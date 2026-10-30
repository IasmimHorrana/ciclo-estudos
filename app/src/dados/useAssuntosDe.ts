import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/dados/db'

/** Assuntos vivos de uma matéria, na ordem do edital. `undefined` enquanto lê o banco. */
export const useAssuntosDe = (materia: string) =>
  useLiveQuery(
    async () => (await db.assuntos.toArray()).filter((a) => a.excluidoEm === null && a.materia === materia).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')),
    [materia],
  )
