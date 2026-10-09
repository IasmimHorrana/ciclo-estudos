import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { carregarCiclo, type Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { hoje, type DataISO } from '@/dominio/datas'

/** O ciclo (configuração, semana, histórico, modelos, cores). `undefined` enquanto lê o banco. */
export const useCiclo = (): Ciclo | undefined => useLiveQuery(() => carregarCiclo(db), [])

/** A data de hoje, que se atualiza sozinha na virada do dia (o app pode ficar aberto a noite toda). */
export function useHojeISO(): DataISO {
  const [h, setH] = useState(() => hoje())
  useEffect(() => {
    const id = setInterval(() => setH(hoje()), 30_000)
    return () => clearInterval(id)
  }, [])
  return h
}
