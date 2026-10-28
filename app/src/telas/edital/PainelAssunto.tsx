import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Check, ClipboardList, FolderPlus, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { abrirQuestoes } from '@/componentes/abrirQuestoes'
import { CampoNumero } from '@/componentes/CampoNumero'
import { SeloAcerto } from '@/componentes/nivel'
import { avisar, confirmar, pedirTexto } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { renomearAssunto } from '@/dados/desempenho'
import { agruparEmNovoTopico, definirHorasDoTopico, enviarAoCiclo, moverAssunto, mudarAssunto, mudarComSubtopicos, responderRevisaoAssunto, tirarAssuntoDoEdital } from '@/dados/edital'
import { fmtH } from '@/dominio/ciclo'
import { fmtData } from '@/dominio/datas'
import { proximaRevisao } from '@/dominio/revisaoAssuntos'
import type { BlocoEdital, LinhaEdital, ResumoEdital } from '@/dominio/edital'
import { COR_PRIORIDADE, NOME_PRIORIDADE, nivelPrioridade } from '@/telas/edital/prioridade'
import { cn } from '@/lib/utils'

const rotulo = 'text-[0.68rem] font-bold uppercase text-muted-foreground'

function Numero({ titulo, valor, cor }: { titulo: string; valor: ReactNode; cor?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-1.5 text-center">
      <div className={cn('text-base font-bold tabular-nums', cor)}>{valor}</div>
      <div className="text-[0.65rem] text-muted-foreground">{titulo}</div>
    </div>
  )
}

/** Nome do assunto com renomear (lápis ou duplo clique). */
function Titulo({ l }: { l: LinhaEdital }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(l.nome)

  async function salvar() {
    setEditando(false)
    if (texto.trim() === l.nome) return
    const r = await renomearAssunto(db, l.id, texto)
    if (r === 'duplicado') void avisar('Renomear', 'Já existe outro assunto com esse nome nesta matéria.')
    if (r === 'vazio') void avisar('Renomear', 'O nome não pode ficar vazio.')
  }

  if (editando) {
    return (
      <Entrada
        autoFocus
        className="text-sm"
        value={texto}
        aria-label={`Novo nome de ${l.nome}`}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => void salvar()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void salvar()
          if (e.key === 'Escape') {
            setTexto(l.nome)
            setEditando(false)
          }
        }}
      />
    )
  }
  const editar = () => {
    setTexto(l.nome)
    setEditando(true)
  }
  return (
    <h2 className="m-0 flex items-start gap-1.5 text-base leading-snug font-bold">
      <span className="cursor-text" onDoubleClick={editar}>{l.nome}</span>
      <button className="mt-0.5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" aria-label={`Renomear ${l.nome}`} title="Renomear" onClick={editar}>
        <Pencil className="size-3.5" />
      </button>
    </h2>
  )
}

const ESTADO: Record<LinhaEdital['revisao'], { texto: string; cor: string }> = {
  nenhuma: { texto: '', cor: '' },
  futura: { texto: 'agendada', cor: 'text-muted-foreground' },
  hoje: { texto: 'para hoje', cor: 'text-aviso' },
  atrasada: { texto: 'atrasada', cor: 'text-erro' },
  concluida: { texto: 'todas feitas', cor: 'text-ok' },
}

