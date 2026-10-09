import { describe, expect, it } from 'vitest'
import { calcularDesempenho, horasDe, inicioDoPeriodo, nivelDe, pctDe, resumoDasSemanas, validarQuestoes, type EntradaDesempenho } from '@/dominio/desempenho'

const HOJE = '2026-10-09'
const base = (o: Partial<EntradaDesempenho> = {}): EntradaDesempenho => ({
  questoes: [], sessoes: [], assuntos: [], materiasDaSemana: [], config: { custom: [], ocultas: [] }, periodo: '30', hojeISO: HOJE, ...o,
})
const q = (id: string, data: string, materia: string, feitas: number, acertos: number, assuntoId: string | null = null) => ({ id, data, materia, assuntoId, feitas, acertos })
const s = (id: string, data: string, materia: string, minutos: number, assuntoId: string | null = null, tipo = 'Teoria') => ({ id, data, materia, assuntoId, minutos, tipo })

describe('níveis', () => {
  it('pouco dado com menos de 5 questões; depois 60/75/90', () => {
    expect(nivelDe(4, 4)).toBe('na')
    expect(nivelDe(10, 5)).toBe('fraco')
    expect(nivelDe(10, 6)).toBe('medio') // 60%
    expect(nivelDe(100, 74)).toBe('medio')
    expect(nivelDe(100, 75)).toBe('bom')
    expect(nivelDe(100, 89)).toBe('bom')
    expect(nivelDe(10, 9)).toBe('dom')
  })
  it('pctDe não divide por zero', () => {
    expect(pctDe(0, 0)).toBe(0)
    expect(pctDe(7, 10)).toBe(70)
  })
})

describe('período', () => {
  it('7 dias inclui hoje e os 6 anteriores', () => {
    expect(inicioDoPeriodo('7', HOJE)).toBe('2026-10-03')
    expect(inicioDoPeriodo('30', HOJE)).toBe('2026-09-10')
    expect(inicioDoPeriodo('tudo', HOJE) < '2000-01-01').toBe(true)
  })
  it('só entra o que está dentro do período', () => {
    const d = calcularDesempenho(base({ periodo: '7', questoes: [q('1', '2026-10-09', 'A', 10, 8), q('2', '2026-09-01', 'A', 100, 10)] }))
    expect(d.feitas).toBe(10)
    expect(d.acertos).toBe(8)
  })
})

