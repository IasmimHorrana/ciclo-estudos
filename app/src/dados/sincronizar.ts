import type { Table } from 'dexie'
import type { BancoCiclo } from '@/dados/db'
import {
  avancarCursor, campoChave, COLECOES, decidir, deNuvem, emLotesPorTamanho, inicioDaBusca, medirDesvio, paraNuvem, podeLimparSujo,
  precisaAtualizar, primeiraSincronizacao, type Colecao, type RegistroLocal, type RegistroNuvem, type RegistroParaEnviar,
} from '@/dominio/sincronia'

/**
 * Motor da sincronização (etapa 5.4): envia o que mudou neste aparelho e recebe o que mudou nos outros.
 * Não conhece o Supabase: fala com um `Servidor` (o de verdade está em `servidor-supabase.ts`; os testes usam um falso).
 * As regras de decisão são as de `dominio/sincronia.ts`.
 */
export interface Servidor {
  /** Hora do servidor em ms. */
  agora(): Promise<number>
  /** Versão mínima dos dados que a nuvem aceita. */
  versaoMinima(): Promise<number>
  /** A conta já tem algum registro na nuvem? */
  temRegistros(): Promise<boolean>
  /** Grava (insere ou atualiza) os registros; o servidor recusa sozinho edições mais velhas. */
  enviar(lote: RegistroParaEnviar[]): Promise<void>
  /** Registros gravados no servidor depois de `desdeMs`, em ordem, a partir de `deslocamento`. */
  buscar(desdeMs: number, deslocamento: number, limite: number): Promise<RegistroNuvem[]>
  /** Anota que este aparelho sincronizou agora. */
  marcarAparelho(id: string, nome: string, agoraServidor: number): Promise<void>
}

/** Primeira vez com os dois lados cheios: juntar (vale a edição mais recente) ou ficar só com a nuvem. */
export type EscolhaPrimeira = 'juntar' | 'nuvem'

export interface OpcoesSincronia {
  /** Conta logada: cada conta tem o seu cursor neste aparelho. */
  usuarioId: string
  aparelho: { id: string; nome: string }
  /** Chamado antes da primeira sincronização se este aparelho tem dados (o app baixa um backup .json). */
  antesDaPrimeira?: () => Promise<void>
  /** Chamado quando este aparelho e a nuvem já têm dados. `null` = ela cancelou (nada é feito). */
  perguntar?: () => Promise<EscolhaPrimeira | null>
  /** Relógio deste aparelho (troca nos testes). */
  relogio?: () => number
}

export type ResultadoSincronia =
  | { tipo: 'ok'; enviados: number; recebidos: number; aplicados: number; desvio: number; primeira: boolean }
  | { tipo: 'cancelado' }
  | { tipo: 'atualize' }

export const TAMANHO_PAGINA = 500
const LOTE_MAX_ITENS = 200
const LOTE_MAX_BYTES = 1_500_000

interface EstadoNoAparelho {
  cursor: number
  primeiraFeita: boolean
}

const chaveEstado = (usuarioId: string) => `sincronia:${usuarioId}`
const tabela = (db: BancoCiclo, c: Colecao) => db.table(c) as Table<RegistroLocal, string>
const chaveDe = (c: Colecao, id: string) => `${c}/${id}`

async function lerEstado(db: BancoCiclo, usuarioId: string): Promise<EstadoNoAparelho> {
  const v = (await db.local.get(chaveEstado(usuarioId)))?.valor as Partial<EstadoNoAparelho> | undefined
  return { cursor: typeof v?.cursor === 'number' ? v.cursor : 0, primeiraFeita: v?.primeiraFeita === true }
}
const gravarEstado = (db: BancoCiclo, usuarioId: string, e: EstadoNoAparelho) => db.local.put({ chave: chaveEstado(usuarioId), valor: e })

/** Este aparelho tem dados dela (não só os padrões de fábrica)? */
export async function temDadosAqui(db: BancoCiclo): Promise<boolean> {
  if (await db.valores.get('config')) return true
  const vivo = (x: { excluidoEm?: number | null }) => !x.excluidoEm
  for (const t of [db.cartoes, db.notasFc, db.baralhos, db.notas, db.assuntos, db.questoes, db.sessoes] as unknown as Table<RegistroLocal, string>[]) {
    if ((await t.filter(vivo).count()) > 0) return true
  }
  return false
}

/** Marca tudo para enviar (primeira vez), sem mudar a hora de edição de nada. Os padrões de fábrica (hora 0) ficam de fora. */
async function marcarTudoParaEnviar(db: BancoCiclo): Promise<void> {
  for (const c of COLECOES) {
    await tabela(db, c).toCollection().modify((r) => {
      if (r.atualizadoEm > 0) r.sujo = 1
    })
  }
}

/** Quantas mudanças deste aparelho ainda não foram para a nuvem. */
export async function contarPendentes(db: BancoCiclo): Promise<number> {
  let n = 0
  for (const c of COLECOES) n += await tabela(db, c).where('sujo').equals(1).count()
  return n
}

/** Envia tudo que está "sujo". Devolve o que foi enviado (chave → hora de edição), para não reaplicar ao receber. */
async function enviarPendentes(db: BancoCiclo, srv: Servidor, desvio: number): Promise<Map<string, number>> {
  const enviados = new Map<string, number>()
  for (const c of COLECOES) {
    const t = tabela(db, c)
    const sujos = await t.where('sujo').equals(1).toArray()
    if (!sujos.length) continue
    const horaLocal = new Map<string, number>()
    const linhas = sujos.map((r) => {
      const n = paraNuvem(c, r, desvio)
      horaLocal.set(n.id, r.atualizadoEm)
      return n
    })
    for (const lote of emLotesPorTamanho(linhas, (x) => JSON.stringify(x.dados).length + 200, LOTE_MAX_BYTES, LOTE_MAX_ITENS)) {
      await srv.enviar(lote)
      await db.transaction('rw', t, async () => {
        for (const r of lote) {
          const atual = await t.get(r.id)
          // só marca como enviado se não mudou durante o envio (senão a edição do meio iria ficar para trás)
          if (podeLimparSujo(horaLocal.get(r.id) as number, atual)) await t.update(r.id, { sujo: 0 })
        }
      })
      for (const r of lote) enviados.set(chaveDe(c, r.id), r.editadoEm)
    }
  }
  return enviados
}

