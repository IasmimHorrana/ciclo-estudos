import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { avisar, confirmar, pedirTexto } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { renomearMateria } from '@/dados/materias'
import {
  adicionarMateriaEdital, carregarEdital, definirHorasDoTopico, enviarAoCiclo, incluirAssuntos, mudarAssunto, mudarComSubtopicos, mudarMateriaEdital, tirarAssuntoDoEdital, tirarMateriaDoEdital,
} from '@/dados/edital'
import { renomearAssunto } from '@/dados/desempenho'
import { useCiclo } from '@/dados/useCiclo'
import { corDe, fmtH, todasMaterias } from '@/dominio/ciclo'
import { materiasDoEdital, montarEdital, partirNome, type BlocoEdital, type LinhaEdital, type OrdemEdital } from '@/dominio/edital'
import { abrirDialogo } from '@/estado/dialogo'
import { useEditalUi } from '@/estado/edital'
import { useUi } from '@/estado/ui'
import { ImportarEdital } from '@/telas/edital/ImportarEdital'
import { cn } from '@/lib/utils'

const mudo = 'text-xs text-muted-foreground'
const COLUNAS = 11

export function Edital() {
  const ciclo = useCiclo()
  const dados = useLiveQuery(() => carregarEdital(db), [])
  const ui = useEditalUi()
  const irParaAba = useUi((s) => s.irParaAba)

  if (!ciclo || !dados) return <p className="text-sm text-muted-foreground">Carregando…</p>

  const materias = materiasDoEdital(dados.materias, dados.assuntos)
  const filtro = materias.some((m) => m.id === ui.filtroMateria) ? ui.filtroMateria : null
  const { blocos, total } = montarEdital({ ...dados, ordem: ui.ordem, ocultarEstudados: ui.ocultarEstudados, filtroMateria: filtro, recolhidos: new Set(ui.topicosRecolhidos) })
  // tópicos = assuntos do edital que têm subtópicos
  const idsDoEdital = new Set(dados.assuntos.filter((a) => a.noEdital).map((a) => a.id))
  const topicos = [...new Set(dados.assuntos.filter((a) => a.noEdital && a.paiId && idsDoEdital.has(a.paiId)).map((a) => a.paiId as string))]
  const tudoRecolhido = topicos.length > 0 && topicos.every((id) => ui.topicosRecolhidos.includes(id))
  const maxPrioridade = Math.max(1, ...blocos.flatMap((b) => b.linhas.filter((l) => !l.estudado).map((l) => l.prioridade)))
  const conhecidas = [...new Set([...todasMaterias(ciclo.config), ...dados.materias.map((m) => m.nome), ...dados.assuntos.map((a) => a.materia)])]

  async function importar() {
    const msg = await abrirDialogo<string>('Importar edital', (fechar) => <ImportarEdital conhecidas={conhecidas} fechar={(r) => fechar(r ?? null)} />)
    if (msg) void avisar('Edital importado', msg)
  }

  async function novaMateria() {
    const nome = await pedirTexto('Nova matéria', 'Nome da matéria', '', { ok: 'Adicionar' })
    if (!nome) return
    const r = await adicionarMateriaEdital(db, nome)
    if (r === 'duplicada') void avisar('Matéria', 'Essa matéria já está no edital.')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-xl font-bold">Edital verticalizado</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Selecao className="w-44" aria-label="Mostrar matéria" value={filtro ?? ''} onChange={(e) => ui.definir({ filtroMateria: e.target.value || null })}>
            <option value="">Todas as matérias</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </Selecao>
          <Selecao className="w-44" aria-label="Ordenar por" value={ui.ordem} onChange={(e) => ui.definir({ ordem: e.target.value as OrdemEdital })}>
            <option value="edital">Ordem do edital</option>
            <option value="prioridade">Maior prioridade</option>
            <option value="falta">Mais horas faltando</option>
          </Selecao>
          {topicos.length > 0 && (
            <Button variant="outline" size="sm" title="Fecha ou abre todos os tópicos (os subtópicos ficam escondidos quando fechados)" onClick={() => ui.definirTopicosRecolhidos(tudoRecolhido ? [] : topicos)}>
              {tudoRecolhido ? 'Abrir tópicos' : 'Recolher tópicos'}
            </Button>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={ui.ocultarEstudados} onChange={(e) => ui.definir({ ocultarEstudados: e.target.checked })} />
            Ocultar estudados
          </label>
          <Button variant="outline" size="sm" onClick={() => void novaMateria()}><Plus className="size-4" /> Matéria</Button>
          <Button size="sm" onClick={() => void importar()}>Importar edital</Button>
          <Button variant="outline" size="sm" onClick={() => irParaAba('montar')} title="Ajuste as repetições e gere o ciclo">Ir para Montar ciclo →</Button>
        </div>
      </div>

      {materias.length === 0 ? (
        <div className="m-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Seu edital ainda está vazio</h2>
          <p className="mb-4 text-sm text-muted-foreground">Cole o conteúdo programático do edital: o app separa as matérias e os assuntos, e você confere antes de salvar. Os assuntos que você já criou em Desempenho não aparecem aqui; se o nome for igual ao do edital, eles são ligados a ele.</p>
          <Button onClick={() => void importar()}>Importar edital</Button>
        </div>
      ) : (
        <>
          <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            Prioridade:
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-5 rounded-full bg-ok" /> baixa</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-5 rounded-full bg-aviso" /> média</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-5 rounded-full bg-erro" /> alta</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2 w-5 rounded-full bg-muted" /> cinza: defina a importância ou as horas ideais</span>
            <span>· a barra é relativa: a mais cheia é o assunto mais urgente da lista</span>
          </p>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card text-[0.68rem] text-muted-foreground uppercase shadow-[0_1px_0_var(--border)]">
                <tr>
                  <th className="w-9 px-2 py-2" aria-label="Estudado" />
                  <th className="px-2 py-2 text-left font-bold">Assunto</th>
                  <th className="w-14 px-1 py-2 text-center font-bold text-ok" title="Questões certas">Certas</th>
                  <th className="w-14 px-1 py-2 text-center font-bold text-erro" title="Questões erradas">Erradas</th>
                  <th className="w-14 px-1 py-2 text-center font-bold">Total</th>
                  <th className="w-12 px-1 py-2 text-center font-bold" title="Percentual de acerto">%</th>
                  <th className="w-16 px-1 py-2 text-center font-bold" title="Importância do assunto para você (1 a 5)">Import.</th>
                  <th className="w-20 px-1 py-2 text-center font-bold" title="Horas que você quer dedicar a este assunto">H. ideais</th>
                  <th className="w-16 px-1 py-2 text-center font-bold" title="Horas estudadas (Pomodoro e tempo registrado)">Feito</th>
                  <th className="w-28 px-1 py-2 text-left font-bold" title="Quanto mais cheia a barra, mais cedo estudar">Prioridade</th>
                  <th className="w-28 px-2 py-2 text-right font-bold">Ciclo</th>
                </tr>
              </thead>
              <tbody>
                {blocos.map((b) => (
                  <BlocoMateria key={b.materia.id} b={b} maxPrioridade={maxPrioridade} recolhida={ui.recolhidas.includes(b.materia.id)} />
                ))}
                {blocos.length === 0 && (
                  <tr><td colSpan={COLUNAS} className="p-6 text-center text-muted-foreground">Nenhuma matéria para mostrar.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border bg-card px-4 py-2.5 shadow-sm">
            <span className="flex items-center gap-2 text-sm font-bold">
              TOTAL
              <span className="flex items-center divide-x overflow-hidden rounded-full border-2 border-ok/60 text-sm font-semibold">
                <span className="px-3 py-0.5 text-ok" title="Certas">{total.certas}</span>
                <span className="px-3 py-0.5 text-erro" title="Erradas">{total.erradas}</span>
                <span className="px-3 py-0.5" title="Questões">{total.questoes}</span>
                <span className="bg-ok-bg px-3 py-0.5" title="Assuntos">{total.resumo.assuntos}</span>
              </span>
            </span>
            <span className="flex min-w-60 flex-1 items-center gap-2 text-sm font-bold">
              PROGRESSO
              <span className="h-3 min-w-24 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={total.resumo.pctEstudados} aria-valuemin={0} aria-valuemax={100}>
                <i className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${total.resumo.pctEstudados}%` }} />
              </span>
              <span className="w-10 text-right tabular-nums">{total.resumo.pctEstudados}%</span>
            </span>
            <span className={mudo}>
              {total.resumo.estudados}/{total.resumo.assuntos} assuntos estudados
              {total.resumo.horasIdeais > 0 && <> · {fmtH(total.resumo.horasFeitas)} de {fmtH(total.resumo.horasIdeais)} ideais ({total.resumo.pctHoras}%)</>}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function BlocoMateria({ b, maxPrioridade, recolhida }: { b: BlocoEdital; maxPrioridade: number; recolhida: boolean }) {
  const ciclo = useCiclo()
  const alternar = useEditalUi((s) => s.alternarRecolhida)
  const cor = corDe(ciclo?.cores ?? {}, b.materia.nome)
  const mat = ciclo?.config.mats.find((m) => m.nome === b.materia.nome)
  const Seta = recolhida ? ChevronRight : ChevronDown

  async function adicionarAssuntos() {
    const t = await pedirTexto(`Novos assuntos — ${b.materia.nome}`, 'Assuntos (separe por ; ou por linha)', '', { ok: 'Adicionar', placeholder: 'Ex.: Posse; Propriedade; Usucapião' })
    const nomes = (t ?? '').split(/[;\n]/).map((x) => x.trim()).filter(Boolean)
    if (nomes.length) await incluirAssuntos(db, b.materia.nome, nomes)
  }

  async function paraOCiclo() {
    const top = b.linhas.filter((l) => l.nivel === 0 && !l.estudado && !l.noCiclo).sort((x, y) => y.prioridade - x.prioridade).slice(0, 3)
    await enviarAoCiclo(db, { materia: b.materia.nome, pesoMateria: b.materia.peso, horasQueFaltam: b.faltam, assuntoIds: top.map((l) => l.id) })
  }

  async function renomearMat() {
    const n = await pedirTexto('Renomear matéria', 'Nome', b.materia.nome)
    if (!n) return
    const r = await renomearMateria(db, b.materia.nome, n)
    if (r === 'duplicada') void avisar('Renomear matéria', 'Já existe outra matéria com esse nome.')
    if (r === 'vazia') void avisar('Renomear matéria', 'O nome não pode ficar vazio.')
  }

  async function excluir() {
    if (await confirmar(`Tirar "${b.materia.nome}" do edital? Os assuntos continuam no app (Desempenho, Pomodoro e flashcards), com as questões e os tempos; só saem desta tela.`, 'Tirar do edital', true)) {
      await tirarMateriaDoEdital(db, b.materia.id)
    }
  }

  return (
    <>
      <tr className="border-t bg-muted/50">
        <td colSpan={COLUNAS} className="px-2 py-1.5" style={{ boxShadow: `inset 4px 0 0 ${cor}` }}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-1.5">
            <button className="flex cursor-pointer items-center gap-1.5 font-bold" onClick={() => alternar(b.materia.id)} aria-expanded={!recolhida}>
              <Seta className="size-4" />
              {b.materia.nome}
            </button>
            <Button size="icon" variant="ghost" className="-ml-2 size-6" title="Renomear matéria" aria-label={`Renomear ${b.materia.nome}`} onClick={() => void renomearMat()}>
              <Pencil className="size-3.5" />
            </Button>
            <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Peso da matéria na prova (1 a 5)">
              Peso
              <Selecao className="w-14 py-0.5" value={b.materia.peso} onChange={(e) => void mudarMateriaEdital(db, b.materia.id, { peso: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((p) => <option key={p}>{p}</option>)}
              </Selecao>
            </label>
            <span className={mudo}>
              {b.resumo.estudados}/{b.resumo.assuntos} estudados ({b.resumo.pctEstudados}%)
              {b.resumo.horasIdeais > 0 && <> · {fmtH(b.resumo.horasFeitas)}/{fmtH(b.resumo.horasIdeais)}</>}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {mat && <span className="rounded-full bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok" title="Já está na montagem do ciclo">no ciclo · {mat.rep} passo(s)</span>}
              <Button size="sm" variant="outline" onClick={() => void adicionarAssuntos()}><Plus className="size-4" /> Assunto</Button>
              <Button size="sm" variant="outline" title="Põe a matéria no ciclo e leva os 3 assuntos de maior prioridade para a anotação dos passos" onClick={() => void paraOCiclo()}>＋ Ciclo</Button>
              <Button size="icon" variant="ghost" title="Tirar matéria do edital (não apaga nada)" aria-label={`Tirar ${b.materia.nome} do edital`} onClick={() => void excluir()}>
                <Trash2 className="size-4" />
              </Button>
            </span>
          </div>
        </td>
      </tr>
      {!recolhida && b.linhas.map((l) => <LinhaAssunto key={l.id} l={l} b={b} maxPrioridade={maxPrioridade} />)}
      {!recolhida && b.linhas.length === 0 && (
        <tr><td colSpan={COLUNAS} className="px-4 py-2 text-xs text-muted-foreground">{b.resumo.assuntos ? 'Todos os assuntos estão estudados (ocultos).' : 'Sem assuntos ainda. Use "＋ Assunto".'}</td></tr>
      )}
    </>
  )
}

/** Nome da linha: num tópico, o título em negrito e a descrição em cinza; duplo clique (ou o lápis) para renomear. */
function NomeDaLinha({ l }: { l: LinhaEdital }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(l.nome)
  const { titulo, resto } = l.temFilhos ? partirNome(l.nome) : { titulo: l.nome, resto: '' }

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
        className="py-1 text-sm font-normal"
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
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span
        className="cursor-text"
        title={`${l.nome}\n(clique duas vezes para renomear)`}
        onDoubleClick={() => {
          setTexto(l.nome)
          setEditando(true)
        }}
      >
        {titulo}
        {resto && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{resto}</span>}
      </span>
      <button
        className="cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Renomear ${l.nome}`}
        title="Renomear"
        onClick={() => {
          setTexto(l.nome)
          setEditando(true)
        }}
      >
        <Pencil className="size-3.5" />
      </button>
    </span>
  )
}

function LinhaAssunto({ l, b, maxPrioridade }: { l: LinhaEdital; b: BlocoEdital; maxPrioridade: number }) {
  const recolhido = useEditalUi((s) => s.topicosRecolhidos.includes(l.id))
  const alternarTopico = useEditalUi((s) => s.alternarTopico)
  const pct = l.estudado ? 0 : Math.round((l.prioridade / maxPrioridade) * 100)
  const nivel = pct >= 66 ? 'bg-erro' : pct >= 33 ? 'bg-aviso' : 'bg-ok'
  const num = (n: number, cor: string) => <span className={n ? cor : 'text-muted-foreground/50'}>{n}</span>
  const Seta = recolhido ? ChevronRight : ChevronDown

  return (
    <tr className={cn('group border-t hover:bg-accent/40', l.temFilhos && 'bg-muted/30 font-semibold', l.estudado && 'text-muted-foreground')}>
      <td className="px-2 text-center">
        <input
          type="checkbox"
          className="size-4 cursor-pointer accent-[var(--primary)]"
          checked={l.estudado}
          aria-label={`Estudado: ${l.nome}`}
          title={l.temFilhos ? 'Marca ou desmarca o tópico e todos os subtópicos' : undefined}
          onChange={(e) => void mudarComSubtopicos(db, l.id, { estudado: e.target.checked })}
        />
      </td>
      <td className={cn('py-1.5 pr-2', l.estudado && 'line-through')} style={{ paddingLeft: `${0.5 + l.nivel * 1.5}rem` }}>
        <span className="flex items-center gap-1">
          {l.temFilhos ? (
            <button
              className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent"
              onClick={() => alternarTopico(l.id)}
              aria-expanded={!recolhido}
              aria-label={recolhido ? `Abrir ${l.nome}` : `Recolher ${l.nome}`}
              title={recolhido ? 'Mostrar os subtópicos' : 'Esconder os subtópicos'}
            >
              <Seta className="size-4" />
            </button>
          ) : (
            l.nivel > 0 && <span className="inline-block size-5 shrink-0" />
          )}
          <NomeDaLinha l={l} />
          {l.temFilhos && <span className="ml-1 shrink-0 text-xs font-normal text-muted-foreground no-underline">{l.folhasEstudadas}/{l.folhas}</span>}
        </span>
      </td>
      <td className="px-1 text-center font-semibold tabular-nums">{num(l.certas, 'text-ok')}</td>
      <td className="px-1 text-center font-semibold tabular-nums">{num(l.erradas, 'text-erro')}</td>
      <td className="px-1 text-center font-semibold tabular-nums">{l.total}</td>
      <td className="px-1 text-center tabular-nums">{l.pctAcerto === null ? '—' : `${l.pctAcerto}%`}</td>
      <td className="px-1 text-center">
        <Selecao
          className="w-14 px-1 py-0.5"
          value={l.importancia ?? ''}
          aria-label={`Importância de ${l.nome}`}
          title={l.temFilhos ? 'Vale para o tópico e todos os subtópicos' : undefined}
          onChange={(e) => e.target.value !== '' && void mudarComSubtopicos(db, l.id, { importancia: Number(e.target.value) })}
        >
          {l.importancia === null && <option value="">vários</option>}
          <option value={0}>—</option>
          {[1, 2, 3, 4, 5].map((p) => <option key={p}>{p}</option>)}
        </Selecao>
      </td>
      <td className="px-1 text-center">
        <CampoNumero
          key={`hi${l.horasIdeais}`}
          className="w-14 px-1 py-0.5 text-center"
          valor={l.horasIdeais}
          aria-label={`Horas ideais de ${l.nome}`}
          title={l.temFilhos ? 'Total de horas do tópico: é dividido em partes iguais entre os subtópicos (depois você ajusta um a um)' : undefined}
          aoConfirmar={(n) => void (l.temFilhos ? definirHorasDoTopico(db, l.id, n !== null && n >= 0 ? n : 0) : mudarAssunto(db, l.id, { horasIdeais: n !== null && n >= 0 ? n : 0 }))}
        />
      </td>
      <td className="px-1 text-center tabular-nums" title={l.falta ? `Faltam ${fmtH(l.falta)}` : undefined}>{l.horasFeitas ? fmtH(l.horasFeitas) : '—'}</td>
      <td className="px-1">
        {l.estudado ? (
          <span className={mudo}>estudado</span>
        ) : l.semDados ? (
          <span className="block h-2.5 rounded-full bg-muted" title="Defina a importância ou as horas ideais para a prioridade aparecer" />
        ) : (
          <span className="block h-2.5 overflow-hidden rounded-full bg-muted" title={`Prioridade ${l.prioridade}`}>
            <i className={cn('block h-full rounded-full', nivel)} style={{ width: `${Math.max(4, pct)}%` }} />
          </span>
        )}
      </td>
      <td className="px-2 text-right whitespace-nowrap">
        {l.noCiclo ? (
          <button
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok"
            title="Vai para a anotação do próximo ciclo gerado. Clique para tirar."
            onClick={() => void mudarAssunto(db, l.id, { noCiclo: false })}
          >
            no ciclo <X className="size-3" />
          </button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={l.estudado}
            title="Põe este assunto (e a matéria) no próximo ciclo"
            onClick={() => void enviarAoCiclo(db, { materia: b.materia.nome, pesoMateria: b.materia.peso, horasQueFaltam: l.falta, assuntoIds: [l.id] })}
          >
            ＋ Ciclo
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          title="Tirar do edital (continua no Desempenho)"
          aria-label={`Tirar ${l.nome} do edital`}
          onClick={async () => (await confirmar(`Tirar "${l.nome}" do edital${l.temFilhos ? `, com os ${l.folhas} subtópico(s)` : ''}? ${l.temFilhos ? 'Eles continuam' : 'Ele continua'} no Desempenho, no Pomodoro e nos flashcards, com as questões e os tempos.`, 'Tirar do edital', true)) && void tirarAssuntoDoEdital(db, l.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </td>
    </tr>
  )
}
