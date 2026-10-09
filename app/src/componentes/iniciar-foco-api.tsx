import { IniciarFoco } from '@/componentes/IniciarFoco'
import { carregarCiclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { abrirDialogo } from '@/estado/dialogo'
import { usePomodoro, type AlvoFoco } from '@/estado/pomodoro'

/** Pergunta o que será estudado e guarda a escolha. Devolve `false` se ela cancelou. */
export async function escolherAlvo(): Promise<boolean> {
  const { semana } = await carregarCiclo(db)
  if (!semana) return true // sem semana não há passo para escolher: começa direto
  const p = usePomodoro.getState()
  const a = await abrirDialogo<AlvoFoco>('O que você vai estudar?', (fechar) => <IniciarFoco semana={semana} inicial={p.alvo ?? p.ultimoAlvo} fechar={fechar} />)
  if (!a) return false
  p.definirAlvo(a)
  return true
}

/** Botão Iniciar/Pausar: ao começar um foco novo, pergunta primeiro o que será estudado. */
export async function iniciarOuPausar(): Promise<void> {
  const p = usePomodoro.getState()
  if (!p.rodando && p.fase === 'foco' && !p.alvo && !(await escolherAlvo())) return
  usePomodoro.getState().alternar()
}
