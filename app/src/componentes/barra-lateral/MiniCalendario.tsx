import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NOMES_DIA, hoje, mesGrade, parseISO, tituloMes } from '@/dominio/datas'
import { cn } from '@/lib/utils'

/** Calendário do mês (segunda a domingo). Por enquanto só mostra o dia de hoje; as marcações de semanas vêm com os dados. */
export function MiniCalendario() {
  const hojeIso = hoje()
  const h = parseISO(hojeIso)
  const [vis, setVis] = useState({ ano: h.getFullYear(), mes: h.getMonth() })
  const grade = mesGrade(vis.ano, vis.mes)

  const mover = (delta: number) => {
    const n = new Date(vis.ano, vis.mes + delta, 1)
    setVis({ ano: n.getFullYear(), mes: n.getMonth() })
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <button
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => mover(-1)}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          className="flex-1 text-sm font-bold"
          onClick={() => setVis({ ano: h.getFullYear(), mes: h.getMonth() })}
          title="Voltar para o mês de hoje"
        >
          {tituloMes(vis.ano, vis.mes)}
        </button>
        <button
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => mover(1)}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {NOMES_DIA.map((n) => (
          <div key={n} className="py-0.5 text-[0.65rem] font-bold text-muted-foreground">
            {n.charAt(0)}
          </div>
        ))}
        {grade.map((c) => (
          <button
            key={c.iso}
            title={c.iso.split('-').reverse().join('/')}
            className={cn(
              'h-6 rounded-lg text-xs hover:bg-accent',
              !c.doMes && 'opacity-45',
              c.iso === hojeIso && 'bg-primary font-bold text-primary-foreground hover:bg-primary',
            )}
          >
            {Number(c.iso.slice(8))}
          </button>
        ))}
      </div>
    </div>
  )
}
