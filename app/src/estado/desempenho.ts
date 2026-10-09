import { create } from 'zustand'
import type { Periodo } from '@/dominio/desempenho'

interface DesempenhoUi {
  visao: 'estudo' | 'semanas'
  periodo: Periodo
  /** Matérias com a lista de assuntos aberta. */
  abertas: string[]
  definir: (p: Partial<Pick<DesempenhoUi, 'visao' | 'periodo'>>) => void
  alternarAberta: (materia: string, aberta: boolean) => void
}

export const useDesempenhoUi = create<DesempenhoUi>()((set) => ({
  visao: 'estudo',
  periodo: '30',
  abertas: [],
  definir: (p) => set(p),
  alternarAberta: (materia, aberta) => set((s) => ({ abertas: aberta ? [...new Set([...s.abertas, materia])] : s.abertas.filter((m) => m !== materia) })),
}))
