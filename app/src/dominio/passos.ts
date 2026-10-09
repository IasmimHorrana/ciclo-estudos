/** "1 10" → [1, 10]; vírgula decimal aceita ("1,5"). Devolve null se algo não for número positivo. */
export function lerPassos(t: string): number[] | null {
  const partes = t.trim().split(/\s+/).filter(Boolean)
  const n = partes.map((p) => Number(p.replace(',', '.')))
  return n.every((x) => Number.isFinite(x) && x > 0) ? n : null
}
