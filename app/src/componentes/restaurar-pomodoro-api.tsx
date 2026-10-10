import { RestaurarPomodoro, type EscolhaRestaurar } from '@/componentes/RestaurarPomodoro'
import { duracaoSeg, proximaFase, restaurarPomodoro } from '@/dominio/pomodoro'
import { abrirDialogo } from '@/estado/dialogo'
import { usePomodoro } from '@/estado/pomodoro'
import { iniciarGravacaoPomodoro, lerPomodoroGravado } from '@/lib/pomodoroSalvo'

let iniciada = false

/**
 * Ao abrir o app: devolve o cronômetro ao ponto em que estava (recarregar a página, fechar o navegador, faltar luz)
 * e só depois passa a guardá-lo de novo. Chamar com os tempos do Pomodoro já carregados do banco.
 */
export async function iniciarPersistenciaPomodoro(): Promise<void> {
  if (iniciada) return
  iniciada = true
  const p = usePomodoro.getState()
  const r = restaurarPomodoro(lerPomodoroGravado(), Date.now(), p.config)

  if (r.tipo === 'estado') p.restaurar(r.estado)
  if (r.tipo === 'perguntar') {
    p.restaurar(r.estado)
    iniciarGravacaoPomodoro()
    const rotulo = r.estado.alvo && r.estado.alvo.passoId > 0 ? r.estado.alvo.rotulo : null
    const escolha =
      (await abrirDialogo<EscolhaRestaurar>('Você tinha um foco em andamento', (fechar) => (
        <RestaurarPomodoro minutosEstudados={r.minutosEstudados} minutosFora={r.minutosFora} restaSeg={r.estado.restaSeg} rotulo={rotulo} fechar={(e) => fechar(e)} />
      ))) ?? 'continuar' // fechar a janela sem escolher não perde nada
    const cfg = usePomodoro.getState().config
    const { focosConcluidos, alvo } = r.estado
    if (escolha === 'somar') {
      const prox = r.focoCompleto ? proximaFase('foco', focosConcluidos, cfg) : { fase: 'foco' as const, focosConcluidos }
      usePomodoro.getState().restaurar({ fase: prox.fase, focosConcluidos: prox.focosConcluidos, rodando: false, fimMs: 0, restaSeg: duracaoSeg(prox.fase, cfg), alvo })
      usePomodoro.getState().concluirFoco({ minutos: r.minutosEstudados, completo: r.focoCompleto }) // o App soma ao passo escolhido
    } else if (escolha === 'descartar') {
      usePomodoro.getState().restaurar({ fase: 'foco', focosConcluidos, rodando: false, fimMs: 0, restaSeg: duracaoSeg('foco', cfg), alvo: null })
    }
    return
  }
  iniciarGravacaoPomodoro()
}
