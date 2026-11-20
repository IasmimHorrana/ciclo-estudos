import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { carregarFlashcards } from '@/dados/backup-flashcards'
import { lerArquivoCompleto, paraArquivo } from '@/dados/converter'
import { BancoCiclo } from '@/dados/db'
import { adicionarNota, criarBaralho, excluirNota, garantirPadroes, responderCartao } from '@/dados/flashcards'
import { carregarDados, substituirDados } from '@/dados/repositorio'

const T0 = new Date(2026, 10, 19, 10, 0).getTime()
const IMG = '<img src="data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==">'
const CICLO = { config: { horas: 2, duracao: 1, mats: [{ nome: 'Informática', rep: 1, peso: 3 }], custom: [], ocultas: [] }, fechadas: [] }

let n = 0
async function banco() {
  const db = new BancoCiclo(`bkfc-${++n}`)
  await garantirPadroes(db, T0)
  return db
}

/** Banco com ciclo, dois baralhos, três notas (uma com imagem, uma cloze), respostas e uma nota excluída. */
async function comFlashcards() {
  const db = await banco()
  await substituirDados(db, lerArquivoCompleto(JSON.stringify(CICLO), T0).dados, T0)
  const redes = await criarBaralho(db, 'Informática::Redes', T0)
  const port = await criarBaralho(db, 'Português', T0)
  const a = await adicionarNota(db, { tipoId: 'basico', baralhoId: redes.id, campos: { Frente: `OSI ${IMG}`, Verso: '7 camadas' }, tags: ['redes'] }, T0)
  await adicionarNota(db, { tipoId: 'cloze', baralhoId: port.id, campos: { Texto: '{{c1::Crase}} e {{c2::regência}}', Extra: '' } }, T0 + 1)
  const c = await adicionarNota(db, { tipoId: 'basico', baralhoId: port.id, campos: { Frente: 'apagada', Verso: 'x' } }, T0 + 2)
  await excluirNota(db, c.nota.id, T0 + 3)
  const cartao = a.cartoes[0]!.id
  await responderCartao(db, cartao, 3, 4000, T0 + 10, null)
  await responderCartao(db, cartao, 3, 3000, T0 + 11 * 60_000, null)
  return { db, cartao }
}

const exportar = async (db: BancoCiclo, agora: number) =>
  JSON.stringify(paraArquivo((await carregarDados(db))!, agora, await carregarFlashcards(db)))

/** Compara sem os controles de sincronização (que mudam ao importar). */
const limpo = (l: readonly object[]) =>
  (l as { id: string; atualizadoEm?: unknown; sujo?: unknown }[]).map(({ atualizadoEm: _a, sujo: _s, ...r }) => r).sort((x, y) => x.id.localeCompare(y.id))

describe('flashcards no backup', () => {
  it('ida e volta: um banco vazio fica com os mesmos baralhos, notas (com imagem), cartões e histórico', async () => {
    const { db, cartao } = await comFlashcards()
    const antes = await carregarFlashcards(db)
    expect(antes.cartoes).toHaveLength(3) // básico + cloze com 2 omissões; o da nota excluída não vai
    expect(antes.revlog).toHaveLength(2)

    const texto = await exportar(db, T0 + 99)
    expect(texto).toContain('data:image/webp')

    const outro = await banco()
    const { dados, flashcards } = lerArquivoCompleto(texto, T0 + 100)
    const r = await substituirDados(outro, dados, T0 + 100, flashcards)
    expect(r.cartoes).toBe(3)

    const depois = await carregarFlashcards(outro)
    for (const k of ['baralhos', 'gruposOpcoes', 'tiposNota', 'notas', 'cartoes', 'revlog'] as const) {
      expect(limpo(depois[k])).toEqual(limpo(antes[k]))
    }
    const c = await outro.cartoes.get(cartao)
    expect(c?.tipo).toBe('revisao') // o estado do SM-2 veio junto
    expect(c?.sujo).toBe(1) // e fica marcado para a nuvem
  })

  it('backup antigo (sem flashcards) não mexe nos cartões que já existem', async () => {
    const { db } = await comFlashcards()
    const antes = await carregarFlashcards(db)
    const { dados, flashcards } = lerArquivoCompleto(JSON.stringify({ ...CICLO, notas: [] }), T0 + 100)
    expect(flashcards).toBeNull()
    const r = await substituirDados(db, dados, T0 + 100, flashcards)
    expect(r.cartoes).toBeNull()
    expect(await carregarFlashcards(db)).toEqual(antes)
  })

  it('importar um backup com menos cartões marca os que sobraram como excluídos (sem apagar) e soma o histórico', async () => {
    const { db } = await comFlashcards()
    const vazio = await banco()
    await substituirDados(vazio, lerArquivoCompleto(JSON.stringify(CICLO), T0).dados, T0)
    const texto = await exportar(vazio, T0 + 50) // só os padrões, nenhum cartão
    const { dados, flashcards } = lerArquivoCompleto(texto, T0 + 100)
    await substituirDados(db, dados, T0 + 100, flashcards)

    expect((await carregarFlashcards(db)).cartoes).toHaveLength(0)
    const todos = await db.cartoes.toArray()
    expect(todos.length).toBeGreaterThan(0)
    expect(todos.every((c) => c.excluidoEm !== null)).toBe(true)
    expect(await db.revlog.count()).toBe(2) // o histórico nunca perde linhas
    expect((await carregarFlashcards(db)).tiposNota).toHaveLength(5)
  })

  it('o arquivo antigo do app em HTML continua sendo lido', () => {
    const { flashcards } = lerArquivoCompleto(JSON.stringify(CICLO), T0)
    expect(flashcards).toBeNull()
  })

  it('flashcards com defeito param a importação inteira com mensagem', async () => {
    const { db } = await comFlashcards()
    const obj = JSON.parse(await exportar(db, T0 + 99))
    obj.flashcards.cartoes[0].venceDia = 'amanhã'
    expect(() => lerArquivoCompleto(JSON.stringify(obj), T0)).toThrow('cartões')
    delete obj.flashcards.revlog
    expect(() => lerArquivoCompleto(JSON.stringify(obj), T0)).toThrow('defeito')
  })

  it('campos que o esquema não conhece são guardados como vieram', async () => {
    const { db } = await comFlashcards()
    const obj = JSON.parse(await exportar(db, T0 + 99))
    obj.flashcards.cartoes[0].campoNovo = { a: 1 }
    const { flashcards } = lerArquivoCompleto(JSON.stringify(obj), T0)
    expect((flashcards!.cartoes[0] as unknown as { campoNovo: unknown }).campoNovo).toEqual({ a: 1 })
  })
})