/** Revisões do assunto: a lista e, quando vence, "Entendi" / "Preciso rever". Num tópico, só o resumo. */
function Revisoes({ l, intervalos }: { l: LinhaEdital; intervalos: readonly number[] }) {
  const devida = l.revisao === 'hoje' || l.revisao === 'atrasada'
  const prox = proximaRevisao(l.revisoes)
  const cabecalho = (
    <div className="flex items-center justify-between">
      <span className={rotulo}>Revisões</span>
      {l.revisao !== 'nenhuma' && <span className={cn('text-xs font-semibold', ESTADO[l.revisao].cor)}>{ESTADO[l.revisao].texto}</span>}
    </div>
  )
  if (l.temFilhos) {
    return (
      <section className="flex flex-col gap-1.5">
        {cabecalho}
        <p className="m-0 text-xs text-muted-foreground">
          {l.proximaRevisao ? `Próxima revisão de um subtópico: ${fmtData(l.proximaRevisao)}. ` : ''}
          As revisões são de cada subtópico: abra o subtópico para responder.
        </p>
      </section>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      {cabecalho}
      {l.revisoes.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">
          {l.estudado ? 'Sem revisões agendadas (marcado antes desta função). Desmarque e marque de novo para agendar.' : `Ao marcar como estudado, o app agenda revisões ${intervalos.join(', ')} dias depois.`}
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {l.revisoes.map((r, i) => (
            <li
              key={`${r.dia}${i}`}
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs tabular-nums',
                r.feitaEm ? (r.resultado === 'rever' ? 'border-aviso/40 text-aviso' : 'border-ok/40 text-ok') : r === prox && devida ? 'border-erro/40 font-semibold text-erro' : 'text-muted-foreground',
              )}
              title={r.feitaEm ? `Feita em ${fmtData(r.feitaEm)}${r.resultado === 'rever' ? ' (precisou rever)' : ''}` : `Para ${fmtData(r.dia)}`}
            >
              {r.feitaEm && (r.resultado === 'rever' ? '↺ ' : '✓ ')}
              {fmtData(r.dia)}
            </li>
          ))}
        </ol>
      )}
      {devida && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void responderRevisaoAssunto(db, l.id, 'ok')} title="Conclui esta revisão; a próxima continua agendada">
            <Check className="size-3.5" /> Entendi
          </Button>
          <Button size="sm" variant="outline" onClick={() => void responderRevisaoAssunto(db, l.id, 'rever')} title={`Conclui esta revisão e recomeça as revisões a partir de hoje (${intervalos.join(', ')} dias)`}>
            <RotateCcw className="size-3.5" /> Preciso rever
          </Button>
        </div>
      )}
      {!devida && prox && <p className="m-0 text-xs text-muted-foreground">Próxima em {fmtData(prox.dia)}. Os botões aparecem no dia.</p>}
    </section>
  )
}

/** Organizar: em qual tópico o assunto fica, a ordem entre os irmãos e "pôr dentro de um tópico novo". Alternativa ao arrastar. */
function Organizar({ l, b }: { l: LinhaEdital; b: BlocoEdital }) {
  // `b.linhas` vem na ordem do edital, com tudo aberto
  const abaixo = new Set<string>()
  for (const x of b.linhas) if (x.id === l.id || (x.paiId && abaixo.has(x.paiId))) abaixo.add(x.id)
  const destinos = b.linhas.filter((x) => !abaixo.has(x.id))
  const irmaos = b.linhas.filter((x) => x.paiId === l.paiId)
  const i = irmaos.findIndex((x) => x.id === l.id)
  const anterior = irmaos[i - 1]
  const seguinte = irmaos[i + 1]

  async function novoTopico() {
    const nome = await pedirTexto('Pôr dentro de um tópico novo', 'Nome do tópico', '', {
      ok: 'Criar',
      placeholder: 'Ex.: Malware',
      ajuda: `O tópico novo fica no lugar de "${l.nome}", e ele vira o primeiro subtópico. Depois arraste os outros para dentro (ou escolha o tópico em "Dentro de").`,
    })
    if (!nome) return
    const r = await agruparEmNovoTopico(db, l.id, nome)
    if (r === 'duplicado') void avisar('Tópico novo', 'Já existe um assunto com esse nome nesta matéria. Escolha-o em "Dentro de" ou arraste para cima dele.')
  }

  return (
    <section className="flex flex-col gap-2">
      <span className={rotulo}>Organizar</span>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Dentro de</span>
        <Selecao
          value={l.paiId ?? ''}
          aria-label={`Tópico de ${l.nome}`}
          onChange={(e) => void moverAssunto(db, l.id, e.target.value || null, 'dentro')}
        >
          <option value="">(nenhum: assunto solto)</option>
          {destinos.map((x) => (
            <option key={x.id} value={x.id}>{'\u00a0\u00a0'.repeat(x.nivel)}{x.nome}</option>
          ))}
        </Selecao>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!anterior} title="Troca de lugar com o de cima (no mesmo nível)" onClick={() => anterior && void moverAssunto(db, l.id, anterior.id, 'antes')}>
          <ArrowUp className="size-3.5" /> Subir
        </Button>
        <Button size="sm" variant="outline" disabled={!seguinte} title="Troca de lugar com o de baixo (no mesmo nível)" onClick={() => seguinte && void moverAssunto(db, l.id, seguinte.id, 'depois')}>
          <ArrowDown className="size-3.5" /> Descer
        </Button>
        <Button size="sm" variant="outline" onClick={() => void novoTopico()}>
          <FolderPlus className="size-3.5" /> Tópico novo
        </Button>
      </div>
      <p className="m-0 text-xs text-muted-foreground">Na lista, você também pode arrastar: no meio de outra linha vira subtópico dela; na borda de cima ou de baixo muda a ordem; no nome da matéria vira assunto solto.</p>
    </section>
  )
}

