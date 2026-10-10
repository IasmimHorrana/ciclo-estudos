import { Button } from '@/componentes/ui/button'
import { fmtMMSS } from '@/dominio/pomodoro'

export type EscolhaRestaurar = 'continuar' | 'somar' | 'descartar'

/** O app foi fechado com um foco rodando: o que fazer com ele? */
export function RestaurarPomodoro({
  minutosEstudados, minutosFora, restaSeg, rotulo, fechar,
}: { minutosEstudados: number; minutosFora: number; restaSeg: number; rotulo: string | null; fechar: (e: EscolhaRestaurar) => void }) {
  const horasFora = minutosFora >= 90 ? `${Math.floor(minutosFora / 60)} h ${minutosFora % 60} min` : `${minutosFora} min`
  return (
    <>
      <p className="mt-0 mb-1 text-sm">
        O app foi fechado com um foco rodando{rotulo ? <> (<b>{rotulo}</b>)</> : null} e voltou depois de cerca de <b>{horasFora}</b>.
        Até o último momento em que ele estava aberto, você tinha estudado <b>{minutosEstudados} min</b>.
      </p>
      <p className="m-0 mb-3 text-xs text-muted-foreground">Como não dá para saber o que você fez com o app fechado, escolha o que contar.</p>
      <div className="flex flex-col gap-2">
        <Button disabled={minutosEstudados < 1} onClick={() => fechar('somar')}>
          Somar {minutosEstudados} min estudados e encerrar este foco
        </Button>
        <Button variant="outline" onClick={() => fechar('continuar')}>
          Continuar o foco de onde parou (faltam {fmtMMSS(restaSeg)})
        </Button>
        <Button variant="outline" onClick={() => fechar('descartar')}>
          Descartar este foco
        </Button>
      </div>
    </>
  )
}
