import type { BancoCiclo } from '@/dados/db'
import type { ConfigCiclo, ModeloSalvo, Semana, SemanaFechada } from '@/dados/esquemas'
import { novoIdFc } from '@/dados/ids'
import { hoje } from '@/dominio/datas'
import {
  alterarPasso, alternarPasso, aplicarSnapshot, atribuirCores, configPadrao, construirSemana, limparMarcacoes, normalizarConfig, reagendarPendentes,
  resumoSemana, round2, snapshotConfig, temProgresso, validarGerar, type Passo,
} from '@/dominio/ciclo'

export interface Pomo {
  foco: number
  pausa: number
  longa: number
  ate: number
}
export const POMO_PADRAO: Pomo = { foco: 25, pausa: 5, longa: 15, ate: 4 }

/** Tudo que as telas Montar e Semana precisam, lido de uma vez. Sem dados ainda, devolve os padrões. */
export interface Ciclo {
  config: ConfigCiclo
  semana: Semana | null
  cores: Record<string, number>
  pomo: Pomo
  fechadas: SemanaFechada[]
  modelos: ModeloSalvo[]
}

export async function carregarCiclo(db: BancoCiclo): Promise<Ciclo> {
  const [valores, fechadas, modelos] = await Promise.all([db.valores.toArray(), db.semanasFechadas.toArray(), db.modelos.toArray()])
  const v = new Map(valores.map((x) => [x.chave, x.valor]))
  return {
    config: normalizarConfig((v.get('config') as ConfigCiclo | undefined) ?? configPadrao()),
    semana: (v.get('semana') as Semana | null | undefined) ?? null,
    cores: (v.get('cores') as Record<string, number> | undefined) ?? {},
    pomo: { ...POMO_PADRAO, ...(v.get('pomo') as Partial<Pomo> | undefined) },
    fechadas: fechadas.filter((f) => f.excluidoEm === null).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    modelos: modelos.filter((m) => m.excluidoEm === null).sort((a, b) => a.criado - b.criado),
  }
}

const gravar = (db: BancoCiclo, chave: string, valor: unknown, agora: number) => db.valores.put({ chave, valor, atualizadoEm: agora, sujo: 1 })
const TABELAS = (db: BancoCiclo) => [db.valores, db.semanasFechadas, db.modelos, db.sessoes] as const

/** Altera a configuração do ciclo (a função recebe uma cópia e devolve a nova). */
export async function mudarConfig(db: BancoCiclo, fn: (c: ConfigCiclo) => ConfigCiclo, agora = Date.now()): Promise<void> {
  await db.transaction('rw', db.valores, async () => {
    const atual = ((await db.valores.get('config'))?.valor as ConfigCiclo | undefined) ?? configPadrao()
    await gravar(db, 'config', normalizarConfig(fn(structuredClone(normalizarConfig(atual)))), agora)
  })
}

/** Altera a semana em andamento (não faz nada se não houver). */
export async function mudarSemana(db: BancoCiclo, fn: (s: Semana) => Semana, agora = Date.now()): Promise<void> {
  await db.transaction('rw', db.valores, async () => {
    const s = (await db.valores.get('semana'))?.valor as Semana | null | undefined
    if (s) await gravar(db, 'semana', fn(structuredClone(s)), agora)
  })
}

export const marcarPasso = (db: BancoCiclo, id: number, feito: boolean) => mudarSemana(db, (s) => alternarPasso(s, id, feito))
export const editarPasso = (db: BancoCiclo, id: number, m: Partial<Passo>) => mudarSemana(db, (s) => alterarPasso(s, id, m))
export const definirMeta = (db: BancoCiclo, meta: number | null) => mudarSemana(db, (s) => ({ ...s, meta }))

export async function reagendar(db: BancoCiclo, agora = Date.now()): Promise<number> {
  let semDia = 0
  await db.transaction('rw', db.valores, async () => {
    const c = await carregarConfig(db)
    await mudarSemana(db, (s) => {
      const r = reagendarPendentes(s, c, hoje(new Date(agora)))
      semDia = r.passos.filter((p) => !p.feito && !p.dia).length
      return r
    }, agora)
  })
  return semDia
}