export function PainelAssunto({ l, b, maxPrioridade, fechar, intervalos }: {
  l: LinhaEdital; b: BlocoEdital; maxPrioridade: number; fechar: () => void; intervalos: readonly number[]
}) {
  const prio = nivelPrioridade(l, maxPrioridade)
  const pct = l.estudado ? 0 : Math.round((l.prioridade / Math.max(1, maxPrioridade)) * 100)

  async function tirar() {
    const ok = await confirmar(
      `Tirar "${l.nome}" do edital${l.temFilhos ? `, com os ${l.folhas} subtópico(s)` : ''}? ${l.temFilhos ? 'Eles continuam' : 'Ele continua'} no Desempenho, no Pomodoro e nos flashcards, com as questões e os tempos.`,
      'Tirar do edital',
      true,
    )
    if (!ok) return
    fechar()
    await tirarAssuntoDoEdital(db, l.id)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs font-semibold text-muted-foreground">{b.materia.nome}</div>
          <Titulo key={l.id} l={l} />
          {l.temFilhos && <p className="m-0 mt-1 text-xs text-muted-foreground">Tópico com {l.folhas} subtópico(s): os números somam todos eles.</p>}
        </div>
        <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label="Fechar detalhes" title="Fechar (Esc)" onClick={fechar}>
          <X className="size-4" />
        </Button>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={l.estudado} onChange={(e) => void mudarComSubtopicos(db, l.id, { estudado: e.target.checked })} />
        {l.temFilhos ? `Estudado (${l.folhasEstudadas}/${l.folhas})` : 'Estudado'}
      </label>

      <Revisoes l={l} intervalos={intervalos} />

      <Organizar l={l} b={b} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={rotulo}>Questões</span>
          <SeloAcerto feitas={l.total} acertos={l.certas} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Numero titulo="certas" valor={l.certas} cor="text-ok" />
          <Numero titulo="erradas" valor={l.erradas} cor="text-erro" />
          <Numero titulo="total" valor={l.total} />
        </div>
        {l.total === 0 && <p className="m-0 text-xs text-muted-foreground">Nenhuma questão registrada ainda.</p>}
        <Button size="sm" variant="outline" className="self-start" onClick={() => void abrirQuestoes({ materia: b.materia.nome, assuntoId: l.id })}>
          <ClipboardList className="size-3.5" /> Registrar questões
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <span className={rotulo}>Planejamento</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground" title="Importância do assunto para você (1 a 5)">Importância</span>
            <Selecao
              value={l.importancia ?? ''}
              aria-label={`Importância de ${l.nome}`}
              title={l.temFilhos ? 'Vale para o tópico e todos os subtópicos' : undefined}
              onChange={(e) => e.target.value !== '' && void mudarComSubtopicos(db, l.id, { importancia: Number(e.target.value) })}
            >
              {l.importancia === null && <option value="">vários</option>}
              <option value={0}>não definida</option>
              {[1, 2, 3, 4, 5].map((p) => <option key={p}>{p}</option>)}
            </Selecao>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground" title={l.temFilhos ? 'Total do tópico: é dividido em partes iguais entre os subtópicos' : 'Horas que você quer dedicar a este assunto'}>Horas ideais</span>
            <CampoNumero
              key={`hi${l.id}${l.horasIdeais}`}
              valor={l.horasIdeais}
              aria-label={`Horas ideais de ${l.nome}`}
              aoConfirmar={(n) => void (l.temFilhos ? definirHorasDoTopico(db, l.id, n !== null && n >= 0 ? n : 0) : mudarAssunto(db, l.id, { horasIdeais: n !== null && n >= 0 ? n : 0 }))}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Numero titulo="estudadas" valor={l.horasFeitas ? fmtH(l.horasFeitas) : '—'} />
          <Numero titulo="faltam" valor={l.horasIdeais > 0 ? fmtH(l.falta) : '—'} />
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className={rotulo}>Prioridade</span>
          <span className="text-xs font-semibold">{l.estudado ? 'estudado' : prio ? NOME_PRIORIDADE[prio] : 'sem dados'}</span>
        </div>
        <span className="block h-2 overflow-hidden rounded-full bg-muted">
          {prio && <i className={cn('block h-full rounded-full', COR_PRIORIDADE[prio])} style={{ width: `${Math.max(4, pct)}%` }} />}
        </span>
        <p className="m-0 text-xs text-muted-foreground">
          {l.semDados && !l.estudado
            ? 'Defina a importância ou as horas ideais (ou faça algumas questões) para a prioridade aparecer.'
            : 'Peso da matéria × importância, maior quando faltam horas e quando o acerto está baixo. A barra é relativa ao assunto mais urgente.'}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {l.noCiclo ? (
          <Button size="sm" variant="outline" title="Vai para a anotação do próximo ciclo gerado" onClick={() => void mudarAssunto(db, l.id, { noCiclo: false })}>
            <X className="size-3.5" /> Tirar do próximo ciclo
          </Button>
        ) : (
          <Button size="sm" disabled={l.estudado} title="Põe este assunto (e a matéria) no próximo ciclo" onClick={() => void enviarAoCiclo(db, { materia: b.materia.nome, pesoMateria: b.materia.peso, horasQueFaltam: l.falta, assuntoIds: [l.id] })}>
            <Plus className="size-3.5" /> Pôr no ciclo
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={() => void tirar()}>
          <Trash2 className="size-3.5" /> Tirar do edital
        </Button>
      </div>
    </div>
  )
}

/** Painel sem assunto aberto: progresso geral e totais de questões. */
export function ResumoGeral({ resumo, certas, erradas, children }: { resumo: ResumoEdital; certas: number; erradas: number; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="flex flex-col gap-2">
        <span className={rotulo}>Progresso do edital</span>
        <div className="flex items-center gap-2">
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progresso do edital" aria-valuenow={resumo.pctEstudados} aria-valuemin={0} aria-valuemax={100}>
            <i className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${resumo.pctEstudados}%` }} />
          </span>
          <span className="w-10 text-right text-sm font-bold tabular-nums">{resumo.pctEstudados}%</span>
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          {resumo.estudados} de {resumo.assuntos} assuntos estudados
          {resumo.horasIdeais > 0 && <> · {fmtH(resumo.horasFeitas)} de {fmtH(resumo.horasIdeais)} ideais ({resumo.pctHoras}%)</>}
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={rotulo}>Questões</span>
          <SeloAcerto feitas={certas + erradas} acertos={certas} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Numero titulo="certas" valor={certas} cor="text-ok" />
          <Numero titulo="erradas" valor={erradas} cor="text-erro" />
          <Numero titulo="total" valor={certas + erradas} />
        </div>
      </section>
      {children}
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        Prioridade:
        {(['alta', 'media', 'baixa'] as const).map((p) => (
          <span key={p} className="flex items-center gap-1"><i className={cn('inline-block size-2.5 rounded-full', COR_PRIORIDADE[p])} /> {NOME_PRIORIDADE[p]}</span>
        ))}
      </p>
      <p className="m-0 text-xs text-muted-foreground">Clique num assunto para ver e ajustar os detalhes.</p>
    </div>
  )
}
