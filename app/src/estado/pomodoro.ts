import { create } from 'zustand'
import { CONFIG_PADRAO, duracaoSeg, minutosDecorridos, proximaFase, type ConfigPomodoro, type Fase } from '@/dominio/pomodoro'

/** Um foco terminou (ou foi encerrado) e há minutos para somar a um passo. */
export interface FocoConcluido {
  minutos: number
  /** `true` = o relógio chegou ao fim (conta um pomodoro); `false` = encerrado antes. */
  completo: boolean
}

/** O que está sendo estudado neste foco (escolhido ao clicar em Iniciar). `passoId` 0 = estudar sem registrar. */
export interface AlvoFoco {
  passoId: number
  tipo: string
  assuntoId: string | null
  /** Texto para mostrar no cartão, ex.: "3. Direito Civil · Teoria". */
  rotulo: string
}

interface PomodoroState {
  config: ConfigPomodoro
  fase: Fase
  restaSeg: number
  rodando: boolean
  /** instante (ms) em que a fase atual termina; só vale com `rodando` */
  fimMs: number
  focosConcluidos: number
  /** Aviso para a tela perguntar a qual passo somar o tempo. */
  foco: FocoConcluido | null
  alvo: AlvoFoco | null
  /** Última escolha, para sugerir de novo no próximo foco. */
  ultimoAlvo: AlvoFoco | null
  definirAlvo: (a: AlvoFoco | null) => void
  alternar: () => void
  reiniciar: () => void
  /** Encerra o foco antes da hora e soma só o que foi estudado (se passou de 1 minuto). */
  encerrar: () => void
  /** Troca de fase à mão (só com o relógio parado). */
  irParaFase: (fase: Fase) => void
  definirConfig: (c: ConfigPomodoro) => void
  limparFoco: () => void
  /** chamado por um relógio central, algumas vezes por segundo */
  tic: (agoraMs?: number) => void
}

/** Três bipes curtos (silencioso se o navegador não deixar tocar som). */
function bipe() {
  try {
    const ctx = new AudioContext()
    for (const t of [0, 0.3, 0.6]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.15, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.25)
    }
  } catch {
    /* sem áudio */
  }
}

export const usePomodoro = create<PomodoroState>((set, get) => ({
  config: CONFIG_PADRAO,
  fase: 'foco',
  restaSeg: duracaoSeg('foco', CONFIG_PADRAO),
  rodando: false,
  fimMs: 0,
  focosConcluidos: 0,
  foco: null,
  alvo: null,
  ultimoAlvo: null,
  definirAlvo: (alvo) => set(alvo ? { alvo, ultimoAlvo: alvo } : { alvo: null }),

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

  encerrar: () => {
    const s = get()
    if (s.fase !== 'foco') return
    const resta = s.rodando ? Math.max(0, Math.ceil((s.fimMs - Date.now()) / 1000)) : s.restaSeg
    const minutos = minutosDecorridos(s.config, resta)
    if (minutos < 1) return set({ rodando: false, restaSeg: duracaoSeg('foco', s.config) })
    const prox = proximaFase('foco', s.focosConcluidos, s.config)
    set({ rodando: false, fase: prox.fase, focosConcluidos: prox.focosConcluidos, restaSeg: duracaoSeg(prox.fase, s.config), foco: { minutos, completo: false } })
  },

  irParaFase: (fase) => {
    const s = get()
    if (s.rodando) return
    set({ fase, restaSeg: duracaoSeg(fase, s.config) })
  },

  definirConfig: (config) => {
    const s = get()
    set({ config, ...(s.rodando ? {} : { restaSeg: duracaoSeg(s.fase, config) }) })
  },

  limparFoco: () => set({ foco: null }),

  tic: (agoraMs = Date.now()) => {
    const s = get()
    if (!s.rodando) return
    const resta = Math.ceil((s.fimMs - agoraMs) / 1000)
    if (resta > 0) {
      if (resta !== s.restaSeg) set({ restaSeg: resta })
      return
    }
    // terminou a fase: passa para a próxima, parada (você decide quando começar)
    bipe()
    const prox = proximaFase(s.fase, s.focosConcluidos, s.config)
    set({
      rodando: false, fase: prox.fase, focosConcluidos: prox.focosConcluidos, restaSeg: duracaoSeg(prox.fase, s.config),
      foco: s.fase === 'foco' ? { minutos: s.config.foco, completo: true } : s.foco,
    })
  },
}))
