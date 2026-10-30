import { Entrada } from '@/componentes/ui/entrada'
import { pctDe } from '@/dominio/desempenho'

const rotulo = 'flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase'

/** Questões feitas × acertos, com o % na hora. Os valores ficam como texto (campo vazio = 0). */
export function CamposQuestoes({ feitas, acertos, aoMudar }: { feitas: string; acertos: string; aoMudar: (feitas: string, acertos: string) => void }) {
  const f = Number(feitas) || 0
  const a = Number(acertos) || 0
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <label className={rotulo}>
        Questões feitas
        <Entrada type="number" min={0} inputMode="numeric" className="px-1.5 text-center" value={feitas} onChange={(e) => aoMudar(e.target.value, acertos)} />
      </label>
      <label className={rotulo}>
        Acertos
        <Entrada type="number" min={0} max={f || undefined} inputMode="numeric" className="px-1.5 text-center" value={acertos} onChange={(e) => aoMudar(feitas, e.target.value)} />
      </label>
      <span className="w-12 pb-2 text-center text-sm font-bold tabular-nums" aria-live="polite" title="Acertos">
        {f > 0 && a <= f ? `${pctDe(a, f)}%` : '—'}
      </span>
    </div>
  )
}