async function carregarConfig(db: BancoCiclo): Promise<ConfigCiclo> {
  return normalizarConfig(((await db.valores.get('config'))?.valor as ConfigCiclo | undefined) ?? configPadrao())
}

/** Zera marcações da semana sem guardar estatísticas. */
export async function limparSemana(db: BancoCiclo, agora = Date.now()): Promise<void> {
  const c = await carregarConfig(db)
  await mudarSemana(db, (s) => limparMarcacoes(s, c, hoje(new Date(agora)), agora), agora)
}

export type ResultadoGerar = { ok: true; passosSemDia: number } | { ok: false; erro: string }

/** Gera a semana a partir da montagem. A tela já perguntou se pode substituir a semana atual. */
export async function gerarSemana(db: BancoCiclo, agora = Date.now()): Promise<ResultadoGerar> {
  return db.transaction('rw', db.valores, async () => {
    const c = await carregarConfig(db)
    const v = validarGerar(c)
    if (!v.ok) return v
    const semana = construirSemana(c, hoje(new Date(agora)), agora)
    const cores = atribuirCores(((await db.valores.get('cores'))?.valor as Record<string, number> | undefined) ?? {}, [...new Set(semana.passos.map((p) => p.materia))])
    await gravar(db, 'semana', semana, agora)
    await gravar(db, 'cores', cores, agora)
    return { ok: true as const, passosSemDia: semana.passos.filter((p) => !p.dia).length }
  })
}

/** Dá uma cor a matérias que entraram no ciclo e ainda não têm. */
export async function garantirCores(db: BancoCiclo, nomes: string[], agora = Date.now()): Promise<void> {
  await db.transaction('rw', db.valores, async () => {
    const atual = ((await db.valores.get('cores'))?.valor as Record<string, number> | undefined) ?? {}
    if (nomes.every((n) => atual[n] !== undefined)) return
    await gravar(db, 'cores', atribuirCores(atual, nomes), agora)
  })
}

/**
 * Fecha a semana: guarda o resumo no histórico e então monta a próxima (`nova`: carrega o modelo usado
 * na montagem e apaga a semana) ou apenas limpa as marcações (`limpar`).
 */
export async function fecharSemana(db: BancoCiclo, modo: 'nova' | 'limpar', agora = Date.now()) {
  return db.transaction('rw', TABELAS(db), async () => {
    const s = (await db.valores.get('semana'))?.valor as Semana | null | undefined
    if (!s) throw new Error('Não há semana em andamento.')
    const h = hoje(new Date(agora))
    const r = resumoSemana(s, h, agora)
    await db.semanasFechadas.put({ ...r, id: String(agora), atualizadoEm: agora, excluidoEm: null, sujo: 1 })
    const c = await carregarConfig(db)
    if (modo === 'nova') {
      if (s.modelo) await gravar(db, 'config', aplicarSnapshot(c, s.modelo), agora)
      await gravar(db, 'semana', null, agora)
    } else {
      await gravar(db, 'semana', limparMarcacoes(s, c, h, agora), agora)
    }
    return r
  })
}

