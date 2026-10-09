import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { lerArquivo } from '@/dados/converter'
import { BancoCiclo } from '@/dados/db'
import {
  adicionarNota, atualizarNota, carregarContexto, criarBaralho, desfazerResposta, excluirBaralho, excluirNota, filaDe,
  garantirPadroes, renomearBaralho, responderCartao, salvarOpcoes, sincronizarBaralhos, GRUPO_PADRAO,
} from '@/dados/flashcards'
import { substituirDados } from '@/dados/repositorio'
import { OPCOES_BARALHO_PADRAO, proximoCartao } from '@/dominio/fila'

const T0 = new Date(2026, 9, 9, 10, 0).getTime()
const MIN = 60_000
const DIA = 86_400_000

let n = 0
async function banco() {
  const db = new BancoCiclo(`fc-${++n}`)
  await garantirPadroes(db, T0)
  return db
}
async function comCiclo(db: BancoCiclo) {
  const bk = {
    config: { mats: [{ nome: 'Informática', rep: 1, peso: 3 }], custom: ['Estatística'] },
    fechadas: [],
    assuntos: [{ id: 'a1', materia: 'Informática', nome: 'Redes' }, { id: 'a2', materia: 'Informática', nome: 'Segurança' }],
    notas: [{ id: 'n1', titulo: 't', materia: 'Língua Portuguesa', texto: '', criado: 1, atualizado: 1 }],
  }
  await substituirDados(db, lerArquivo(JSON.stringify(bk), T0), T0)
}

describe('padrões e baralhos', () => {
  it('cria grupo padrão e 5 tipos de nota, sem duplicar ao repetir', async () => {
    const db = await banco()
    await garantirPadroes(db, T0 + 1)
    expect(await db.gruposOpcoes.count()).toBe(1)
    expect(await db.tiposNota.count()).toBe(5)
  })

  it('matérias e assuntos viram baralho e subbaralho, uma vez só', async () => {
    const db = await banco()
    await comCiclo(db)
    expect(await sincronizarBaralhos(db, T0)).toBe(5)
    expect((await db.baralhos.toArray()).map((b) => b.nome).sort()).toEqual([
      'Estatística', 'Informática', 'Informática::Redes', 'Informática::Segurança', 'Língua Portuguesa',
    ])
    expect(await sincronizarBaralhos(db, T0 + 1)).toBe(0)
  })

  it('baralho excluído de propósito não é recriado pela sincronização', async () => {
    const db = await banco()
    await comCiclo(db)
    await sincronizarBaralhos(db, T0)
    await excluirBaralho(db, 'mat:Estatística', T0 + 1)
    expect(await sincronizarBaralhos(db, T0 + 2)).toBe(0)
    expect((await db.baralhos.get('mat:Estatística'))?.excluidoEm).toBe(T0 + 1)
  })

  it('sem backup importado, não cria baralho nenhum', async () => {
    expect(await sincronizarBaralhos(await banco())).toBe(0)
  })

  it('criar manual, recusar nome repetido e renomear leva os filhos junto', async () => {
    const db = await banco()
    const a = await criarBaralho(db, 'Direito::Penal', T0)
    expect(a.nome).toBe('Direito::Penal')
    await expect(criarBaralho(db, 'direito::penal')).rejects.toThrow('Já existe')
    const pai = await criarBaralho(db, 'Direito', T0)
    await renomearBaralho(db, pai.id, 'Leis', T0 + 1)
    expect((await db.baralhos.toArray()).map((b) => b.nome).sort()).toEqual(['Leis', 'Leis::Penal'])
  })
})

