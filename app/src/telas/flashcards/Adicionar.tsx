import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { EscolherAssunto } from '@/componentes/EscolherAssunto'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { adicionarNota } from '@/dados/flashcards'
import { useFc } from '@/estado/flashcards'
import { CamposNota } from '@/telas/flashcards/CamposNota'
import { useCamposNota } from '@/telas/flashcards/useCamposNota'

type Aviso = { tipo: 'ok' | 'erro'; texto: string }

export function Adicionar() {
  const { baralhoId: inicial, ir } = useFc()
  const tipos = useLiveQuery(() => db.tiposNota.toArray(), [])
  const baralhos = useLiveQuery(async () => (await db.baralhos.toArray()).filter((b) => b.excluidoEm === null).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [])
  const [tipoId, setTipoId] = useState('basico')
  const [baralhoId, setBaralhoId] = useState<string>(inicial ?? '')
  const [tags, setTags] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const ed = useCamposNota((texto) => setAviso({ tipo: 'erro', texto }))

  const tipo = tipos?.find((t) => t.id === tipoId)
  const escolhido = baralhoId || baralhos?.[0]?.id || ''
  const primeiroCampo = tipo?.campos[0] ?? ''

  function omissao() {
    if (tipo?.cloze) ed.omissao(primeiroCampo)
  }

  async function salvar() {
    if (!tipo) return
    try {
      const r = await adicionarNota(db, {
        tipoId, baralhoId: escolhido, campos: ed.paraHtml(tipo.campos), tags: tags.split(/[\s,]+/).filter(Boolean),
      })
      ed.limpar()
      setAviso({ tipo: 'ok', texto: `Adicionado: ${r.cartoes.length} cartão(ões).` })
      ed.caixas.current[primeiroCampo]?.focus()
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível adicionar.' })
    }
  }

  if (!tipos || !baralhos) return <p className="text-sm text-muted-foreground">Carregando…</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => ir('baralhos')}>
          <ArrowLeft className="size-4" /> Baralhos
        </Button>
        <h1 className="m-0 text-xl font-bold">Adicionar cartões</h1>
      </div>

      {baralhos.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Crie um baralho antes (botão "+ Baralho" na tela anterior).</p>
      ) : (
        <div
          className="flex max-w-3xl flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void salvar()
            if (e.key.toLowerCase() === 'c' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              omissao()
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
              Tipo
              <Selecao value={tipoId} onChange={(e) => { setTipoId(e.target.value); setAviso(null) }}>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Selecao>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
              Baralho
              <EscolherAssunto assuntos={baralhos} valor={escolhido} aoMudar={setBaralhoId} rotulo="Baralho" semVazio />
            </label>
          </div>

          {tipo && <CamposNota ed={ed} campos={tipo.campos} cloze={tipo.cloze} />}

          {tipo?.cloze && <BotaoOmissao onClick={omissao} />}

          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
            Tags (separadas por espaço)
            <Entrada value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>

          <div className="flex items-center gap-3">
            <Button onClick={() => void salvar()}>
              Adicionar <span className="ml-2 text-xs opacity-70">Ctrl+Enter</span>
            </Button>
            {aviso && <span className={`text-sm font-semibold ${aviso.tipo === 'ok' ? 'text-ok' : 'text-erro'}`}>{aviso.texto}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function BotaoOmissao({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onClick}>
        Omissão [...] <span className="ml-1 text-xs opacity-60">Ctrl+Shift+C</span>
      </Button>
      <span className="text-xs text-muted-foreground">Selecione um trecho e clique. Cada número (c1, c2…) vira um cartão.</span>
    </div>
  )
}
