import type { BancoCiclo } from '@/dados/db'
import { novoIdFc } from '@/dados/ids'
import { carregarDados } from '@/dados/repositorio'
import type { Controle } from '@/dados/esquemas'
import type { Baralho, CartaoFc, GrupoOpcoes, NotaFc, RegistroRevisao, TipoNota } from '@/dados/flashcards-tipos'
import {
  dentroDe, irmaosParaEnterrar, montarFila, OPCOES_BARALHO_PADRAO, usoDoDia,
  type BaralhoFila, type CartaoNaFila, type Fila, type OpcoesBaralho,
} from '@/dominio/fila'
import { indicesDeCartoes, TIPOS_DE_FABRICA, type Campos } from '@/dominio/modelo'
import { novoCartao, numeroDoDia, responder, type Botao, type EstadoCartao } from '@/dominio/sm2'

export const GRUPO_PADRAO = 'padrao'

const novo = (agora: number): Controle => ({ atualizadoEm: agora, excluidoEm: null, sujo: 1 })
const alea = () => Math.random().toString(36).slice(2, 8)
export { novoIdFc }

/** Um nível do nome não pode ter ":" (o separador de níveis é "::"). */
const limparNivel = (n: string) => n.replace(/:+/g, ' ').replace(/\s+/g, ' ').trim()
/** "A :: B" → "A::B"; níveis vazios somem. Devolve "" se não sobrar nada. */
export const normalizarNomeBaralho = (n: string) => n.split('::').map(limparNivel).filter(Boolean).join('::')

/** Opções efetivas do baralho: as padrão + o que o grupo definiu (assim opções novas nunca faltam). */
export const opcoesDoGrupo = (g: GrupoOpcoes | undefined): OpcoesBaralho => ({ ...OPCOES_BARALHO_PADRAO, ...g?.opcoes })

// ---------------------------------------------------------------- padrões e baralhos

/** Cria (sem sobrescrever) o grupo de opções padrão e os tipos de nota de fábrica. */
export async function garantirPadroes(db: BancoCiclo, agora = Date.now()): Promise<void> {
  await db.transaction('rw', [db.gruposOpcoes, db.tiposNota], async () => {
    if (!(await db.gruposOpcoes.get(GRUPO_PADRAO))) {
      await db.gruposOpcoes.put({ id: GRUPO_PADRAO, nome: 'Padrão', opcoes: OPCOES_BARALHO_PADRAO, ...novo(agora) })
    }
    for (const t of TIPOS_DE_FABRICA) {
      if (!(await db.tiposNota.get(t.id))) await db.tiposNota.put({ ...t, ...novo(agora) })
    }
  })
}

/**
 * Cria os baralhos das matérias e dos assuntos do ciclo ("Matéria" e "Matéria::Assunto"). Só acrescenta:
 * não renomeia nem recria o que foi excluído de propósito. Devolve quantos baralhos criou.
 */
export async function sincronizarBaralhos(db: BancoCiclo, agora = Date.now()): Promise<number> {
  const d = await carregarDados(db)
  if (!d) return 0
  const materias = new Set<string>()
  for (const m of d.config.mats) materias.add(m.nome)
  for (const m of d.config.custom) materias.add(m)
  for (const x of [...d.assuntos, ...d.notas]) if (x.materia) materias.add(x.materia)

  const precisa: { id: string; nome: string; origem: Baralho['origem'] }[] = []
  for (const m of materias) {
    const nm = limparNivel(m)
    if (nm) precisa.push({ id: `mat:${m}`, nome: nm, origem: 'materia' })
  }
  for (const a of d.assuntos) {
    const nm = limparNivel(a.materia)
    const na = limparNivel(a.nome)
    if (nm && na) precisa.push({ id: `ass:${a.id}`, nome: `${nm}::${na}`, origem: 'assunto' })
  }

  let criados = 0
  await db.transaction('rw', db.baralhos, async () => {
    const existentes = new Set((await db.baralhos.toArray()).map((b) => b.id)) // inclui os excluídos
    for (const p of precisa) {
      if (existentes.has(p.id)) continue
      await db.baralhos.put({ ...p, grupoId: GRUPO_PADRAO, criadoEm: agora, ...novo(agora) })
      criados++
    }
  })
  return criados
}