describe('notas e cartões', () => {
  it('nota básica gera 1 cartão novo; invertido gera 2; cloze com 2 omissões gera 2', async () => {
    const db = await banco()
    const b = await criarBaralho(db, 'Teste', T0)
    const r1 = await adicionarNota(db, { tipoId: 'basico', baralhoId: b.id, campos: { Frente: 'Q', Verso: 'R' } }, T0)
    expect(r1.cartoes).toHaveLength(1)
    expect(r1.cartoes[0]).toMatchObject({ tipo: 'novo', facilidade: 2.5, baralhoId: b.id, sujo: 1 })
    const r2 = await adicionarNota(db, { tipoId: 'basico-invertido', baralhoId: b.id, campos: { Frente: 'Q', Verso: 'R' } }, T0 + 1)
    expect(r2.cartoes).toHaveLength(2)
    const r3 = await adicionarNota(db, { tipoId: 'cloze', baralhoId: b.id, campos: { Texto: '{{c1::A}} {{c2::B}}', Extra: '' } }, T0 + 2)
    expect(r3.cartoes.map((c) => c.indice)).toEqual([0, 1])
  })

  it('recusa nota vazia, com mensagem clara', async () => {
    const db = await banco()
    const b = await criarBaralho(db, 'Teste', T0)
    await expect(adicionarNota(db, { tipoId: 'basico', baralhoId: b.id, campos: { Frente: '', Verso: 'R' } })).rejects.toThrow('Preencha a frente')
    await expect(adicionarNota(db, { tipoId: 'cloze', baralhoId: b.id, campos: { Texto: 'x', Extra: '' } })).rejects.toThrow('omissão')
    expect(await db.notasFc.count()).toBe(0)
  })

  it('editar a nota cloze acrescentando c3 cria só o cartão novo', async () => {
    const db = await banco()
    const b = await criarBaralho(db, 'Teste', T0)
    const { nota } = await adicionarNota(db, { tipoId: 'cloze', baralhoId: b.id, campos: { Texto: '{{c1::A}} {{c2::B}}', Extra: '' } }, T0)
    await atualizarNota(db, nota.id, { campos: { Texto: '{{c1::A}} {{c2::B}} {{c3::C}}', Extra: '' } }, T0 + 5)
    expect((await db.cartoes.where('notaId').equals(nota.id).toArray()).map((c) => c.indice).sort()).toEqual([0, 1, 2])
  })

  it('excluir a nota marca os cartões e eles somem da fila', async () => {
    const db = await banco()
    const b = await criarBaralho(db, 'Teste', T0)
    const { nota } = await adicionarNota(db, { tipoId: 'basico-invertido', baralhoId: b.id, campos: { Frente: 'Q', Verso: 'R' } }, T0)
    await excluirNota(db, nota.id, T0 + 1)
    expect((await db.cartoes.toArray()).every((c) => c.excluidoEm === T0 + 1)).toBe(true)
    expect(filaDe(await carregarContexto(db, T0 + 2), null).contagem.novos).toBe(0)
  })

  it('excluir baralho leva filhos, notas e cartões', async () => {
    const db = await banco()
    const pai = await criarBaralho(db, 'A', T0)
    const filho = await criarBaralho(db, 'A::B', T0)
    await adicionarNota(db, { tipoId: 'basico', baralhoId: filho.id, campos: { Frente: 'Q', Verso: 'R' } }, T0)
    expect(await excluirBaralho(db, pai.id, T0 + 1)).toBe(1)
    expect((await carregarContexto(db, T0 + 2)).baralhos).toEqual([])
  })
})

