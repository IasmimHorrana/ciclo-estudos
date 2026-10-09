import { describe, expect, it } from 'vitest'
import { isoDoNumero, mapaDeCalor } from './mapaCalor'

// dia 20_000 = 2024-10-04 (sexta)
const HOJE = 20_000

describe('mapaDeCalor', () => {
  it('converte número de dia em data', () => {
    expect(isoDoNumero(HOJE)).toBe('2024-10-04')
  })

  it('sem nenhum estudo: tudo zerado', () => {
    const m = mapaDeCalor(new Map(), HOJE)
    expect(m.sequenciaAtual).toBe(0)
    expect(m.maiorSequencia).toBe(0)
    expect(m.mediaPorDiaEstudado).toBe(0)
  })

  it('calcula média, % de dias, maior sequência e sequência atual', () => {
    // estudou 5 dias seguidos (HOJE-9..HOJE-5), faltou, e estudou ontem e hoje
    const p = new Map<number, number>()
    for (let d = HOJE - 9; d <= HOJE - 5; d++) p.set(d, 10)
    p.set(HOJE - 1, 20)
    p.set(HOJE, 30)
    const m = mapaDeCalor(p, HOJE)
    expect(m.maiorSequencia).toBe(5)
    expect(m.sequenciaAtual).toBe(2)
    expect(m.mediaPorDiaEstudado).toBeCloseTo((50 + 50) / 7)
    expect(m.pctDiasEstudados).toBe(70) // 7 de 10 dias (período começa no 1º estudo)
  })

  it('hoje sem estudo não quebra a sequência', () => {
    const m = mapaDeCalor(new Map([[HOJE - 2, 5], [HOJE - 1, 5]]), HOJE)
    expect(m.sequenciaAtual).toBe(2)
  })

  it('a grade tem 7 linhas por coluna, cobre o ano e termina em hoje (resto é futuro)', () => {
    const m = mapaDeCalor(new Map([[HOJE - 20, 5]]), HOJE)
    expect(m.semanas.every((c) => c.length === 7)).toBe(true)
    const todas = m.semanas.flat().filter((c) => c)
    expect(todas.find((c) => c?.dia === HOJE)?.futuro).toBe(false)
    expect(todas.find((c) => c?.dia === HOJE + 1)?.futuro).toBe(true)
  })

  it('níveis crescem com a quantidade', () => {
    const m = mapaDeCalor(new Map([[HOJE - 3, 100], [HOJE - 2, 60], [HOJE - 1, 30], [HOJE, 5]]), HOJE)
    const niv = (d: number) => m.semanas.flat().find((c) => c?.dia === d)?.nivel
    expect([niv(HOJE - 3), niv(HOJE - 2), niv(HOJE - 1), niv(HOJE)]).toEqual([4, 3, 2, 1])
  })
})
