import { useLiveQuery } from 'dexie-react-hooks'
import { abrirQuestoes } from '@/componentes/abrirQuestoes'
import { avisar, confirmar, pedirTexto } from '@/componentes/dialogos-api'
import { Barras } from '@/componentes/graficos/Barras'
import { Rosca } from '@/componentes/graficos/Rosca'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { excluirSemanaFechada, repetirSemanaFechada, type Ciclo } from '@/dados/ciclo'
import { adicionarAssuntos, carregarEstudo, excluirAssunto, excluirRegistroQuestoes, renomearAssunto, type Estudo } from '@/dados/desempenho'
import { db } from '@/dados/db'
import { useCiclo, useHojeISO } from '@/dados/useCiclo'
import { corDe, fmtH, todasMaterias } from '@/dominio/ciclo'
import { fmtData } from '@/dominio/datas'
import { calcularDesempenho, MIN_QUESTOES, NOMES_NIVEL, nivelDe, pctDe, resumoDasSemanas, type Nivel, type Periodo } from '@/dominio/desempenho'
import { abrirDialogo } from '@/estado/dialogo'
import { useDesempenhoUi } from '@/estado/desempenho'
import { useUi } from '@/estado/ui'
import { ResumoDaSemana } from '@/telas/Semana'
import { colorir } from '@/lib/colunas'
import { cn } from '@/lib/utils'

const card = 'rounded-xl border bg-card p-3.5 shadow-sm'
const mudo = 'text-xs text-muted-foreground'
const COR_NIVEL: Record<Nivel, string> = { na: 'var(--muted-foreground)', fraco: 'var(--erro)', medio: 'var(--aviso)', bom: 'var(--primary)', dom: 'var(--ok)' }

function Etiqueta({ nivel }: { nivel: Nivel }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold whitespace-nowrap" style={{ color: COR_NIVEL[nivel], background: `color-mix(in srgb, ${COR_NIVEL[nivel]} 14%, transparent)` }}>
      {NOMES_NIVEL[nivel]}
    </span>
  )
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className={cn(card, 'py-2.5')}>
      <span className={mudo}>{rotulo}</span>
      <b className="block text-xl">{valor}</b>
    </div>
  )
}

