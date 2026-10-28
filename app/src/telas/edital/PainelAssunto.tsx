import { useState, type ReactNode } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { SeloAcerto } from '@/componentes/nivel'
import { avisar, confirmar } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { renomearAssunto } from '@/dados/desempenho'
import { definirHorasDoTopico, enviarAoCiclo, mudarAssunto, mudarComSubtopicos, tirarAssuntoDoEdital } from '@/dados/edital'
import { fmtH } from '@/dominio/ciclo'
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

export function PainelAssunto({ l, b, maxPrioridade, fechar }: { l: LinhaEdital; b: BlocoEdital; maxPrioridade: number; fechar: () => void }) {
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
        {l.total === 0 && <p className="m-0 text-xs text-muted-foreground">Nenhuma questão registrada ainda (lance em Desempenho ou ao fim do Pomodoro).</p>}
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
