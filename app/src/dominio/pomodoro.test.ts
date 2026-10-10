import { describe, expect, it } from 'vitest'
import { CONFIG_PADRAO, duracaoSeg, fmtMMSS, lerPomodoroSalvo, minutosDecorridos, proximaFase, restaurarPomodoro, type PomodoroSalvo } from './pomodoro'

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

describe('minutosDecorridos', () => {
  it('arredonda o que já foi estudado do foco', () => {
    expect(minutosDecorridos(CONFIG_PADRAO, 25 * 60)).toBe(0)
    expect(minutosDecorridos(CONFIG_PADRAO, 10 * 60 + 20)).toBe(15)
    expect(minutosDecorridos(CONFIG_PADRAO, 0)).toBe(25)
  })
})

describe('restaurarPomodoro (voltar de onde parou)', () => {
  const MIN = 60_000
  const T0 = 1_800_000_000_000
  const alvo = { passoId: 3, tipo: 'Teoria', assuntoId: null, rotulo: '3. Civil · Teoria' }
  // foco de 25 min que começou em T0 e termina em T0 + 25 min
  const rodando = (visto: number, extra: Partial<PomodoroSalvo> = {}): PomodoroSalvo => ({
    fase: 'foco', rodando: true, fimMs: T0 + 25 * MIN, restaSeg: 1500, focosConcluidos: 1, alvo, visto, ...extra,
  })

  it('sem nada guardado, não faz nada', () => {
    expect(restaurarPomodoro(null, T0, CONFIG_PADRAO)).toEqual({ tipo: 'nada' })
  })

  it('parado: volta parado, do mesmo ponto e com o mesmo alvo (limitado à duração atual)', () => {
    const r = restaurarPomodoro({ ...rodando(T0), rodando: false, restaSeg: 700 }, T0 + 60 * MIN, CONFIG_PADRAO)
    expect(r).toEqual({ tipo: 'estado', estado: { fase: 'foco', rodando: false, fimMs: 0, restaSeg: 700, focosConcluidos: 1, alvo } })
    const curto = restaurarPomodoro({ ...rodando(T0), rodando: false, restaSeg: 1500 }, T0, { ...CONFIG_PADRAO, foco: 10 })
    expect(curto).toMatchObject({ estado: { restaSeg: 600 } })
  })

  it('recarregar a página (poucos segundos fora) continua rodando sem perder tempo', () => {
    const r = restaurarPomodoro(rodando(T0 + 10 * MIN), T0 + 10 * MIN + 3000, CONFIG_PADRAO)
    expect(r).toMatchObject({ tipo: 'estado', estado: { rodando: true, fimMs: T0 + 25 * MIN, alvo } })
    if (r.tipo === 'estado') expect(r.estado.restaSeg).toBe(15 * 60 - 3)
  })

  it('app fechado por mais tempo (luz caiu): pergunta, com o tempo estudado até o último instante visto', () => {
    // visto aos 10 min de foco; reabriu 4 min depois, ainda dentro do horário do foco
    const r = restaurarPomodoro(rodando(T0 + 10 * MIN), T0 + 14 * MIN, CONFIG_PADRAO)
    expect(r).toMatchObject({ tipo: 'perguntar', minutosEstudados: 10, minutosFora: 4, focoCompleto: false })
    if (r.tipo === 'perguntar') {
      expect(r.estado).toMatchObject({ rodando: false, restaSeg: 15 * 60, fase: 'foco', alvo })
    }
  })

  it('o horário do foco já passou enquanto fechado: pergunta do mesmo jeito (conta só até o visto)', () => {
    const r = restaurarPomodoro(rodando(T0 + 20 * MIN), T0 + 90 * MIN, CONFIG_PADRAO)
    expect(r).toMatchObject({ tipo: 'perguntar', minutosEstudados: 20, minutosFora: 70, focoCompleto: false })
  })

  it('visto só no instante final: foco conta como completo', () => {
    const r = restaurarPomodoro(rodando(T0 + 25 * MIN), T0 + 30 * MIN, CONFIG_PADRAO)
    expect(r).toMatchObject({ tipo: 'perguntar', minutosEstudados: 25, focoCompleto: true })
  })

  it('pausa rodando: continua pela hora real; se já acabou, vem o próximo foco, parado', () => {
    const pausa = (extra: Partial<PomodoroSalvo> = {}): PomodoroSalvo => ({ fase: 'pausa', rodando: true, fimMs: T0 + 5 * MIN, restaSeg: 300, focosConcluidos: 2, alvo: null, visto: T0, ...extra })
    expect(restaurarPomodoro(pausa(), T0 + 2 * MIN, CONFIG_PADRAO)).toMatchObject({ tipo: 'estado', estado: { fase: 'pausa', rodando: true, restaSeg: 180 } })
    expect(restaurarPomodoro(pausa(), T0 + 9 * MIN, CONFIG_PADRAO)).toEqual({
      tipo: 'estado', estado: { fase: 'foco', rodando: false, fimMs: 0, restaSeg: 1500, focosConcluidos: 2, alvo: null },
    })
  })
})

describe('lerPomodoroSalvo', () => {
  const ok = { fase: 'foco', rodando: true, fimMs: 10, restaSeg: 5, focosConcluidos: 2, alvo: null, visto: 3 }
  it('aceita o que ela mesma grava', () => {
    expect(lerPomodoroSalvo(JSON.stringify(ok))).toEqual(ok)
  })
  it('lixo, vazio ou campos errados viram null (começa do zero)', () => {
    expect(lerPomodoroSalvo(null)).toBeNull()
    expect(lerPomodoroSalvo('não é json')).toBeNull()
    expect(lerPomodoroSalvo(JSON.stringify({ ...ok, fase: 'outra' }))).toBeNull()
    expect(lerPomodoroSalvo(JSON.stringify({ ...ok, fimMs: 'x' }))).toBeNull()
    expect(lerPomodoroSalvo('42')).toBeNull()
  })
  it('alvo malformado é ignorado, sem derrubar o resto', () => {
    expect(lerPomodoroSalvo(JSON.stringify({ ...ok, alvo: { passoId: 'x' } }))?.alvo).toBeNull()
  })
})
