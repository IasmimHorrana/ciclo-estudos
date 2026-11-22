import { CalendarDays, Layers, ListChecks, NotebookPen, Puzzle, TrendingUp, type LucideIcon } from 'lucide-react'
import type { AbaId } from '@/estado/ui'

/** Abas do menu (barra lateral no computador, gaveta no celular), em grupos. "Dados" fica fora: abre pelo aviso de backup. */
export const GRUPOS: { titulo: string; abas: { id: AbaId; rotulo: string; Icone: LucideIcon }[] }[] = [
  {
    titulo: 'Estudo',
    abas: [
      { id: 'semana', rotulo: 'Semana', Icone: CalendarDays },
      { id: 'montar', rotulo: 'Montar ciclo', Icone: Puzzle },
    ],
  },
  {
    titulo: 'Acompanhamento',
    abas: [
      { id: 'desempenho', rotulo: 'Desempenho', Icone: TrendingUp },
      { id: 'edital', rotulo: 'Edital', Icone: ListChecks },
    ],
  },
  {
    titulo: 'Material',
    abas: [
      { id: 'resumos', rotulo: 'Resumos', Icone: NotebookPen },
      { id: 'flashcards', rotulo: 'Flashcards', Icone: Layers },
    ],
  },
]

export const ABAS = GRUPOS.flatMap((g) => g.abas)
