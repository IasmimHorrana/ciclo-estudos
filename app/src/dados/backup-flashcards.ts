import { z } from 'zod'
import type { BancoCiclo } from '@/dados/db'
import type { Controle } from '@/dados/esquemas'
import type { Baralho, CartaoFc, GrupoOpcoes, NotaFc, RegistroRevisao, TipoNota } from '@/dados/flashcards-tipos'

/**
 * Flashcards no arquivo de backup (chave `flashcards`). Leva baralhos, opções, tipos de nota, notas
 * (com as imagens, que ficam dentro dos campos), cartões e o histórico de respostas.
 *
 * Os esquemas conferem só os campos de que o app depende e guardam o resto como veio (`looseObject`):
 * assim um campo novo ou com outro tipo não é descartado em silêncio. Se um campo essencial estiver
 * errado, a importação para inteira com uma mensagem, em vez de restaurar só uma parte.
 */
export interface Flashcards {
  baralhos: Baralho[]
  gruposOpcoes: GrupoOpcoes[]
  tiposNota: TipoNota[]
  notas: NotaFc[]
  cartoes: CartaoFc[]
  revlog: RegistroRevisao[]
}

const id = z.string().min(1)
const n = z.number()

const BaralhoArq = z.looseObject({ id, nome: z.string(), grupoId: z.string() })
const GrupoArq = z.looseObject({ id, nome: z.string(), opcoes: z.looseObject({}) })
const TipoArq = z.looseObject({ id, nome: z.string(), campos: z.array(z.string()), modelos: z.array(z.looseObject({})) })
const NotaArq = z.looseObject({ id, tipoId: z.string(), baralhoId: z.string(), campos: z.record(z.string(), z.string()), tags: z.array(z.string()) })
const CartaoArq = z.looseObject({
  id,
  notaId: z.string(),
  baralhoId: z.string(),
  indice: n,
  tipo: z.enum(['novo', 'aprendendo', 'revisao', 'reaprendendo']),
  intervalo: n,
  facilidade: n,
  venceMs: n,
  venceDia: n,
})
const RevlogArq = z.looseObject({ id, cartaoId: z.string(), baralhoId: z.string(), dia: n, instante: n, botao: n })

const FlashcardsArq = z.object({
  baralhos: z.array(BaralhoArq),
  gruposOpcoes: z.array(GrupoArq),
  tiposNota: z.array(TipoArq),
  notas: z.array(NotaArq),
  cartoes: z.array(CartaoArq),
  revlog: z.array(RevlogArq),
})

const NOMES: Record<keyof Flashcards, string> = {
  baralhos: 'baralhos',
  gruposOpcoes: 'opções de baralho',
  tiposNota: 'tipos de nota',
  notas: 'notas dos flashcards',
  cartoes: 'cartões',
  revlog: 'histórico de respostas',
}

/** Lê a parte `flashcards` de um backup já convertido de JSON. Devolve `null` se o arquivo não tem flashcards (backup antigo). */
export function lerFlashcards(o: Record<string, unknown>, agora: number): Flashcards | null {
  if (o.flashcards === undefined || o.flashcards === null) return null
  const r = FlashcardsArq.safeParse(o.flashcards)
  if (!r.success) {
    const onde = r.error.issues[0]?.path[0]
    const parte = typeof onde === 'string' && onde in NOMES ? ` (${NOMES[onde as keyof Flashcards]})` : ''
    throw new Error(`Os flashcards deste backup estão com defeito${parte}. Nada foi importado.`)
  }
  const ctl = (): Controle => ({ atualizadoEm: agora, excluidoEm: null, sujo: 1 })
  const f = r.data
  return {
    baralhos: f.baralhos.map((x) => ({ ...x, ...ctl() }) as unknown as Baralho),
    gruposOpcoes: f.gruposOpcoes.map((x) => ({ ...x, ...ctl() }) as unknown as GrupoOpcoes),
    tiposNota: f.tiposNota.map((x) => ({ ...x, ...ctl() }) as unknown as TipoNota),
    notas: f.notas.map((x) => ({ ...x, ...ctl() }) as unknown as NotaFc),
    cartoes: f.cartoes.map((x) => ({ ...x, ...ctl() }) as unknown as CartaoFc),
    revlog: f.revlog.map((x) => ({ ...x, ...ctl() }) as unknown as RegistroRevisao),
  }
}

