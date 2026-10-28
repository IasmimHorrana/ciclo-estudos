import type { Nivel } from '@/dominio/desempenho'

export const COR_NIVEL: Record<Nivel, string> = { na: 'var(--muted-foreground)', fraco: 'var(--erro)', medio: 'var(--aviso)', bom: 'var(--primary)', dom: 'var(--ok)' }
