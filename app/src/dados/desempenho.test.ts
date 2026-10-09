import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { adicionarAssuntos, carregarEstudo, excluirAssunto, excluirRegistroQuestoes, registrarQuestoes, renomearAssunto } from '@/dados/desempenho'
import { BancoCiclo } from '@/dados/db'

const T0 = new Date(2026, 9, 9, 10, 0).getTime()
let n = 0
const banco = () => new BancoCiclo(`ds-${++n}`)
const form = { data: '2026-10-09', materia: 'Informática', assuntoId: '', novo: '', feitas: 10, acertos: 7 }

describe('assuntos', () => {
  it('adiciona vários, ignora repetidos (sem diferenciar maiúsculas) e conta os novos', async () => {
    const db = banco()
    expect(await adicionarAssuntos(db, 'Informática', ['Redes', 'redes', ' Segurança '], T0)).toBe(2)
    expect(await adicionarAssuntos(db, 'Informática', ['REDES'], T0)).toBe(0)
    expect(await adicionarAssuntos(db, 'Estatística', ['Redes'], T0)).toBe(1) // outra matéria pode ter o mesmo nome
    expect((await carregarEstudo(db)).assuntos).toHaveLength(3)
  })

  it('renomear recusa nome repetido na mesma matéria e nome vazio', async () => {
    const db = banco()
    await adicionarAssuntos(db, 'Informática', ['Redes', 'Segurança'], T0)
    const todos = (await carregarEstudo(db)).assuntos
    const a = todos.find((x) => x.nome === 'Redes')!
    const b = todos.find((x) => x.nome === 'Segurança')!
    expect(await renomearAssunto(db, a.id, 'segurança', T0)).toBe('duplicado')
    expect(await renomearAssunto(db, a.id, '  ', T0)).toBe('vazio')
    expect(await renomearAssunto(db, b.id, 'Criptografia', T0)).toBe('ok')
    expect((await carregarEstudo(db)).assuntos.map((x) => x.nome).sort()).toEqual(['Criptografia', 'Redes'])
  })

  it('excluir solta os registros ("sem assunto") e marca o assunto como excluído', async () => {
    const db = banco()
    await adicionarAssuntos(db, 'Informática', ['Redes'], T0)
    const id = (await carregarEstudo(db)).assuntos[0]!.id
    await registrarQuestoes(db, { ...form, assuntoId: id }, T0)
    await db.sessoes.put({ id: 's1', data: '2026-10-09', materia: 'Informática', assuntoId: id, minutos: 25, tipo: 'Teoria', atualizadoEm: T0, excluidoEm: null, sujo: 1 })
    await excluirAssunto(db, id, T0 + 1)
    const e = await carregarEstudo(db)
    expect(e.assuntos).toEqual([])
    expect(e.questoes[0]?.assuntoId).toBeNull()
    expect(e.sessoes[0]?.assuntoId).toBeNull()
    expect((await db.assuntos.get(id))?.excluidoEm).toBe(T0 + 1)
  })
})

describe('registrar questões', () => {
  it('salva e devolve null; dados inválidos voltam com a mensagem e nada é gravado', async () => {
    const db = banco()
    expect(await registrarQuestoes(db, form, T0)).toBeNull()
    expect(await registrarQuestoes(db, { ...form, acertos: 99 }, T0)).toContain('entre 0 e o número')
    expect(await registrarQuestoes(db, { ...form, data: '2026-10-10' }, T0)).toBe('A data não pode ser no futuro.')
    expect((await carregarEstudo(db)).questoes).toHaveLength(1)
  })

  it('"assunto novo" cria o assunto, e reaproveita se já existir', async () => {
    const db = banco()
    await registrarQuestoes(db, { ...form, novo: 'Prescrição' }, T0)
    await registrarQuestoes(db, { ...form, novo: ' prescrição ' }, T0 + 1)
    const e = await carregarEstudo(db)
    expect(e.assuntos).toHaveLength(1)
    expect(e.questoes.every((q) => q.assuntoId === e.assuntos[0]!.id)).toBe(true)
  })

  it('apagar um registro o esconde (não some do banco)', async () => {
    const db = banco()
    await registrarQuestoes(db, form, T0)
    const id = (await carregarEstudo(db)).questoes[0]!.id
    await excluirRegistroQuestoes(db, id, T0 + 1)
    expect((await carregarEstudo(db)).questoes).toEqual([])
    expect((await db.questoes.get(id))?.excluidoEm).toBe(T0 + 1)
  })
})
