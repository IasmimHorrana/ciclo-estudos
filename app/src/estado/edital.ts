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
  /** Tópicos (ids de assuntos) recolhidos: os subtópicos deles ficam escondidos. */
  topicosRecolhidos: string[]
  /** Texto da busca (não fica salvo). */
  busca: string
  /** Assunto aberto no painel lateral (não fica salvo). */
  assuntoAberto: string | null
  /** Só as revisões de hoje e atrasadas (não fica salvo). */
  soRevisar: boolean
  definir: (p: Partial<Pick<EditalUi, 'ordem' | 'ocultarEstudados' | 'filtroMateria' | 'busca' | 'assuntoAberto' | 'soRevisar'>>) => void
  alternarRecolhida: (id: string) => void
  alternarTopico: (id: string) => void
  definirTopicosRecolhidos: (ids: string[]) => void
}

export const useEditalUi = create<EditalUi>()(
  persist(
    (set) => ({
      ordem: 'edital',
      ocultarEstudados: false,
      filtroMateria: null,
      recolhidas: [],
      topicosRecolhidos: [],
      busca: '',
      assuntoAberto: null,
      soRevisar: false,
      definir: (p) => set(p),
      alternarRecolhida: (id) => set((s) => ({ recolhidas: s.recolhidas.includes(id) ? s.recolhidas.filter((x) => x !== id) : [...s.recolhidas, id] })),
      alternarTopico: (id) => set((s) => ({ topicosRecolhidos: s.topicosRecolhidos.includes(id) ? s.topicosRecolhidos.filter((x) => x !== id) : [...s.topicosRecolhidos, id] })),
      definirTopicosRecolhidos: (ids) => set({ topicosRecolhidos: ids }),
    }),
    {
      name: 'ciclo-estudos.edital',
      partialize: ({ ordem, ocultarEstudados, filtroMateria, recolhidas, topicosRecolhidos }) => ({ ordem, ocultarEstudados, filtroMateria, recolhidas, topicosRecolhidos }),
    },
  ),
)
