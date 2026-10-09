import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AbaId = 'montar' | 'semana' | 'desempenho' | 'resumos' | 'flashcards' | 'dados'
export type Tema = 'auto' | 'light' | 'dark'

interface UiState {
  aba: AbaId
  tema: Tema
  irParaAba: (aba: AbaId) => void
  alternarTema: () => void
}

/** Escuro "agora"? (resolve o modo automático pelo sistema) */
export function temaEscuro(tema: Tema): boolean {
  if (tema === 'dark') return true
  if (tema === 'light') return false
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      aba: 'montar',
      tema: 'auto',
      irParaAba: (aba) => set({ aba }),
      alternarTema: () => set({ tema: temaEscuro(get().tema) ? 'light' : 'dark' }),
    }),
    { name: 'ciclo-estudos.ui' },
  ),
)
