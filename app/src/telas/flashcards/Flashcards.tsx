import { useEffect } from 'react'
import { db } from '@/dados/db'
import { garantirPadroes, limparBaralhosAutomaticosVazios } from '@/dados/flashcards'
import { useFc } from '@/estado/flashcards'
import { Adicionar } from '@/telas/flashcards/Adicionar'
import { Baralhos } from '@/telas/flashcards/Baralhos'
import { Estatisticas } from '@/telas/flashcards/Estatisticas'
import { Estudo } from '@/telas/flashcards/Estudo'
import { OpcoesDoBaralho } from '@/telas/flashcards/OpcoesDoBaralho'

export function Flashcards() {
  const vista = useFc((s) => s.vista)

  // garante os padrões e tira os baralhos vazios que antes eram criados sozinhos das matérias/assuntos
  useEffect(() => {
    void garantirPadroes(db).then(() => limparBaralhosAutomaticosVazios(db))
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {vista === 'baralhos' && <Baralhos />}
      {vista === 'estudo' && <Estudo />}
      {vista === 'adicionar' && <Adicionar />}
      {vista === 'opcoes' && <OpcoesDoBaralho />}
      {vista === 'estatisticas' && <Estatisticas />}
    </div>
  )
}
