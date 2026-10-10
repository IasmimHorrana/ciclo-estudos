import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { carregarCiclo, gerarSemana, mudarConfig } from '@/dados/ciclo'
import { lerArquivo } from '@/dados/converter'
import { BancoCiclo } from '@/dados/db'
import { carregarEstudo } from '@/dados/desempenho'
import { registrarEstudoManual, type PedidoManual } from '@/dados/manual'
import { substituirDados } from '@/dados/repositorio'
import { validarEstudoManual } from '@/dominio/desempenho'

const AGORA = new Date(2026, 9, 9, 15).getTime() // sexta 09/10
let n = 0

async function bancoComSemana() {
  const db = new BancoCiclo(`manual-${++n}`)
  await substituirDados(db, lerArquivo(JSON.stringify({ config: { horas: 2, duracao: 1, modo: 'Livre', mats: [{ nome: 'Informática', rep: 2, peso: 3 }], custom: [], ocultas: [] }, fechadas: [] }), AGORA), AGORA)
  await mudarConfig(db, (c) => c, AGORA)
  await gerarSemana(db, AGORA)
  return db
}

const base: PedidoManual = { data: '2026-10-08', materia: 'Informática', tipo: 'Teoria', minutos: 90, feitas: 0, acertos: 0, assuntoId: null, passoId: null }

describe('validarEstudoManual', () => {
  const ok = { data: '2026-10-08', materia: 'Civil', tipo: 'Teoria', minutos: 30, feitas: 0, acertos: 0 }
  it('aceita um registro de tempo', () => {
    expect(validarEstudoManual(ok, '2026-10-09')).toBeNull()
  })
  it('recusa data futura, sem data, sem matéria, tipo estranho e tempo zerado fora de questões', () => {
    expect(validarEstudoManual({ ...ok, data: '2026-10-10' }, '2026-10-09')).toMatch('futuro')
    expect(validarEstudoManual({ ...ok, data: '' }, '2026-10-09')).toMatch('data')
    expect(validarEstudoManual({ ...ok, materia: '' }, '2026-10-09')).toMatch('matéria')
    expect(validarEstudoManual({ ...ok, tipo: 'Outro' }, '2026-10-09')).toMatch('tipo')
    expect(validarEstudoManual({ ...ok, minutos: 0 }, '2026-10-09')).toMatch('tempo')
    expect(validarEstudoManual({ ...ok, minutos: 25 * 60 }, '2026-10-09')).toMatch('24 horas')
  })
  it('questões: só questões ou só tempo vale; acertos não passam do feito', () => {
    const q = { ...ok, tipo: 'Questões', minutos: 0, feitas: 20, acertos: 15 }
    expect(validarEstudoManual(q, '2026-10-09')).toBeNull()
    expect(validarEstudoManual({ ...q, feitas: 0, acertos: 0, minutos: 40 }, '2026-10-09')).toBeNull()
    expect(validarEstudoManual({ ...q, acertos: 21 }, '2026-10-09')).toMatch('acertos')
    expect(validarEstudoManual({ ...q, feitas: 0, acertos: 0 }, '2026-10-09')).toMatch('questões')
  })
})

describe('registrarEstudoManual', () => {
  it('só tempo: guarda a sessão na data escolhida, sem mexer nos passos', async () => {
    const db = await bancoComSemana()
    expect(await registrarEstudoManual(db, base, AGORA)).toBeNull()
    const e = await carregarEstudo(db)
    expect(e.sessoes).toHaveLength(1)
    expect(e.sessoes[0]).toMatchObject({ data: '2026-10-08', materia: 'Informática', minutos: 90, tipo: 'Teoria' })
    expect((await carregarCiclo(db)).semana?.passos.every((p) => p.horasFeitas === 0)).toBe(true)
  })

  it('somando a um passo: as horas do passo sobem e a sessão fica com a data escolhida', async () => {
    const db = await bancoComSemana()
    const passo = (await carregarCiclo(db)).semana?.passos[0]
    expect(await registrarEstudoManual(db, { ...base, passoId: passo?.id ?? 0 }, AGORA)).toBeNull()
    expect((await carregarCiclo(db)).semana?.passos[0]?.horasFeitas).toBe(1.5)
    expect((await carregarEstudo(db)).sessoes[0]?.data).toBe('2026-10-08')
  })

  it('questões: guarda feitas e acertos (e o tempo, se informado)', async () => {
    const db = await bancoComSemana()
    expect(await registrarEstudoManual(db, { ...base, tipo: 'Questões', minutos: 45, feitas: 20, acertos: 15, assuntoId: 'a1' }, AGORA)).toBeNull()
    const e = await carregarEstudo(db)
    expect(e.questoes[0]).toMatchObject({ data: '2026-10-08', materia: 'Informática', assuntoId: 'a1', feitas: 20, acertos: 15 })
    expect(e.sessoes[0]).toMatchObject({ minutos: 45, tipo: 'Questões' })
  })

  it('questões sem tempo não cria sessão; registro inválido não grava nada', async () => {
    const db = await bancoComSemana()
    await registrarEstudoManual(db, { ...base, tipo: 'Questões', minutos: 0, feitas: 10, acertos: 7 }, AGORA)
    expect((await carregarEstudo(db)).sessoes).toHaveLength(0)
    expect(await registrarEstudoManual(db, { ...base, data: '2026-12-01' }, AGORA)).toMatch('futuro')
    const e = await carregarEstudo(db)
    expect(e.questoes).toHaveLength(1)
    expect(e.sessoes).toHaveLength(0)
  })
})