const ehColecao = (x: unknown): x is Colecao => typeof x === 'string' && (COLECOES as readonly string[]).includes(x)

/** Recebe o que mudou na nuvem e aplica o que vence. Com `forcar`, aplica tudo (escolha "ficar com a nuvem"). */
async function receber(
  db: BancoCiclo, srv: Servidor, desvio: number, cursor: number, enviados: Map<string, number>, forcar: boolean,
): Promise<{ cursor: number; recebidos: number; aplicados: number; vistos: Set<string> }> {
  const desde = inicioDaBusca(cursor)
  let novo = cursor
  let deslocamento = 0
  let recebidos = 0
  let aplicados = 0
  const vistos = new Set<string>()
  for (;;) {
    const pagina = await srv.buscar(desde, deslocamento, TAMANHO_PAGINA)
    recebidos += pagina.length
    const porColecao = new Map<Colecao, RegistroNuvem[]>()
    for (const r of pagina) {
      if (!ehColecao(r.colecao) || !r.dados || typeof r.dados !== 'object') continue // linha estranha: ignora
      vistos.add(chaveDe(r.colecao, r.id))
      if (!forcar && enviados.get(chaveDe(r.colecao, r.id)) === r.editadoEm) continue // é o que acabei de enviar
      porColecao.set(r.colecao, [...(porColecao.get(r.colecao) ?? []), r])
    }
    for (const [c, linhas] of porColecao) {
      const t = tabela(db, c)
      await db.transaction('rw', t, async () => {
        for (const r of linhas) {
          const local = await t.get(r.id)
          if (forcar || decidir(c, local, r, desvio) === 'aplicar') {
            await t.put({ ...deNuvem(r, desvio), [campoChave(c)]: r.id })
            aplicados++
          }
        }
      })
    }
    novo = avancarCursor(novo, pagina)
    deslocamento += pagina.length
    if (pagina.length < TAMANHO_PAGINA) break
  }
  return { cursor: novo, recebidos, aplicados, vistos }
}

/**
 * "Ficar com a nuvem" na primeira vez: o que só existia neste aparelho sai daqui (marcado como excluído e sem enviar,
 * para não apagar nada na nuvem). Os padrões de fábrica e os valores avulsos ficam.
 */
async function descartarSoDoAparelho(db: BancoCiclo, vistos: Set<string>, agora: number): Promise<void> {
  for (const c of COLECOES) {
    if (c === 'valores') continue
    const t = tabela(db, c)
    await t.toCollection().modify((r) => {
      const id = r[campoChave(c)] as string
      if (!vistos.has(chaveDe(c, id)) && !r.excluidoEm && r.atualizadoEm > 0) {
        r.excluidoEm = agora
        r.sujo = 0
      }
    })
  }
}

let emAndamento: Promise<ResultadoSincronia> | null = null

/** Uma sincronização completa (só uma por vez: se já houver uma rodando, devolve a mesma). */
export function sincronizarAgora(db: BancoCiclo, srv: Servidor, op: OpcoesSincronia): Promise<ResultadoSincronia> {
  emAndamento ??= sincronizar(db, srv, op).finally(() => {
    emAndamento = null
  })
  return emAndamento
}

async function sincronizar(db: BancoCiclo, srv: Servidor, op: OpcoesSincronia): Promise<ResultadoSincronia> {
  const relogio = op.relogio ?? Date.now
  const antes = relogio()
  const servidor = await srv.agora()
  const desvio = medirDesvio(antes, relogio(), servidor)

  if (precisaAtualizar(await srv.versaoMinima())) return { tipo: 'atualize' }

  const estado = await lerEstado(db, op.usuarioId)
  let forcar = false
  const primeira = !estado.primeiraFeita
  if (primeira) {
    const aqui = await temDadosAqui(db)
    const plano = primeiraSincronizacao(aqui, await srv.temRegistros())
    if (aqui) await op.antesDaPrimeira?.()
    if (plano === 'perguntar') {
      const escolha = (await op.perguntar?.()) ?? null
      if (!escolha) return { tipo: 'cancelado' }
      if (escolha === 'juntar') await marcarTudoParaEnviar(db)
      else forcar = true
    } else if (plano === 'enviar') {
      await marcarTudoParaEnviar(db)
    }
    estado.cursor = 0
  }

  let enviados = new Map<string, number>()
  if (forcar) {
    // ficar com a nuvem: o que estava pendente aqui não sobe
    for (const c of COLECOES) await tabela(db, c).where('sujo').equals(1).modify({ sujo: 0 })
  } else {
    enviados = await enviarPendentes(db, srv, desvio)
  }

  const r = await receber(db, srv, desvio, estado.cursor, enviados, forcar)
  if (forcar) await descartarSoDoAparelho(db, r.vistos, relogio())

  await gravarEstado(db, op.usuarioId, { cursor: r.cursor, primeiraFeita: true })
  await srv.marcarAparelho(op.aparelho.id, op.aparelho.nome, relogio() + desvio)
  return { tipo: 'ok', enviados: enviados.size, recebidos: r.recebidos, aplicados: r.aplicados, desvio, primeira }
}
