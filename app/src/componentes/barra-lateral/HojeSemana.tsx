import { Button } from '@/componentes/ui/button'
import { marcarPasso } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { useCiclo, useHojeISO } from '@/dados/useCiclo'
import { corDe, fmtH, horasFeitasDe, metaEf } from '@/dominio/ciclo'
import { fmtData, idxDia, NOMES_DIA_LONGO } from '@/dominio/datas'
import { useUi } from '@/estado/ui'
import { cn } from '@/lib/utils'

/** "Hoje e semana" da barra lateral: passos de hoje com caixinha e o progresso de horas. */
export function HojeSemana() {
  const ciclo = useCiclo()
  const hojeISO = useHojeISO()
  const irParaAba = useUi((s) => s.irParaAba)
  const s = ciclo?.semana
  if (!ciclo) return null
  if (!s) {
    return (
      <>
        <p className="m-0 mb-2 text-sm text-muted-foreground">Nenhuma semana em andamento.</p>
        <Button size="sm" variant="outline" onClick={() => irParaAba('montar')}>Montar ciclo</Button>
      </>
    )
  }
  const doDia = s.passos.filter((p) => p.dia === hojeISO)
  const feitos = s.passos.filter((p) => p.feito).length
  const horas = horasFeitasDe(s)
  const meta = metaEf(s)
  const pct = meta ? Math.min(100, Math.round((horas / meta) * 100)) : 0
  return (
    <div className="text-xs">
      <div className="mb-1 text-muted-foreground">
        {NOMES_DIA_LONGO[idxDia(hojeISO)]}, {fmtData(hojeISO)} · hoje {doDia.filter((p) => p.feito).length}/{doDia.length} · semana {feitos}/{s.passos.length}
      </div>
      {doDia.length ? (
        doDia.slice(0, 3).map((p) => (
          <label key={p.id} className={cn('flex cursor-pointer items-center gap-1.5 py-0.5 text-sm', p.feito && 'line-through opacity-60')}>
            <input type="checkbox" checked={p.feito} onChange={(e) => void marcarPasso(db, p.id, e.target.checked)} />
            <i className="size-2 shrink-0 rounded-full" style={{ background: corDe(ciclo.cores, p.materia) }} />
            <span className="truncate" title={p.materia}>{p.materia}</span>
          </label>
        ))
      ) : (
        <p className="m-0 text-muted-foreground">Sem passos hoje.</p>
      )}
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted" title="Horas da semana">
        <i className="block h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-muted-foreground">{fmtH(horas)} de {fmtH(meta)} na semana</div>
    </div>
  )
}
