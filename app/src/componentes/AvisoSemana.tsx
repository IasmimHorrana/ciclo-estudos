import { Button } from '@/componentes/ui/button'
import { useCiclo, useHojeISO } from '@/dados/useCiclo'
import { fmtData } from '@/dominio/datas'
import { useUi } from '@/estado/ui'

/** Faixa no topo quando a semana em andamento já passou do domingo: lembra de fechar para salvar as estatísticas. */
export function AvisoSemana() {
  const ciclo = useCiclo()
  const hojeISO = useHojeISO()
  const aba = useUi((s) => s.aba)
  const irParaAba = useUi((s) => s.irParaAba)
  const s = ciclo?.semana
  if (!s || hojeISO <= s.dom) return null
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-aviso-bg px-3 py-2 text-sm font-semibold text-aviso">
      <span>📅 A semana {fmtData(s.seg)} → {fmtData(s.dom)} já terminou. Feche-a para salvar as estatísticas.</span>
      {aba !== 'semana' && (
        <Button size="sm" variant="outline" onClick={() => irParaAba('semana')}>
          Ir para a semana
        </Button>
      )}
    </div>
  )
}
