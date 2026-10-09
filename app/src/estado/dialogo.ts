import type { ReactNode } from 'react'
import { create } from 'zustand'

/** Um diálogo aberto: `render` recebe a função que fecha e devolve um valor a quem abriu. */
interface Aberto {
  titulo: string
  render: (fechar: (valor?: unknown) => void) => ReactNode
  resolver: (valor: unknown) => void
}

interface DialogoState {
  atual: Aberto | null
  fechar: (valor?: unknown) => void
}

export const useDialogo = create<DialogoState>((set, get) => ({
  atual: null,
  fechar: (valor) => {
    const a = get().atual
    if (!a) return
    set({ atual: null })
    a.resolver(valor ?? null)
  },
}))

/** Abre um diálogo com conteúdo próprio. Resolve com o valor passado a `fechar` (ou `null` ao cancelar). */
export function abrirDialogo<T = unknown>(titulo: string, render: Aberto['render']): Promise<T | null> {
  // se já havia um aberto, ele é cancelado
  useDialogo.getState().fechar(null)
  return new Promise<T | null>((resolver) => {
    useDialogo.setState({ atual: { titulo, render, resolver: resolver as (v: unknown) => void } })
  })
}
