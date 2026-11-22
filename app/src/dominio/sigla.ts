/** Palavras que não entram na sigla ("Administração Financeira e Orçamentária" → AFO). */
const LIGACOES = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'com', 'ao', 'aos', 'à', 'às'])

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Sigla curta de uma matéria, para a etiqueta colorida.
 * Uma palavra: as 4 primeiras letras (Informática → INFO). Duas: a inicial da primeira e 3 letras da segunda
 * (Direito Administrativo → DADM, Conhecimentos Específicos → CESP). Três ou mais: as iniciais, até 4 (AFO).
 * Um nome que já é sigla (até 5 letras maiúsculas) fica como está.
 */
export function siglaDe(nome: string): string {
  const palavras = semAcento(nome)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p && !LIGACOES.has(p.toLowerCase()))
  if (palavras.length === 0) return '?'
  // a matéria já é uma sigla (ex.: "AFO", "TI")
  const unica = palavras.length === 1 ? (palavras[0] ?? '') : ''
  if (unica && unica === unica.toUpperCase() && unica.length <= 5) return unica
  let s: string
  if (palavras.length === 1) s = (palavras[0] ?? '').slice(0, 4)
  else if (palavras.length === 2) s = (palavras[0] ?? '').slice(0, 1) + (palavras[1] ?? '').slice(0, 3)
  else s = palavras.map((p) => p.slice(0, 1)).join('').slice(0, 4)
  return s.toUpperCase()
}
