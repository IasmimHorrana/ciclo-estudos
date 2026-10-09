import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ModoEditor = 'editar' | 'dividido' | 'ver'
export const CHAVE_SEM_MATERIA = '__sem__'

interface ResumosUi {
  notaId: string | null
  modo: ModoEditor
  busca: string
  /** Matérias com a lista de notas recolhida. */
  gruposFechados: string[]
  selecionar: (id: string | null) => void
  definirModo: (m: ModoEditor) => void
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
      modo: 'dividido',
      busca: '',
      gruposFechados: [],
      selecionar: (id) => set({ notaId: id }),
      definirModo: (modo) => set({ modo }),
      buscar: (busca) => set({ busca }),
      alternarGrupo: (c) => set((s) => ({ gruposFechados: s.gruposFechados.includes(c) ? s.gruposFechados.filter((x) => x !== c) : [...s.gruposFechados, c] })),
      abrirGrupo: (c) => set((s) => ({ gruposFechados: s.gruposFechados.filter((x) => x !== c) })),
      recolherTodos: (chaves) => set({ gruposFechados: chaves }),
      expandirTodos: () => set({ gruposFechados: [] }),
    }),
    { name: 'ciclo-estudos.resumos', partialize: (s) => ({ notaId: s.notaId, modo: s.modo, gruposFechados: s.gruposFechados }) },
  ),
)