describe('calcularDesempenho', () => {
  const assuntos = [{ id: 'a1', materia: 'Info', nome: 'Redes' }, { id: 'a2', materia: 'Info', nome: 'Segurança' }]

  it('horas vêm só das sessões do Pomodoro, em horas com 2 casas', () => {
    expect(horasDe([s('1', HOJE, 'A', 25), s('2', HOJE, 'A', 35)])).toBe(1)
    const d = calcularDesempenho(base({ sessoes: [s('1', HOJE, 'Info', 90)] }))
    expect(d.horas).toBe(1.5)
    expect(d.horasPorMateria).toEqual([{ nome: 'Info', valor: 1.5 }])
  })

  it('por assunto: acertos, horas, nível; "(sem assunto)" só aparece se tiver dados', () => {
    const d = calcularDesempenho(base({
      assuntos,
      questoes: [q('1', HOJE, 'Info', 10, 9, 'a1'), q('2', HOJE, 'Info', 5, 1, null)],
      sessoes: [s('1', HOJE, 'Info', 60, 'a1')],
    }))
    const info = d.blocos.find((b) => b.materia === 'Info')!
    expect(info).toMatchObject({ feitas: 15, acertos: 10, horas: 1, temAssuntos: true })
    const redes = info.assuntos.find((a) => a.nome === 'Redes')!
    expect(redes).toMatchObject({ feitas: 10, acertos: 9, horas: 1, nivel: 'dom' })
    expect(info.assuntos.map((a) => a.nome)).toEqual(['Redes', 'Segurança', '(sem assunto)'])
    const limpo = calcularDesempenho(base({ assuntos }))
    expect(limpo.blocos[0]?.assuntos.map((a) => a.nome)).toEqual(['Redes', 'Segurança'])
  })

  it('matérias: as da lista na ordem dela, depois as outras', () => {
    const d = calcularDesempenho(base({ questoes: [q('1', HOJE, 'Zeta Própria', 1, 1), q('2', HOJE, 'Informática', 1, 1), q('3', HOJE, 'Língua Portuguesa', 1, 1)], materiasDaSemana: ['Estatística'] }))
    expect(d.mats).toEqual(['Língua Portuguesa', 'Estatística', 'Informática', 'Zeta Própria'])
  })

  it('colunas: 30 dias, hoje por último, e erros = feitas − acertos', () => {
    const d = calcularDesempenho(base({ questoes: [q('1', HOJE, 'A', 10, 7)] }))
    expect(d.colsQuestoes).toHaveLength(30)
    const ultima = d.colsQuestoes[29]!
    expect(ultima.label).toBe('09/10')
    expect(ultima.partes.map((p) => p.v)).toEqual([7, 3])
    expect(calcularDesempenho(base({ periodo: '7' })).colsHoras).toHaveLength(7)
  })

  it('acerto por matéria ordenado do maior para o menor', () => {
    const d = calcularDesempenho(base({ questoes: [q('1', HOJE, 'A', 10, 5), q('2', HOJE, 'B', 10, 9)] }))
    expect(d.acertoPorMateria.map((x) => x.materia)).toEqual(['B', 'A'])
  })

  it('tipos de estudo (sessão sem tipo conta como Teoria) e dias com estudo', () => {
    const d = calcularDesempenho(base({ sessoes: [s('1', HOJE, 'A', 60, null, 'Questões'), { ...s('2', '2026-10-08', 'A', 30), tipo: '' }], questoes: [q('1', HOJE, 'A', 1, 1)] }))
    expect(d.tipos).toEqual([{ tipo: 'Teoria', horas: 0.5 }, { tipo: 'Questões', horas: 1 }, { tipo: 'Revisão', horas: 0 }])
    expect(d.dias).toBe(2)
  })

  it('últimos registros: os 8 mais recentes', () => {
    const lista = Array.from({ length: 10 }, (_, i) => q(String(i), `2026-10-${String(i + 1).padStart(2, '0')}`, 'A', 1, 1))
    const d = calcularDesempenho(base({ questoes: lista }))
    expect(d.ultimos).toHaveLength(8)
    expect(d.ultimos[0]?.data).toBe('2026-10-10')
  })
})

describe('semanas fechadas', () => {
  it('totais e média', () => {
    expect(resumoDasSemanas([])).toEqual({ total: 0, fechadas: 0, horas: 0, media: 0 })
    expect(resumoDasSemanas([{ cicloFechado: true, horasEstudadas: 6, pctConcluido: 100 }, { cicloFechado: false, horasEstudadas: 3.5, pctConcluido: 50 }])).toEqual({ total: 2, fechadas: 1, horas: 9.5, media: 75 })
  })
})

describe('validar registro de questões', () => {
  const ok = { data: HOJE, materia: 'A', assuntoId: '', novo: '', feitas: 10, acertos: 7 }
  it('aceita um registro correto', () => expect(validarQuestoes(ok, HOJE)).toBeNull())
  it('recusa data futura, sem matéria, zero questões e acertos acima do total', () => {
    expect(validarQuestoes({ ...ok, data: '' }, HOJE)).toBe('Informe a data.')
    expect(validarQuestoes({ ...ok, data: '2026-10-10' }, HOJE)).toBe('A data não pode ser no futuro.')
    expect(validarQuestoes({ ...ok, materia: '' }, HOJE)).toBe('Escolha a matéria.')
    expect(validarQuestoes({ ...ok, feitas: 0 }, HOJE)).toContain('mínimo 1')
    expect(validarQuestoes({ ...ok, feitas: Number.NaN }, HOJE)).toContain('mínimo 1')
    expect(validarQuestoes({ ...ok, acertos: 11 }, HOJE)).toContain('entre 0 e o número')
    expect(validarQuestoes({ ...ok, acertos: -1 }, HOJE)).toContain('entre 0 e o número')
  })
})
