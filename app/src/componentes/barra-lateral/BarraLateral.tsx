import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Moon, Palette, RefreshCw, Sun } from 'lucide-react'
import { GRUPOS } from '@/componentes/barra-lateral/abas'
import { db } from '@/dados/db'
import { contarPendencias } from '@/dados/pendencias'
import { useHojeISO } from '@/dados/useCiclo'
import { useBackup } from '@/estado/backup'
import { useConta } from '@/estado/conta'
import { textoSincronia, useSincronia } from '@/estado/sincronia'
import { useUi, temaEscuro, PALETAS, type AbaId } from '@/estado/ui'
import { cn } from '@/lib/utils'

/** Edital e Flashcards mostram quantas revisões esperam por hoje (recalcula sozinho e a cada minuto). */
function usePendencias() {
  const hoje = useHojeISO()
  const [minuto, setMinuto] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMinuto((m) => m + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  return useLiveQuery(() => contarPendencias(db, hoje), [hoje, minuto])
}

/**
 * No computador, a coluna fixa da esquerda: só a navegação, em grupos. No celular (até 900 px), a mesma barra
 * vira uma gaveta que entra pela esquerda quando `aberta` (o botão de menu fica em `TopoCelular`).
 */
export function BarraLateral({ aberta = false, aoNavegar }: { aberta?: boolean; aoNavegar?: () => void }) {
  const { aba, irParaAba: trocarAba, tema, alternarTema, paleta, trocarPaleta } = useUi()
  const irParaAba = (id: AbaId) => {
    trocarAba(id)
    aoNavegar?.()
  }
  const escuro = temaEscuro(tema)
  const nomePaleta = PALETAS.find((p) => p.id === paleta)?.nome
  const bk = useBackup((s) => s.estado)
  const backupOk = bk === 'ok' || bk === 'gravando'
  const conectada = useConta((s) => s.estado === 'dentro')
  const sinc = useSincronia()
  const sincRuim = sinc.estado === 'erro' || sinc.estado === 'atualize' || sinc.estado === 'aguardando'
  const pend = usePendencias()
  const contador: Partial<Record<AbaId, number>> = { edital: pend?.edital, flashcards: pend?.flashcards }

  return (
    <aside
      id="barra-lateral"
      aria-label="Menu"
      className={cn(
        'flex h-full flex-col gap-0.5 overflow-x-hidden overflow-y-auto bg-lateral px-3 py-4',
        'max-[900px]:fixed max-[900px]:inset-y-0 max-[900px]:left-0 max-[900px]:z-50 max-[900px]:w-[min(85vw,300px)] max-[900px]:pt-[max(1rem,env(safe-area-inset-top))] max-[900px]:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-[900px]:shadow-xl max-[900px]:transition-transform',
        !aberta && 'max-[900px]:invisible max-[900px]:-translate-x-full',
      )}
    >
      <div className="flex items-center gap-2.5 px-1.5 pb-3 text-[0.95rem] font-bold">
        <span className="destaque grid size-8 place-items-center rounded-[10px]">
          <RefreshCw className="size-4" strokeWidth={2.4} />
        </span>
        Ciclo de Estudos
      </div>

      <nav className="flex flex-col gap-0.5">
        {GRUPOS.map((g, i) => (
          <div key={g.titulo} className="flex flex-col gap-0.5">
            <span className={cn('px-2 pb-1 text-[0.62rem] font-bold tracking-[0.09em] text-muted-foreground/80 uppercase', i > 0 ? 'pt-4' : 'pt-0.5')}>{g.titulo}</span>
            {g.abas.map(({ id, rotulo, Icone }) => {
              const n = contador[id] ?? 0
              return (
                <button
                  key={id}
                  onClick={() => irParaAba(id)}
                  aria-current={aba === id ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[0.84rem] font-medium text-foreground/85 hover:bg-card/70 max-[900px]:py-2.5 max-[900px]:text-base',
                    aba === id && 'bg-card font-semibold text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05),0_0_0_1px_var(--border)] hover:bg-card',
                  )}
                >
                  <Icone className={cn('size-[1.05rem] shrink-0 text-muted-foreground', aba === id && 'text-primary')} strokeWidth={1.9} />
                  {rotulo}
                  {n > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-2 text-[0.66rem] leading-[1.15rem] font-bold text-primary-foreground tabular-nums" title={id === 'edital' ? 'Revisões de assuntos para hoje' : 'Cartões em aprendizado e revisões para hoje'}>
                      {n}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={trocarPaleta} title={`Paleta: ${nomePaleta} (clique para trocar)`} aria-label="Trocar paleta de cores" className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] border bg-card text-xs font-medium text-muted-foreground hover:text-foreground">
            <Palette className="size-3.5" /> {nomePaleta}
          </button>
          <button onClick={alternarTema} title="Alternar tema claro/escuro" aria-label="Alternar tema" className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] border bg-card text-xs font-medium text-muted-foreground hover:text-foreground">
            {escuro ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />} {escuro ? 'Claro' : 'Escuro'}
          </button>
        </div>
        <button
          onClick={() => irParaAba('dados')}
          className="w-full rounded-xl border bg-card px-3 py-2 text-left text-[0.74rem] hover:bg-accent/60 max-[900px]:py-2.5"
          title="Importar, exportar e backup em pasta"
        >
          <b className="flex items-center gap-1.5 font-semibold">
            <span className={cn('size-1.5 rounded-full', backupOk ? 'bg-ok shadow-[0_0_0_3px_var(--ok-bg)]' : 'bg-aviso shadow-[0_0_0_3px_var(--aviso-bg)]')} />
            {backupOk ? 'Backup em pasta ativo' : 'Sem backup automático'}
          </b>
          <span className={cn('mt-0.5 block pl-3 text-muted-foreground', conectada && sincRuim && 'text-erro')}>
            {conectada ? `☁ ${textoSincronia(sinc.estado, sinc.ultima, sinc.pendentes, sinc.erro)}` : 'Dados, importar e exportar'}
          </span>
        </button>
      </div>
    </aside>
  )
}
