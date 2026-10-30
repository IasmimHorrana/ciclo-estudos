import { describe, expect, it } from 'vitest'
import {
  CRONOMETRO_ZERADO, decorridoSeg, fmtDuracao, fmtHHMMSS, iniciar, lerCronometroSalvo, minutosDe, pausar, restaurarCronometro, zerar,
  type CronometroSalvo,
} from './cronometro'

const T0 = new Date(2026, 9, 29, 14, 0, 0).getTime()
const ALVO = { materia: 'Português', tipo: 'Teoria', assuntoId: null }

describe('cronômetro livre', () => {
  it('conta para cima, pausa e retoma sem perder o que já contou', () => {
    let c = iniciar({ ...CRONOMETRO_ZERADO, alvo: ALVO }, T0)
    expect(decorridoSeg(c, T0 + 90_000)).toBe(90)
    c = pausar(c, T0 + 90_000)
    expect(c.rodando).toBe(false)
    expect(decorridoSeg(c, T0 + 999_000)).toBe(90) // parado não anda
    c = iniciar(c, T0 + 200_000)
    expect(decorridoSeg(c, T0 + 230_000)).toBe(120)
    expect(iniciar(c, T0 + 300_000)).toBe(c) // já rodando: não reinicia
  })

  it('zerar mantém a matéria', () => {
    const c = zerar(pausar(iniciar({ ...CRONOMETRO_ZERADO, alvo: ALVO }, T0), T0 + 60_000))
    expect(c).toEqual({ ...CRONOMETRO_ZERADO, alvo: ALVO })
  })

  it('formata com horas só quando precisa', () => {
    expect(fmtHHMMSS(0)).toBe('00:00')
    expect(fmtHHMMSS(307.9)).toBe('05:07')
    expect(fmtHHMMSS(3600 + 5 * 60 + 7)).toBe('1:05:07')
    expect(fmtHHMMSS(-5)).toBe('00:00')
    expect(minutosDe(89)).toBe(1)
    expect(minutosDe(29)).toBe(0)
  })

  it('mostra a sessão com os segundos', () => {
    expect(fmtDuracao(30 + 20 / 60)).toBe('30 min 20 s')
    expect(fmtDuracao(45)).toBe('45 min')
    expect(fmtDuracao(65 + 7 / 60)).toBe('1 h 05 min 07 s')
    expect(fmtDuracao(6 / 60)).toBe('0 min 06 s')
    expect(fmtDuracao(120)).toBe('2 h 00 min')
  })
})

describe('lerCronometroSalvo', () => {
  it('aceita o formato gravado e recusa lixo', () => {
    const s: CronometroSalvo = { rodando: true, inicioMs: T0, acumuladoSeg: 30, alvo: ALVO, visto: T0 + 1000 }
    expect(lerCronometroSalvo(JSON.stringify(s))).toEqual(s)
    expect(lerCronometroSalvo(null)).toBeNull()
    expect(lerCronometroSalvo('{')).toBeNull()
    expect(lerCronometroSalvo(JSON.stringify({ rodando: 'sim' }))).toBeNull()
    expect(lerCronometroSalvo(JSON.stringify({ ...s, alvo: { materia: '' } }))?.alvo).toBeNull()
  })
})

describe('restaurarCronometro', () => {
  const rodando: CronometroSalvo = { rodando: true, inicioMs: T0, acumuladoSeg: 600, alvo: ALVO, visto: T0 + 30 * 60_000 }

  it('nada guardado, ou zerado sem matéria: começa do zero', () => {
    expect(restaurarCronometro(null, T0)).toEqual({ tipo: 'nada' })
    expect(restaurarCronometro({ ...CRONOMETRO_ZERADO, visto: T0 }, T0)).toEqual({ tipo: 'nada' })
  })

  it('parado: volta igual', () => {
    const s = { ...rodando, rodando: false, inicioMs: 0 }
    expect(restaurarCronometro(s, T0 + 5 * 3600_000)).toEqual({ tipo: 'estado', estado: { rodando: false, inicioMs: 0, acumuladoSeg: 600, alvo: ALVO } })
  })

  it('recarregar a página: segue rodando', () => {
    const r = restaurarCronometro(rodando, rodando.visto + 5000)
    expect(r).toEqual({ tipo: 'estado', estado: { rodando: true, inicioMs: T0, acumuladoSeg: 600, alvo: ALVO } })
  })

  it('fechado por mais tempo: pergunta e conta só até o último instante visto', () => {
    const r = restaurarCronometro(rodando, rodando.visto + 2 * 3600_000)
    expect(r).toMatchObject({ tipo: 'perguntar', minutosEstudados: 40, minutosFora: 120, data: '2026-10-29' })
    if (r.tipo === 'perguntar') expect(r.estado).toEqual({ rodando: false, inicioMs: 0, acumuladoSeg: 2400, alvo: ALVO })
  })
})
