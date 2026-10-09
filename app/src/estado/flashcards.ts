import { create } from 'zustand'

export type VistaFc = 'baralhos' | 'estudo' | 'adicionar' | 'opcoes'

interface FcState {
  vista: VistaFc
  /** Baralho do estudo/opções/adicionar (null = todos, só no estudo). */
  baralhoId: string | null
  ir: (vista: VistaFc, baralhoId?: string | null) => void
}

export const useFc = create<FcState>()((set) => ({
  vista: 'baralhos',
  baralhoId: null,
  ir: (vista, baralhoId) => set((s) => ({ vista, baralhoId: baralhoId === undefined ? s.baralhoId : baralhoId })),
}))
