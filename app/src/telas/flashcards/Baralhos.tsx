import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { carregarContexto, criarBaralho, excluirBaralho, filaDe } from '@/dados/flashcards'
import { useFc } from '@/estado/flashcards'
import { CalendarioCalor } from '@/telas/flashcards/CalendarioCalor'

export function Baralhos() {
  const ir = useFc((s) => s.ir)
  const [tick, setTick] = useState(0)
  const [novo, setNovo] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  // recalcula de vez em quando: cartões em aprendizado vencem com o passar dos minutos
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const ctx = useLiveQuery(() => carregarContexto(db), [tick])

  if (!ctx) return <p className="text-sm text-muted-foreground">Carregando…</p>
  const linhas = [...ctx.baralhos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((b) => ({
    b,
    nivel: b.nome.split('::').length - 1,
    rotulo: b.nome.split('::').pop() ?? b.nome,
    c: filaDe(ctx, b.id).contagem,
  }))

  async function criar() {
    try {
      const b = await criarBaralho(db, novo ?? '')
      setNovo(null)
      setErro('')
      ir('adicionar', b.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar.')
    }
  }

  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir o baralho "${nome}", os subbaralhos e TODOS os cartões dentro dele?`)) return
    await excluirBaralho(db, id)
  }

  const num = (n: number, cor: string) => <span className={n ? cor : 'text-muted-foreground/50'}>{n}</span>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-xl font-bold">Flashcards</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNovo(novo === null ? '' : null)}>
            <Plus className="size-4" /> Baralho
          </Button>
          <Button size="sm" onClick={() => ir('adicionar', null)}>
            <Plus className="size-4" /> Adicionar cartões
          </Button>
        </div>
      </div>

      <CalendarioCalor />

      {novo !== null && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <Entrada
            autoFocus
            className="max-w-sm"
            placeholder='Nome do baralho (use "::" para subbaralho, ex.: Direito::Penal)'
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void criar()}
          />
          <Button size="sm" onClick={() => void criar()}>
            Criar
          </Button>
          {erro && <span className="text-sm text-erro">{erro}</span>}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card shadow-sm">
        {linhas.length === 0 ? (
          <p className="m-0 p-6 text-center text-sm text-muted-foreground">
            Nenhum baralho ainda. Importe o backup do app em HTML (aba "Dados") para criar um baralho por matéria e assunto, ou crie um à mão.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground uppercase">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-bold">Baralho</th>
                <th className="w-20 px-2 py-2 text-right font-bold">Novos</th>
                <th className="w-20 px-2 py-2 text-right font-bold">Aprender</th>
                <th className="w-20 px-2 py-2 text-right font-bold">Revisar</th>
                <th className="w-24 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ b, nivel, rotulo, c }) => (
                <tr key={b.id} className="border-b last:border-b-0 hover:bg-accent/40">
                  <td className="px-3 py-1.5" style={{ paddingLeft: `${0.75 + nivel * 1.5}rem` }}>
                    <button className="cursor-pointer text-left font-semibold hover:underline" onClick={() => ir('estudo', b.id)}>
                      {rotulo}
                    </button>
                  </td>
                  <td className="px-2 text-right font-bold tabular-nums">{num(c.novos, 'text-blue-500')}</td>
                  <td className="px-2 text-right font-bold tabular-nums">{num(c.aprendendo, 'text-red-500')}</td>
                  <td className="px-2 text-right font-bold tabular-nums">{num(c.revisao, 'text-green-600')}</td>
                  <td className="px-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" title="Opções do baralho" aria-label={`Opções de ${b.nome}`} onClick={() => ir('opcoes', b.id)}>
                      <Settings className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Excluir baralho" aria-label={`Excluir ${b.nome}`} onClick={() => void excluir(b.id, b.nome)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Clique no nome do baralho para estudar. Azul = novos, vermelho = em aprendizado, verde = revisões de hoje. Os números de um baralho incluem os subbaralhos.
      </p>
    </div>
  )
}
