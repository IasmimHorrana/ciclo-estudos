import { lerCronometroSalvo, type CronometroSalvo } from '@/dominio/cronometro'
import { useCronometro } from '@/estado/cronometro'

const CHAVE = 'ciclo-estudos.cronometro'

/** O que foi guardado da última vez (ou `null`). Nunca lança erro: sem armazenamento, o app só começa do zero. */
export function lerCronometroGravado(): CronometroSalvo | null {
  try {
    return lerCronometroSalvo(localStorage.getItem(CHAVE))
  } catch {
    return null
  }
}

/** Guarda o estado atual do cronômetro livre, com o instante em que o app foi visto. */
export function gravarCronometro(agora = Date.now()): void {
  const { rodando, inicioMs, acumuladoSeg, alvo } = useCronometro.getState()
  const salvo: CronometroSalvo = { rodando, inicioMs, acumuladoSeg, alvo, visto: agora }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(salvo))
  } catch {
    /* sem armazenamento: segue sem guardar */
  }
}

/** Passa a guardar o cronômetro a cada mudança, ao esconder/fechar a página e a cada 5 segundos (como o Pomodoro). */
export function iniciarGravacaoCronometro(): void {
  useCronometro.subscribe(() => gravarCronometro())
  const aoSair = () => gravarCronometro()
  window.addEventListener('pagehide', aoSair)
  document.addEventListener('visibilitychange', aoSair)
  setInterval(() => {
    if (useCronometro.getState().rodando) gravarCronometro()
  }, 5000)
}
