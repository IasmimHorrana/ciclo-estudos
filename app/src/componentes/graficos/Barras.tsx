import type { ColunaColorida } from '@/lib/colunas'

/** Barras empilhadas por dia. `fmt` formata o total em cima de cada barra. */
export function Barras({ cols, fmt }: { cols: ColunaColorida[]; fmt: (v: number) => string }) {
  const W = 640
  const H = 170
  const pad = 16
  const base = H - 24
  const tot = (c: ColunaColorida) => c.partes.reduce((a, p) => a + p.v, 0)
  const max = Math.max(0, ...cols.map(tot))
  if (!max) return <p className="text-center text-sm text-muted-foreground">Sem dados no período.</p>
  const n = cols.length
  const passo = (W - pad * 2) / n
  const bw = Math.max(4, Math.min(34, passo * 0.62))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" className="max-h-44">
      {cols.map((c, i) => {
        const x = pad + i * passo + (passo - bw) / 2
        let y = base
        const rects = c.partes.map((p, k) => {
          const h = (p.v / max) * (base - 20)
          if (h <= 0) return null
          y -= h
          return (
            <rect key={k} x={x.toFixed(1)} y={y.toFixed(1)} width={bw.toFixed(1)} height={h.toFixed(1)} rx="2" fill={p.cor}>
              <title>{`${p.t}: ${fmt(p.v)}`}</title>
            </rect>
          )
        })
        return (
          <g key={i}>
            {rects}
            {tot(c) > 0 && n <= 14 && (
              <text x={(x + bw / 2).toFixed(1)} y={(y - 4).toFixed(1)} textAnchor="middle" fontSize="10" fill="var(--foreground)">{fmt(tot(c))}</text>
            )}
            {(n <= 10 || i % Math.ceil(n / 10) === 0) && (
              <text x={(x + bw / 2).toFixed(1)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{c.label}</text>
            )}
          </g>
        )
      })}
      <line x1={pad} x2={W - pad} y1={base} y2={base} stroke="var(--border)" />
    </svg>
  )
}
