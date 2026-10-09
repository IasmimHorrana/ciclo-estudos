import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCiclo } from '@/dados/useCiclo'
import { NOMES_DIA, fmtData, hoje, mesGrade, parseISO, tituloMes } from '@/dominio/datas'
import { abrirDialogo } from '@/estado/dialogo'
import { useUi } from '@/estado/ui'
import { irParaDia } from '@/lib/rolagem'
import { ResumoDaSemana } from '@/telas/Semana'
import { Button } from '@/componentes/ui/button'
import { cn } from '@/lib/utils'

/** Calendário do mês (segunda a domingo): semana em andamento, semanas fechadas (verde = ciclo fechado, laranja = incompleto) e pontos nos dias com passos. */
export function MiniCalendario() {
  const hojeIso = hoje()
  const h = parseISO(hojeIso)
  const [vis, setVis] = useState({ ano: h.getFullYear(), mes: h.getMonth() })
  const grade = mesGrade(vis.ano, vis.mes)
  const ciclo = useCiclo()
  const irParaAba = useUi((u) => u.irParaAba)
  const semana = ciclo?.semana ?? null

  function aoClicar(iso: string) {
    if (semana && iso >= semana.seg && iso <= semana.dom) {
      irParaAba('semana')
      setTimeout(() => irParaDia(iso), 50)
      return
    }
    const f = ciclo?.fechadas.find((x) => iso >= x.inicio && iso <= x.fim)
    if (f && ciclo) {
      void abrirDialogo(`Semana ${fmtData(f.inicio)} → ${fmtData(f.fim)}`, (fechar) => (
        <>
          <ResumoDaSemana r={f} cores={ciclo.cores} />
          <div className="mt-4 flex justify-end"><Button onClick={() => fechar()}>Fechar</Button></div>
        </>
      ))
    }
  }

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
        {grade.map((c) => {
          const naSemana = !!semana && c.iso >= semana.seg && c.iso <= semana.dom
          const fech = ciclo?.fechadas.find((x) => c.iso >= x.inicio && c.iso <= x.fim)
          const ps = semana ? semana.passos.filter((p) => p.dia === c.iso) : []
          const dica = fmtData(c.iso) + (ps.length ? ` · ${ps.filter((p) => p.feito).length}/${ps.length} passos` : '') + (fech ? (fech.cicloFechado ? ' · ciclo fechado' : ' · semana incompleta') : '')
          return (
            <button
              key={c.iso}
              title={dica}
              onClick={() => aoClicar(c.iso)}
              className={cn(
                'relative h-6 rounded-lg text-xs hover:bg-accent',
                !c.doMes && 'opacity-45',
                naSemana && 'bg-accent',
                fech && (fech.cicloFechado ? 'shadow-[inset_0_-2px_0_var(--ok)]' : 'shadow-[inset_0_-2px_0_var(--aviso)]'),
                c.iso === hojeIso && 'bg-primary font-bold text-primary-foreground hover:bg-primary',
              )}
            >
              {Number(c.iso.slice(8))}
              {ps.length > 0 && <i className={cn('absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full', ps.every((p) => p.feito) ? 'bg-ok' : 'bg-primary')} />}
            </button>
          )
        })}
      </div>
      <p className="m-0 mt-1 text-[0.65rem] text-muted-foreground">
        <span className="text-ok">▬</span> fechado · <span className="text-aviso">▬</span> incompleto · <span className="text-primary">●</span> passos
      </p>
    </div>
  )
}
