// Regras do Pomodoro (puras, sem relógio nem tela): o estado do cronômetro fica em src/estado/pomodoro.ts.

export type Fase = 'foco' | 'pausa' | 'longa'

export interface ConfigPomodoro {
  foco: number // minutos
  pausa: number
  longa: number
  /** a cada quantos focos concluídos vem a pausa longa */
  ate: number
}

export const CONFIG_PADRAO: ConfigPomodoro = { foco: 25, pausa: 5, longa: 15, ate: 4 }

export const NOMES_FASE: Record<Fase, string> = {
  foco: 'Foco',
  pausa: 'Pausa',
  longa: 'Pausa longa',
}

export const duracaoSeg = (fase: Fase, cfg: ConfigPomodoro): number => cfg[fase] * 60

/** Qual é a fase seguinte e quantos focos já foram concluídos. */
export function proximaFase(fase: Fase, focosConcluidos: number, cfg: ConfigPomodoro): { fase: Fase; focosConcluidos: number } {
  if (fase !== 'foco') return { fase: 'foco', focosConcluidos }
  const total = focosConcluidos + 1
  return { fase: total % cfg.ate === 0 ? 'longa' : 'pausa', focosConcluidos: total }
}

/** "25:00" */
export function fmtMMSS(seg: number): string {
  const s = Math.max(0, Math.round(seg))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
