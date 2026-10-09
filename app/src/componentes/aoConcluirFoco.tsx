import { RegistrarTempo } from '@/componentes/RegistrarTempo'
import { carregarCiclo, contarPomodoro } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { abrirDialogo } from '@/estado/dialogo'
import { usePomodoro, type FocoConcluido } from '@/estado/pomodoro'

/** Um foco terminou: conta o pomodoro na semana e pergunta a qual passo somar o tempo. */
export async function aoConcluirFoco(f: FocoConcluido): Promise<void> {
  usePomodoro.getState().limparFoco()
  if (f.completo) await contarPomodoro(db)
  const { semana } = await carregarCiclo(db)
  if (!semana) return
  await abrirDialogo(`Foco concluído: ${f.minutos} min`, (fechar) => <RegistrarTempo semana={semana} minutos={f.minutos} fechar={() => fechar()} />)
}
