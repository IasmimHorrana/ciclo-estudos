import { RegistrarTempo } from '@/componentes/RegistrarTempo'
import { carregarCiclo, contarPomodoro, registrarTempo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { abrirDialogo } from '@/estado/dialogo'
import { usePomodoro, type FocoConcluido } from '@/estado/pomodoro'

/**
 * Um foco terminou: conta o pomodoro na semana e soma o tempo ao passo escolhido ao clicar em Iniciar.
 * Sem escolha (ou se o passo não existe mais), pergunta a qual passo somar.
 */
export async function aoConcluirFoco(f: FocoConcluido): Promise<void> {
  const pomo = usePomodoro.getState()
  const alvo = pomo.alvo
  pomo.limparFoco()
  pomo.definirAlvo(null)
  if (f.completo) await contarPomodoro(db)
  if (alvo?.passoId === 0) return // "estudar sem registrar"
  const { semana } = await carregarCiclo(db)
  if (!semana) return
  if (alvo && semana.passos.some((p) => p.id === alvo.passoId)) {
    await registrarTempo(db, { passoId: alvo.passoId, minutos: f.minutos, tipo: alvo.tipo, assuntoId: alvo.assuntoId, feito: false })
    return
  }
  await abrirDialogo(`Foco concluído: ${f.minutos} min`, (fechar) => <RegistrarTempo semana={semana} minutos={f.minutos} fechar={() => fechar()} />)
}
