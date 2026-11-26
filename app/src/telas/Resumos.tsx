import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bold, FileText, Heading2, Heading3, Italic, List, ListOrdered, NotebookPen, Plus, Search, Strikethrough, Upload } from 'lucide-react'
import { confirmar } from '@/componentes/dialogos-api'
import { abrirNota } from '@/lib/abrirNota'
import { BarraMarcacao } from '@/componentes/BarraMarcacao'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { caixa, Sigla, Topo } from '@/componentes/visual'
import { type Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import type { NotaResumo } from '@/dados/esquemas'
import { acharPorTitulo, carregarNotas, criarNota, excluirNotaResumo, mudarMateriaNota, renomearNota, salvarTextoNota } from '@/dados/notas'
import { useCiclo } from '@/dados/useCiclo'
import { corDe, todasMaterias } from '@/dominio/ciclo'
import { numerarMarcas } from '@/dominio/marcacao'
import { domParaFolha, folhaParaMd } from '@/dominio/folha'
import { mdParaHtml } from '@/dominio/markdown'
import { agruparNotas, filtrarNotas, mencionadaEm } from '@/dominio/notas'
import { abrirDialogo } from '@/estado/dialogo'
import { CHAVE_SEM_MATERIA, useResumosUi } from '@/estado/resumos'
import { sanitizarMarkdown } from '@/lib/sanitizar'
import { cn } from '@/lib/utils'
import { ImportarTexto } from '@/telas/ImportarTexto'

const card = caixa
const mudo = 'text-xs text-muted-foreground'

export function Resumos() {
  const ciclo = useCiclo()
  const notas = useLiveQuery(() => carregarNotas(db), [])
  if (!ciclo || !notas) return <p className="text-sm text-muted-foreground">Carregando…</p>
  return <ResumosTela ciclo={ciclo} notas={notas} />
}

function ResumosTela({ ciclo, notas }: { ciclo: Ciclo; notas: NotaResumo[] }) {
  const { notaId, busca, gruposFechados, selecionar, buscar, alternarGrupo, abrirGrupo, recolherTodos, expandirTodos } = useResumosUi()
  const nota = notas.find((n) => n.id === notaId) ?? null
  const filtradas = filtrarNotas(notas, busca)
  const grupos = agruparNotas(filtradas, todasMaterias(ciclo.config))
  const buscando = busca.trim() !== ''

  async function nova(materia?: string) {
    const n = await criarNota(db, 'Nova nota', materia !== undefined ? materia : (nota?.materia ?? ''))
    abrirNota(n.id)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
    <Topo titulo="Resumos" sub={`${notas.length} ${notas.length === 1 ? 'nota' : 'notas'}`}>
      <span className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Entrada type="search" className="w-60 pl-8 max-[900px]:w-full" placeholder="Buscar nas notas" aria-label="Buscar nas notas" value={busca} onChange={(e) => buscar(e.target.value)} />
      </span>
      <Button variant="outline" onClick={() => void abrirDialogo('Importar / colar texto', (fechar) => <ImportarTexto aoImportar={(id) => { fechar(); abrirNota(id) }} fechar={() => fechar()} />)}>
        <Upload className="size-4" /> Importar / colar texto
      </Button>
      <Button variant="destaque" onClick={() => void nova()}><Plus className="size-4" /> Nova nota</Button>
    </Topo>
    <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] gap-3.5 max-[900px]:grid-cols-1 max-[900px]:overflow-visible">
      <aside className={cn(card, 'flex min-h-0 flex-col gap-1.5 bg-muted/40 px-3')}>
        {notas.length > 0 && (
          <div className={mudo}>
            <button className="cursor-pointer underline" onClick={() => recolherTodos(notas.map((n) => n.materia || CHAVE_SEM_MATERIA))}>Recolher tudo</button> ·{' '}
            <button className="cursor-pointer underline" onClick={expandirTodos}>Expandir tudo</button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {notas.length === 0 && <p className={mudo}>Nenhuma nota ainda.</p>}
          {notas.length > 0 && filtradas.length === 0 && <p className={mudo}>Nada encontrado.</p>}
          {grupos.map((g) => {
            const chave = g.materia || CHAVE_SEM_MATERIA
            const fechado = !buscando && gruposFechados.includes(chave)
            return (
              <div key={chave}>
                <div className="flex items-center">
                  <button
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm font-bold hover:bg-accent"
                    aria-expanded={!fechado}
                    title={`${fechado ? 'Abrir' : 'Fechar'} esta matéria`}
                    onClick={() => alternarGrupo(chave)}
                  >
                    <span className="w-3 text-xs">{fechado ? '▸' : '▾'}</span>
                    {g.materia ? <Sigla materia={g.materia} cor={corDe(ciclo.cores, g.materia)} className="h-5 min-w-9 text-[0.55rem]" /> : <i className="size-2.5 shrink-0 rounded-sm bg-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate">{g.materia || 'Sem matéria'}</span>
                    <span className="text-xs font-normal text-muted-foreground">{g.notas.length}</span>
                  </button>
                  <button className="cursor-pointer rounded-md px-2 text-lg hover:bg-accent" title="Nova nota nesta matéria" aria-label="Nova nota" onClick={() => void nova(g.materia)}>+</button>
                </div>
                {!fechado &&
                  g.notas.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { selecionar(n.id); abrirGrupo(chave) }}
                      className={cn('flex w-full cursor-pointer items-center gap-2 truncate rounded-lg py-1.5 pr-1 pl-6 text-left text-sm hover:bg-card', n.id === notaId && 'bg-card font-semibold text-primary shadow-[0_0_0_1px_var(--border)]')}
                    >
                      <FileText className="size-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{n.titulo}</span>
                    </button>
                  ))}
              </div>
            )
          })}
        </div>
      </aside>

      {nota ? (
        <Editor key={nota.id} nota={nota} notas={notas} ciclo={ciclo} />
      ) : (
        <div className={cn(card, 'flex items-center justify-center text-center')}>
          <div className="max-w-md">
            <h2 className="mb-1 text-lg font-bold">{notas.length ? 'Selecione uma nota' : 'Seus resumos'}</h2>
            <p className="mb-2 text-sm text-muted-foreground">Uma folha para escrever, ligada às matérias do seu ciclo.</p>
            <ul className="mx-auto mb-3 inline-block text-left text-sm text-muted-foreground">
              <li>Comece a linha com <code>-</code> e espaço para fazer tópicos; <b>Tab</b> / <b>Shift+Tab</b> mudam o nível.</li>
              <li>Digite <code>[[Nome da nota]]</code> para ligar notas; as ligações aparecem como "Mencionada em".</li>
              <li>Selecione um trecho e escolha uma cor para marcá-lo.</li>
            </ul>
            <div><Button variant="destaque" onClick={() => void nova()}><Plus className="size-4" /> Nova nota</Button></div>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

/** Botão pequeno da barra da folha (não tira o foco da folha ao clicar). */
function BotaoFolha({ titulo, ativo, onClick, children }: { titulo: string; ativo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      className={cn('flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground', ativo && 'bg-accent text-foreground')}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Atalhos do começo da linha: "- " vira lista, "1. " lista numerada, "# " / "## " título. */
const ATALHOS: [RegExp, (el: HTMLElement) => void][] = [
  [/^[-*]\s$/, () => document.execCommand('insertUnorderedList')],
  [/^1[.)]\s$/, () => document.execCommand('insertOrderedList')],
  [/^#\s$/, () => document.execCommand('formatBlock', false, '<h1>')],
  [/^##\s$/, () => document.execCommand('formatBlock', false, '<h2>')],
  [/^###\s$/, () => document.execCommand('formatBlock', false, '<h3>')],
]

/** Bloco (parágrafo, título, item) onde está o cursor. */
function blocoDoCursor(raiz: HTMLElement): HTMLElement | null {
  const s = window.getSelection()
  let n: Node | null = s && s.rangeCount ? s.getRangeAt(0).startContainer : null
  while (n && n !== raiz) {
    if (n.nodeType === 1 && /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test((n as Element).tagName)) return n as HTMLElement
    n = n.parentNode
  }
  return null
}

function Editor({ nota, notas, ciclo }: { nota: NotaResumo; notas: NotaResumo[]; ciclo: Ciclo }) {
  const pautada = useResumosUi((s) => s.pautada)
  const alternarPautada = useResumosUi((s) => s.alternarPautada)
  const selecionar = useResumosUi((s) => s.selecionar)
  const abrirGrupo = useResumosUi((s) => s.abrirGrupo)
  const [texto, setTexto] = useState(nota.texto)
  const [titulo, setTitulo] = useState(nota.titulo)
  const [bloco, setBloco] = useState('')
  const folha = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendente = useRef<string | null>(null)
  const atual = useRef(nota.texto)
  const notasRef = useRef(notas)
  notasRef.current = notas

  // grava o que falta ao sair da nota, trocar de aba ou fechar a página
  useEffect(() => {
    const id = nota.id
    const gravar = () => {
      clearTimeout(timer.current)
      if (pendente.current !== null) {
        const t = pendente.current
        pendente.current = null
        void salvarTextoNota(db, id, t)
      }
    }
    window.addEventListener('beforeunload', gravar)
    return () => {
      window.removeEventListener('beforeunload', gravar)
      gravar()
    }
  }, [nota.id])

  function salvar(v: string) {
    if (v === atual.current) return
    atual.current = v
    setTexto(v)
    pendente.current = v
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const t = pendente.current
      pendente.current = null
      if (t !== null) void salvarTextoNota(db, nota.id, t)
    }, 500)
  }

  /** Desenha a folha a partir do texto guardado (ao abrir, ao sair da folha e depois de marcar). */
  const desenhar = useCallback(
    (md: string) => {
      const el = folha.current
      if (!el) return
      const ctx = { existe: (t: string) => !!acharPorTitulo(notasRef.current, t), fechados: new Set<string>(), folha: true }
      el.innerHTML = sanitizarMarkdown(numerarMarcas(mdParaHtml(md, nota.id, ctx)))
      el.querySelectorAll('a').forEach((a) => { a.contentEditable = 'false' })
    },
    [nota.id],
  )

  useLayoutEffect(() => {
    document.execCommand('defaultParagraphSeparator', false, 'p')
    desenhar(nota.texto)
    // só ao abrir a nota (o Editor é recriado a cada nota): depois a folha é a fonte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function lerFolha() {
    const el = folha.current
    if (el) salvar(folhaParaMd(domParaFolha(el)))
  }

  function aoDigitar() {
    const el = folha.current
    if (!el) return
    const b = blocoDoCursor(el)
    if (b && b.tagName !== 'LI') {
      const atalho = ATALHOS.find(([re]) => re.test(b.textContent ?? ''))
      if (atalho) {
        b.textContent = ''
        b.appendChild(document.createElement('br'))
        const r = document.createRange()
        r.setStart(b, 0)
        r.collapse(true)
        const s = window.getSelection()
        s?.removeAllRanges()
        s?.addRange(r)
        atalho[1](b)
      }
    }
    lerFolha()
    atualizarBloco()
  }

  function atualizarBloco() {
    const el = folha.current
    const b = el ? blocoDoCursor(el) : null
    setBloco(b ? b.tagName.toLowerCase() : '')
  }

  function comando(c: string, v?: string) {
    folha.current?.focus()
    document.execCommand(c, false, v)
    lerFolha()
    atualizarBloco()
  }

  const titulo2 = (t: string) => comando('formatBlock', bloco === t ? '<p>' : `<${t}>`)

  function tecla(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (ev.key === 'Tab') {
      ev.preventDefault()
      const el = folha.current
      const b = el ? blocoDoCursor(el) : null
      if (b?.closest('li')) comando(ev.shiftKey ? 'outdent' : 'indent')
      else if (!ev.shiftKey) comando('insertText', String.fromCharCode(160).repeat(4))
    }
  }

  function colar(ev: React.ClipboardEvent<HTMLDivElement>) {
    // cola só o texto (sem cores e fontes de outros sites); Markdown colado vira formatação ao sair da folha
    ev.preventDefault()
    const t = ev.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
    document.execCommand('insertText', false, t)
  }

  async function abrirLigacao(t: string) {
    const existente = acharPorTitulo(notas, t)
    const alvo = existente ?? (await criarNota(db, t.trim(), nota.materia))
    selecionar(alvo.id)
    abrirGrupo(alvo.materia || CHAVE_SEM_MATERIA)
  }

  async function mudarTitulo() {
    if (titulo.trim() === nota.titulo) return
    setTitulo(await renomearNota(db, nota.id, titulo))
  }

  async function excluir() {
    if (!(await confirmar(`Excluir a nota "${nota.titulo}"? Se houver backup em pasta, o arquivo dela será apagado de lá.`, 'Excluir', true))) return
    clearTimeout(timer.current)
    pendente.current = null
    await excluirNotaResumo(db, nota.id)
    selecionar(null)
  }

  const mats = [...todasMaterias(ciclo.config)]
  if (nota.materia && !mats.includes(nota.materia)) mats.push(nota.materia)
  const refs = mencionadaEm(notas, nota)

  return (
    <section className={cn(card, 'flex min-h-0 flex-col')}>
      <div className={mudo}>Resumos › {nota.materia || 'Sem matéria'} › {nota.titulo}</div>
      <Entrada
        className="mt-1 border-0 bg-transparent px-0 text-xl font-bold"
        value={titulo}
        aria-label="Título da nota"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => void mudarTitulo()}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <div className="my-1.5 flex flex-wrap items-center gap-2">
        <Selecao className="w-auto max-w-60" aria-label="Matéria" value={nota.materia} onChange={(e) => { void mudarMateriaNota(db, nota.id, e.target.value); abrirGrupo(e.target.value || CHAVE_SEM_MATERIA) }}>
          <option value="">Sem matéria</option>
          {mats.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Selecao>
        <div role="toolbar" aria-label="Formatação" className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5">
          <BotaoFolha titulo="Título" ativo={bloco === 'h2'} onClick={() => titulo2('h2')}><Heading2 className="size-4" /></BotaoFolha>
          <BotaoFolha titulo="Subtítulo" ativo={bloco === 'h3'} onClick={() => titulo2('h3')}><Heading3 className="size-4" /></BotaoFolha>
          <BotaoFolha titulo="Negrito (Ctrl+B)" onClick={() => comando('bold')}><Bold className="size-4" /></BotaoFolha>
          <BotaoFolha titulo="Itálico (Ctrl+I)" onClick={() => comando('italic')}><Italic className="size-4" /></BotaoFolha>
          <BotaoFolha titulo="Riscado" onClick={() => comando('strikeThrough')}><Strikethrough className="size-4" /></BotaoFolha>
          <BotaoFolha titulo="Lista (Tab / Shift+Tab mudam o nível)" onClick={() => comando('insertUnorderedList')}><List className="size-4" /></BotaoFolha>
          <BotaoFolha titulo="Lista numerada" onClick={() => comando('insertOrderedList')}><ListOrdered className="size-4" /></BotaoFolha>
        </div>
        <BotaoFolha titulo={pautada ? 'Folha com linhas (clique para lisa)' : 'Folha lisa (clique para pôr linhas)'} ativo={pautada} onClick={alternarPautada}>
          <NotebookPen className="size-4" /> <span className="text-xs font-semibold">{pautada ? 'Com linhas' : 'Lisa'}</span>
        </BotaoFolha>
        <span className="flex-1" />
        <Button size="sm" variant="destructive" onClick={() => void excluir()}>Excluir</Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-muted/30 p-3 max-[900px]:p-0">
        <div
          ref={folha}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Texto da nota"
          spellCheck
          data-vazia={texto.trim() ? undefined : ''}
          className={cn('md folha mx-auto min-h-full max-w-[860px] rounded-lg border bg-card px-10 py-8 shadow-sm outline-none max-[900px]:px-5', pautada && 'pautada')}
          onInput={aoDigitar}
          onKeyDown={tecla}
          onKeyUp={atualizarBloco}
          onMouseUp={atualizarBloco}
          onPaste={colar}
          onBlur={() => desenhar(atual.current)}
          onClick={(e) => {
            const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
            if (!a) return
            e.preventDefault()
            if (a.classList.contains('wiki')) void abrirLigacao(a.dataset.t ?? '')
            else if (/^https?:/.test(a.href)) window.open(a.href, '_blank', 'noopener,noreferrer')
          }}
        />
      </div>
      <BarraMarcacao area={folha} texto={texto} aoMudar={(novo) => { salvar(novo); desenhar(novo) }} />
      {refs.length > 0 && (
        <div className={cn(mudo, 'mt-2 flex flex-wrap items-center gap-1')}>
          ↩ Mencionada em:
          {refs.map((o) => (
            <Button key={o.id} size="sm" variant="outline" onClick={() => { selecionar(o.id); abrirGrupo(o.materia || CHAVE_SEM_MATERIA) }}>{o.titulo}</Button>
          ))}
        </div>
      )}
    </section>
  )
}
