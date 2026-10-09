import { create } from 'zustand'

/** inativo: sem pasta · ok · gravando · permissao: precisa reconectar (clique) · erro */
export type EstadoPasta = 'inativo' | 'ok' | 'gravando' | 'permissao' | 'erro'

interface BackupState {
  estado: EstadoPasta
  nomePasta: string
  ultimoBackup: number
  erro: string
}

export const useBackup = create<BackupState>()(() => ({ estado: 'inativo', nomePasta: '', ultimoBackup: 0, erro: '' }))
