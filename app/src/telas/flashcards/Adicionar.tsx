import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ImagePlus, X } from 'lucide-react'
import { EscolherAssunto } from '@/componentes/EscolherAssunto'
import { Button } from '@/componentes/ui/button'
import { AreaTexto, Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { adicionarNota } from '@/dados/flashcards'
import { envolverCloze } from '@/dominio/cloze'
import { inserirMarcador, marcador, numerosNoTexto, removerMarcador, trocarMarcadores, type Imagens } from '@/dominio/imagens'
import { useFc } from '@/estado/flashcards'
import { comprimirImagem } from '@/lib/imagem'
import { textoParaHtml } from '@/lib/sanitizar'

type Aviso = { tipo: 'ok' | 'erro'; texto: string }

/** Primeira imagem de uma lista de arquivos (colar ou arrastar). */
const imagemDe = (arquivos: Iterable<File | null>): File | null => [...arquivos].find((f) => f?.type.startsWith('image/')) ?? null

export function Adicionar() {
  const { baralhoId: inicial, ir } = useFc()
  const tipos = useLiveQuery(() => db.tiposNota.toArray(), [])
  const baralhos = useLiveQuery(async () => (await db.baralhos.toArray()).filter((b) => b.excluidoEm === null).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [])
  const [tipoId, setTipoId] = useState('basico')
  const [baralhoId, setBaralhoId] = useState<string>(inicial ?? '')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [imagens, setImagens] = useState<Imagens>({})
  const [tags, setTags] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const caixas = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const seletor = useRef<HTMLInputElement>(null)
  const campoDoSeletor = useRef('')
  const proxima = useRef(1) // número da próxima imagem desta nota

  const tipo = tipos?.find((t) => t.id === tipoId)
  const escolhido = baralhoId || baralhos?.[0]?.id || ''
  const primeiroCampo = tipo?.campos[0] ?? ''

  function omissao() {
    const el = caixas.current[primeiroCampo]
    if (!el || !tipo?.cloze) return
    const texto = valores[primeiroCampo] ?? ''
    if (el.selectionStart === el.selectionEnd) return setAviso({ tipo: 'erro', texto: 'Selecione o trecho que será escondido e clique em "Omissão".' })
    setValores({ ...valores, [primeiroCampo]: envolverCloze(texto, el.selectionStart, el.selectionEnd) })
  }

  async function porImagem(campo: string, arquivo: Blob) {
    const el = caixas.current[campo]
    const ini = el?.selectionStart ?? (valores[campo] ?? '').length
    const fim = el?.selectionEnd ?? ini
    const n = proxima.current++
    try {
      const src = await comprimirImagem(arquivo)
      // a caixa mostra o texto mais recente (a pessoa pode ter digitado enquanto a imagem era comprimida)
      const atual = el?.value ?? valores[campo] ?? ''
      const r = inserirMarcador(atual, Math.min(ini, atual.length), Math.min(fim, atual.length), n)
      setImagens((im) => ({ ...im, [n]: src }))
      setValores((v) => ({ ...v, [campo]: r.texto }))
      setAviso(null)
      requestAnimationFrame(() => {
        el?.focus()
        el?.setSelectionRange(r.cursor, r.cursor)
      })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível pôr a imagem.' })
    }
  }

  function aoColar(campo: string, e: ClipboardEvent<HTMLTextAreaElement>) {
    const img = imagemDe([...e.clipboardData.items].map((i) => (i.kind === 'file' ? i.getAsFile() : null)))
    if (!img) return // texto comum: cola normal
    e.preventDefault()
    void porImagem(campo, img)
  }

  function aoSoltar(campo: string, e: DragEvent<HTMLTextAreaElement>) {
    const img = imagemDe(e.dataTransfer.files)
    if (!img) return
    e.preventDefault()
    void porImagem(campo, img)
  }

  function tirarImagem(n: number) {
    setValores((v) => Object.fromEntries(Object.entries(v).map(([c, t]) => [c, removerMarcador(t, n)])))
    setImagens(({ [n]: _fora, ...resto }) => resto)
  }

  async function salvar() {
    if (!tipo) return
    try {
      const campos = Object.fromEntries(tipo.campos.map((c) => [c, trocarMarcadores(textoParaHtml(valores[c] ?? ''), imagens)]))
      const r = await adicionarNota(db, {
        tipoId, baralhoId: escolhido, campos, tags: tags.split(/[\s,]+/).filter(Boolean),
      })
      setValores({})
      setImagens({})
      proxima.current = 1
      setAviso({ tipo: 'ok', texto: `Adicionado: ${r.cartoes.length} cartão(ões).` })
      caixas.current[primeiroCampo]?.focus()
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

          <input
            ref={seletor}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void porImagem(campoDoSeletor.current, f)
            }}
          />

          {tipo?.campos.map((campo, i) => {
            const desteCampo = numerosNoTexto(valores[campo] ?? '').filter((n) => imagens[n])
            return (
              <div key={campo} className="flex flex-col gap-1">
                <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
                  {campo}
                  <AreaTexto
                    ref={(el) => { caixas.current[campo] = el }}
                    value={valores[campo] ?? ''}
                    placeholder={tipo.cloze && i === 0 ? 'Ex.: A capital do Brasil é {{c1::Brasília}}.' : ''}
                    onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
                    onPaste={(e) => aoColar(campo, e)}
                    onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
                    onDrop={(e) => aoSoltar(campo, e)}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      campoDoSeletor.current = campo
                      seletor.current?.click()
                    }}
                  >
                    <ImagePlus className="size-4" /> Imagem
                  </Button>
                  {desteCampo.length === 0 && i === 0 && (
                    <span className="text-xs text-muted-foreground">ou cole um print (Ctrl+V) / arraste uma imagem para a caixa</span>
                  )}
                  {desteCampo.map((n) => (
                    <span key={n} className="flex items-center gap-1.5 rounded-lg border bg-background p-1 pr-1.5 text-xs text-muted-foreground">
                      <img src={imagens[n]} alt={marcador(n)} className="h-10 max-w-20 rounded object-contain" />
                      {marcador(n)}
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-accent hover:text-foreground"
                        aria-label={`Tirar ${marcador(n)}`}
                        title="Tirar a imagem"
                        onClick={() => tirarImagem(n)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}

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
