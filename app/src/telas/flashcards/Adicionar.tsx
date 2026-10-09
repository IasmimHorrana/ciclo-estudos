import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { AreaTexto, Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { adicionarNota } from '@/dados/flashcards'
import { envolverCloze } from '@/dominio/cloze'
import { useFc } from '@/estado/flashcards'
import { textoParaHtml } from '@/lib/sanitizar'

type Aviso = { tipo: 'ok' | 'erro'; texto: string }

export function Adicionar() {
  const { baralhoId: inicial, ir } = useFc()
  const tipos = useLiveQuery(() => db.tiposNota.toArray(), [])
  const baralhos = useLiveQuery(async () => (await db.baralhos.toArray()).filter((b) => b.excluidoEm === null).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [])
  const [tipoId, setTipoId] = useState('basico')
  const [baralhoId, setBaralhoId] = useState<string>(inicial ?? '')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [tags, setTags] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const primeiro = useRef<HTMLTextAreaElement>(null)

  const tipo = tipos?.find((t) => t.id === tipoId)
  const escolhido = baralhoId || baralhos?.[0]?.id || ''

  function omissao() {
    const el = primeiro.current
    if (!el || !tipo?.cloze) return
    const nome = tipo.campos[0] as string
    const texto = valores[nome] ?? ''
    if (el.selectionStart === el.selectionEnd) return setAviso({ tipo: 'erro', texto: 'Selecione o trecho que será escondido e clique em "Omissão".' })
    setValores({ ...valores, [nome]: envolverCloze(texto, el.selectionStart, el.selectionEnd) })
  }

  async function salvar() {
    if (!tipo) return
    try {
      const campos = Object.fromEntries(tipo.campos.map((c) => [c, textoParaHtml(valores[c] ?? '')]))
      const r = await adicionarNota(db, {
        tipoId, baralhoId: escolhido, campos, tags: tags.split(/[\s,]+/).filter(Boolean),
      })
      setValores({})
      setAviso({ tipo: 'ok', texto: `Adicionado: ${r.cartoes.length} cartão(ões).` })
      primeiro.current?.focus()
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
              <Selecao value={escolhido} onChange={(e) => setBaralhoId(e.target.value)}>
                {baralhos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome}
                  </option>
                ))}
              </Selecao>
            </label>
          </div>

          {tipo?.campos.map((campo, i) => (
            <label key={campo} className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
              {campo}
              <AreaTexto
                ref={i === 0 ? primeiro : undefined}
                value={valores[campo] ?? ''}
                placeholder={tipo.cloze && i === 0 ? 'Ex.: A capital do Brasil é {{c1::Brasília}}.' : ''}
                onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
              />
            </label>
          ))}

          {tipo?.cloze && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={omissao}>
                Omissão [...] <span className="ml-1 text-xs opacity-60">Ctrl+Shift+C</span>
              </Button>
              <span className="text-xs text-muted-foreground">Selecione um trecho e clique. Cada número (c1, c2…) vira um cartão.</span>
            </div>
          )}

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
