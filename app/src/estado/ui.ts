import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AbaId = 'montar' | 'semana' | 'desempenho' | 'resumos' | 'edital' | 'flashcards' | 'dados'
export type Tema = 'auto' | 'light' | 'dark'
/** Relógio da barra lateral: Pomodoro (blocos) ou cronômetro livre. */
export type Relogio = 'pomodoro' | 'livre'

/** Paletas de cor (as variáveis de cada uma ficam em index.css, em [data-paleta]) */
export const PALETAS = [
  { id: 'menta', nome: 'Verde-menta' },
  { id: 'trigo', nome: 'Trigo' },
] as const
export type PaletaId = (typeof PALETAS)[number]['id']

interface UiState {
  aba: AbaId
  tema: Tema
  paleta: PaletaId
  relogio: Relogio
  irParaAba: (aba: AbaId) => void
  escolherRelogio: (r: Relogio) => void
  alternarTema: () => void
  trocarPaleta: () => void
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
      paleta: 'menta',
      relogio: 'pomodoro',
      irParaAba: (aba) => set({ aba }),
      escolherRelogio: (relogio) => set({ relogio }),
      alternarTema: () => set({ tema: temaEscuro(get().tema) ? 'light' : 'dark' }),
      trocarPaleta: () => {
        const i = PALETAS.findIndex((p) => p.id === get().paleta)
        set({ paleta: (PALETAS[(i + 1) % PALETAS.length] ?? PALETAS[0]).id })
      },
    }),
    { name: 'ciclo-estudos.ui' },
  ),
)
