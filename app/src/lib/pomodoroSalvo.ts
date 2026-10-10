import { lerPomodoroSalvo, type PomodoroSalvo } from '@/dominio/pomodoro'
import { usePomodoro } from '@/estado/pomodoro'

const CHAVE = 'ciclo-estudos.pomodoro'

/** O que foi guardado da última vez (ou `null`). Nunca lança erro: sem armazenamento, o app só começa do zero. */
export function lerPomodoroGravado(): PomodoroSalvo | null {
  try {
    return lerPomodoroSalvo(localStorage.getItem(CHAVE))
  } catch {
    return null
  }
}

/** Guarda o estado atual do cronômetro, com o instante em que o app foi visto. */
export function gravarPomodoro(agora = Date.now()): void {
  const { fase, rodando, fimMs, restaSeg, focosConcluidos, alvo } = usePomodoro.getState()
  const salvo: PomodoroSalvo = { fase, rodando, fimMs, restaSeg, focosConcluidos, alvo, visto: agora }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(salvo))
  } catch {
    /* sem armazenamento (janela anônima cheia, bloqueado): segue sem guardar */
  }
}

/**
 * Passa a guardar o cronômetro a cada mudança (o relógio muda a cada segundo enquanto roda), ao esconder/fechar a página
 * e a cada 5 segundos por garantia. É isso que permite voltar de onde parou depois de fechar o navegador ou faltar luz.
 */
export function iniciarGravacaoPomodoro(): void {
  usePomodoro.subscribe(() => gravarPomodoro())
  const aoSair = () => gravarPomodoro()
  window.addEventListener('pagehide', aoSair)
  document.addEventListener('visibilitychange', aoSair)
  setInterval(() => {
    if (usePomodoro.getState().rodando) gravarPomodoro()
  }, 5000)
}
