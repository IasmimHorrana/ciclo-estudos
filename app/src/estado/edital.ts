import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OrdemEdital } from '@/dominio/edital'

interface EditalUi {
  ordem: OrdemEdital
  ocultarEstudados: boolean
  /** Id da matéria mostrada sozinha, ou null para todas. */
  filtroMateria: string | null
  /** Matérias (ids) recolhidas. */
  recolhidas: string[]
  definir: (p: Partial<Pick<EditalUi, 'ordem' | 'ocultarEstudados' | 'filtroMateria'>>) => void
  alternarRecolhida: (id: string) => void
}

export const useEditalUi = create<EditalUi>()(
  persist(
    (set) => ({
      ordem: 'edital',
      ocultarEstudados: false,
      filtroMateria: null,
      recolhidas: [],
      definir: (p) => set(p),
      alternarRecolhida: (id) => set((s) => ({ recolhidas: s.recolhidas.includes(id) ? s.recolhidas.filter((x) => x !== id) : [...s.recolhidas, id] })),
    }),
    { name: 'ciclo-estudos.edital' },
  ),
)