export async function excluirSemanaFechada(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const f = await db.semanasFechadas.get(id)
  if (f) await db.semanasFechadas.put({ ...f, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
}

// ---------------------------------------------------------------- modelos

export async function salvarModelo(db: BancoCiclo, nome: string, agora = Date.now()): Promise<'criado' | 'substituido'> {
  return db.transaction('rw', [db.valores, db.modelos], async () => {
    const c = await carregarConfig(db)
    if (!c.mats.length) throw new Error('Adicione ao menos uma matéria ao ciclo antes de salvar como modelo.')
    const todos = (await db.modelos.toArray()).filter((m) => m.excluidoEm === null)
    const n = nome.trim() || `Modelo ${todos.length + 1}`
    const existente = todos.find((m) => m.nome.toLowerCase() === n.toLowerCase())
    const config = snapshotConfig(c)
    if (existente) {
      await db.modelos.put({ ...existente, config, atualizadoEm: agora, sujo: 1 })
      return 'substituido' as const
    }
    await db.modelos.put({ id: novoIdFc('m', agora), nome: n, criado: agora, config, atualizadoEm: agora, excluidoEm: null, sujo: 1 })
    return 'criado' as const
  })
}

export const nomeModeloExiste = async (db: BancoCiclo, nome: string) =>
  (await db.modelos.toArray()).some((m) => m.excluidoEm === null && m.nome.toLowerCase() === nome.trim().toLowerCase())

export async function usarModelo(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const m = await db.modelos.get(id)
  if (!m) return
  await mudarConfig(db, (c) => aplicarSnapshot(c, m.config), agora)
}

export async function atualizarModelo(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const m = await db.modelos.get(id)
  const c = await carregarConfig(db)
  if (!m) return
  if (!c.mats.length) throw new Error('A montagem atual está vazia.')
  await db.modelos.put({ ...m, config: snapshotConfig(c), atualizadoEm: agora, sujo: 1 })
}

export async function renomearModelo(db: BancoCiclo, id: string, nome: string, agora = Date.now()): Promise<void> {
  const m = await db.modelos.get(id)
  if (m && nome.trim()) await db.modelos.put({ ...m, nome: nome.trim(), atualizadoEm: agora, sujo: 1 })
}

export async function excluirModelo(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const m = await db.modelos.get(id)
  if (m) await db.modelos.put({ ...m, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
}

/** Carrega na montagem o ciclo de uma semana já fechada. */
export async function repetirSemanaFechada(db: BancoCiclo, id: string, agora = Date.now()): Promise<boolean> {
  const f = await db.semanasFechadas.get(id)
  if (!f?.modelo) return false
  const modelo = f.modelo
  await mudarConfig(db, (c) => aplicarSnapshot(c, modelo), agora)
  return true
}

export async function voltarAoPadrao(db: BancoCiclo, agora = Date.now()): Promise<void> {
  await gravar(db, 'config', normalizarConfig(configPadrao()), agora)
}

// ---------------------------------------------------------------- Pomodoro → horas do passo

export interface RegistroTempo {
  passoId: number
  minutos: number
  tipo: string
  assuntoId: string | null
  feito: boolean
}

/** Soma o tempo de um foco a um passo da semana e guarda a sessão (para o Desempenho). */
export async function registrarTempo(db: BancoCiclo, r: RegistroTempo, agora = Date.now()): Promise<void> {
  await db.transaction('rw', [db.valores, db.sessoes], async () => {
    const s = (await db.valores.get('semana'))?.valor as Semana | null | undefined
    const p = s?.passos.find((x) => x.id === r.passoId)
    if (!s || !p) return
    const novo: Semana = {
      ...s,
      passos: s.passos.map((x) => (x.id === r.passoId ? { ...x, horasFeitas: round2(x.horasFeitas + r.minutos / 60), feito: r.feito ? true : x.feito } : x)),
    }
    await gravar(db, 'semana', novo, agora)
    await db.sessoes.put({
      id: novoIdFc('s', agora), data: hoje(new Date(agora)), materia: p.materia, assuntoId: r.assuntoId, minutos: r.minutos, tipo: r.tipo,
      atualizadoEm: agora, excluidoEm: null, sujo: 1,
    })
  })
}

/** Conta um pomodoro concluído na semana em andamento. */
export async function contarPomodoro(db: BancoCiclo, agora = Date.now()): Promise<void> {
  await mudarSemana(db, (s) => ({ ...s, pomodoros: (s.pomodoros || 0) + 1 }), agora)
}

export async function salvarPomo(db: BancoCiclo, pomo: Pomo, agora = Date.now()): Promise<void> {
  await gravar(db, 'pomo', pomo, agora)
}

export { temProgresso }
