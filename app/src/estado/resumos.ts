import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const CHAVE_SEM_MATERIA = '__sem__'

interface ResumosUi {
  notaId: string | null
  /** Folha com linhas (pautada) ou lisa; vale para todas as notas. */
  pautada: boolean
  busca: string
  /** Matérias com a lista de notas recolhida. */
  gruposFechados: string[]
  selecionar: (id: string | null) => void
  alternarPautada: () => void
  buscar: (q: string) => void
  alternarGrupo: (chave: string) => void
  abrirGrupo: (chave: string) => void
  recolherTodos: (chaves: string[]) => void
  expandirTodos: () => void
}

export const useResumosUi = create<ResumosUi>()(
  persist(
    (set) => ({
      notaId: null,
      pautada: false,
      busca: '',
      gruposFechados: [],
      selecionar: (id) => set({ notaId: id }),
      alternarPautada: () => set((s) => ({ pautada: !s.pautada })),
      buscar: (busca) => set({ busca }),
      alternarGrupo: (c) => set((s) => ({ gruposFechados: s.gruposFechados.includes(c) ? s.gruposFechados.filter((x) => x !== c) : [...s.gruposFechados, c] })),
      abrirGrupo: (c) => set((s) => ({ gruposFechados: s.gruposFechados.filter((x) => x !== c) })),
      recolherTodos: (chaves) => set({ gruposFechados: chaves }),
      expandirTodos: () => set({ gruposFechados: [] }),
    }),
    { name: 'ciclo-estudos.resumos', partialize: (s) => ({ notaId: s.notaId, pautada: s.pautada, gruposFechados: s.gruposFechados }) },
  ),
)
