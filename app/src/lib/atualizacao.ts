/**
 * Quando uma versão nova do app assume (service worker), recarrega a página para ela passar a valer,
 * sem cortar um Pomodoro em andamento: nesse caso espera o relógio parar.
 * Na primeira instalação (ainda sem versão anterior no controle) não recarrega.
 */
export function recarregarAoAtualizar(
  sw: Pick<ServiceWorkerContainer, 'controller' | 'addEventListener'> | undefined,
  pomodoroRodando: () => boolean,
  observarPomodoro: (fn: () => void) => () => void,
  recarregar: () => void,
): void {
  if (!sw) return
  let jaTinhaVersao = !!sw.controller
  sw.addEventListener('controllerchange', () => {
    if (!jaTinhaVersao) {
      jaTinhaVersao = true
      return
    }
    if (!pomodoroRodando()) return recarregar()
    const parar = observarPomodoro(() => {
      if (pomodoroRodando()) return
      parar()
      recarregar()
    })
  })
}
