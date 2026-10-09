import { create } from 'zustand'
import { CONFIG_PADRAO, duracaoSeg, proximaFase, type ConfigPomodoro, type Fase } from '@/dominio/pomodoro'

interface PomodoroState {
  config: ConfigPomodoro
  fase: Fase
  restaSeg: number
  rodando: boolean
  /** instante (ms) em que a fase atual termina; só vale com `rodando` */
  fimMs: number
  focosConcluidos: number
  alternar: () => void
  reiniciar: () => void
  /** chamado por um relógio central, algumas vezes por segundo */
  tic: (agoraMs?: number) => void
}

export const usePomodoro = create<PomodoroState>((set, get) => ({
  config: CONFIG_PADRAO,
  fase: 'foco',
  restaSeg: duracaoSeg('foco', CONFIG_PADRAO),
  rodando: false,
  fimMs: 0,
  focosConcluidos: 0,

  alternar: () => {
    const s = get()
    if (s.rodando) {
      set({ rodando: false, restaSeg: Math.max(0, Math.ceil((s.fimMs - Date.now()) / 1000)) })
    } else {
      set({ rodando: true, fimMs: Date.now() + s.restaSeg * 1000 })
    }
  },

  reiniciar: () => {
    const s = get()
    set({ rodando: false, restaSeg: duracaoSeg(s.fase, s.config) })
  },

  tic: (agoraMs = Date.now()) => {
    const s = get()
    if (!s.rodando) return
    const resta = Math.ceil((s.fimMs - agoraMs) / 1000)
    if (resta > 0) {
      if (resta !== s.restaSeg) set({ restaSeg: resta })
      return
    }
    // terminou a fase: passa para a próxima, parada (você decide quando começar)
    const prox = proximaFase(s.fase, s.focosConcluidos, s.config)
    set({ rodando: false, fase: prox.fase, focosConcluidos: prox.focosConcluidos, restaSeg: duracaoSeg(prox.fase, s.config) })
  },
}))
