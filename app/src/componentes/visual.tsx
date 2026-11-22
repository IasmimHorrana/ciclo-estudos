import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { siglaDe } from '@/dominio/sigla'
import { cn } from '@/lib/utils'

/** Quadro padrão dentro do painel (borda fina, cantos arredondados). */
export const caixa = 'rounded-2xl border bg-card p-4'
/** Título de um quadro. */
export const tituloCaixa = 'm-0 flex items-center gap-2 text-sm font-bold'
/** Rótulo pequeno em caixa-alta, acima de campos. */
export const rotuloCampo = 'flex flex-col gap-1 text-[0.68rem] font-bold tracking-wider text-muted-foreground uppercase'

/** Etiqueta colorida com a sigla da matéria (ex.: DADM). O nome inteiro aparece ao passar o mouse. */
export function Sigla({ materia, cor, className }: { materia: string; cor: string; className?: string }) {
  return (
    <span
      title={materia}
      className={cn('sigla inline-grid h-6 min-w-10 shrink-0 place-items-center rounded-md px-1.5 text-[0.62rem] font-bold tracking-wide', className)}
      style={{ '--cor': cor } as CSSProperties}
    >
      {siglaDe(materia)}
    </span>
  )
}

/**
 * Cartão de número do topo das telas. O primeiro de cada tela vai em `destaque` (degradê da paleta).
 * `unidade` fica menor ao lado do valor ("14 / 20", "16h59 de 20h").
 */
export function Numero({
  rotulo, icone: Icone, valor, unidade, sub, destaque, children, className,
}: {
  rotulo: string
  icone?: LucideIcon
  valor: ReactNode
  unidade?: ReactNode
  sub?: ReactNode
  destaque?: boolean
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 rounded-2xl px-4 py-3', destaque ? 'destaque' : 'bg-muted', className)}>
      <span className={cn('flex items-center gap-1.5 text-xs font-medium', destaque ? 'opacity-85' : 'text-muted-foreground')}>
        {Icone && <Icone className="size-3.5" />}
        {rotulo}
      </span>
      <b className="truncate text-2xl leading-tight font-bold">
        {valor}
        {unidade && <span className={cn('ml-1 text-sm font-medium', destaque ? 'opacity-85' : 'text-muted-foreground')}>{unidade}</span>}
      </b>
      {children}
      {sub && <span className={cn('truncate text-xs', destaque ? 'opacity-85' : 'text-muted-foreground')}>{sub}</span>}
    </div>
  )
}

/** Faixa de cartões de número (4 lado a lado; 2 no celular). */
export function Numeros({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-4 gap-3 max-[900px]:grid-cols-2', className)}>{children}</div>
}

/** Linha de título da tela: nome, um complemento e, à direita, os controles. Ocupa a largura toda do painel. */
export function Topo({ titulo, sub, children, className }: { titulo: string; sub?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-5 -mt-4 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-2.5 max-[900px]:-mx-3 max-[900px]:-mt-3 max-[900px]:px-3', className)}>
      <h1 className="m-0 text-base font-bold max-[900px]:hidden">{titulo}</h1>
      {sub && <span className="text-[0.8rem] text-muted-foreground">{sub}</span>}
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Barra fina de progresso (0 a 100). */
export function Barrinha({ pct, cor, className }: { pct: number; cor?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-foreground/10', className)}>
      <i className={cn('block h-full rounded-full', !cor && 'bg-[image:var(--degrade)]')} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} />
    </div>
  )
}

/** Botões de escolha única lado a lado (o escolhido fica branco, em relevo). */
export function Segmentado<T extends string>({ itens, atual, aoMudar, rotulo, className }: { itens: [T, string][]; atual: T; aoMudar: (k: T) => void; rotulo: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn('inline-flex rounded-[11px] border bg-muted p-0.5 text-xs font-semibold', className)}>
      {itens.map(([k, r]) => (
        <button
          key={k}
          role="radio"
          aria-checked={atual === k}
          onClick={() => aoMudar(k)}
          className={cn('cursor-pointer rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground', atual === k && 'bg-card text-foreground shadow-sm')}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
