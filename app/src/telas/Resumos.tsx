import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { confirmar } from '@/componentes/dialogos-api'
import { abrirNota } from '@/lib/abrirNota'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { nomeSeguro } from '@/dados/arquivos'
import { type Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import type { NotaResumo } from '@/dados/esquemas'
import { acharPorTitulo, carregarNotas, criarNota, excluirNotaResumo, mudarMateriaNota, renomearNota, salvarTextoNota } from '@/dados/notas'
import { useCiclo } from '@/dados/useCiclo'
import { corDe, todasMaterias } from '@/dominio/ciclo'
import { consultaLigacao, continuarLista, indentar, inserirLigacao, mdParaHtml, type Edicao } from '@/dominio/markdown'
import { agruparNotas, filtrarNotas, mencionadaEm, sugerirNotas } from '@/dominio/notas'
import { abrirDialogo } from '@/estado/dialogo'
import { CHAVE_SEM_MATERIA, useResumosUi, type ModoEditor } from '@/estado/resumos'
import { sanitizarMarkdown } from '@/lib/sanitizar'
import { cn } from '@/lib/utils'
import { ImportarTexto } from '@/telas/ImportarTexto'

const card = 'rounded-xl border bg-card p-3.5 shadow-sm'
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
    <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] gap-3 max-[900px]:grid-cols-1 max-[900px]:overflow-visible">
      <aside className={cn(card, 'flex min-h-0 flex-col gap-1.5')}>
        <Entrada type="search" placeholder="🔍 Buscar nas notas…" value={busca} onChange={(e) => buscar(e.target.value)} />
        <Button onClick={() => void nova()}>＋ Nova nota</Button>
        <Button variant="outline" onClick={() => void abrirDialogo('Importar / colar texto', (fechar) => <ImportarTexto aoImportar={(id) => { fechar(); abrirNota(id) }} fechar={() => fechar()} />)}>
          ⬆ Importar / colar texto
        </Button>
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
                    <i className="size-2.5 shrink-0 rounded-sm" style={{ background: g.materia ? corDe(ciclo.cores, g.materia) : 'var(--muted-foreground)' }} />
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
                      className={cn('block w-full cursor-pointer truncate rounded-md py-1 pr-1 pl-6 text-left text-sm hover:bg-accent', n.id === notaId && 'bg-accent font-semibold')}
                    >
                      {n.titulo}
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
            <p className="mb-2 text-sm text-muted-foreground">Notas em Markdown, ligadas às matérias do seu ciclo.</p>
            <ul className="mx-auto mb-3 inline-block text-left text-sm text-muted-foreground">
              <li>Use <code>-</code> e <b>Tab</b> / <b>Shift+Tab</b> para montar tópicos que recolhem e expandem.</li>
              <li>Digite <code>[[Nome da nota]]</code> para ligar notas; as ligações aparecem como "Mencionada em".</li>
            </ul>
            <div><Button onClick={() => void nova()}>＋ Nova nota</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function Editor({ nota, notas, ciclo }: { nota: NotaResumo; notas: NotaResumo[]; ciclo: Ciclo }) {
  const modo = useResumosUi((s) => s.modo)
  const definirModo = useResumosUi((s) => s.definirModo)
  const selecionar = useResumosUi((s) => s.selecionar)
  const abrirGrupo = useResumosUi((s) => s.abrirGrupo)
  const [texto, setTexto] = useState(nota.texto)
  const [titulo, setTitulo] = useState(nota.titulo)
  const [sug, setSug] = useState<NotaResumo[]>([])
  const ta = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendente = useRef<string | null>(null)
  const [fechados] = useState(() => new Set<string>())

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

  function digitou(v: string) {
    setTexto(v)
    pendente.current = v
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const t = pendente.current
      pendente.current = null
      if (t !== null) void salvarTextoNota(db, nota.id, t)
    }, 500)
    const el = ta.current
    const q = el ? consultaLigacao(v, el.selectionStart) : null
    setSug(q === null ? [] : sugerirNotas(notas, nota.id, q))
  }

  /** Aplica uma edição preservando o "desfazer" do navegador. */
  function aplicar(e: Edicao) {
    const el = ta.current
    if (!el) return
    el.focus()
    el.setSelectionRange(e.inicio, e.fim)
    if (!document.execCommand('insertText', false, e.inserir)) {
      el.setRangeText(e.inserir, e.inicio, e.fim, 'end')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    el.setSelectionRange(e.selA, e.selB)
  }

  function tecla(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = ev.currentTarget
    if (ev.key === 'Tab') {
      ev.preventDefault()
      return aplicar(indentar(el.value, el.selectionStart, el.selectionEnd, ev.shiftKey))
    }
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey && el.selectionStart === el.selectionEnd) {
      const e = continuarLista(el.value, el.selectionStart)
      if (e) {
        ev.preventDefault()
        aplicar(e)
      }
    }
  }

  const html = useMemo(
    () => sanitizarMarkdown(mdParaHtml(texto, nota.id, { existe: (t) => !!acharPorTitulo(notas, t), fechados })),
    [texto, nota.id, notas, fechados],
  )
  const previa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = previa.current
    if (!el) return
    const aoTocar = (e: Event) => {
      const d = e.target as HTMLDetailsElement
      const k = d.dataset?.k
      if (!k) return
      if (d.open) fechados.delete(k)
      else fechados.add(k)
    }
    el.addEventListener('toggle', aoTocar, true)
    return () => el.removeEventListener('toggle', aoTocar, true)
  }, [fechados])

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

  function exportarMd() {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${nomeSeguro(nota.titulo)}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function excluir() {
    if (!(await confirmar(`Excluir a nota "${nota.titulo}"? Se houver backup em pasta, o arquivo .md dela será apagado de lá.`, 'Excluir', true))) return
    clearTimeout(timer.current)
    pendente.current = null
    await excluirNotaResumo(db, nota.id)
    selecionar(null)
  }

  const mats = [...todasMaterias(ciclo.config)]
  if (nota.materia && !mats.includes(nota.materia)) mats.push(nota.materia)
  const refs = mencionadaEm(notas, nota)
  const modos: [ModoEditor, string][] = [['editar', 'Editar'], ['dividido', 'Dividido'], ['ver', 'Ver']]

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
        <div className="inline-flex rounded-lg border p-0.5">
          {modos.map(([k, r]) => (
            <button key={k} onClick={() => definirModo(k)} className={cn('cursor-pointer rounded-md px-3 py-1 text-sm font-semibold', modo === k ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
              {r}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={exportarMd}>⬇ .md</Button>
        <Button size="sm" variant="destructive" onClick={() => void excluir()}>Excluir</Button>
      </div>

      <div className={cn('grid min-h-0 flex-1 gap-3', modo === 'dividido' ? 'grid-cols-2 max-[1000px]:grid-cols-1' : 'grid-cols-1')}>
        {modo !== 'ver' && (
          <div className="relative min-h-0">
            <textarea
              ref={ta}
              className="size-full min-h-60 resize-none rounded-lg border bg-background p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              spellCheck={false}
              value={texto}
              placeholder="Escreva em Markdown. Ex.: - tópico, [[outra nota]]"
              onChange={(e) => digitou(e.target.value)}
              onKeyDown={tecla}
              onClick={(e) => { const q = consultaLigacao(e.currentTarget.value, e.currentTarget.selectionStart); if (q === null) setSug([]) }}
              onBlur={() => setTimeout(() => setSug([]), 150)}
            />
            {sug.length > 0 && (
              <div className="absolute right-2 bottom-2 left-2 flex flex-wrap gap-1 rounded-lg border bg-card p-1.5 shadow-lg">
                {sug.map((n) => (
                  <Button
                    key={n.id}
                    size="sm"
                    variant="outline"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const el = ta.current
                      if (el) aplicar(inserirLigacao(el.value, el.selectionStart, n.titulo))
                    }}
                  >
                    {n.titulo}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
        {modo !== 'editar' && (
          <div
            ref={previa}
            className="md min-h-0 overflow-auto rounded-lg border p-3"
            onClick={(e) => {
              const a = (e.target as HTMLElement).closest('a.wiki') as HTMLElement | null
              if (a) {
                e.preventDefault()
                void abrirLigacao(a.dataset.t ?? '')
              }
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
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

