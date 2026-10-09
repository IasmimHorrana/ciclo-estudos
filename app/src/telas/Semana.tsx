import { useState } from 'react'
import { Pizza, RoscaCiclo } from '@/componentes/graficos/Rosca'
import { CampoNumero } from '@/componentes/CampoNumero'
import { avisar, confirmar } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { definirMeta, editarPasso, fecharSemana, limparSemana, marcarPasso, reagendar, type Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { useCiclo, useHojeISO } from '@/dados/useCiclo'
import { corDe, fmtH, horasFeitasDe, metaEf, resumoSemana, round2, soma, type Passo, type ResumoSemana } from '@/dominio/ciclo'
import { addDias, fmtData, idxDia, NOMES_DIA, NOMES_DIA_LONGO } from '@/dominio/datas'
import { abrirDialogo } from '@/estado/dialogo'
import { useUi } from '@/estado/ui'
import { irParaDia } from '@/lib/rolagem'
import { cn } from '@/lib/utils'

const card = 'rounded-xl border bg-card p-3.5 shadow-sm'
const mudo = 'text-xs text-muted-foreground'

/** O resumo da semana (também usado ao fechar e nas semanas fechadas do Desempenho). */
export function ResumoDaSemana({ r, cores }: { r: ResumoSemana | Omit<ResumoSemana, 'id'>; cores: Record<string, number> }) {
  const bloco = (rotulo: string, valor: string, sub?: string) => (
    <div className="rounded-lg border p-2">
      <span className={mudo}>{rotulo}</span>
      <b className="block text-lg">{valor}</b>
      {sub && <span className={mudo}>{sub}</span>}
    </div>
  )
  return (
    <>
      <div className="mb-4 grid grid-cols-4 gap-2 max-[560px]:grid-cols-2">
        {bloco('Ciclo', r.cicloFechado ? '✅ Fechado' : '⏳ Incompleto')}
        {bloco('Concluído', `${r.pctConcluido}%`, `${r.passosFeitos}/${r.passosTotal} passos`)}
        {bloco('Estudado', fmtH(r.horasEstudadas), `meta ${fmtH(r.metaHoras)}`)}
        {bloco('Faltaram', fmtH(r.horasFaltando), r.pomodoros ? `🍅 ${r.pomodoros} pomodoro(s)` : undefined)}
      </div>
      <Pizza porMateria={r.porMateria} cores={cores} />
    </>
  )
}

export function Semana() {
  const ciclo = useCiclo()
  const hojeISO = useHojeISO()
  if (!ciclo) return <p className="text-sm text-muted-foreground">Carregando…</p>
  return ciclo.semana ? <SemanaTela ciclo={ciclo} hojeISO={hojeISO} /> : <SemSemana />
}

function SemSemana() {
  const irParaAba = useUi((s) => s.irParaAba)
  return (
    <div className="m-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
      <h1 className="mb-2 text-xl font-bold">Nenhuma semana em andamento</h1>
      <p className="mb-4 text-sm text-muted-foreground">Monte um ciclo para começar a acompanhar a semana.</p>
      <Button onClick={() => irParaAba('montar')}>Montar ciclo</Button>
    </div>
  )
}

function SemanaTela({ ciclo, hojeISO }: { ciclo: Ciclo; hojeISO: string }) {
  const irParaAba = useUi((s) => s.irParaAba)
  const [copiado, setCopiado] = useState(false)
  const s = ciclo.semana as NonNullable<Ciclo['semana']>
  const { cores, config } = ciclo
  const n = s.passos.length
  const feitos = s.passos.filter((p) => p.feito).length
  const horas = horasFeitasDe(s)
  const meta = metaEf(s)
  const falta = Math.max(0, round2(meta - horas))
  const pctP = n ? Math.round((feitos / n) * 100) : 0
  const pctH = meta ? Math.min(100, Math.round((horas / meta) * 100)) : 0
  const passosHoje = s.passos.filter((p) => p.dia === hojeISO)
  const hojeFeitos = passosHoje.filter((p) => p.feito).length
  const fora = hojeISO > s.dom ? ' · ⚠️ semana encerrada' : hojeISO < s.seg ? ' · semana futura' : ''

  const semDia = s.passos.filter((p) => !p.dia || p.dia < s.seg || p.dia > s.dom)
  const grupos: { chave: string; titulo: string; dia: string | null; itens: Passo[] }[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDias(s.seg, i)
    const itens = s.passos.filter((p) => p.dia === d)
    if (itens.length) grupos.push({ chave: d, titulo: `${NOMES_DIA_LONGO[i]} ${fmtData(d)}`, dia: d, itens })
  }
  if (semDia.length) grupos.push({ chave: 'sem', titulo: grupos.length ? 'Sem dia' : 'Passos', dia: null, itens: semDia })

  const materias = [...new Set(s.passos.map((p) => p.materia))]

  async function copiar() {
    const txt = s.passos.map((p, i) => `${i + 1}. ${p.materia}`).join('\n')
    try {
      await navigator.clipboard.writeText(txt)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      void avisar('Copiar lista', 'Não foi possível copiar automaticamente neste navegador.')
    }
  }

  async function reagendarPendentes() {
    if (!(await confirmar('Os passos ainda não concluídos serão redistribuídos a partir de hoje, nos seus dias de estudo, e os dias que você ajustou à mão nesses passos serão sobrescritos. Continuar?', 'Reagendar'))) return
    const semDiaN = await reagendar(db)
    if (semDiaN) void avisar('Passos sem dia', `${semDiaN} passo(s) não couberam nos dias restantes desta semana e ficaram em "Sem dia".`)
  }

  async function limpar() {
    if (await confirmar('Isso zera as marcações, horas e anotações da semana SEM salvar estatísticas. Para guardar o resultado, use "Fechar semana". Continuar?', 'Limpar', true)) await limparSemana(db)
  }

  async function fechar() {
    const r = resumoSemana(s, hojeISO, Date.now())
    const escolha = await abrirDialogo<'nova' | 'limpar'>('Fechar semana', (fecharDlg) => (
      <>
        <ResumoDaSemana r={r} cores={cores} />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => fecharDlg(null)}>Cancelar</Button>
          <Button variant="outline" onClick={() => fecharDlg('nova')}>Salvar e montar a próxima semana</Button>
          <Button onClick={() => fecharDlg('limpar')}>Salvar e limpar marcações</Button>
        </div>
      </>
    ))
    if (!escolha) return
    await fecharSemana(db, escolha)
    irParaAba(escolha === 'nova' ? 'montar' : 'semana')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2 text-sm font-bold">
        📅 Hoje: {NOMES_DIA_LONGO[idxDia(hojeISO)]}, {fmtData(hojeISO)}
        <span className="text-xs font-normal text-muted-foreground">
          · Semana {fmtData(s.seg)} → {fmtData(s.dom)}{fora}
        </span>
      </div>

      <div className={cn(card, 'grid grid-cols-[repeat(5,minmax(0,1fr))] items-start gap-4 max-[900px]:grid-cols-2')}>
        <Estat rotulo="Hoje" valor={passosHoje.length ? `${hojeFeitos}/${passosHoje.length}` : '—'} sub={passosHoje.length ? 'passos do dia' : 'sem passos hoje'} />
        <Estat rotulo="Passos" valor={`${feitos}/${n}`} barra={pctP} />
        <Estat rotulo="Horas estudadas" valor={fmtH(horas)} barra={pctH} />
        <div className="flex flex-col gap-1">
          <span className={mudo}>Meta da semana (h)</span>
          <CampoNumero key={`meta${s.meta}${meta}`} className="w-24" valor={meta} aoConfirmar={(v) => void definirMeta(db, v !== null && v >= 0 ? v : null)} />
        </div>
        <Estat rotulo="Faltam" valor={fmtH(falta)} />
      </div>

      <div className="grid grid-cols-7 gap-2 max-[700px]:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDias(s.seg, i)
          const it = s.passos.filter((p) => p.dia === d)
          const fe = it.filter((p) => p.feito).length
          const folga = !config.dias[i] && !it.length
          return (
            <button
              key={d}
              onClick={() => irParaDia(d)}
              title={`Ir para ${NOMES_DIA_LONGO[i]}`}
              className={cn('cursor-pointer rounded-xl border bg-card p-2 text-left', d === hojeISO && 'border-2 border-primary', folga && 'opacity-55')}
            >
              <span className="text-xs font-bold">{NOMES_DIA[i]}</span>
              <span className="block text-[0.7rem] text-muted-foreground">{fmtData(d)}</span>
              <b className="block text-base">{it.length ? `${fe}/${it.length}` : folga ? 'folga' : '—'}</b>
              <div className="mt-1 h-1 overflow-hidden rounded bg-muted"><i className="block h-full bg-primary" style={{ width: `${it.length ? Math.round((fe / it.length) * 100) : 0}%` }} /></div>
            </button>
          )
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-3 max-[1100px]:grid-cols-1 max-[1100px]:overflow-visible">
        <div className="flex min-h-0 flex-col gap-2">
          <div className={cn(card, 'flex min-h-0 flex-1 flex-col')}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="m-0 text-sm font-bold">
                Ciclo da semana <span className="font-normal text-muted-foreground">· início {fmtData(s.inicio)}</span>
              </h2>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void copiar()}>📋 Copiar lista</Button>
                {copiado && <span className={mudo}>Copiado!</span>}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {grupos.map((g) => {
                const fe = g.itens.filter((p) => p.feito).length
                const pend = g.itens.length - fe
                return (
                  <div key={g.chave}>
                    <div id={g.dia ? `dia-${g.dia}` : undefined} className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card py-1.5 text-sm">
                      <b>{g.titulo}</b>
                      {g.dia === hojeISO && <span className="rounded-full bg-primary/15 px-2 text-[0.65rem] font-bold text-primary">HOJE</span>}
                      {g.dia && g.dia < hojeISO && pend > 0 && <span className="rounded-full bg-erro-bg px-2 text-[0.65rem] font-bold text-erro">{pend} atrasado(s)</span>}
                      <span className={mudo}>
                        {fe}/{g.itens.length} passos · {fmtH(soma(g.itens, (p) => p.horasFeitas))}/{fmtH(soma(g.itens, (p) => p.horasPlanejadas))}
                      </span>
                    </div>
                    {g.itens.map((p) => (
                      <LinhaPasso key={p.id} p={p} s={s} cores={cores} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void fechar()}>✅ Fechar semana</Button>
            <Button variant="outline" onClick={() => void reagendarPendentes()}>📅 Reagendar pendentes a partir de hoje</Button>
            <Button variant="destructive" onClick={() => void limpar()}>Limpar marcações sem salvar</Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto max-[1100px]:overflow-visible">
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Ciclo</h2>
            <RoscaCiclo passos={s.passos} cores={cores} />
          </section>
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Por matéria</h2>
            {materias.map((m) => {
              const itens = s.passos.filter((p) => p.materia === m)
              const pl = soma(itens, (p) => p.horasPlanejadas)
              const fe = soma(itens, (p) => p.horasFeitas)
              return (
                <div key={m} className="mb-2.5 last:mb-0">
                  <div className="flex items-center gap-2 text-sm">
                    <i className="size-2.5 shrink-0 rounded-full" style={{ background: corDe(cores, m) }} />
                    <span className="min-w-0 flex-1 truncate" title={m}>{m}</span>
                    <span className={mudo}>{fmtH(fe)}/{fmtH(pl)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><i className="block h-full" style={{ width: `${pl ? Math.min(100, (fe / pl) * 100) : 0}%`, background: corDe(cores, m) }} /></div>
                </div>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}

function Estat({ rotulo, valor, sub, barra }: { rotulo: string; valor: string; sub?: string; barra?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={mudo}>{rotulo}</span>
      <b className="text-xl leading-tight">{valor}</b>
      {sub && <span className={mudo}>{sub}</span>}
      {barra !== undefined && <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-muted"><i className="block h-full bg-primary" style={{ width: `${barra}%` }} /></div>}
    </div>
  )
}

function LinhaPasso({ p, s, cores }: { p: Passo; s: NonNullable<Ciclo['semana']>; cores: Record<string, number> }) {
  const pct = p.horasPlanejadas ? Math.min(100, Math.round((p.horasFeitas / p.horasPlanejadas) * 100)) : 0
  return (
    <div className={cn('grid grid-cols-[auto_minmax(0,1fr)_72px_72px_minmax(0,1.3fr)_130px] items-end gap-2 border-b py-2 max-[1300px]:grid-cols-[auto_minmax(0,1fr)_72px_72px_130px] max-[1300px]:[&>.nota]:col-span-full', p.feito && 'opacity-60')}>
      <input type="checkbox" className="mb-1.5 size-4 cursor-pointer accent-[var(--primary)]" checked={p.feito} onChange={(e) => void marcarPasso(db, p.id, e.target.checked)} aria-label={`Concluir passo ${p.id}`} />
      <div className="min-w-0 pb-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="text-xs text-muted-foreground">{p.id}.</span>
          <i className="size-2.5 shrink-0 rounded-full" style={{ background: corDe(cores, p.materia) }} />
          <span className="truncate" title={p.materia}>{p.materia}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded bg-muted"><i className="block h-full" style={{ width: `${pct}%`, background: corDe(cores, p.materia) }} /></div>
      </div>
      <label className="flex flex-col text-[0.65rem] text-muted-foreground">
        planejado (h)
        <CampoNumero key={`pl${p.horasPlanejadas}`} className="px-1.5 py-1 text-center" valor={p.horasPlanejadas} aoConfirmar={(n) => void editarPasso(db, p.id, { horasPlanejadas: n && n > 0 ? n : 1 })} />
      </label>
      <label className="flex flex-col text-[0.65rem] text-muted-foreground">
        feito (h)
        <CampoNumero key={`fe${p.horasFeitas}`} className="px-1.5 py-1 text-center" valor={p.horasFeitas} aoConfirmar={(n) => void editarPasso(db, p.id, { horasFeitas: n && n > 0 ? n : 0 })} />
      </label>
      <Entrada
        key={`nt${p.nota}`}
        className="nota py-1"
        placeholder="Anotação: tópico, questões, acertos…"
        defaultValue={p.nota}
        onBlur={(e) => e.target.value !== p.nota && void editarPasso(db, p.id, { nota: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <Selecao className="py-1" value={p.dia ?? ''} aria-label={`Dia do passo ${p.id}`} onChange={(e) => void editarPasso(db, p.id, { dia: e.target.value || null })}>
        <option value="">Sem dia</option>
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDias(s.seg, i)
          return <option key={d} value={d}>{NOMES_DIA[i]} {fmtData(d)}</option>
        })}
      </Selecao>
    </div>
  )
}
