import { ChevronDown, ChevronRight, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Menu } from '@/componentes/Menu'
import { SeloAcerto } from '@/componentes/nivel'
import { avisar, confirmar, pedirTexto } from '@/componentes/dialogos-api'
import { Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { enviarAoCiclo, incluirAssuntos, mudarComSubtopicos, mudarMateriaEdital, tirarMateriaDoEdital } from '@/dados/edital'
import { renomearMateria } from '@/dados/materias'
import { useCiclo } from '@/dados/useCiclo'
import { corDe, fmtH } from '@/dominio/ciclo'
import { partirNome, type BlocoEdital, type LinhaEdital } from '@/dominio/edital'
import { COR_PRIORIDADE, NOME_PRIORIDADE, nivelPrioridade } from '@/telas/edital/prioridade'
import { useEditalUi } from '@/estado/edital'
import { cn } from '@/lib/utils'

export function CartaoMateria({ b, maxPrioridade, recolhida }: { b: BlocoEdital; maxPrioridade: number; recolhida: boolean }) {
  const ciclo = useCiclo()
  const alternar = useEditalUi((s) => s.alternarRecolhida)
  const cor = corDe(ciclo?.cores ?? {}, b.materia.nome)
  const mat = ciclo?.config.mats.find((m) => m.nome === b.materia.nome)
  const Seta = recolhida ? ChevronRight : ChevronDown
  const feitas = b.totais.certas + b.totais.erradas

  async function adicionarAssuntos() {
    const t = await pedirTexto(`Novos assuntos — ${b.materia.nome}`, 'Assuntos (separe por ; ou por linha)', '', { ok: 'Adicionar', placeholder: 'Ex.: Posse; Propriedade; Usucapião' })
    const nomes = (t ?? '').split(/[;\n]/).map((x) => x.trim()).filter(Boolean)
    if (nomes.length) await incluirAssuntos(db, b.materia.nome, nomes)
  }

  async function paraOCiclo() {
    const top = b.linhas.filter((l) => l.nivel === 0 && !l.estudado && !l.noCiclo).sort((x, y) => y.prioridade - x.prioridade).slice(0, 3)
    await enviarAoCiclo(db, { materia: b.materia.nome, pesoMateria: b.materia.peso, horasQueFaltam: b.faltam, assuntoIds: top.map((l) => l.id) })
  }

  async function renomear() {
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
    <section className="rounded-xl border bg-card shadow-sm" style={{ boxShadow: `inset 4px 0 0 ${cor}` }}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-2 pl-4">
        <button className="flex min-w-0 cursor-pointer items-center gap-1.5 font-bold" onClick={() => alternar(b.materia.id)} aria-expanded={!recolhida}>
          <Seta className="size-4 shrink-0" />
          <span className="truncate">{b.materia.nome}</span>
        </button>
        <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Peso da matéria na prova (1 a 5)">
          peso
          <Selecao className="w-12 px-1 py-0.5 text-xs" value={b.materia.peso} onChange={(e) => void mudarMateriaEdital(db, b.materia.id, { peso: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((p) => <option key={p}>{p}</option>)}
          </Selecao>
        </label>
        <span className="ml-auto flex items-center gap-2">
          {mat && <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[0.68rem] font-semibold text-ok" title="Já está na montagem do ciclo">no ciclo · {mat.rep}</span>}
          <SeloAcerto feitas={feitas} acertos={b.totais.certas} />
          <span className="flex w-36 items-center gap-2" title={b.resumo.horasIdeais > 0 ? `${fmtH(b.resumo.horasFeitas)} de ${fmtH(b.resumo.horasIdeais)} ideais` : undefined}>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Progresso de ${b.materia.nome}`} aria-valuenow={b.resumo.pctEstudados} aria-valuemin={0} aria-valuemax={100}>
              <i className="block h-full rounded-full bg-primary" style={{ width: `${b.resumo.pctEstudados}%` }} />
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{b.resumo.estudados}/{b.resumo.assuntos}</span>
          </span>
          <Menu
            rotulo={`Ações de ${b.materia.nome}`}
            itens={[
              { rotulo: 'Novos assuntos', icone: <Plus className="size-4" />, acao: () => void adicionarAssuntos() },
              { rotulo: 'Pôr no ciclo (3 mais urgentes)', icone: <Plus className="size-4" />, acao: () => void paraOCiclo() },
              { rotulo: 'Renomear matéria', icone: <Pencil className="size-4" />, acao: () => void renomear() },
              { rotulo: 'Tirar do edital', icone: <Trash2 className="size-4" />, acao: () => void excluir(), perigo: true },
            ]}
          />
        </span>
      </header>
      {!recolhida && (
        <ul className="m-0 list-none p-0 pb-1">
          {b.linhas.map((l) => <LinhaAssunto key={l.id} l={l} maxPrioridade={maxPrioridade} />)}
          {b.linhas.length === 0 && (
            <li className="border-t px-4 py-2 text-xs text-muted-foreground">{b.resumo.assuntos ? 'Todos os assuntos estão estudados (ocultos).' : 'Sem assuntos ainda. Use "⋯ › Novos assuntos".'}</li>
          )}
        </ul>
      )}
    </section>
  )
}

function LinhaAssunto({ l, maxPrioridade }: { l: LinhaEdital; maxPrioridade: number }) {
  const recolhido = useEditalUi((s) => s.topicosRecolhidos.includes(l.id))
  const alternarTopico = useEditalUi((s) => s.alternarTopico)
  const aberto = useEditalUi((s) => s.assuntoAberto === l.id)
  const definir = useEditalUi((s) => s.definir)
  const buscando = useEditalUi((s) => s.busca.trim() !== '')
  const { titulo, resto } = l.temFilhos ? partirNome(l.nome) : { titulo: l.nome, resto: '' }
  const prio = nivelPrioridade(l, maxPrioridade)
  const Seta = recolhido && !buscando ? ChevronRight : ChevronDown

  return (
    <li
      id={`assunto-${l.id}`}
      className={cn('flex items-center gap-2 border-t py-1.5 pr-3 hover:bg-accent/40', aberto && 'bg-accent hover:bg-accent', l.estudado && 'text-muted-foreground')}
      style={{ paddingLeft: `${0.75 + l.nivel * 1.5}rem` }}
    >
      {l.temFilhos ? (
        <button
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:cursor-default"
          onClick={() => alternarTopico(l.id)}
          disabled={buscando}
          aria-expanded={!recolhido || buscando}
          aria-label={recolhido ? `Abrir ${l.nome}` : `Recolher ${l.nome}`}
          title={buscando ? 'Durante a busca os tópicos ficam abertos' : recolhido ? 'Mostrar os subtópicos' : 'Esconder os subtópicos'}
        >
          <Seta className="size-4" />
        </button>
      ) : (
        <span className="inline-block size-5 shrink-0" />
      )}
      <input
        type="checkbox"
        className="size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
        checked={l.estudado}
        aria-label={`Estudado: ${l.nome}`}
        title={l.temFilhos ? 'Marca ou desmarca o tópico e todos os subtópicos' : 'Estudado'}
        onChange={(e) => void mudarComSubtopicos(db, l.id, { estudado: e.target.checked })}
      />
      <button
        className={cn('min-w-0 flex-1 cursor-pointer truncate text-left text-sm', l.temFilhos && 'font-semibold', l.estudado && 'line-through')}
        title={`${l.nome}\n(clique para ver os detalhes)`}
        aria-pressed={aberto}
        onClick={() => definir({ assuntoAberto: aberto ? null : l.id })}
      >
        {titulo}
        {resto && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{resto}</span>}
      </button>
      {l.temFilhos && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{l.folhasEstudadas}/{l.folhas}</span>}
      {(l.revisao === 'hoje' || l.revisao === 'atrasada') && (
        <Clock
          className={cn('size-3.5 shrink-0', l.revisao === 'atrasada' ? 'text-erro' : 'text-aviso')}
          aria-label={l.revisao === 'atrasada' ? 'Revisão atrasada' : 'Revisão para hoje'}
          role="img"
        >
          <title>{l.revisao === 'atrasada' ? 'Revisão atrasada' : 'Revisão para hoje'}</title>
        </Clock>
      )}
      {l.noCiclo && <span className="shrink-0 rounded-full bg-ok-bg px-1.5 py-0.5 text-[0.65rem] font-semibold text-ok">ciclo</span>}
      <SeloAcerto feitas={l.total} acertos={l.certas} />
      <span className="flex w-3 shrink-0 justify-center">
        {prio && <i className={cn('inline-block size-2.5 rounded-full', COR_PRIORIDADE[prio])} title={`Prioridade ${NOME_PRIORIDADE[prio]}`} aria-label={`Prioridade ${NOME_PRIORIDADE[prio]}`} />}
      </span>
    </li>
  )
}