export async function criarBaralho(db: BancoCiclo, nome: string, agora = Date.now()): Promise<Baralho> {
  const n = normalizarNomeBaralho(nome)
  if (!n) throw new Error('Dê um nome ao baralho.')
  const b: Baralho = { id: novoIdFc('b', agora), nome: n, grupoId: GRUPO_PADRAO, origem: 'manual', criadoEm: agora, ...novo(agora) }
  await db.transaction('rw', db.baralhos, async () => {
    if ((await db.baralhos.toArray()).some((x) => x.excluidoEm === null && x.nome.toLowerCase() === n.toLowerCase())) {
      throw new Error('Já existe um baralho com esse nome.')
    }
    await db.baralhos.put(b)
  })
  return b
}

/** Renomeia o baralho e também os filhos ("A::B" → "C::B"). */
export async function renomearBaralho(db: BancoCiclo, id: string, nomeNovo: string, agora = Date.now()): Promise<void> {
  const n = normalizarNomeBaralho(nomeNovo)
  if (!n) throw new Error('Dê um nome ao baralho.')
  await db.transaction('rw', db.baralhos, async () => {
    const todos = (await db.baralhos.toArray()).filter((b) => b.excluidoEm === null)
    const alvo = todos.find((b) => b.id === id)
    if (!alvo) return
    if (todos.some((b) => b.id !== id && b.nome.toLowerCase() === n.toLowerCase())) throw new Error('Já existe um baralho com esse nome.')
    for (const b of todos.filter((x) => dentroDe(x.nome, alvo.nome))) {
      await db.baralhos.put({ ...b, nome: n + b.nome.slice(alvo.nome.length), atualizadoEm: agora, sujo: 1 })
    }
  })
}

