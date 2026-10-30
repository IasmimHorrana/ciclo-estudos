import { describe, expect, it } from 'vitest'
import { fmtHs } from './ciclo'
import type { Questoes, Sessao } from './desempenho'
import {
  META_LIVRE_PADRAO, ajustarSemana, diaDe, escolherNoDia, materiasDoDia, metaDaSemana, progressoMeta, resumoLivre, sugerirMaterias, validarMeta,
} from './livre'

const QUINTA = '2026-10-29'
const SEGUNDA = '2026-10-26'

const ses = (data: string, materia: string, minutos: number): Sessao => ({ id: `${data}${materia}${minutos}`, data, materia, assuntoId: null, minutos, tipo: 'Teoria' })
const q = (data: string, feitas: number, acertos: number): Questoes => ({ id: `${data}${feitas}`, data, materia: 'Português', assuntoId: null, feitas, acertos })

describe('meta semanal', () => {
  it('usa a base, a menos que a semana tenha sido ajustada', () => {
    expect(metaDaSemana(META_LIVRE_PADRAO, SEGUNDA)).toBe(28)
    const m = ajustarSemana(META_LIVRE_PADRAO, SEGUNDA, 20)
    expect(metaDaSemana(m, SEGUNDA)).toBe(20)
    expect(metaDaSemana(m, '2026-11-02')).toBe(28) // a semana seguinte volta à base: sem dívida
    expect(metaDaSemana(ajustarSemana(m, SEGUNDA, null), SEGUNDA)).toBe(28)
  })

  it('descarta ajustes muito antigos', () => {
    const m = ajustarSemana({ ...META_LIVRE_PADRAO, ajustes: { '2025-01-06': 10 } }, SEGUNDA, 20)
    expect(m.ajustes).toEqual({ [SEGUNDA]: 20 })
  })

  it('valida base e estendida', () => {
    expect(validarMeta(28, 32)).toBeNull()
    expect(validarMeta(0, 32)).toMatch(/base/)
    expect(validarMeta(28, 20)).toMatch(/estendida/)
  })

  it('progresso: abaixo, base e estendida; a falta nunca fica negativa', () => {
    expect(progressoMeta(14, 28, 32)).toMatchObject({ pctMeta: 50, faltaMeta: 14, faltaEstendida: 18, situacao: 'abaixo' })
    expect(progressoMeta(29, 28, 32)).toMatchObject({ pctMeta: 100, faltaMeta: 0, faltaEstendida: 3, situacao: 'base' })
    expect(progressoMeta(33, 28, 32)).toMatchObject({ pctEstendida: 100, faltaEstendida: 0, situacao: 'estendida' })
    // semana ajustada acima da estendida: a estendida acompanha
    expect(progressoMeta(35, 36, 32)).toMatchObject({ estendida: 36, situacao: 'abaixo' })
  })
})

describe('fmtHs', () => {
  it('mostra os segundos só quando há', () => {
    expect(fmtHs(0)).toBe('0min')
    expect(fmtHs(140 / 3600)).toBe('2min 20s')
    expect(fmtHs(0.75)).toBe('45min')
    expect(fmtHs(1 + 5 / 60 + 7 / 3600)).toBe('1h05 07s')
    expect(fmtHs(28)).toBe('28h00')
  })
})

describe('resumoLivre', () => {
  it('soma as sessões da semana (seg–dom) e o dia de hoje por matéria', () => {
    const sessoes = [
      ses('2026-10-25', 'Português', 600), // domingo anterior: fora
      ses(SEGUNDA, 'Português', 120),
      ses(QUINTA, 'Português', 90),
      ses(QUINTA, 'Direito Adm.', 150),
      ses(QUINTA, 'Português', 30),
      ses('2026-11-01', 'Informática', 60), // domingo desta semana: dentro
    ]
    const r = resumoLivre(sessoes, [q(QUINTA, 10, 7), q(QUINTA, 5, 5), q(SEGUNDA, 20, 10)], META_LIVRE_PADRAO, QUINTA)
    expect(r.segunda).toBe(SEGUNDA)
    expect(r.domingo).toBe('2026-11-01')
    expect(r.horasSemana).toBe(7.5)
    expect(r.dias.map((d) => d.horas)).toEqual([2, 0, 0, 4.5, 0, 0, 1])
    expect(r.hoje.materias).toEqual([{ materia: 'Direito Adm.', horas: 2.5 }, { materia: 'Português', horas: 2 }])
    expect(r.hoje).toMatchObject({ horas: 4.5, feitas: 15, acertos: 12, pct: 80 })
    expect(r.progresso).toMatchObject({ meta: 28, faltaMeta: 20.5 })
  })
})

describe('dia com duas matérias', () => {
  it('vale só no próprio dia', () => {
    expect(diaDe({ data: '2026-10-28', principal: 'Português', secundaria: null, extra: null }, QUINTA)).toEqual({ data: QUINTA, principal: null, secundaria: null, extra: null })
  })

  it('não deixa as duas iguais (troca de lugar) e promove a secundária se a principal sair', () => {
    let d = diaDe(null, QUINTA)
    d = escolherNoDia(d, 'principal', 'Português')
    d = escolherNoDia(d, 'secundaria', 'Direito Adm.')
    expect(materiasDoDia(d)).toEqual(['Português', 'Direito Adm.'])
    expect(escolherNoDia(d, 'secundaria', 'Português')).toMatchObject({ principal: 'Direito Adm.', secundaria: 'Português' })
    expect(escolherNoDia({ ...d, secundaria: null }, 'secundaria', 'Português')).toMatchObject({ principal: 'Português', secundaria: null })
    expect(escolherNoDia(d, 'principal', null)).toMatchObject({ principal: 'Direito Adm.', secundaria: null })
    expect(materiasDoDia(escolherNoDia(d, 'secundaria', null))).toEqual(['Português'])
  })

  it('extra: entra no fim da lista, não repete as outras e sai se uma delas passar a ser a mesma matéria', () => {
    let d = escolherNoDia(escolherNoDia(diaDe(null, QUINTA), 'principal', 'Português'), 'secundaria', 'Direito Adm.')
    expect(escolherNoDia(d, 'extra', 'Português')).toBe(d)
    d = escolherNoDia(d, 'extra', 'Redação')
    expect(materiasDoDia(d)).toEqual(['Português', 'Direito Adm.', 'Redação'])
    expect(escolherNoDia(d, 'secundaria', 'Redação')).toMatchObject({ secundaria: 'Redação', extra: null })
    expect(escolherNoDia(d, 'extra', null).extra).toBeNull()
  })

  it('sugere primeiro as nunca estudadas e depois as mais antigas', () => {
    const ss = [ses('2026-10-20', 'A', 30), ses('2026-10-28', 'B', 30), ses('2026-10-10', 'A', 30)]
    expect(sugerirMaterias(ss, ['A', 'B', 'C'])).toEqual(['C', 'A', 'B'])
  })
})
