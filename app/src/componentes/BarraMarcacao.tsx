import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Highlighter, X } from 'lucide-react'
import { contarOcorrencias, CORES_MARCA, corValida, desmarcar, marcarTrecho, NOMES_COR, trocarCor, type CorMarca } from '@/dominio/marcacao'
import { cn } from '@/lib/utils'

const CHAVE_COR = 'ciclo.rsUltimaCor'

/** O que a barra está mostrando: uma seleção nova ou uma marcação já feita. */
type Alvo =
  | { tipo: 'selecao'; texto: string; ordem: number; x: number; y: number; embaixo: number }
  | { tipo: 'marca'; i: number; cor: CorMarca; x: number; y: number; embaixo: number }

function ultimaCor(): CorMarca {
  try {
    return corValida(localStorage.getItem(CHAVE_COR) ?? undefined)
  } catch {
    return 'amarelo'
  }
}

/**
 * Marca-texto da pré-visualização dos Resumos: ao selecionar um trecho aparece uma barra com as cores;
 * ao clicar numa marcação, a barra permite trocar a cor ou remover. A marcação é gravada no Markdown.
 */
export function BarraMarcacao({ area, texto, aoMudar }: { area: RefObject<HTMLDivElement | null>; texto: string; aoMudar: (novo: string) => void }) {
  const [alvo, setAlvo] = useState<Alvo | null>(null)
  const [aviso, setAviso] = useState('')
  const [cor, setCor] = useState<CorMarca>(ultimaCor)
  const apertando = useRef(false)
  const barra = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = area.current
    if (!el) return
    let t: ReturnType<typeof setTimeout> | undefined

    const lerSelecao = () => {
      const s = window.getSelection()
      if (!s || s.isCollapsed || s.rangeCount === 0) return setAlvo((a) => (a?.tipo === 'selecao' ? null : a))
      const r = s.getRangeAt(0)
      if (!el.contains(r.commonAncestorContainer)) return
      const sel = s.toString()
      if (!sel.trim()) return
      const antes = document.createRange()
      antes.setStart(el, 0)
      antes.setEnd(r.startContainer, r.startOffset)
      const caixa = r.getBoundingClientRect()
      setAviso('')
      setAlvo({ tipo: 'selecao', texto: sel, ordem: contarOcorrencias(antes.toString(), sel), x: caixa.left + caixa.width / 2, y: caixa.top, embaixo: caixa.bottom })
    }
    const mudouSelecao = () => {
      clearTimeout(t)
      if (!apertando.current) t = setTimeout(lerSelecao, 200)
    }
    const desceu = () => { apertando.current = true }
    const subiu = () => {
      if (!apertando.current) return
      apertando.current = false
      clearTimeout(t)
      t = setTimeout(lerSelecao, 10)
    }
    const clicou = (e: MouseEvent) => {
      const s = window.getSelection()
      if (s && !s.isCollapsed) return
      const alvoEl = e.target as HTMLElement
      if (alvoEl.closest('a')) return
      const m = alvoEl.closest('mark[data-i]') as HTMLElement | null
      if (!m) return
      e.preventDefault() // dentro de um tópico, não abre/fecha o tópico
      const caixa = m.getBoundingClientRect()
      setAviso('')
      setAlvo({ tipo: 'marca', i: Number(m.dataset.i), cor: corValida(m.dataset.c), x: caixa.left + caixa.width / 2, y: caixa.top, embaixo: caixa.bottom })
    }
    const rolou = () => setAlvo(null)

    document.addEventListener('selectionchange', mudouSelecao)
    el.addEventListener('pointerdown', desceu)
    document.addEventListener('pointerup', subiu)
    el.addEventListener('click', clicou)
    el.addEventListener('scroll', rolou)
    return () => {
      clearTimeout(t)
      document.removeEventListener('selectionchange', mudouSelecao)
      el.removeEventListener('pointerdown', desceu)
      document.removeEventListener('pointerup', subiu)
      el.removeEventListener('click', clicou)
      el.removeEventListener('scroll', rolou)
    }
  }, [area])

  // fecha com Esc ou ao clicar fora (da barra e da pré-visualização)
  useEffect(() => {
    if (!alvo) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAlvo(null)
    const fora = (e: PointerEvent) => {
      const n = e.target as Node
      if (!barra.current?.contains(n) && !area.current?.contains(n)) setAlvo(null)
    }
    document.addEventListener('keydown', tecla)
    document.addEventListener('pointerdown', fora)
    return () => {
      document.removeEventListener('keydown', tecla)
      document.removeEventListener('pointerdown', fora)
    }
  }, [alvo, area])

  if (!alvo) return null

  function aplicar(c: CorMarca) {
    if (!alvo) return
    if (alvo.tipo === 'marca') {
      aoMudar(trocarCor(texto, alvo.i, c))
      setAlvo(null)
      return
    }
    const r = marcarTrecho(texto, alvo.texto, alvo.ordem, c)
    if (!r.ok) return setAviso(r.motivo)
    setCor(c)
    try {
      localStorage.setItem(CHAVE_COR, c)
    } catch {
      /* sem armazenamento: só não lembra a cor */
    }
    aoMudar(r.texto)
    window.getSelection()?.removeAllRanges()
    setAlvo(null)
  }

  function remover() {
    if (alvo?.tipo !== 'marca') return
    aoMudar(desmarcar(texto, alvo.i))
    setAlvo(null)
  }

  const emCima = alvo.y > 70
  const atual = alvo.tipo === 'marca' ? alvo.cor : cor
  return createPortal(
    <div
      ref={barra}
      role="toolbar"
      aria-label={alvo.tipo === 'marca' ? 'Marcação' : 'Marcar texto'}
      className="fixed z-50 flex max-w-80 flex-col gap-1.5 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
      style={{ left: Math.min(Math.max(alvo.x, 170), window.innerWidth - 170), top: emCima ? alvo.y - 8 : alvo.embaixo + 8, transform: `translate(-50%, ${emCima ? '-100%' : '0'})` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1">
        {alvo.tipo === 'selecao' && (
          <button
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-semibold hover:bg-accent"
            title={`Marcar com ${NOMES_COR[cor].toLowerCase()} (a última cor usada)`}
            onClick={() => aplicar(cor)}
          >
            <Highlighter className="size-4" /> Marcar
          </button>
        )}
        {CORES_MARCA.map((c) => (
          <button
            key={c}
            className={cn('size-7 cursor-pointer rounded-md border border-black/10 transition hover:scale-110', c === atual && 'ring-2 ring-primary ring-offset-1 ring-offset-popover')}
            style={{ background: `var(--m-${c})` }}
            title={NOMES_COR[c]}
            aria-label={alvo.tipo === 'marca' ? `Trocar para ${NOMES_COR[c].toLowerCase()}` : `Marcar com ${NOMES_COR[c].toLowerCase()}`}
            onClick={() => aplicar(c)}
          />
        ))}
        {alvo.tipo === 'marca' ? (
          <button className="ml-0.5 flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-destructive hover:bg-accent" onClick={remover}>
            <X className="size-3.5" /> Remover
          </button>
        ) : (
          <button className="ml-0.5 flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title="Fechar (Esc)" aria-label="Fechar" onClick={() => setAlvo(null)}>
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {aviso && <p className="max-w-72 px-1 text-xs text-destructive">{aviso}</p>}
    </div>,
    document.body,
  )
}