/** Exclui o baralho, os filhos e tudo que há dentro (notas e cartões). Nada é apagado de verdade. */
export async function excluirBaralho(db: BancoCiclo, id: string, agora = Date.now()): Promise<number> {
  let cartoes = 0
  await db.transaction('rw', [db.baralhos, db.notasFc, db.cartoes], async () => {
    const todos = (await db.baralhos.toArray()).filter((b) => b.excluidoEm === null)
    const alvo = todos.find((b) => b.id === id)
    if (!alvo) return
    const ids = new Set(todos.filter((b) => dentroDe(b.nome, alvo.nome)).map((b) => b.id))
    for (const b of todos.filter((x) => ids.has(x.id))) await db.baralhos.put({ ...b, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
    for (const c of (await db.cartoes.toArray()).filter((x) => x.excluidoEm === null && ids.has(x.baralhoId))) {
      await db.cartoes.put({ ...c, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
      cartoes++
    }
    for (const n of (await db.notasFc.toArray()).filter((x) => x.excluidoEm === null && ids.has(x.baralhoId))) {
      await db.notasFc.put({ ...n, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
    }
  })
  return cartoes
}

// ---------------------------------------------------------------- notas e cartões

function cartoesNovos(nota: NotaFc, tipo: TipoNota, jaTem: Set<number>, agora: number): CartaoFc[] {
  const opcoes = OPCOES_BARALHO_PADRAO
  return indicesDeCartoes(tipo, nota.campos)
    .filter((i) => !jaTem.has(i))
    .map((i, k) => ({
      id: novoIdFc('c', agora),
      notaId: nota.id,
      baralhoId: nota.baralhoId,
      indice: i,
      flag: 0,
      criadoEm: agora,
      ...novoCartao(agora * 100 + i + k, opcoes), // cartões novos aparecem na ordem em que foram criados
      ...novo(agora),
    }))
}

export interface DadosNota {
  tipoId: string
  baralhoId: string
  campos: Campos
  tags?: string[]
}

/** Adiciona uma nota e gera seus cartões. Lança `Error` (em português) se não gerar nenhum. */
export async function adicionarNota(db: BancoCiclo, d: DadosNota, agora = Date.now()): Promise<{ nota: NotaFc; cartoes: CartaoFc[] }> {
  return db.transaction('rw', [db.tiposNota, db.baralhos, db.notasFc, db.cartoes], async () => {
    const tipo = await db.tiposNota.get(d.tipoId)
    if (!tipo) throw new Error('Tipo de nota não encontrado.')
    const baralho = await db.baralhos.get(d.baralhoId)
    if (!baralho || baralho.excluidoEm !== null) throw new Error('Escolha um baralho.')
    const nota: NotaFc = {
      id: novoIdFc('n', agora), tipoId: d.tipoId, baralhoId: d.baralhoId, campos: d.campos,
      tags: [...new Set((d.tags ?? []).map((t) => t.trim()).filter(Boolean))], criadoEm: agora, ...novo(agora),
    }
    const cartoes = cartoesNovos(nota, tipo, new Set(), agora)
    if (!cartoes.length) {
      throw new Error(tipo.cloze ? 'Coloque ao menos uma omissão {{c1::texto}}.' : 'Preencha a frente do cartão.')
    }
    await db.notasFc.put(nota)
    await db.cartoes.bulkPut(cartoes)
    return { nota, cartoes }
  })
}

/** Edita os campos/tags/baralho da nota. Cria cartões que passaram a existir (ex.: nova omissão c2); não apaga nenhum. */
export async function atualizarNota(db: BancoCiclo, id: string, mudancas: Partial<Pick<NotaFc, 'campos' | 'tags' | 'baralhoId'>>, agora = Date.now()): Promise<void> {
  await db.transaction('rw', [db.tiposNota, db.notasFc, db.cartoes], async () => {
    const atual = await db.notasFc.get(id)
    if (!atual || atual.excluidoEm !== null) throw new Error('Nota não encontrada.')
    const nota: NotaFc = { ...atual, ...mudancas, atualizadoEm: agora, sujo: 1 }
    const tipo = await db.tiposNota.get(nota.tipoId)
    if (!tipo) throw new Error('Tipo de nota não encontrado.')
    const meus = await db.cartoes.where('notaId').equals(id).toArray()
    await db.notasFc.put(nota)
    if (mudancas.baralhoId && mudancas.baralhoId !== atual.baralhoId) {
      for (const c of meus.filter((x) => x.excluidoEm === null)) {
        await db.cartoes.put({ ...c, baralhoId: mudancas.baralhoId, atualizadoEm: agora, sujo: 1 })
      }
    }
    const jaTem = new Set(meus.filter((c) => c.excluidoEm === null).map((c) => c.indice))
    await db.cartoes.bulkPut(cartoesNovos(nota, tipo, jaTem, agora))
  })
}

export async function excluirNota(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  await db.transaction('rw', [db.notasFc, db.cartoes], async () => {
    const n = await db.notasFc.get(id)
    if (n && n.excluidoEm === null) await db.notasFc.put({ ...n, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
    for (const c of await db.cartoes.where('notaId').equals(id).toArray()) {
      if (c.excluidoEm === null) await db.cartoes.put({ ...c, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
    }
  })
}

// ---------------------------------------------------------------- fila e estudo

const estadoDe = (c: CartaoFc): EstadoCartao => ({
  tipo: c.tipo, ordem: c.ordem, passo: c.passo, intervalo: c.intervalo, facilidade: c.facilidade, lapsos: c.lapsos,
  repeticoes: c.repeticoes, venceMs: c.venceMs, venceDia: c.venceDia, suspenso: c.suspenso, enterradoAte: c.enterradoAte,
})
const paraFila = (c: CartaoFc): CartaoNaFila => ({ id: c.id, baralhoId: c.baralhoId, notaId: c.notaId, estado: estadoDe(c) })

export interface ContextoEstudo {
  baralhos: Baralho[]
  baralhosFila: BaralhoFila[]
  /** Cartões que podem aparecer hoje (novos, em aprendizado e revisões vencidas). */
  cartoes: CartaoFc[]
  hoje: number
  agora: number
  uso: ReturnType<typeof usoDoDia>
}

/** Lê do banco o que é preciso para montar filas. */
export async function carregarContexto(db: BancoCiclo, agora = Date.now(), virada = 4): Promise<ContextoEstudo> {
  const hoje = numeroDoDia(agora, virada)
  const [baralhos, grupos, candidatos, logsHoje] = await Promise.all([
    db.baralhos.toArray(),
    db.gruposOpcoes.toArray(),
    db.cartoes.filter((c) => c.excluidoEm === null && !c.suspenso && (c.tipo !== 'revisao' || c.venceDia <= hoje)).toArray(),
    db.revlog.where('dia').equals(hoje).toArray(),
  ])
  const vivos = baralhos.filter((b) => b.excluidoEm === null)
  const porGrupo = new Map(grupos.map((g) => [g.id, g]))
  return {
    baralhos: vivos,
    baralhosFila: vivos.map((b) => ({ id: b.id, nome: b.nome, opcoes: opcoesDoGrupo(porGrupo.get(b.grupoId)) })),
    cartoes: candidatos,
    hoje,
    agora,
    uso: usoDoDia(logsHoje, hoje),
  }
}

export function filaDe(ctx: ContextoEstudo, raizId: string | null): Fila {
  return montarFila(ctx.baralhosFila, ctx.cartoes.map(paraFila), raizId, ctx.uso, ctx.agora, ctx.hoje)
}

export interface Desfazer {
  cartaoAntes: CartaoFc
  logId: string
  irmaosAntes: CartaoFc[]
  notaAntes: NotaFc | null
}

/** Grava a resposta: novo estado do cartão, linha no histórico e (se for o caso) enterra irmãos / marca sanguessuga. */
export async function responderCartao(
  db: BancoCiclo,
  cartaoId: string,
  botao: Botao,
  tempoMs: number,
  agora = Date.now(),
  rand: (() => number) | null = Math.random,
  virada = 4,
): Promise<Desfazer> {
  return db.transaction('rw', [db.cartoes, db.notasFc, db.baralhos, db.gruposOpcoes, db.revlog], async () => {
    const c = await db.cartoes.get(cartaoId)
    if (!c || c.excluidoEm !== null) throw new Error('Cartão não encontrado.')
    const baralho = await db.baralhos.get(c.baralhoId)
    const opcoes = opcoesDoGrupo(baralho ? await db.gruposOpcoes.get(baralho.grupoId) : undefined)
    const hoje = numeroDoDia(agora, virada)

    const r = responder(estadoDe(c), botao, opcoes, agora, hoje, rand)
    const novoC: CartaoFc = { ...c, ...r.cartao, atualizadoEm: agora, sujo: 1 }
    const logId = `${agora.toString(36)}${alea()}`
    const log: RegistroRevisao = {
      id: logId, cartaoId, baralhoId: c.baralhoId, dia: hoje, instante: agora, botao, tipoLog: r.log.tipoLog, estadoAntes: r.log.estadoAntes,
      intervaloAntes: r.log.intervaloAntes, intervaloDepois: r.log.intervaloDepois, facilidade: r.log.facilidade, tempoMs,
      atualizadoEm: agora, sujo: 1,
    }
    await db.cartoes.put(novoC)
    await db.revlog.put(log)

    let irmaosAntes: CartaoFc[] = []
    if (opcoes.enterrarIrmaos) {
      const todos = (await db.cartoes.where('notaId').equals(c.notaId).toArray()).filter((x) => x.excluidoEm === null)
      const ids = new Set(irmaosParaEnterrar(todos.map(paraFila), paraFila(c)))
      irmaosAntes = todos.filter((x) => ids.has(x.id))
      for (const s of irmaosAntes) await db.cartoes.put({ ...s, enterradoAte: hoje + 1, atualizadoEm: agora, sujo: 1 })
    }

    let notaAntes: NotaFc | null = null
    if (r.log.sanguessuga) {
      const n = await db.notasFc.get(c.notaId)
      if (n && !n.tags.includes('leech')) {
        notaAntes = n
        await db.notasFc.put({ ...n, tags: [...n.tags, 'leech'], atualizadoEm: agora, sujo: 1 })
      }
    }
    return { cartaoAntes: c, logId, irmaosAntes, notaAntes }
  })
}

/** Desfaz a última resposta (cartão, irmãos, tag de sanguessuga e linha do histórico). */
export async function desfazerResposta(db: BancoCiclo, d: Desfazer, agora = Date.now()): Promise<void> {
  await db.transaction('rw', [db.cartoes, db.notasFc, db.revlog], async () => {
    await db.cartoes.put({ ...d.cartaoAntes, atualizadoEm: agora, sujo: 1 })
    for (const s of d.irmaosAntes) await db.cartoes.put({ ...s, atualizadoEm: agora, sujo: 1 })
    if (d.notaAntes) await db.notasFc.put({ ...d.notaAntes, atualizadoEm: agora, sujo: 1 })
    await db.revlog.delete(d.logId)
  })
}

// ---------------------------------------------------------------- opções

export async function salvarOpcoes(db: BancoCiclo, grupoId: string, opcoes: OpcoesBaralho, agora = Date.now()): Promise<void> {
  const g = await db.gruposOpcoes.get(grupoId)
  if (!g) throw new Error('Grupo de opções não encontrado.')
  await db.gruposOpcoes.put({ ...g, opcoes, atualizadoEm: agora, sujo: 1 })
}

// ---------------------------------------------------------------- ações rápidas do estudo

/** Cartões vivos de uma nota (ou só o cartão, conforme o escopo). */
async function alvos(db: BancoCiclo, cartaoId: string, escopo: 'cartao' | 'nota'): Promise<CartaoFc[]> {
  const c = await db.cartoes.get(cartaoId)
  if (!c || c.excluidoEm !== null) return []
  if (escopo === 'cartao') return [c]
  return (await db.cartoes.where('notaId').equals(c.notaId).toArray()).filter((x) => x.excluidoEm === null)
}

/** Suspende (ou volta a ativar) o cartão ou a nota inteira. */
export async function suspender(db: BancoCiclo, cartaoId: string, escopo: 'cartao' | 'nota', suspenso = true, agora = Date.now()): Promise<void> {
  await db.transaction('rw', db.cartoes, async () => {
    for (const c of await alvos(db, cartaoId, escopo)) await db.cartoes.put({ ...c, suspenso, atualizadoEm: agora, sujo: 1 })
  })
}

/** Esconde o cartão (ou a nota) até amanhã. */
export async function enterrar(db: BancoCiclo, cartaoId: string, escopo: 'cartao' | 'nota', agora = Date.now(), virada = 4): Promise<void> {
  const amanha = numeroDoDia(agora, virada) + 1
  await db.transaction('rw', db.cartoes, async () => {
    for (const c of await alvos(db, cartaoId, escopo)) await db.cartoes.put({ ...c, enterradoAte: amanha, atualizadoEm: agora, sujo: 1 })
  })
}

/** Liga/desliga a marca (tag "marked") da nota do cartão. Devolve se ficou marcada. */
export async function alternarMarca(db: BancoCiclo, notaId: string, agora = Date.now()): Promise<boolean> {
  const n = await db.notasFc.get(notaId)
  if (!n) return false
  const marcada = n.tags.includes('marked')
  await db.notasFc.put({ ...n, tags: marcada ? n.tags.filter((t) => t !== 'marked') : [...n.tags, 'marked'], atualizadoEm: agora, sujo: 1 })
  return !marcada
}

/** Bandeira de 0 (nenhuma) a 7; repetir a mesma bandeira a remove, como no Anki. */
export async function definirBandeira(db: BancoCiclo, cartaoId: string, flag: number, agora = Date.now()): Promise<void> {
  const c = await db.cartoes.get(cartaoId)
  if (c) await db.cartoes.put({ ...c, flag: c.flag === flag ? 0 : flag, atualizadoEm: agora, sujo: 1 })
}

/** Cartões estudados e tempo gasto por dia (número do dia), para o calendário de calor. */
export async function estudoPorDia(db: BancoCiclo): Promise<{ cartoes: Map<number, number>; tempoMs: Map<number, number> }> {
  const cartoes = new Map<number, number>()
  const tempoMs = new Map<number, number>()
  await db.revlog.each((r) => {
    cartoes.set(r.dia, (cartoes.get(r.dia) ?? 0) + 1)
    tempoMs.set(r.dia, (tempoMs.get(r.dia) ?? 0) + r.tempoMs)
  })
  return { cartoes, tempoMs }
}
