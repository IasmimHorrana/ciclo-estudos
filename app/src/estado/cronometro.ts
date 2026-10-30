import { create } from 'zustand'
import { CRONOMETRO_ZERADO, decorridoSeg, iniciar, pausar, zerar, type AlvoLivre, type Cronometro } from '@/dominio/cronometro'

export type { AlvoLivre }

interface CronometroState extends Cronometro {
  /** Segundos contados, atualizados pelo relógio central (para a tela). */
  seg: number
  /** Última matéria escolhida, para sugerir de novo. */
  ultimoAlvo: AlvoLivre | null
  alternar: (agoraMs?: number) => void
  pausar: (agoraMs?: number) => void
  zerar: () => void
  definirAlvo: (a: AlvoLivre | null) => void
  /** Põe o cronômetro de volta num estado guardado (ao abrir o app). */
  restaurar: (c: Cronometro, agoraMs?: number) => void
  /** chamado pelo relógio central, algumas vezes por segundo */
  tic: (agoraMs?: number) => void
}

const so = (s: CronometroState): Cronometro => ({ rodando: s.rodando, inicioMs: s.inicioMs, acumuladoSeg: s.acumuladoSeg, alvo: s.alvo })
const comSeg = (c: Cronometro, agora: number) => ({ ...c, seg: Math.floor(decorridoSeg(c, agora)) })

export const useCronometro = create<CronometroState>((set, get) => ({
  ...CRONOMETRO_ZERADO,
  seg: 0,
  ultimoAlvo: null,
  alternar: (agora = Date.now()) => {
    const c = so(get())
    set(comSeg(c.rodando ? pausar(c, agora) : iniciar(c, agora), agora))
  },
  pausar: (agora = Date.now()) => set(comSeg(pausar(so(get()), agora), agora)),
  zerar: () => set({ ...zerar(so(get())), seg: 0 }),
  definirAlvo: (alvo) => set(alvo ? { alvo, ultimoAlvo: alvo } : { alvo: null }),
  restaurar: (c, agora = Date.now()) => set({ ...comSeg(c, agora), ultimoAlvo: c.alvo ?? get().ultimoAlvo }),
  tic: (agora = Date.now()) => {
    const s = get()
    if (!s.rodando) return
    const seg = Math.floor(decorridoSeg(s, agora))
    if (seg !== s.seg) set({ seg })
  },
}))
