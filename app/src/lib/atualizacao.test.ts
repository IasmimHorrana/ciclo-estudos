import { describe, expect, it, vi } from 'vitest'
import { recarregarAoAtualizar } from './atualizacao'

function simular(temControle: boolean) {
  let aoTrocar = () => {}
  const sw = { controller: temControle ? ({} as ServiceWorker) : null, addEventListener: (_: string, fn: () => void) => { aoTrocar = fn } }
  let rodando = false
  const ouvintes = new Set<() => void>()
  const recarregar = vi.fn()
  recarregarAoAtualizar(sw as unknown as ServiceWorkerContainer, () => rodando, (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn) }, recarregar)
  return {
    trocar: () => aoTrocar(),
    recarregar,
    parar: () => { rodando = false; ouvintes.forEach((f) => f()) },
    iniciar: () => { rodando = true },
  }
}

describe('recarregarAoAtualizar', () => {
  it('recarrega quando uma versão nova assume e o Pomodoro está parado', () => {
    const s = simular(true)
    s.trocar()
    expect(s.recarregar).toHaveBeenCalledTimes(1)
  })

  it('na primeira instalação não recarrega, mas na troca seguinte sim', () => {
    const s = simular(false)
    s.trocar()
    expect(s.recarregar).not.toHaveBeenCalled()
    s.trocar()
    expect(s.recarregar).toHaveBeenCalledTimes(1)
  })

  it('com o Pomodoro rodando espera ele parar para recarregar (uma vez só)', () => {
    const s = simular(true)
    s.iniciar()
    s.trocar()
    expect(s.recarregar).not.toHaveBeenCalled()
    s.parar()
    s.parar()
    expect(s.recarregar).toHaveBeenCalledTimes(1)
  })

  it('sem service worker no navegador, não faz nada', () => {
    expect(() => recarregarAoAtualizar(undefined, () => false, () => () => {}, () => {})).not.toThrow()
  })
})