describe('estudar', () => {
  async function comUmCartao(opcoes = {}) {
    const db = await banco()
    const b = await criarBaralho(db, 'Teste', T0)
    if (Object.keys(opcoes).length) await salvarOpcoes(db, GRUPO_PADRAO, { ...OPCOES_BARALHO_PADRAO, ...opcoes }, T0)
    const { cartoes } = await adicionarNota(db, { tipoId: 'basico', baralhoId: b.id, campos: { Frente: 'Q', Verso: 'R' } }, T0)
    return { db, b, id: cartoes[0]!.id }
  }

  it('novo → Bom → Bom: vira revisão de 1 dia e some da fila até amanhã', async () => {
    const { db, b, id } = await comUmCartao()
    await responderCartao(db, id, 3, 4000, T0, null)
    const c1 = (await db.cartoes.get(id))!
    expect(c1).toMatchObject({ tipo: 'aprendendo', passo: 1, venceMs: T0 + 10 * MIN })
    await responderCartao(db, id, 3, 3000, T0 + 10 * MIN, null)
    expect(await db.cartoes.get(id)).toMatchObject({ tipo: 'revisao', intervalo: 1 })
    expect(filaDe(await carregarContexto(db, T0 + 11 * MIN), b.id).contagem).toEqual({ novos: 0, aprendendo: 0, revisao: 0 })
    expect(filaDe(await carregarContexto(db, T0 + DIA), b.id).contagem.revisao).toBe(1)
  })

  it('grava o histórico (revlog) com o tempo, o botão e o estado de antes', async () => {
    const { db, id } = await comUmCartao()
    await responderCartao(db, id, 4, 2500, T0, null)
    const l = (await db.revlog.toArray())[0]!
    expect(l).toMatchObject({ cartaoId: id, botao: 4, estadoAntes: 'novo', tempoMs: 2500, tipoLog: 0, sujo: 1 })
  })

  it('o limite de novos por dia vale (1 por dia) e conta pelo histórico', async () => {
    const db = await banco()
    const b = await criarBaralho(db, 'Teste', T0)
    await salvarOpcoes(db, GRUPO_PADRAO, { ...OPCOES_BARALHO_PADRAO, novosPorDia: 1 }, T0)
    for (let i = 0; i < 3; i++) await adicionarNota(db, { tipoId: 'basico', baralhoId: b.id, campos: { Frente: `Q${i}`, Verso: 'R' } }, T0 + i)
    const f1 = filaDe(await carregarContexto(db, T0 + 10), b.id)
    expect(f1.contagem.novos).toBe(1)
    await responderCartao(db, proximoCartao(f1, T0 + 10)!.cartao.id, 4, 1000, T0 + 10, null)
    expect(filaDe(await carregarContexto(db, T0 + 20), b.id).contagem.novos).toBe(0) // cota do dia usada
    expect(filaDe(await carregarContexto(db, T0 + DIA), b.id).contagem.novos).toBe(1) // amanhã libera
  })

  it('errar uma revisão: lapso, facilidade menor e reaprendizado', async () => {
    const { db, id } = await comUmCartao()
    await db.cartoes.update(id, { tipo: 'revisao', intervalo: 10, venceDia: 1, facilidade: 2.5 })
    await responderCartao(db, id, 1, 5000, T0, null)
    expect(await db.cartoes.get(id)).toMatchObject({ tipo: 'reaprendendo', lapsos: 1, facilidade: 2.3 })
  })

  it('desfazer devolve o cartão ao estado de antes e apaga a linha do histórico', async () => {
    const { db, id } = await comUmCartao()
    const antes = (await db.cartoes.get(id))!
    const d = await responderCartao(db, id, 3, 1000, T0, null)
    await desfazerResposta(db, d, T0 + 1)
    expect(await db.cartoes.get(id)).toMatchObject({ tipo: 'novo', repeticoes: 0, passo: antes.passo })
    expect(await db.revlog.count()).toBe(0)
  })

  it('irmãos: responder um cartão enterra o outro da mesma nota até amanhã; desfazer solta', async () => {
    const db = await banco()
    const b = await criarBaralho(db, 'Teste', T0)
    const { cartoes } = await adicionarNota(db, { tipoId: 'basico-invertido', baralhoId: b.id, campos: { Frente: 'Q', Verso: 'R' } }, T0)
    const d = await responderCartao(db, cartoes[0]!.id, 4, 1000, T0, null)
    let f = filaDe(await carregarContexto(db, T0 + 1), b.id)
    expect(f.novos.map((c) => c.id)).toEqual([]) // o irmão ficou escondido
    expect(filaDe(await carregarContexto(db, T0 + DIA), b.id).novos.map((c) => c.id)).toEqual([cartoes[1]!.id])
    await desfazerResposta(db, d, T0 + 2)
    f = filaDe(await carregarContexto(db, T0 + 3), b.id)
    expect(f.novos).toHaveLength(2)
  })

  it('sanguessuga: no 8º lapso o cartão é suspenso e a nota ganha a tag "leech"', async () => {
    const { db, id } = await comUmCartao()
    await db.cartoes.update(id, { tipo: 'revisao', intervalo: 10, venceDia: 1, lapsos: 7 })
    await responderCartao(db, id, 1, 1000, T0, null)
    expect((await db.cartoes.get(id))?.suspenso).toBe(true)
    const nota = (await db.notasFc.toArray())[0]!
    expect(nota.tags).toContain('leech')
  })

  it('mudar as opções do grupo muda o comportamento (passos 5 min)', async () => {
    const { db, id } = await comUmCartao({ passos: [5, 20] })
    await responderCartao(db, id, 3, 1000, T0, null)
    expect((await db.cartoes.get(id))?.venceMs).toBe(T0 + 20 * MIN)
  })
})
