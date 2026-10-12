import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

interface ArvoreState {
  /** Nome completo dos baralhos recolhidos na lista (guardado no navegador). */
  recolhidos: string[]
  alternar: (nome: string) => void
  definir: (nomes: string[]) => void
}

export const useFcArvore = create<ArvoreState>()(
  persist(
    (set) => ({
      recolhidos: [],
      alternar: (nome) => set((s) => ({ recolhidos: s.recolhidos.includes(nome) ? s.recolhidos.filter((n) => n !== nome) : [...s.recolhidos, nome] })),
      definir: (recolhidos) => set({ recolhidos }),
    }),
    { name: 'ciclo-estudos.fc-arvore' },
  ),
)
