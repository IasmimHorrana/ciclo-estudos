import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { useFaixas } from '@/componentes/faixas-contexto'
import { Etiqueta } from '@/componentes/nivel'
import { COR_NIVEL } from '@/componentes/nivel-cores'
import { Button } from '@/componentes/ui/button'
import { db } from '@/dados/db'
import { estatisticasDoBaralho } from '@/dados/flashcards'
import { fmtH } from '@/dominio/ciclo'
import { fmtData } from '@/dominio/datas'
import { pctDe } from '@/dominio/desempenho'
import { DIAS_MADURO, MIN_RESPOSTAS, nivelFc, type Acertos, type PeriodoFc } from '@/dominio/estatisticasFc'
import { isoDoNumero } from '@/dominio/mapaCalor'
import { useFc } from '@/estado/flashcards'
import { cn } from '@/lib/utils'

const card = 'rounded-xl border bg-card p-3.5 shadow-sm'
const mudo = 'text-xs text-muted-foreground'
const titulo = 'm-0 mb-2 text-sm font-bold'

const PERIODOS: [PeriodoFc, string][] = [['7', '7 dias'], ['30', '30 dias'], ['tudo', 'Tudo']]
const BOTOES = [
  { nome: 'Errei', cor: 'bg-red-500' },
  { nome: 'Difícil', cor: 'bg-amber-500' },
  { nome: 'Bom', cor: 'bg-green-600' },
  { nome: 'Fácil', cor: 'bg-blue-500' },
]

/** Tempo de uma resposta: "8 s" (passando de um minuto, só os minutos). */
const fmtResposta = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : fmtH(ms / 3_600_000)
}
const fmtDia = (dia: number) => fmtData(isoDoNumero(dia))

