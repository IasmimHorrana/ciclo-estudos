// Omissões de texto (cloze) no formato do Anki: "A capital do Brasil é {{c1::Brasília::dica}}".
// Cada número (c1, c2...) gera um cartão. Omissões aninhadas não são suportadas.

const RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g

/** Números de cartão presentes no texto, em ordem e sem repetir: "{{c2::a}} {{c1::b}}" → [1, 2]. */
export function indicesCloze(texto: string): number[] {
  const s = new Set<number>()
  for (const m of texto.matchAll(RE)) s.add(Number(m[1]))
  return [...s].sort((a, b) => a - b)
}

/**
 * Texto do cartão `n`. Na frente, a omissão do cartão `n` vira `[...]` (ou `[dica]`); no verso, aparece
 * destacada. As omissões de outros números aparecem como texto normal nos dois lados.
 */
export function renderizarCloze(texto: string, n: number, lado: 'frente' | 'verso'): string {
  return texto.replace(RE, (_t, num: string, resposta: string, dica?: string) => {
    if (Number(num) !== n) return resposta
    if (lado === 'verso') return `<span class="cloze">${resposta}</span>`
    return `<span class="cloze">[${dica ? dica : '...'}]</span>`
  })
}

/** Insere a omissão `{{cN::trecho}}` no trecho selecionado: o próximo número livre se `n` não for dado. */
export function envolverCloze(texto: string, inicio: number, fim: number, n?: number): string {
  const num = n ?? Math.max(0, ...indicesCloze(texto)) + 1
  return `${texto.slice(0, inicio)}{{c${num}::${texto.slice(inicio, fim)}}}${texto.slice(fim)}`
}
