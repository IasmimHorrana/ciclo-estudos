import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/dados/db'
import { estudoPorDia } from '@/dados/flashcards'
import { fmtData } from '@/dominio/datas'
import { mapaDeCalor } from '@/dominio/mapaCalor'
import { numeroDoDia } from '@/dominio/sm2'
import { cn } from '@/lib/utils'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS = ['seg', '', 'qua', '', 'sex', '', '']

// verdes do mais fraco ao mais forte (pastéis no claro, vivos no escuro)
const NIVEL = ['bg-muted', 'bg-[var(--calor-1)]', 'bg-[var(--calor-2)]', 'bg-[var(--calor-3)]', 'bg-[var(--calor-4)]']

const fmtTempo = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} segundo(s)`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

/** Calendário de calor do último ano de estudo, no estilo do Anki. */
export function CalendarioCalor() {
  const dados = useLiveQuery(async () => ({ ...(await estudoPorDia(db)), hoje: numeroDoDia(Date.now()) }), [])
  if (!dados) return null
  const { hoje } = dados
  const m = mapaDeCalor(dados.cartoes, hoje)
  const nHoje = dados.cartoes.get(hoje) ?? 0
  const tHoje = dados.tempoMs.get(hoje) ?? 0
  const stat = (rotulo: string, valor: string) => (
    <span>
      {rotulo}: <b className="text-ok">{valor}</b>
    </span>
  )
  return (
    <section className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="m-0 mb-2 text-center text-sm">
        Estudado hoje: <b>{nHoje}</b> {nHoje === 1 ? 'cartão' : 'cartões'}
        {nHoje > 0 && <> em <b>{fmtTempo(tHoje)}</b> ({fmtTempo(tHoje / nHoje)}/cartão)</>}
      </p>
      <div className="flex justify-center gap-1 overflow-x-auto pb-1">
        <div className="mt-[1.125rem] grid grid-rows-7 gap-0.5 text-[0.6rem] leading-none text-muted-foreground">
          {DIAS.map((d, i) => (
            <span key={i} className="flex h-3.5 items-center">{d}</span>
          ))}
        </div>
        <div>
          <div className="mb-0.5 flex h-3.5 gap-0.5 text-[0.65rem] leading-none text-muted-foreground">
            {m.meses.map((mes, i) => (
              <span key={i} className="relative w-3.5 shrink-0">
                {mes !== null && <span className="absolute left-0 whitespace-nowrap">{MESES[mes]}</span>}
              </span>
            ))}
          </div>
          <div className="flex gap-0.5">
            {m.semanas.map((col, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                {col.map((c, j) =>
                  c && !c.futuro ? (
                    <span
                      key={j}
                      title={`${fmtData(c.data)}/${c.data.slice(0, 4)} · ${c.cartoes} cartão(ões)`}
                      className={cn('size-3.5 rounded-[3px]', NIVEL[c.nivel], c.dia === hoje && 'ring-1 ring-foreground')}
                    />
                  ) : (
                    <span key={j} className="size-3.5" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
        {stat('Média diária', `${Math.round(m.mediaPorDiaEstudado)} ${Math.round(m.mediaPorDiaEstudado) === 1 ? 'cartão' : 'cartões'}`)}
        {stat('Dias estudados', `${m.pctDiasEstudados}%`)}
        {stat('Maior sequência', `${m.maiorSequencia} ${m.maiorSequencia === 1 ? 'dia' : 'dias'}`)}
        {stat('Sequência atual', `${m.sequenciaAtual} ${m.sequenciaAtual === 1 ? 'dia' : 'dias'}`)}
      </div>
    </section>
  )
}
