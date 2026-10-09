// Regras dos resumos (notas em Markdown): títulos únicos, ligações [[...]], busca e agrupamento por matéria. Puro.

import { norm } from '@/dominio/markdown'

export interface NotaBasica {
  id: string
  titulo: string
  materia: string
  texto: string
}

/** "Nova nota", "Nova nota (2)"... até não repetir nenhum título (sem diferenciar maiúsculas). */
export function tituloUnico(titulos: string[], base: string): string {
  const t = base.trim() || 'Sem título'
  const usados = new Set(titulos.map(norm))
  let k = 2
  let cand = t
  while (usados.has(norm(cand))) cand = `${t} (${k++})`
  return cand
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Troca `[[antigo]]` por `[[novo]]` em um texto (mantém as ligações quando uma nota é renomeada). */
export function renomearLigacoes(texto: string, antigo: string, novo: string): string {
  const re = new RegExp('\\[\\[\\s*' + escRe(antigo) + '\\s*\\]\\]', 'gi')
  return texto.replace(re, () => `[[${novo}]]`)
}

/** Notas que citam `[[título da nota]]`. */
export function mencionadaEm<T extends NotaBasica>(notas: T[], nota: NotaBasica): T[] {
  const alvo = norm(nota.titulo)
  return notas.filter((o) => o.id !== nota.id && [...o.texto.matchAll(/\[\[([^\]]+)\]\]/g)].some((m) => norm(m[1] as string) === alvo))
}

/** Busca no título e no texto. Busca vazia devolve tudo. */
export function filtrarNotas<T extends NotaBasica>(notas: T[], busca: string): T[] {
  const q = norm(busca)
  return notas.filter((n) => !q || norm(n.titulo).includes(q) || norm(n.texto).includes(q))
}

export interface GrupoDeNotas<T> {
  /** "" = sem matéria */
  materia: string
  notas: T[]
}

/** Agrupa por matéria: primeiro as da lista (na ordem dela), depois as próprias das notas e por último "sem matéria". Grupos vazios somem. */
export function agruparNotas<T extends NotaBasica>(notas: T[], ordem: string[]): GrupoDeNotas<T>[] {
  const mats = [...ordem]
  for (const n of notas) if (n.materia && !mats.includes(n.materia)) mats.push(n.materia)
  mats.push('')
  return mats.map((materia) => ({ materia, notas: notas.filter((n) => (n.materia || '') === materia) })).filter((g) => g.notas.length > 0)
}

/** Sugestões de ligação: notas (menos a atual) cujo título contém o que foi digitado. */
export function sugerirNotas<T extends NotaBasica>(notas: T[], atualId: string, consulta: string, limite = 6): T[] {
  const q = norm(consulta)
  return notas.filter((n) => n.id !== atualId && norm(n.titulo).includes(q)).slice(0, limite)
}
