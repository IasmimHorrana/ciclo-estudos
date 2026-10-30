import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Play, X } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { estudarMateria } from '@/componentes/cronometro-api'
import { avisar, pedirTexto } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Selecao } from '@/componentes/ui/entrada'
import type { Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { carregarEstudo } from '@/dados/desempenho'
import { ajustarMetaDaSemana, definirMetaLivre, definirModo, escolherDia } from '@/dados/livre'
import { corDe, fmtH, fmtHs, todasMaterias } from '@/dominio/ciclo'
import { fmtData, idxDia, NOMES_DIA, NOMES_DIA_LONGO } from '@/dominio/datas'
import { diaDe, escolherNoDia, materiasDoDia, resumoLivre, sugerirMaterias, type ModoEstudo, type PapelNoDia } from '@/dominio/livre'
import { useCronometro } from '@/estado/cronometro'
import { useUi } from '@/estado/ui'
import { Constancia } from '@/telas/PainelSemana'
import { RegistroManual } from '@/telas/RegistroManual'
import { cn } from '@/lib/utils'

const card = 'rounded-xl border bg-card p-3.5 shadow-sm'
const mudo = 'text-xs text-muted-foreground'
const rotulo = 'flex flex-col gap-1 text-[0.7rem] font-bold tracking-wide text-muted-foreground uppercase'
const OUTRA = '__outra'

/** Ciclo de passos ou modo Livre. Trocar não apaga nada; o relógio da barra lateral acompanha a escolha. */
export function SeletorModo({ modo, className = 'ml-auto' }: { modo: ModoEstudo; className?: string }) {
  const escolherRelogio = useUi((s) => s.escolherRelogio)
  const opcoes: { id: ModoEstudo; rotulo: string; dica: string }[] = [
    { id: 'ciclo', rotulo: 'Ciclo', dica: 'Semana em passos, com o Pomodoro' },
    { id: 'livre', rotulo: 'Livre', dica: 'Até duas matérias por dia, tempo livre e meta semanal em horas' },
  ]
  return (
    <div role="radiogroup" aria-label="Modo de estudo" className={cn('inline-flex rounded-lg border bg-muted p-0.5 text-xs font-bold', className)}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={modo === o.id}
          title={o.dica}
          onClick={() => {
            if (modo === o.id) return
            void definirModo(db, o.id)
            escolherRelogio(o.id === 'livre' ? 'livre' : 'pomodoro')
          }}
          className={cn('rounded-md px-3 py-1 text-muted-foreground transition-colors hover:text-foreground', modo === o.id && 'bg-card text-foreground shadow-sm')}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

/** Painel do modo Livre: as matérias do dia, as horas da semana contra a meta (sem dívida) e o que já foi feito. */
export function SemanaLivre({ ciclo, hojeISO }: { ciclo: Ciclo; hojeISO: string }) {
  const estudo = useLiveQuery(() => carregarEstudo(db), [])
  const ocupado = useCronometro((s) => s.rodando || s.seg > 0)
  const [abrirExtra, setAbrirExtra] = useState(false)
  const { preferencias: p, config, cores } = ciclo
  const dia = diaDe(p.diaLivre, hojeISO)
  const doDia = materiasDoDia(dia)
  const r = resumoLivre(estudo?.sessoes ?? [], estudo?.questoes ?? [], p.metaLivre, hojeISO)
  const g = r.progresso
  const todas = [...new Set([...(ciclo.semana?.passos.map((x) => x.materia) ?? []), ...todasMaterias(config)])]
  const materias = sugerirMaterias(estudo?.sessoes ?? [], todas)
  const ajustada = p.metaLivre.ajustes[r.segunda] !== undefined
  const extras = r.hoje.materias.filter((x) => !doDia.includes(x.materia))

  const escolher = (papel: PapelNoDia, m: string) => void escolherDia(db, escolherNoDia(dia, papel, m || null))
  // a extra pode ser uma matéria fora da lista (ex.: Redação), digitada na hora
  const opcoesExtra = [...new Set([...(dia.extra ? [dia.extra] : []), ...materias])].filter((x) => x !== dia.principal && x !== dia.secundaria)

  async function escolherExtra(valor: string) {
    if (valor !== OUTRA) return escolher('extra', valor)
    const nome = (await pedirTexto('Matéria extra', 'Nome da matéria', '', { ok: 'Usar hoje' }))?.trim()
    if (nome) escolher('extra', nome)
  }

  async function mudarPadrao(base: number, estendida: number) {
    const erro = await definirMetaLivre(db, base, estendida)
    if (erro) void avisar('Meta semanal', erro)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
        📅 Hoje: {NOMES_DIA_LONGO[idxDia(hojeISO)]}, {fmtData(hojeISO)}
        <span className="text-xs font-normal text-muted-foreground">· Semana {fmtData(r.segunda)} → {fmtData(r.domingo)}</span>
        <SeletorModo modo="livre" />
      </div>

      <div className={cn(card, 'grid grid-cols-[repeat(5,minmax(0,1fr))] items-start gap-4 max-[900px]:grid-cols-2')}>
        <Estat rotulo="Hoje" valor={fmtHs(r.hoje.horas)} sub={r.hoje.materias.length ? r.hoje.materias.map((m) => m.materia).join(' · ') : 'nada registrado ainda'} />
        <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
          <span className={mudo}>Horas na semana</span>
          <b className="text-xl leading-tight">
            {fmtHs(g.horas)} <span className="text-sm font-normal text-muted-foreground">de {fmtH(g.meta)}{g.estendida > g.meta ? ` · estendida ${fmtH(g.estendida)}` : ''}</span>
          </b>
          <BarraMeta horas={g.horas} meta={g.meta} estendida={g.estendida} />
          <span className={mudo}>
            {g.situacao === 'estendida'
              ? '🏆 Meta estendida batida!'
              : g.situacao === 'base'
                ? `✅ Meta batida${g.faltaEstendida ? ` · ${fmtHs(g.faltaEstendida)} para a estendida` : ''}`
                : `Faltam ${fmtHs(g.faltaMeta)} para a meta`}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={mudo}>Meta desta semana (h)</span>
          <CampoNumero
            key={`meta${g.meta}`}
            className="w-24"
            valor={g.meta}
            aoConfirmar={(v) => {
              if (v === null || v <= 0) return
              void ajustarMetaDaSemana(db, hojeISO, v === p.metaLivre.base ? null : v)
            }}
          />
          {ajustada && (
            <span className={mudo}>
              só nesta semana ·{' '}
              <button className="cursor-pointer underline" onClick={() => void ajustarMetaDaSemana(db, hojeISO, null)}>
                voltar a {fmtH(p.metaLivre.base)}
              </button>
            </span>
          )}
        </div>
        <Estat
          rotulo="Questões hoje"
          valor={r.hoje.feitas ? `${r.hoje.acertos}/${r.hoje.feitas}` : '—'}
          sub={r.hoje.feitas ? `${r.hoje.pct}% de acertos` : undefined}
        />
      </div>

      {/* a coluna da direita vai do topo ao fim; à esquerda, só a faixa de dias cresce (e rola por dentro se faltar espaço) */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] grid-rows-[auto_auto_minmax(0,1fr)] gap-x-3 gap-y-2 max-[1100px]:grid-cols-1 max-[1100px]:grid-rows-none">
        <section className={card}>
          <h2 className="m-0 mb-2 text-sm font-bold">Matérias de hoje</h2>
          <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
            {(['principal', 'secundaria'] as const).map((papel) => {
              const m = dia[papel]
              const horas = r.hoje.materias.find((x) => x.materia === m)?.horas ?? 0
              return (
                <div key={papel} className="flex flex-col gap-1.5 rounded-lg border p-2.5" style={m ? { borderLeft: `4px solid ${corDe(cores, m)}` } : undefined}>
                  <label className={rotulo}>
                    {papel === 'principal' ? 'Principal · bloco maior' : 'Secundária · opcional'}
                    <Selecao value={m ?? ''} disabled={papel === 'secundaria' && !dia.principal} onChange={(e) => escolher(papel, e.target.value)}>
                      <option value="">{papel === 'principal' ? '— escolha a matéria —' : dia.principal ? '— só uma hoje —' : '— escolha a principal antes —'}</option>
                      {materias.map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </Selecao>
                  </label>
                  {m && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        <b>{fmtHs(horas)}</b> <span className={mudo}>hoje</span>
                      </span>
                      <Button
                        size="sm"
                        disabled={ocupado}
                        title={ocupado ? 'Já há um cronômetro em andamento na barra lateral' : `Ligar o cronômetro livre em ${m}`}
                        onClick={() => void estudarMateria(m)}
                      >
                        <Play className="size-3.5" /> Estudar agora
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {dia.principal && (dia.extra || abrirExtra) ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5" style={dia.extra ? { borderLeft: `4px solid ${corDe(cores, dia.extra)}` } : undefined}>
              <span className="text-[0.7rem] font-bold tracking-wide text-muted-foreground uppercase">Extra</span>
              <Selecao
                aria-label="Matéria extra"
                autoFocus={!dia.extra}
                className="h-7 w-auto min-w-40 py-0 text-xs"
                value={dia.extra ?? ''}
                onChange={(e) => void escolherExtra(e.target.value)}
              >
                <option value="">— escolha —</option>
                {opcoesExtra.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
                <option value={OUTRA}>＋ Outra matéria…</option>
              </Selecao>
              {dia.extra && (
                <>
                  <span className="text-xs"><b>{fmtHs(r.hoje.materias.find((x) => x.materia === dia.extra)?.horas ?? 0)}</b> <span className="text-muted-foreground">hoje</span></span>
                  <Button size="sm" variant="outline" className="h-7" disabled={ocupado} title={ocupado ? 'Já há um cronômetro em andamento na barra lateral' : `Ligar o cronômetro livre em ${dia.extra}`} onClick={() => dia.extra && void estudarMateria(dia.extra)}>
                    <Play className="size-3.5" /> Estudar
                  </Button>
                </>
              )}
              <button
                className="ml-auto cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Tirar a extra de hoje"
                aria-label="Tirar a extra de hoje"
                onClick={() => {
                  escolher('extra', '')
                  setAbrirExtra(false)
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            dia.principal && (
              <button className="mt-2 cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setAbrirExtra(true)}>
                ＋ Extra do dia
              </button>
            )
          )}
          {extras.length > 0 && <p className={cn(mudo, 'm-0 mt-2')}>Hoje também: {extras.map((x) => `${x.materia} (${fmtHs(x.horas)})`).join(', ')}</p>}
        </section>

        <Constancia s={ciclo.semana} diasDeEstudo={config.dias} hojeISO={hojeISO} />

        <section className={cn(card, 'flex max-h-full min-h-0 flex-col self-start')}>
          <h2 className="m-0 mb-2 text-sm font-bold">Dias da semana</h2>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-7 gap-2 overflow-auto max-[700px]:grid-cols-2">
            {r.dias.map((d) => (
              <div key={d.data} className={cn('flex min-w-0 flex-col gap-1 rounded-lg border p-2', d.data === hojeISO && 'border-primary', d.data > hojeISO && 'opacity-60')}>
                <span className={mudo}>
                  {NOMES_DIA[idxDia(d.data)]} {fmtData(d.data)}
                </span>
                <b className="text-base">{d.horas ? fmtHs(d.horas) : '—'}</b>
                {/* nome inteiro (quebra a linha em vez de cortar) e o tempo embaixo, com a cor da matéria na borda */}
                {d.materias.map((m) => (
                  <div
                    key={m.materia}
                    className="flex flex-col gap-0.5 rounded-md border-l-4 px-2 py-1 text-[0.72rem] leading-snug"
                    style={{ borderLeftColor: corDe(cores, m.materia), background: `${corDe(cores, m.materia)}1f` }}
                  >
                    <span className="break-words hyphens-auto" lang="pt-BR">{m.materia}</span>
                    <b className="whitespace-nowrap tabular-nums">{fmtHs(m.horas)}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <div className="col-start-2 row-span-3 row-start-1 flex min-h-0 flex-col gap-3 overflow-auto max-[1100px]:col-start-1 max-[1100px]:row-span-1 max-[1100px]:row-start-auto max-[1100px]:overflow-visible">
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Meta semanal</h2>
            <div className="grid grid-cols-2 gap-2">
              <label className={rotulo}>
                Base (h)
                <CampoNumero key={`b${p.metaLivre.base}`} valor={p.metaLivre.base} aoConfirmar={(v) => v !== null && void mudarPadrao(v, Math.max(v, p.metaLivre.estendida))} />
              </label>
              <label className={rotulo}>
                Estendida (h)
                <CampoNumero key={`e${p.metaLivre.estendida}`} valor={p.metaLivre.estendida} aoConfirmar={(v) => v !== null && void mudarPadrao(p.metaLivre.base, v)} />
              </label>
            </div>
          </section>
          <RegistroManual s={null} config={config} hojeISO={hojeISO} primeiras={doDia} />
        </div>
      </div>
    </div>
  )
}

/** Barra de horas com dois marcadores: a meta da semana e a estendida. */
function BarraMeta({ horas, meta, estendida }: { horas: number; meta: number; estendida: number }) {
  const escala = Math.max(estendida, horas, 1)
  const pct = (x: number) => `${Math.min(100, (x / escala) * 100)}%`
  return (
    <div className="relative mt-1 h-2.5 rounded bg-muted" role="img" aria-label={`${fmtHs(horas)} de ${fmtH(meta)}`}>
      <i className={cn('absolute inset-y-0 left-0 block rounded', horas >= meta ? 'bg-ok' : 'bg-primary')} style={{ width: pct(horas) }} />
      <span className="absolute -inset-y-1 w-0.5 bg-foreground/70" style={{ left: pct(meta) }} title={`Meta: ${fmtH(meta)}`} />
      {estendida > meta && <span className="absolute -inset-y-1 w-0.5 bg-foreground/35" style={{ left: `calc(${pct(estendida)} - 2px)` }} title={`Estendida: ${fmtH(estendida)}`} />}
    </div>
  )
}

function Estat({ rotulo: r, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={mudo}>{r}</span>
      <b className="text-xl leading-tight">{valor}</b>
      {sub && (
        <span className={cn(mudo, 'break-words')}>
          {sub}
        </span>
      )}
    </div>
  )
}