const vivos = <T extends { excluidoEm: number | null }>(l: T[]) => l.filter((x) => x.excluidoEm === null)

/** Tudo dos flashcards que está vivo (o histórico sem as respostas desfeitas). */
export async function carregarFlashcards(db: BancoCiclo): Promise<Flashcards> {
  const [baralhos, gruposOpcoes, tiposNota, notas, cartoes, revlog] = await Promise.all([
    db.baralhos.toArray(),
    db.gruposOpcoes.toArray(),
    db.tiposNota.toArray(),
    db.notasFc.toArray(),
    db.cartoes.toArray(),
    db.revlog.toArray(),
  ])
  return {
    baralhos: vivos(baralhos),
    gruposOpcoes: vivos(gruposOpcoes),
    tiposNota: vivos(tiposNota),
    notas: vivos(notas),
    cartoes: vivos(cartoes),
    revlog: revlog.filter((r) => !r.excluidoEm),
  }
}

const semControle = <T extends Partial<Controle>>({ atualizadoEm: _a, excluidoEm: _e, sujo: _s, ...resto }: T) => resto

/** A parte `flashcards` do arquivo, sem os controles de sincronização. */
export function flashcardsParaArquivo(f: Flashcards) {
  return {
    baralhos: f.baralhos.map(semControle),
    gruposOpcoes: f.gruposOpcoes.map(semControle),
    tiposNota: f.tiposNota.map(semControle),
    notas: f.notas.map(semControle),
    cartoes: f.cartoes.map(semControle),
    revlog: f.revlog.map(semControle),
  }
}

export const tabelasFlashcards = (db: BancoCiclo) => [db.baralhos, db.gruposOpcoes, db.tiposNota, db.notasFc, db.cartoes, db.revlog]

/**
 * Grava os flashcards do backup, **substituindo** os atuais. Chame dentro de uma transação que inclua
 * `tabelasFlashcards(db)`. O que existia e não está no arquivo ganha `excluidoEm` (nada é apagado de verdade).
 * O histórico de respostas é **somado**: entram as linhas do arquivo e nenhuma linha existente sai
 * (uma resposta desfeita aqui continua desfeita, mesmo que um backup mais antigo a traga).
 */
export async function gravarFlashcards(db: BancoCiclo, f: Flashcards, agora: number): Promise<void> {
  const pares = [
    [db.baralhos, f.baralhos],
    [db.gruposOpcoes, f.gruposOpcoes],
    [db.tiposNota, f.tiposNota],
    [db.notasFc, f.notas],
    [db.cartoes, f.cartoes],
  ] as const
  for (const [tabela, entrantes] of pares) {
    const t = tabela as unknown as { toArray(): Promise<({ id: string } & Controle)[]>; bulkPut(l: unknown[]): Promise<unknown> }
    const ids = new Set(entrantes.map((x) => x.id))
    const sobras = (await t.toArray())
      .filter((x) => x.excluidoEm === null && !ids.has(x.id))
      .map((x) => ({ ...x, excluidoEm: agora, atualizadoEm: agora, sujo: 1 as const }))
    await t.bulkPut([...entrantes, ...sobras])
  }
  const desfeitas = new Set((await db.revlog.filter((r) => !!r.excluidoEm).primaryKeys()) as string[])
  await db.revlog.bulkPut(f.revlog.filter((r) => !desfeitas.has(r.id)))
}