/** Estatísticas de um baralho (com os subbaralhos): % de acertos, botões, situação dos cartões e evolução. */
export function Estatisticas() {
  const ir = useFc((s) => s.ir)
  const baralhoId = useFc((s) => s.baralhoId)
  const faixas = useFaixas()
  const [periodo, setPeriodo] = useState<PeriodoFc>('30')
  const dados = useLiveQuery(async () => {
    const b = baralhoId ? await db.baralhos.get(baralhoId) : undefined
    return { nome: b?.nome ?? 'Todos os baralhos', e: await estatisticasDoBaralho(db, b ? b.id : null, periodo) }
  }, [baralhoId, periodo])

  const cabecalho = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => ir('baralhos')}>
        <ArrowLeft className="size-4" /> Baralhos
      </Button>
      <h1 className="m-0 mr-1 min-w-0 truncate text-xl font-bold">Estatísticas: {dados ? dados.nome.split('::').join(' › ') : '…'}</h1>
      <div className="inline-flex rounded-lg border p-0.5">
        {PERIODOS.map(([k, r]) => (
          <button key={k} onClick={() => setPeriodo(k)} className={cn('cursor-pointer rounded-md px-3 py-1 text-sm font-semibold', periodo === k ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
            {r}
          </button>
        ))}
      </div>
    </div>
  )
  if (!dados) return <div className="flex flex-col gap-3">{cabecalho}<p className="text-sm text-muted-foreground">Carregando…</p></div>

  const { resumo: r, situacao: s, semanas, dificeis, totalCartoes } = dados.e
  const nivel = nivelFc(r.total, faixas)
  const respostas = r.total.respostas

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 max-[900px]:overflow-auto">
      {cabecalho}

      <div className="grid grid-cols-4 gap-3 max-[700px]:grid-cols-2">
        <div className={cn(card, 'py-2.5')}>
          <span className={mudo}>Acertos</span>
          <span className="flex items-center gap-2">
            <b className="text-xl" style={{ color: respostas ? COR_NIVEL[nivel] : undefined }}>{respostas ? `${r.pct}%` : '—'}</b>
            {respostas > 0 && <Etiqueta nivel={nivel} />}
          </span>
        </div>
        <Kpi rotulo="Respostas" valor={String(respostas)} sub={`${r.total.acertos} certas · ${respostas - r.total.acertos} erradas`} />
        <Kpi rotulo="Cartões estudados" valor={String(r.cartoes)} sub={`de ${totalCartoes} no baralho`} />
        <Kpi rotulo="Tempo médio" valor={respostas ? fmtResposta(r.tempoMs / respostas) : '—'} sub={respostas ? `por resposta · ${fmtH(r.tempoMs / 3_600_000)} no total` : 'por resposta'} />
      </div>

      {respostas === 0 && (
        <p className="m-0 rounded-xl border bg-card p-3 text-sm text-muted-foreground">
          Nenhuma resposta neste período. Estude o baralho e os números aparecem aqui.
        </p>
      )}
      {respostas > 0 && respostas < MIN_RESPOSTAS && (
        <p className={cn(mudo, 'm-0')}>Com menos de {MIN_RESPOSTAS} respostas o nível fica "Poucos dados".</p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        <div className="flex min-h-0 flex-col gap-3">
          <section className={card}>
            <h2 className={titulo}>Acertos por tipo</h2>
            <LinhaAcerto rotulo="Revisões" dica="cartões já aprendidos: mostra o quanto você lembra" a={r.revisao} />
            <LinhaAcerto rotulo="Aprendizado" dica="cartões novos, em aprendizado ou reaprendendo" a={r.aprendizado} />
          </section>

          <section className={card}>
            <h2 className={titulo}>Botões</h2>
            <div className="grid grid-cols-4 gap-2">
              {BOTOES.map((b, i) => {
                const n = r.botoes[i] ?? 0
                return (
                  <div key={b.nome} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-1 text-sm">
                      <span>{b.nome}</span>
                      <b className="tabular-nums">{pctDe(n, respostas)}%</b>
                    </span>
                    <div className="h-1.5 overflow-hidden rounded bg-muted">
                      <i className={cn('block h-full', b.cor)} style={{ width: `${pctDe(n, respostas)}%` }} />
                    </div>
                    <span className={mudo}>{n}×</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className={card}>
            <h2 className={titulo}>Situação dos cartões</h2>
            <Situacao s={s} total={totalCartoes} />
          </section>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <section className={card}>
            <h2 className={titulo}>Acertos por semana</h2>
            <div className="flex h-28 items-end gap-1.5">
              {semanas.map((w) => {
                const nv = nivelFc(w, faixas)
                return (
                  <div
                    key={w.inicio}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    title={`${fmtDia(w.inicio)} a ${fmtDia(w.fim)}: ${w.respostas ? `${w.pct}% (${w.acertos} de ${w.respostas})` : 'sem respostas'}`}
                  >
                    <span className="text-[0.65rem] text-muted-foreground tabular-nums">{w.respostas ? `${w.pct}%` : ''}</span>
                    <i
                      className="block w-full rounded-t"
                      style={{ height: w.respostas ? `${Math.max(4, w.pct)}%` : '2px', background: w.respostas ? COR_NIVEL[nv] : 'var(--muted)' }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-1 flex gap-1.5">
              {semanas.map((w) => (
                <span key={w.inicio} className="min-w-0 flex-1 truncate text-center text-[0.6rem] text-muted-foreground">{fmtDia(w.inicio)}</span>
              ))}
            </div>
          </section>

          <section className={cn(card, 'flex min-h-40 flex-1 flex-col')}>
            <h2 className={titulo}>Cartões que mais erro</h2>
            {dificeis.length === 0 ? (
              <p className={cn(mudo, 'm-0')}>Nenhum "Errei" neste período.</p>
            ) : (
              <ol className="m-0 min-h-0 flex-1 list-none overflow-auto p-0">
                {dificeis.map((d) => (
                  <li key={d.cartaoId} className="flex items-center gap-2 border-b py-1 text-sm last:border-b-0">
                    <span className="min-w-0 flex-1 truncate" title={d.frente}>{d.frente}</span>
                    <b className="whitespace-nowrap text-erro tabular-nums">{d.erros}×</b>
                    <span className={cn(mudo, 'whitespace-nowrap')}>de {d.respostas}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) {
  return (
    <div className={cn(card, 'py-2.5')}>
      <span className={mudo}>{rotulo}</span>
      <b className="block text-xl">{valor}</b>
      <span className={mudo}>{sub}</span>
    </div>
  )
}

function LinhaAcerto({ rotulo, dica, a }: { rotulo: string; dica: string; a: Acertos }) {
  const faixas = useFaixas()
  const nivel = nivelFc(a, faixas)
  const pct = pctDe(a.acertos, a.respostas)
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>
          <b>{rotulo}</b> <span className={mudo}>{dica}</span>
        </span>
        <span className="whitespace-nowrap tabular-nums">
          {a.respostas ? <><b>{pct}%</b> <span className={mudo}>({a.acertos}/{a.respostas})</span></> : <span className={mudo}>—</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
        <i className="block h-full" style={{ width: `${pct}%`, background: COR_NIVEL[nivel] }} />
      </div>
    </div>
  )
}

function Situacao({ s, total }: { s: { novos: number; aprendendo: number; jovens: number; maduros: number; suspensos: number }; total: number }) {
  const partes = [
    { nome: 'Novos', n: s.novos, cor: 'bg-blue-500' },
    { nome: 'Aprendendo', n: s.aprendendo, cor: 'bg-red-500' },
    { nome: 'Jovens', n: s.jovens, cor: 'bg-[var(--calor-2)]', dica: `em revisão, intervalo menor que ${DIAS_MADURO} dias` },
    { nome: 'Maduros', n: s.maduros, cor: 'bg-[var(--calor-4)]', dica: `intervalo de ${DIAS_MADURO} dias ou mais: bem guardados` },
    { nome: 'Suspensos', n: s.suspensos, cor: 'bg-muted-foreground/40' },
  ]
  if (!total) return <p className={cn(mudo, 'm-0')}>Nenhum cartão neste baralho.</p>
  return (
    <>
      <div className="flex h-3 overflow-hidden rounded bg-muted" role="img" aria-label={partes.map((p) => `${p.nome}: ${p.n}`).join(', ')}>
        {partes.map((p) => p.n > 0 && <i key={p.nome} className={cn('block h-full', p.cor)} style={{ width: `${(p.n / total) * 100}%` }} title={`${p.nome}: ${p.n}`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {partes.map((p) => (
          <span key={p.nome} className="flex items-center gap-1.5" title={p.dica}>
            <i className={cn('inline-block size-2.5 rounded-sm', p.cor)} />
            {p.nome} <b className="tabular-nums">{p.n}</b>
          </span>
        ))}
      </div>
    </>
  )
}
