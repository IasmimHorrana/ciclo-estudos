import { useEffect } from 'react'
import { db } from '@/dados/db'
import { garantirPadroes, sincronizarBaralhos } from '@/dados/flashcards'
import { useFc } from '@/estado/flashcards'
import { Adicionar } from '@/telas/flashcards/Adicionar'
import { Baralhos } from '@/telas/flashcards/Baralhos'
import { Estudo } from '@/telas/flashcards/Estudo'
import { OpcoesDoBaralho } from '@/telas/flashcards/OpcoesDoBaralho'

export function Flashcards() {
  const vista = useFc((s) => s.vista)

  // garante os padrões e cria os baralhos das matérias/assuntos do ciclo que ainda não existem
  useEffect(() => {
    void garantirPadroes(db).then(() => sincronizarBaralhos(db))
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {vista === 'baralhos' && <Baralhos />}
      {vista === 'estudo' && <Estudo />}
      {vista === 'adicionar' && <Adicionar />}
      {vista === 'opcoes' && <OpcoesDoBaralho />}
    </div>
  )
}