export function Desempenho() {
  const ciclo = useCiclo()
  const estudo = useLiveQuery(() => carregarEstudo(db), [])
  const visao = useDesempenhoUi((s) => s.visao)
  const periodo = useDesempenhoUi((s) => s.periodo)
  const definir = useDesempenhoUi((s) => s.definir)
  if (!ciclo || !estudo) return <p className="text-sm text-muted-foreground">Carregando…</p>

  const botoes = <T extends string>(itens: [T, string][], atual: T, onChange: (k: T) => void) => (
    <div className="inline-flex rounded-lg border p-0.5">
      {itens.map(([k, r]) => (
        <button key={k} onClick={() => onChange(k)} className={cn('cursor-pointer rounded-md px-3 py-1 text-sm font-semibold', atual === k ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
          {r}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="m-0 mr-1 text-xl font-bold">Desempenho</h1>
        {botoes<'estudo' | 'semanas'>([['estudo', 'Estudo'], ['semanas', 'Semanas']], visao, (k) => definir({ visao: k }))}
        {visao === 'estudo' && botoes<Periodo>([['7', '7 dias'], ['30', '30 dias'], ['tudo', 'Tudo']], periodo, (k) => definir({ periodo: k }))}
        <span className="flex-1" />
        {visao === 'estudo' && <Button onClick={() => void abrirQuestoes()}>＋ Registrar questões</Button>}
      </div>
      {visao === 'estudo' ? <VisaoEstudo ciclo={ciclo} estudo={estudo} periodo={periodo} /> : <VisaoSemanas ciclo={ciclo} />}
    </div>
  )
}

function VisaoEstudo({ ciclo, estudo, periodo }: { ciclo: Ciclo; estudo: Estudo; periodo: Periodo }) {
  const hojeISO = useHojeISO()
  const abertas = useDesempenhoUi((s) => s.abertas)
  const alternarAberta = useDesempenhoUi((s) => s.alternarAberta)
  const d = calcularDesempenho({
    questoes: estudo.questoes, sessoes: estudo.sessoes, assuntos: estudo.assuntos, periodo, hojeISO,
    materiasDaSemana: ciclo.semana?.passos.map((p) => p.materia) ?? [], config: ciclo.config,
  })
  const cor = (m: string) => corDe(ciclo.cores, m)
  const nomeAssunto = (id: string | null) => estudo.assuntos.find((a) => a.id === id)?.nome
  const todas = [...new Set([...todasMaterias(ciclo.config), ...d.mats])]

  return (
    <>
      <div className="grid grid-cols-4 gap-3 max-[700px]:grid-cols-2">
        <Kpi rotulo="Horas (Pomodoro)" valor={fmtH(d.horas)} />
        <Kpi rotulo="Questões feitas" valor={String(d.feitas)} />
        <Kpi rotulo="Acertos" valor={d.feitas ? `${pctDe(d.acertos, d.feitas)}%` : '—'} />
        <Kpi rotulo="Dias com estudo" valor={String(d.dias)} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3 max-[1000px]:grid-cols-1 max-[1000px]:overflow-visible">
        <section className={cn(card, 'flex min-h-0 flex-col')}>
          <h2 className="m-0 mb-1 text-sm font-bold">Matérias e assuntos</h2>
          <p className={cn(mudo, 'm-0 mb-2')}>
            O nível de cada assunto vem da porcentagem de acertos no período (mínimo de {MIN_QUESTOES} questões): abaixo de 60% é Fraco, até 74% Médio, até 89% Bom e 90% ou mais Dominado.
          </p>
          <FormAssuntos materias={todas} />
          <div className="min-h-0 flex-1 overflow-auto">
            {d.blocos.length === 0 && <p className={mudo}>Nada ainda. Adicione assuntos a uma matéria ou registre questões.</p>}
            {d.blocos.map((b) => (
              <details key={b.materia} open={abertas.includes(b.materia)} onToggle={(e) => alternarAberta(b.materia, e.currentTarget.open)} className="border-b last:border-b-0">
                <summary className="flex cursor-pointer items-center gap-2 py-2 text-sm">
                  <i className="size-3 shrink-0 rounded-sm" style={{ background: cor(b.materia) }} />
                  <span className="min-w-0 flex-1 truncate font-bold" title={b.materia}>{b.materia}</span>
                  <span className={mudo}>{b.feitas ? `${b.acertos}/${b.feitas} · ${pctDe(b.acertos, b.feitas)}%` : 'sem questões'} · {fmtH(b.horas)}</span>
                  <Etiqueta nivel={b.nivel} />
                </summary>
                {b.assuntos.map((a) => (
                  <div key={a.id ?? 'sem'} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2 py-1 pl-6 text-sm">
                    <span className="truncate" title={a.nome}>{a.nome}</span>
                    <div>
                      <div className="h-1 overflow-hidden rounded bg-muted"><i className="block h-full" style={{ width: `${pctDe(a.acertos, a.feitas)}%`, background: COR_NIVEL[a.nivel] }} /></div>
                      <div className={mudo}>{a.feitas ? `${a.acertos}/${a.feitas} · ${pctDe(a.acertos, a.feitas)}%` : 'sem questões'}{a.horas ? ` · ${fmtH(a.horas)}` : ''}</div>
                    </div>
                    <Etiqueta nivel={a.nivel} />
                    <span className="flex gap-1">
                      <Button size="sm" variant="outline" title="Registrar questões" onClick={() => void abrirQuestoes({ materia: b.materia, assuntoId: a.id ?? '' })}>＋</Button>
                      {a.id && (
                        <>
                          <Button size="sm" variant="outline" title="Renomear" aria-label="Renomear" onClick={() => void renomear(a.id as string, a.nome)}>✎</Button>
                          <Button size="sm" variant="outline" title="Excluir" aria-label="Excluir" onClick={() => void excluir(a.id as string, a.nome)}>🗑</Button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
                {!b.temAssuntos && <p className={cn(mudo, 'm-0 mb-2 pl-6')}>Nenhum assunto ainda. Adicione acima.</p>}
              </details>
            ))}
          </div>
        </section>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto max-[1000px]:overflow-visible">
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Horas por matéria</h2>
            <Rosca dados={d.horasPorMateria.map((x) => ({ nome: x.nome, valor: x.valor, cor: cor(x.nome), rotulo: fmtH(x.valor) }))} centro={fmtH(d.horas)} sub="estudadas" />
            <p className={cn(mudo, 'm-0 mt-2 text-center')}>{d.tipos.map((t) => `${t.tipo}: ${fmtH(t.horas)}`).join(' · ')}</p>
          </section>
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Horas por dia</h2>
            <Barras cols={colorir(d.colsHoras, cor, { acerto: 'var(--primary)', erro: 'var(--erro)' })} fmt={fmtH} />
          </section>
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Questões por dia</h2>
            <Barras cols={colorir(d.colsQuestoes, cor, { acerto: 'var(--primary)', erro: 'var(--erro)' })} fmt={String} />
            <p className={cn(mudo, 'm-0 mt-1')}><span style={{ color: 'var(--primary)' }}>■</span> acertos · <span style={{ color: 'var(--erro)' }}>■</span> erros</p>
          </section>
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Acerto por matéria</h2>
            {d.acertoPorMateria.length === 0 && <p className={mudo}>Registre questões para ver o desempenho por matéria.</p>}
            {d.acertoPorMateria.map((x) => (
              <div key={x.materia} className="mb-2.5 last:mb-0">
                <div className="flex items-center gap-2 text-sm">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: cor(x.materia) }} />
                  <span className="min-w-0 flex-1 truncate" title={x.materia}>{x.materia}</span>
                  <span className={mudo}>{x.acertos}/{x.feitas} · {pctDe(x.acertos, x.feitas)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><i className="block h-full" style={{ width: `${pctDe(x.acertos, x.feitas)}%`, background: COR_NIVEL[nivelDe(x.feitas, x.acertos)] }} /></div>
              </div>
            ))}
          </section>
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Últimos registros</h2>
            {d.ultimos.length === 0 && <p className={mudo}>Nenhum registro ainda.</p>}
            {d.ultimos.map((q) => (
              <div key={q.id} className="flex items-center gap-2 border-b py-1 text-sm last:border-b-0">
                <span className={mudo}>{fmtData(q.data)}</span>
                <span className="min-w-0 flex-1 truncate">{q.materia}{nomeAssunto(q.assuntoId) ? ` › ${nomeAssunto(q.assuntoId)}` : ''}</span>
                <b>{q.acertos}/{q.feitas}</b>
                <Button size="sm" variant="outline" title="Apagar este registro" aria-label="Apagar registro" onClick={() => void apagarRegistro(q.id)}>🗑</Button>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  )
}

async function renomear(id: string, atual: string) {
  const n = await pedirTexto('Renomear assunto', 'Nome', atual)
  if (!n) return
  const r = await renomearAssunto(db, id, n)
  if (r === 'duplicado') void avisar('Aviso', 'Já existe um assunto com esse nome nessa matéria.')
}
async function excluir(id: string, nome: string) {
  if (await confirmar(`Excluir o assunto "${nome}"? Os registros de questões e horas dele continuam, mas passam a contar como "sem assunto".`, 'Excluir', true)) await excluirAssunto(db, id)
}
async function apagarRegistro(id: string) {
  if (await confirmar('Apagar este registro de questões? Não dá para desfazer.', 'Apagar', true)) await excluirRegistroQuestoes(db, id)
}

function FormAssuntos({ materias }: { materias: string[] }) {
  async function adicionar(form: HTMLFormElement) {
    const dados = new FormData(form)
    const materia = String(dados.get('materia') ?? '')
    const nomes = String(dados.get('nomes') ?? '').split(/[,\n;]/).map((s) => s.trim()).filter(Boolean)
    if (!nomes.length) return void avisar('Aviso', 'Digite o nome de um ou mais assuntos (separados por vírgula).')
    useDesempenhoUi.getState().alternarAberta(materia, true)
    const novos = await adicionarAssuntos(db, materia, nomes)
    if (!novos) void avisar('Aviso', 'Esses assuntos já existem nessa matéria.')
    else form.reset()
  }
  return (
    <form
      className="mb-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void adicionar(e.currentTarget)
      }}
    >
      <Selecao name="materia" aria-label="Matéria" className="max-w-56">
        {materias.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </Selecao>
      <Entrada name="nomes" className="min-w-40 flex-1" placeholder="Assuntos (separe por vírgula)" />
      <Button type="submit" variant="outline">+ Adicionar</Button>
    </form>
  )
}

function VisaoSemanas({ ciclo }: { ciclo: Ciclo }) {
  const irParaAba = useUi((s) => s.irParaAba)
  const f = ciclo.fechadas
  const r = resumoDasSemanas(f)
  const ult = f.slice(-12)
  const W = 640
  const H = 200
  const pad = 28
  const bw = Math.min(40, (W - pad * 2) / Math.max(1, ult.length) - 8)
  const maxV = Math.max(1, ...ult.map((x) => Math.max(x.horasEstudadas, x.metaHoras)))
  const passo = (W - pad * 2) / Math.max(1, ult.length)

  async function repetir(id: string) {
    if (ciclo.config.mats.length && !(await confirmar('Carregar o ciclo dessa semana substitui a montagem atual. Continuar?', 'Carregar'))) return
    if (await repetirSemanaFechada(db, id)) irParaAba('montar')
  }
  function ver(x: (typeof f)[number]) {
    void abrirDialogo(`Semana ${fmtData(x.inicio)} → ${fmtData(x.fim)}`, (fechar) => (
      <>
        <ResumoDaSemana r={x} cores={ciclo.cores} />
        <div className="mt-4 flex justify-end"><Button onClick={() => fechar()}>Fechar</Button></div>
      </>
    ))
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-3 max-[700px]:grid-cols-2">
        <Kpi rotulo="Semanas fechadas" valor={String(r.total)} />
        <Kpi rotulo="Ciclos completos" valor={r.total ? `${r.fechadas} de ${r.total}` : '0'} />
        <Kpi rotulo="Horas nessas semanas" valor={fmtH(r.horas)} />
        <Kpi rotulo="Passos concluídos (média)" valor={r.total ? `${r.media}%` : '—'} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3 max-[1000px]:grid-cols-1">
        <section className={cn(card, 'flex min-h-0 flex-col')}>
          <h2 className="m-0 mb-2 text-sm font-bold">Semanas fechadas</h2>
          <div className="min-h-0 flex-1 overflow-auto">
            {f.length === 0 && <p className={mudo}>Nenhuma semana fechada ainda. Ao fechar uma semana, as estatísticas dela aparecem aqui.</p>}
            {[...f].reverse().map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-2 border-b py-2 last:border-b-0">
                <div className="min-w-44 flex-1">
                  <b className="text-sm">{fmtData(x.inicio)} → {fmtData(x.fim)}</b>
                  <div className={mudo}>
                    {fmtH(x.horasEstudadas)} de {fmtH(x.metaHoras)} · faltaram {fmtH(x.horasFaltando)} · {x.pctConcluido}% ({x.passosFeitos}/{x.passosTotal}){x.pomodoros ? ` · 🍅 ${x.pomodoros}` : ''}
                  </div>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[0.65rem] font-bold', x.cicloFechado ? 'bg-ok-bg text-ok' : 'bg-aviso-bg text-aviso')}>{x.cicloFechado ? 'Ciclo fechado' : 'Incompleto'}</span>
                {x.modelo && <Button size="sm" variant="outline" title="Carregar as matérias desta semana na aba Montar ciclo" onClick={() => void repetir(x.id)}>↻ Repetir ciclo</Button>}
                <Button size="sm" variant="outline" onClick={() => ver(x)}>Ver detalhes</Button>
                <Button size="sm" variant="destructive" onClick={async () => (await confirmar('Excluir esta semana do histórico? Não dá para desfazer.', 'Excluir', true)) && void excluirSemanaFechada(db, x.id)}>Excluir</Button>
              </div>
            ))}
          </div>
        </section>
        <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          <section className={card}>
            <h2 className="m-0 mb-2 text-sm font-bold">Horas por semana</h2>
            {f.length === 0 ? (
              <p className={mudo}>O gráfico aparece quando você fechar a primeira semana.</p>
            ) : (
              <>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Horas estudadas por semana">
                  {ult.map((x, i) => {
                    const bx = pad + i * passo + (passo - bw) / 2
                    const h = (x.horasEstudadas / maxV) * (H - pad * 2)
                    const y = H - pad - h
                    const ym = H - pad - (x.metaHoras / maxV) * (H - pad * 2)
                    return (
                      <g key={x.id}>
                        <rect x={bx} y={y} width={bw} height={Math.max(h, 0)} rx="4" fill={x.cicloFechado ? 'var(--ok)' : 'var(--primary)'}>
                          <title>{`${fmtData(x.inicio)}–${fmtData(x.fim)}: ${fmtH(x.horasEstudadas)} de ${fmtH(x.metaHoras)}`}</title>
                        </rect>
                        <line x1={bx - 4} x2={bx + bw + 4} y1={ym} y2={ym} stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="3 2" />
                        <text x={bx + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{fmtData(x.inicio)}</text>
                        <text x={bx + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="var(--foreground)">{Math.round(x.horasEstudadas * 100) / 100}</text>
                      </g>
                    )
                  })}
                  <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="var(--border)" />
                </svg>
                <p className={cn(mudo, 'm-0 mt-1')}>Barras verdes: ciclo fechado · da cor do destaque: incompleto · tracejado: meta da semana</p>
              </>
            )}
          </section>
          <section className={card}>
            <h2 className="m-0 mb-1 text-sm font-bold">Sobre estas horas</h2>
            <p className={cn(mudo, 'm-0')}>Nas semanas fechadas, as horas somam o que foi marcado nos passos (focos do Pomodoro e horas digitadas à mão). Na visão <b>Estudo</b>, as horas vêm só dos focos do Pomodoro.</p>
          </section>
        </div>
      </div>
    </>
  )
}
