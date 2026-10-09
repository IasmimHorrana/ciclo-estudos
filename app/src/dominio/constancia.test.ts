import { describe, expect, it } from 'vitest'
import { constancia } from './constancia'

// 2026-10-09 é sexta
const SEG_A_SEX = [true, true, true, true, true, false, false]

describe('constancia', () => {
  it('conta a sequência até hoje e pula as folgas', () => {
    const ativos = new Set(['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-02'])
    const r = constancia('2026-10-09', SEG_A_SEX, ativos, 7)
    expect(r.sequencia).toBe(6)
    expect(r.celulas.map((c) => c.estado)).toEqual(['folga', 'folga', 'feito', 'feito', 'feito', 'feito', 'feito'])
  })

  it('hoje sem estudo não quebra a sequência', () => {
    const r = constancia('2026-10-09', SEG_A_SEX, new Set(['2026-10-08', '2026-10-07']), 4)
    expect(r.sequencia).toBe(2)
    expect(r.celulas.map((c) => c.estado)).toEqual(['falhou', 'feito', 'feito', 'hoje'])
  })

  it('um dia de estudo sem nada quebra a sequência', () => {
    const r = constancia('2026-10-09', SEG_A_SEX, new Set(['2026-10-07']), 4)
    expect(r.sequencia).toBe(0)
    expect(r.celulas.map((c) => c.estado)).toEqual(['falhou', 'feito', 'falhou', 'hoje'])
  })
})
