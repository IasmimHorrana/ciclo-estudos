// Geometria dos gráficos em SVG (puro).

/** Caminho SVG de um arco de anel entre os ângulos a0 e a1 (radianos). */
export function arcoAnel(cx: number, cy: number, R: number, r: number, a0: number, a1: number): string {
  const p = (rad: number, a: number): [string, string] => [(cx + rad * Math.cos(a)).toFixed(2), (cy + rad * Math.sin(a)).toFixed(2)]
  const [x0, y0] = p(R, a0)
  const [x1, y1] = p(R, a1)
  const [x2, y2] = p(r, a1)
  const [x3, y3] = p(r, a0)
  const g = a1 - a0 > Math.PI ? 1 : 0
  return `M${x0} ${y0} A${R} ${R} 0 ${g} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${g} 0 ${x3} ${y3} Z`
}
