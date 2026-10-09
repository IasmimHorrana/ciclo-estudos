import { describe, expect, it } from 'vitest'
import { CONFIG_PADRAO, duracaoSeg, fmtMMSS, proximaFase } from './pomodoro'

describe('pomodoro', () => {
  it('durações em segundos', () => {
    expect(duracaoSeg('foco', CONFIG_PADRAO)).toBe(1500)
    expect(duracaoSeg('pausa', CONFIG_PADRAO)).toBe(300)
    expect(duracaoSeg('longa', CONFIG_PADRAO)).toBe(900)
  })

  it('a cada 4 focos vem a pausa longa; depois de qualquer pausa volta o foco', () => {
    let fase = 'foco' as const
    let r = proximaFase(fase, 0, CONFIG_PADRAO)
    expect(r).toEqual({ fase: 'pausa', focosConcluidos: 1 })
    expect(proximaFase('pausa', 1, CONFIG_PADRAO)).toEqual({ fase: 'foco', focosConcluidos: 1 })
    r = proximaFase(fase, 1, CONFIG_PADRAO)
    expect(r.fase).toBe('pausa')
    r = proximaFase(fase, 2, CONFIG_PADRAO)
    expect(r.fase).toBe('pausa')
    r = proximaFase(fase, 3, CONFIG_PADRAO)
    expect(r).toEqual({ fase: 'longa', focosConcluidos: 4 })
    expect(proximaFase('longa', 4, CONFIG_PADRAO)).toEqual({ fase: 'foco', focosConcluidos: 4 })
    fase = 'foco'
    expect(proximaFase(fase, 7, CONFIG_PADRAO).fase).toBe('longa') // 8º foco
  })

  it('fmtMMSS', () => {
    expect(fmtMMSS(1500)).toBe('25:00')
    expect(fmtMMSS(59.4)).toBe('00:59')
    expect(fmtMMSS(-3)).toBe('00:00')
  })
})
