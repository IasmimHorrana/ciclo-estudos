import { CalendarDays, Layers, ListChecks, NotebookPen, Puzzle, TrendingUp, type LucideIcon } from 'lucide-react'
import type { AbaId } from '@/estado/ui'

/** Abas do menu (barra lateral no computador, gaveta no celular). "Dados" fica fora: abre pelo botão de backup. */
export const ABAS: { id: AbaId; rotulo: string; Icone: LucideIcon }[] = [
  { id: 'montar', rotulo: 'Montar ciclo', Icone: Puzzle },
  { id: 'semana', rotulo: 'Semana', Icone: CalendarDays },
  { id: 'desempenho', rotulo: 'Desempenho', Icone: TrendingUp },
  { id: 'edital', rotulo: 'Edital', Icone: ListChecks },
  { id: 'resumos', rotulo: 'Resumos', Icone: NotebookPen },
  { id: 'flashcards', rotulo: 'Flashcards', Icone: Layers },
]
