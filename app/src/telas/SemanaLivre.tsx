import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleHelp, Clock, Flame, Play, Plus, Sun, X } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { estudarMateria } from '@/componentes/cronometro-api'
import { avisar, pedirTexto } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Selecao } from '@/componentes/ui/entrada'
import { caixa, Numero, Numeros, rotuloCampo, Sigla, tituloCaixa, Topo } from '@/componentes/visual'
import type { Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { carregarEstudo } from '@/dados/desempenho'
import { ajustarMetaDaSemana, definirMetaLivre, definirModo, escolherDia } from '@/dados/livre'
import { corDe, fmtH, todasMaterias } from '@/dominio/ciclo'
import { fmtData, idxDia, NOMES_DIA, NOMES_DIA_LONGO } from '@/dominio/datas'
import { diaDe, escolherNoDia, materiasDoDia, resumoLivre, sugerirMaterias, type ModoEstudo, type PapelNoDia } from '@/dominio/livre'
import { useCronometro } from '@/estado/cronometro'
import { useUi } from '@/estado/ui'
import { useConstancia } from '@/dados/useConstancia'
import { Constancia } from '@/telas/PainelSemana'
import { RegistroManual } from '@/telas/RegistroManual'
import { cn } from '@/lib/utils'

const mudo = 'text-xs text-muted-foreground'
const OUTRA = '__outra'

/** Ciclo de passos ou modo Livre. Trocar não apaga nada; o relógio da barra de baixo acompanha a escolha. */
export function SeletorModo({ modo, className }: { modo: ModoEstudo; className?: string }) {
  const escolherRelogio = useUi((s) => s.escolherRelogio)
  const opcoes: { id: ModoEstudo; rotulo: string; dica: string }[] = [
    { id: 'ciclo', rotulo: 'Ciclo', dica: 'Semana em passos, com o Pomodoro' },
    { id: 'livre', rotulo: 'Livre', dica: 'Até duas matérias por dia, tempo livre e meta semanal em horas' },
  ]
  return (
    <div role="radiogroup" aria-label="Modo de estudo" className={cn('inline-flex rounded-[11px] border bg-muted p-0.5 text-xs font-semibold', className)}>
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
          className={cn('rounded-lg px-3.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground', modo === o.id && 'bg-card text-foreground shadow-sm')}
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
  const { sequencia } = useConstancia(ciclo.semana, config.dias, hojeISO)
  const dia = diaDe(p.diaLivre, hojeISO)
  const doDia = materiasDoDia(dia)
  const r = resumoLivre(estudo?.sessoes ?? [], estudo?.questoes ?? [], p.metaLivre, hojeISO)
  const g = r.progresso
  const todas = [...new Set([...(ciclo.semana?.passos.map((x) => x.materia) ?? []), ...todasMaterias(config)])]
  const materias = sugerirMaterias(estudo?.sessoes ?? [], todas)
  const ajustada = p.metaLivre.ajustes[r.segunda] !== undefined
  const extras = r.hoje.materias.filter((x) => !doDia.includes(x.materia))
  const maiorDia = Math.max(1 / 60, ...r.dias.map((d) => d.horas))

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

  const botaoEstudar = (m: string, compacto = false) => (
    <Button
      size={compacto ? 'sm' : 'default'}
      variant={compacto ? 'outline' : 'default'}
      className={cn(!compacto && 'shadow-[0_4px_12px_color-mix(in_oklab,var(--primary)_30%,transparent)]')}
      disabled={ocupado}
      title={ocupado ? 'Já há um cronômetro em andamento na barra de baixo' : `Ligar o cronômetro livre em ${m}`}
      onClick={() => void estudarMateria(m)}
    >
      <Play className="size-3.5" /> {compacto ? 'Estudar' : 'Estudar agora'}
    </Button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <Topo titulo="Semana" sub={`${NOMES_DIA_LONGO[idxDia(hojeISO)]}, ${fmtData(hojeISO)} · semana de ${fmtData(r.segunda)} a ${fmtData(r.domingo)}`}>
        <SeletorModo modo="livre" />
      </Topo>

      {/* cartões mais baixos aqui, para a faixa de dias caber sem rolar */}
      <Numeros className="[&>*]:py-2">
        <Numero destaque rotulo="Hoje" icone={Sun} valor={fmtH(r.hoje.horas)} sub={r.hoje.materias.length ? r.hoje.materias.map((m) => m.materia).join(' · ') : 'nada registrado ainda'} />
        <Numero
          rotulo="Questões hoje"
          icone={CircleHelp}
          valor={r.hoje.feitas ? r.hoje.acertos : '—'}
          unidade={r.hoje.feitas ? `/ ${r.hoje.feitas}` : undefined}
          sub={r.hoje.feitas ? `${r.hoje.pct}% de acertos` : 'nenhuma registrada'}
        />
        <Numero
          rotulo="Horas na semana"
          icone={Clock}
          valor={fmtH(g.horas)}
          unidade={`de ${fmtH(g.meta)}${g.estendida > g.meta ? ` · estendida ${fmtH(g.estendida)}` : ''}`}
          sub={
            g.situacao === 'estendida'
              ? '🏆 Meta estendida batida!'
              : g.situacao === 'base'
                ? `✅ Meta batida${g.faltaEstendida ? ` · ${fmtH(g.faltaEstendida)} para a estendida` : ''}`
                : `faltam ${fmtH(g.faltaMeta)} para a meta`
          }
        >
          <BarraMeta horas={g.horas} meta={g.meta} estendida={g.estendida} />
        </Numero>
        <Numero rotulo="Dias seguidos" icone={Flame} valor={sequencia} unidade={sequencia === 1 ? 'dia' : 'dias'} sub={sequencia > 0 ? 'sem falhar um dia de estudo' : 'estude hoje para começar'} />
      </Numeros>

      {/* a coluna da direita vai do topo ao fim; à esquerda, só a faixa de dias cresce (e rola por dentro se faltar espaço) */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] grid-rows-[auto_auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 max-[1100px]:grid-cols-1 max-[1100px]:grid-rows-none">
        <section className={cn(caixa, 'py-3')}>
          <div className="mb-2 flex items-center gap-3">
            <h2 className={tituloCaixa}>Matérias de hoje</h2>
            {dia.principal && !dia.extra && !abrirExtra && (
              <button className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline" onClick={() => setAbrirExtra(true)}>
                <Plus className="size-3.5" /> Extra do dia
              </button>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 max-[700px]:grid-cols-1">
            {(['principal', 'secundaria'] as const).map((papel) => {
              const m = dia[papel]
              const horas = r.hoje.materias.find((x) => x.materia === m)?.horas ?? 0
              const pri = papel === 'principal'
              return (
                <div key={papel} className={cn('flex min-w-0 flex-col gap-1.5 rounded-xl px-3 py-2', pri ? 'border border-primary/25 bg-accent/60' : 'border border-dashed bg-muted/60')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-[0.64rem] font-bold tracking-wider uppercase', pri ? 'text-primary' : 'text-muted-foreground')}>
                      {pri ? 'Principal · bloco maior' : 'Secundária · opcional'}
                    </span>
                    {m && (
                      <span className="text-sm whitespace-nowrap">
                        <b>{fmtH(horas)}</b> <span className={mudo}>hoje</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m ? <Sigla materia={m} cor={corDe(cores, m)} /> : <span className="grid h-6 min-w-10 place-items-center rounded-md bg-card text-muted-foreground">—</span>}
                    <Selecao
                      aria-label={pri ? 'Matéria principal' : 'Matéria secundária'}
                      className="min-w-0 flex-1 bg-card font-semibold"
                      value={m ?? ''}
                      disabled={!pri && !dia.principal}
                      onChange={(e) => escolher(papel, e.target.value)}
                    >
                      <option value="">{pri ? '— escolha a matéria —' : dia.principal ? '— só uma hoje —' : '— escolha a principal antes —'}</option>
                      {materias.map((x) => (
                        <option key={x} value={x}>{x}</option>
                      ))}
                    </Selecao>
                    {m && botaoEstudar(m, !pri)}
                  </div>
                </div>
              )
            })}
          </div>
          {dia.principal && (dia.extra || abrirExtra) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-3 py-1">
              <span className="text-[0.64rem] font-bold tracking-wider text-muted-foreground uppercase">Extra</span>
              {dia.extra && <Sigla materia={dia.extra} cor={corDe(cores, dia.extra)} />}
              <Selecao
                aria-label="Matéria extra"
                autoFocus={!dia.extra}
                className="h-8 w-auto min-w-40 py-0 text-xs"
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
                  <span className="text-xs"><b>{fmtH(r.hoje.materias.find((x) => x.materia === dia.extra)?.horas ?? 0)}</b> <span className="text-muted-foreground">hoje</span></span>
                  {botaoEstudar(dia.extra, true)}
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
          )}
          {extras.length > 0 && <p className={cn(mudo, 'm-0 mt-2')}>Hoje também: {extras.map((x) => `${x.materia} (${fmtH(x.horas)})`).join(', ')}</p>}
        </section>

        <Constancia s={ciclo.semana} diasDeEstudo={config.dias} hojeISO={hojeISO} />

        <section className={cn(caixa, 'flex max-h-full min-h-0 flex-col py-3')}>
          <h2 className={cn(tituloCaixa, 'mb-2')}>
            Dias da semana <span className="text-xs font-normal text-muted-foreground">{fmtData(r.segunda)} → {fmtData(r.domingo)}</span>
            <span className="ml-auto text-xs font-normal text-muted-foreground">Total <b className="text-foreground">{fmtH(r.horasSemana)}</b></span>
          </h2>
          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-2 overflow-auto max-[700px]:auto-rows-min max-[700px]:grid-cols-2">
            {r.dias.map((d) => {
              const ehHoje = d.data === hojeISO
              return (
                <div key={d.data} className={cn('flex min-w-0 flex-col gap-1 rounded-xl border p-2', ehHoje && 'border-primary/40 bg-accent/50 ring-3 ring-primary/10', d.data > hojeISO && 'opacity-55')}>
                  <span className="flex items-center justify-between gap-1 text-[0.72rem] whitespace-nowrap text-muted-foreground">
                    <span><b className="text-foreground">{NOMES_DIA[idxDia(d.data)]}</b> {fmtData(d.data)}</span>
                    {ehHoje && <span className="rounded-[5px] bg-primary px-1.5 text-[0.55rem] leading-4 font-bold text-primary-foreground">HOJE</span>}
                  </span>
                  <b className="text-lg leading-none">{d.horas ? fmtH(d.horas) : '—'}</b>
                  <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
                    <i className={cn('block h-full rounded-full', ehHoje ? 'bg-[image:var(--degrade)]' : 'bg-primary/35')} style={{ width: `${(d.horas / maiorDia) * 100}%` }} />
                  </div>
                  {d.materias.map((m) => (
                    <div
                      key={m.materia}
                      className="flex min-w-0 flex-col rounded-lg border-l-3 bg-card px-2 py-1 shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
                      style={{ borderLeftColor: corDe(cores, m.materia) }}
                      title={`${m.materia} · ${fmtH(m.horas)}`}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <Sigla materia={m.materia} cor={corDe(cores, m.materia)} className="h-[1.1rem] min-w-0 rounded-[5px] px-1 text-[0.55rem]" />
                        <b className="font-mono text-[0.7rem] whitespace-nowrap tabular-nums">{fmtH(m.horas)}</b>
                      </span>
                      <span className="truncate text-[0.66rem] text-muted-foreground">{m.materia}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </section>

        <div className="col-start-2 row-span-3 row-start-1 flex min-h-0 flex-col gap-3 overflow-auto max-[1100px]:col-start-1 max-[1100px]:row-span-1 max-[1100px]:row-start-auto max-[1100px]:overflow-visible">
          <section className={caixa}>
            <h2 className={cn(tituloCaixa, 'mb-3')}>Meta semanal</h2>
            <div className="grid grid-cols-3 gap-2">
              <label className={rotuloCampo}>
                Base (h)
                <CampoNumero key={`b${p.metaLivre.base}`} valor={p.metaLivre.base} aoConfirmar={(v) => v !== null && void mudarPadrao(v, Math.max(v, p.metaLivre.estendida))} />
              </label>
              <label className={rotuloCampo}>
                Estendida
                <CampoNumero key={`e${p.metaLivre.estendida}`} valor={p.metaLivre.estendida} aoConfirmar={(v) => v !== null && void mudarPadrao(p.metaLivre.base, v)} />
              </label>
              <label className={rotuloCampo} title="Só esta semana (h)">
                Esta semana
                <CampoNumero
                  key={`s${g.meta}`}
                  valor={g.meta}
                  aoConfirmar={(v) => {
                    if (v === null || v <= 0) return
                    void ajustarMetaDaSemana(db, hojeISO, v === p.metaLivre.base ? null : v)
                  }}
                />
              </label>
            </div>
            {ajustada && (
              <button className={cn(mudo, 'mt-1.5 cursor-pointer underline')} onClick={() => void ajustarMetaDaSemana(db, hojeISO, null)}>
                voltar a {fmtH(p.metaLivre.base)}
              </button>
            )}
          </section>
          <RegistroManual s={null} config={config} hojeISO={hojeISO} primeiras={doDia} />
        </div>
      </div>
    </div>
  )
}

/** Barra de horas com dois marcadores: a meta da semana e a estendida. */
export function BarraMeta({ horas, meta, estendida }: { horas: number; meta: number; estendida: number }) {
  const escala = Math.max(estendida, horas, 1)
  const pct = (x: number) => `${Math.min(100, (x / escala) * 100)}%`
  return (
    <div className="relative my-1 h-1.5 rounded-full bg-foreground/10" role="img" aria-label={`${fmtH(horas)} de ${fmtH(meta)}`}>
      <i className={cn('absolute inset-y-0 left-0 block rounded-full', horas >= meta ? 'bg-ok' : 'bg-[image:var(--degrade)]')} style={{ width: pct(horas) }} />
      <span className="absolute -inset-y-1 w-0.5 rounded bg-foreground/60" style={{ left: pct(meta) }} title={`Meta: ${fmtH(meta)}`} />
      {estendida > meta && <span className="absolute -inset-y-1 w-0.5 rounded bg-foreground/30" style={{ left: `calc(${pct(estendida)} - 2px)` }} title={`Estendida: ${fmtH(estendida)}`} />}
    </div>
  )
}
