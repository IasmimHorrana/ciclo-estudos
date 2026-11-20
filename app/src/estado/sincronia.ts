import { create } from 'zustand'

/**
 * desligado: fora da conta · sincronizando · ok · offline: sem internet (tenta de novo quando voltar)
 * erro · atualize: a nuvem pede um app mais novo · aguardando: primeira vez esperando a escolha dela
 */
export type EstadoSincronia = 'desligado' | 'sincronizando' | 'ok' | 'offline' | 'erro' | 'atualize' | 'aguardando'

interface SincroniaState {
  estado: EstadoSincronia
  /** Hora (deste aparelho) da última sincronização completa; 0 = nunca. */
  ultima: number
  /** Mudanças deste aparelho que ainda não foram para a nuvem. */
  pendentes: number
  erro: string
}

export const useSincronia = create<SincroniaState>()(() => ({ estado: 'desligado', ultima: 0, pendentes: 0, erro: '' }))

const hora = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Frase do estado da sincronização (também usada no rodapé da barra lateral). */
export function textoSincronia(estado: EstadoSincronia, ultima: number, pendentes: number, erro: string): string {
  const espera = pendentes > 0 ? ` · ${pendentes} mudança(s) esperando` : ''
  switch (estado) {
    case 'sincronizando':
      return 'Sincronizando…'
    case 'ok':
      return `Sincronizado às ${hora(ultima)}${espera}`
    case 'offline':
      return `Sem internet${espera || ''}. Sincroniza quando a conexão voltar.`
    case 'aguardando':
      return 'Primeira sincronização esperando a sua escolha. Clique em "Sincronizar agora".'
    case 'atualize':
      return erro || 'Atualize o app para continuar sincronizando.'
    case 'erro':
      return `${erro || 'Erro ao sincronizar.'}${espera}`
    default:
      return 'Sincronização desligada.'
  }
}
