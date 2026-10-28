import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Entrada } from '@/componentes/ui/entrada'
import { cn } from '@/lib/utils'

interface Opcao {
  valor: string
  rotulo: string
  /** "sem assunto" e "novo assunto": não entram na busca */
  extra?: boolean
}
interface Posicao {
  left: number
  width: number
  top?: number
  bottom?: number
  maxH: number
}

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Escolha do assunto. A lista nativa do navegador não quebra linha, e os nomes vindos do edital são longos (ficavam cortados):
 * aqui o nome aparece inteiro, em várias linhas, e dá para filtrar digitando. Valor `''` = sem assunto.
 */
export function EscolherAssunto({ assuntos, valor, aoMudar, valorNovo, rotulo = 'Assunto' }: {
  assuntos: readonly { id: string; nome: string }[]
  valor: string
  aoMudar: (valor: string) => void
  /** Se vier, aparece a opção "＋ Novo assunto…" com este valor. */
  valorNovo?: string
  rotulo?: string
}) {
  const novo: Opcao[] = valorNovo ? [{ valor: valorNovo, rotulo: '＋ Novo assunto…', extra: true }] : []
  const opcoes: Opcao[] = [{ valor: '', rotulo: '— sem assunto —', extra: true }, ...assuntos.map((a) => ({ valor: a.id, rotulo: a.nome })), ...novo]
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [pos, setPos] = useState<Posicao | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLDivElement>(null)

  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0]!
  const termo = normalizar(busca.trim())
  const visiveis = termo ? [...opcoes.filter((o) => !o.extra && normalizar(o.rotulo).includes(termo)), ...novo] : opcoes

  function abrir() {
    setBusca('')
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === valor)))
    setAberto(true)
  }
  function fechar(focar = true) {
    setAberto(false)
    if (focar) botao.current?.focus()
  }
  function escolher(o: Opcao | undefined) {
    if (!o) return
    aoMudar(o.valor)
    fechar()
  }

  // abre abaixo do campo (ou acima, se faltar espaço), por cima de tudo, para não ser cortado pelo quadro em volta
  useLayoutEffect(() => {
    if (!aberto || !botao.current) return
    const r = botao.current.getBoundingClientRect()
    const width = Math.min(Math.max(r.width, 300), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    const abaixo = window.innerHeight - r.bottom - 12
    const acima = r.top - 12
    setPos(abaixo >= 240 || abaixo >= acima ? { left, width, top: r.bottom + 4, maxH: Math.min(380, abaixo) } : { left, width, bottom: window.innerHeight - r.top + 4, maxH: Math.min(380, acima) })
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: Event) => {
      const alvo = e.target as Node
      if (!painel.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar(false)
    }
    const rolou = (e: Event) => !painel.current?.contains(e.target as Node) && fechar(false)
    const redimensionou = () => fechar(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('scroll', rolou, true)
    window.addEventListener('resize', redimensionou)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('scroll', rolou, true)
      window.removeEventListener('resize', redimensionou)
    }
  }, [aberto])

  useEffect(() => {
    if (aberto) painel.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [aberto, ativo, pos])

  // sem campo de busca, o teclado vai para a lista
  const comBusca = assuntos.length > 6
  useEffect(() => {
    if (aberto && pos && !comBusca) lista.current?.focus()
  }, [aberto, pos, comBusca])

  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((i) => Math.max(0, Math.min(visiveis.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      escolher(visiveis[ativo])
    } else if (e.key === 'Escape') {
      e.stopPropagation() // fecha só a lista, não o diálogo
      fechar()
    } else if (e.key === 'Tab') fechar(false)
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title={atual.extra ? undefined : atual.rotulo}
        onClick={() => (aberto ? fechar() : abrir())}
        className={cn(
          'flex w-full items-start gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-left text-sm font-normal tracking-normal normal-case outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          atual.extra && 'text-muted-foreground',
        )}
      >
        <span className="line-clamp-3 min-w-0 flex-1 break-words">{atual.rotulo}</span>
        <span aria-hidden className="text-muted-foreground">▾</span>
      </button>
      {aberto && pos &&
        createPortal(
          <div
            ref={painel}
            className="fixed z-[60] flex flex-col overflow-hidden rounded-lg border bg-card text-sm shadow-xl"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
          >
            {comBusca && (
              <div className="border-b p-2">
                <Entrada
                  autoFocus
                  placeholder="Buscar assunto…"
                  aria-label={`Buscar ${rotulo.toLowerCase()}`}
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value)
                    setAtivo(0)
                  }}
                  onKeyDown={teclas}
                />
              </div>
            )}
            <div
              role="listbox"
              aria-label={rotulo}
              tabIndex={-1}
              ref={lista}
              onKeyDown={teclas}
              className="min-h-0 flex-1 overflow-auto py-1 outline-none"
            >
              {visiveis.length === 0 && <p className="m-0 px-3 py-2 text-xs text-muted-foreground">Nenhum assunto com esse nome.</p>}
              {visiveis.map((o, i) => (
                <div
                  key={o.valor}
                  data-i={i}
                  role="option"
                  aria-selected={o.valor === valor}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => escolher(o)}
                  className={cn(
                    'cursor-pointer border-b border-border/40 px-3 py-1.5 break-words last:border-b-0',
                    i === ativo && 'bg-muted',
                    o.valor === valor && 'font-semibold text-primary',
                    o.extra && o.valor !== valor && 'text-muted-foreground',
                  )}
                >
                  {o.rotulo}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
