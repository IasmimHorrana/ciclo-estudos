import { create } from 'zustand'

/** carregando: lendo a sessão guardada · fora · dentro · semNuvem: o app não tem endereço/chave da nuvem */
export type EstadoConta = 'carregando' | 'fora' | 'dentro' | 'semNuvem'

interface ContaState {
  estado: EstadoConta
  email: string
  /** Id do usuário no Supabase (vazio fora da conta). */
  usuarioId: string
}

export const useConta = create<ContaState>()(() => ({ estado: 'carregando', email: '', usuarioId: '' }))
