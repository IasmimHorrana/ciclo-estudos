import { corDe, fmtH, type Passo } from '@/dominio/ciclo'
import { arcoAnel } from '@/dominio/graficos'

interface Fatia {
  nome: string
  valor: number
  cor: string
  rotulo: string
}

/** Rosca com legenda; `centro` e `sub` aparecem no meio. */
export function Rosca({ dados, centro, sub }: { dados: Fatia[]; centro: string; sub: string }) {
  const vivos = dados.filter((d) => d.valor > 0)
  const total = vivos.reduce((a, d) => a + d.valor, 0)
  if (!total) return <p className="text-center text-sm text-muted-foreground">Sem dados no período.</p>
  const inicios = vivos.map((_, i) => -Math.PI / 2 + (vivos.slice(0, i).reduce((a, d) => a + d.valor, 0) / total) * Math.PI * 2)
  return (
    <div>
      <svg viewBox="0 0 180 180" role="img" aria-label={sub} className="mx-auto block size-44 max-h-[28dvh]">
        {vivos.map((d, i) => {
          const ang = Math.min((d.valor / total) * Math.PI * 2, Math.PI * 2 - 0.0001)
          const caminho = arcoAnel(90, 90, 82, 54, inicios[i] as number, (inicios[i] as number) + ang)
          return (
            <path key={d.nome} d={caminho} fill={d.cor} stroke="var(--card)" strokeWidth="1.5">
              <title>{`${d.nome}: ${d.rotulo}`}</title>
            </path>
          )
        })}
        <text x="90" y="88" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--foreground)">{centro}</text>
        <text x="90" y="106" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{sub}</text>
      </svg>
      <Legenda itens={vivos.map((d) => ({ nome: `${d.nome} · ${d.rotulo}`, cor: d.cor }))} />
    </div>
  )
}

export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
      {itens.map((i) => (
        <span key={i.nome} className="inline-flex items-center gap-1">
          <i className="inline-block size-2 rounded-full" style={{ background: i.cor }} />
          {i.nome}
        </span>
      ))}
    </div>
  )
}

/** Um segmento por passo: feito = cor cheia, pendente = clara. */
export function RoscaCiclo({ passos, cores }: { passos: Passo[]; cores: Record<string, number> }) {
  const n = passos.length
  if (!n) return null
  const fatia = (Math.PI * 2) / n
  const gap = Math.min(0.03, fatia * 0.25)
  const feitos = passos.filter((p) => p.feito).length
  const materias = [...new Set(passos.map((p) => p.materia))]
  return (
    <div>
      <svg viewBox="0 0 180 180" role="img" aria-label="Ciclo da semana" className="mx-auto block size-44 max-h-[28dvh]">
        {passos.map((p, i) => (
          <path
            key={p.id}
            d={arcoAnel(90, 90, 82, 54, -Math.PI / 2 + i * fatia + gap / 2, -Math.PI / 2 + (i + 1) * fatia - gap / 2)}
            fill={corDe(cores, p.materia)}
            opacity={p.feito ? 1 : 0.32}
          >
            <title>{`${p.id}. ${p.materia}${p.feito ? ' ✓' : ''}`}</title>
          </path>
        ))}
        <text x="90" y="88" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">{`${feitos}/${n}`}</text>
        <text x="90" y="106" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">passos feitos</text>
      </svg>
      <Legenda itens={materias.map((m) => ({ nome: m, cor: corDe(cores, m) }))} />
    </div>
  )
}

/** Pizza de horas por matéria (resumo ao fechar a semana). */
export function Pizza({ porMateria, cores }: { porMateria: Record<string, number>; cores: Record<string, number> }) {
  const dados = Object.entries(porMateria)
    .map(([nome, valor]) => ({ nome, valor }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor)
  const total = dados.reduce((a, d) => a + d.valor, 0)
  if (!total) return <p className="text-center text-sm text-muted-foreground">Nenhuma hora registrada nesta semana.</p>
  const R = 80
  const C = 90
  const inicios = dados.map((_, i) => -Math.PI / 2 + (dados.slice(0, i).reduce((a, d) => a + d.valor, 0) / total) * Math.PI * 2)
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <svg viewBox="0 0 180 180" width="160" height="160" role="img" aria-label="Horas por matéria">
        {dados.length === 1 ? (
          <circle cx={C} cy={C} r={R} fill={corDe(cores, dados[0]!.nome)} />
        ) : (
          dados.map((d, i) => {
            const a0 = inicios[i] as number
            const ang = (d.valor / total) * Math.PI * 2
            const a1 = a0 + ang
            const x0 = C + R * Math.cos(a0)
            const y0 = C + R * Math.sin(a0)
            const x1 = C + R * Math.cos(a1)
            const y1 = C + R * Math.sin(a1)
            return (
              <path key={d.nome} d={`M${C} ${C} L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${ang > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`} fill={corDe(cores, d.nome)} stroke="var(--card)" strokeWidth="2">
                <title>{`${d.nome}: ${fmtH(d.valor)}`}</title>
              </path>
            )
          })
        )}
      </svg>
      <div className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
        {dados.map((d) => (
          <div key={d.nome} className="flex items-center gap-2">
            <i className="size-2.5 shrink-0 rounded-full" style={{ background: corDe(cores, d.nome) }} />
            <span className="flex-1 truncate">{d.nome}</span>
            <b>{fmtH(d.valor)}</b>
            <span className="text-xs text-muted-foreground">{Math.round((d.valor / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
