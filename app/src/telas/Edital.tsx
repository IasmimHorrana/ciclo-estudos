import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { ArrowRight, FileText, ListCollapse, Plus, Search, X } from 'lucide-react'
import { Menu } from '@/componentes/Menu'
import { avisar, pedirTexto } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { adicionarMateriaEdital, carregarEdital } from '@/dados/edital'
import { useCiclo } from '@/dados/useCiclo'
import { todasMaterias } from '@/dominio/ciclo'
import { materiasDoEdital, montarEdital, type OrdemEdital } from '@/dominio/edital'
import { abrirDialogo } from '@/estado/dialogo'
import { useEditalUi } from '@/estado/edital'
import { useUi } from '@/estado/ui'
import { CartaoMateria } from '@/telas/edital/CartaoMateria'
import { ImportarEdital } from '@/telas/edital/ImportarEdital'
import { PainelAssunto, ResumoGeral } from '@/telas/edital/PainelAssunto'
import { cn } from '@/lib/utils'

export function Edital() {
  const ciclo = useCiclo()
  const dados = useLiveQuery(() => carregarEdital(db), [])
  const ui = useEditalUi()
  const irParaAba = useUi((s) => s.irParaAba)

  // Esc fecha o painel do assunto (quando o foco não está num campo)
  const aberto = ui.assuntoAberto
  const definir = ui.definir
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (e.key === 'Escape' && !alvo.closest('input, select, textarea, [role=dialog]')) definir({ assuntoAberto: null })
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [aberto, definir])

  if (!ciclo || !dados) return <p className="text-sm text-muted-foreground">Carregando…</p>

  const materias = materiasDoEdital(dados.materias, dados.assuntos)
  const filtro = materias.some((m) => m.id === ui.filtroMateria) ? ui.filtroMateria : null
  const { blocos } = montarEdital({ ...dados, ordem: ui.ordem, ocultarEstudados: ui.ocultarEstudados, filtroMateria: filtro, recolhidos: new Set(ui.topicosRecolhidos), busca: ui.busca })
  // tudo, sem filtros: o painel acha o assunto aberto mesmo escondido, e a prioridade é relativa ao edital inteiro
  const completo = montarEdital({ ...dados, ordem: 'edital', ocultarEstudados: false, filtroMateria: null })
  const selecionado = completo.blocos.flatMap((b) => b.linhas.map((l) => ({ l, b }))).find((x) => x.l.id === ui.assuntoAberto)
  const maxPrioridade = Math.max(1, ...completo.blocos.map((b) => b.maiorPrioridade))
  // tópicos = assuntos do edital que têm subtópicos
  const idsDoEdital = new Set(dados.assuntos.filter((a) => a.noEdital).map((a) => a.id))
  const topicos = [...new Set(dados.assuntos.filter((a) => a.noEdital && a.paiId && idsDoEdital.has(a.paiId)).map((a) => a.paiId as string))]
  const tudoRecolhido = topicos.length > 0 && topicos.every((id) => ui.topicosRecolhidos.includes(id))
  const conhecidas = [...new Set([...todasMaterias(ciclo.config), ...dados.materias.map((m) => m.nome), ...dados.assuntos.map((a) => a.materia)])]
  const fechar = () => ui.definir({ assuntoAberto: null })

  async function importar() {
    const msg = await abrirDialogo<string>('Importar edital', (fecharDialogo) => <ImportarEdital conhecidas={conhecidas} fechar={(r) => fecharDialogo(r ?? null)} />)
    if (msg) void avisar('Edital importado', msg)
  }

  async function novaMateria() {
    const nome = await pedirTexto('Nova matéria', 'Nome da matéria', '', { ok: 'Adicionar' })
    if (!nome) return
    const r = await adicionarMateriaEdital(db, nome)
    if (r === 'duplicada') void avisar('Matéria', 'Essa matéria já está no edital.')
  }

  if (materias.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <h1 className="m-0 text-xl font-bold">Edital verticalizado</h1>
        <div className="m-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Seu edital ainda está vazio</h2>
          <p className="mb-4 text-sm text-muted-foreground">Cole o conteúdo programático do edital: o app separa as matérias e os assuntos, e você confere antes de salvar. Os assuntos que você já criou em Desempenho não aparecem aqui; se o nome for igual ao do edital, eles são ligados a ele.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => void importar()}>Importar edital</Button>
            <Button variant="outline" onClick={() => void novaMateria()}><Plus className="size-4" /> Matéria</Button>
          </div>
        </div>
      </div>
    )
  }

  const resumo = completo.total.resumo
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="m-0 mr-auto text-xl font-bold">Edital verticalizado</h1>
        <span className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Entrada
            className="w-56 pr-7 pl-8"
            placeholder="Buscar no edital"
            aria-label="Buscar assunto ou matéria"
            value={ui.busca}
            onChange={(e) => ui.definir({ busca: e.target.value })}
            onKeyDown={(e) => e.key === 'Escape' && ui.definir({ busca: '' })}
          />
          {ui.busca && (
            <button className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-muted-foreground" aria-label="Limpar busca" onClick={() => ui.definir({ busca: '' })}>
              <X className="size-3.5" />
            </button>
          )}
        </span>
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
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={ui.ocultarEstudados} onChange={(e) => ui.definir({ ocultarEstudados: e.target.checked })} />
          Ocultar estudados
        </label>
        <Menu
          rotulo="Mais ações do edital"
          itens={[
            { rotulo: 'Importar edital', icone: <FileText className="size-4" />, acao: () => void importar() },
            { rotulo: 'Nova matéria', icone: <Plus className="size-4" />, acao: () => void novaMateria() },
            { rotulo: tudoRecolhido ? 'Abrir todos os tópicos' : 'Recolher todos os tópicos', icone: <ListCollapse className="size-4" />, acao: () => ui.definirTopicosRecolhidos(tudoRecolhido ? [] : topicos), desativado: topicos.length === 0 },
            { rotulo: 'Ir para Montar ciclo', icone: <ArrowRight className="size-4" />, acao: () => irParaAba('montar') },
          ]}
        />
      </div>

      {/* em tela estreita o painel some; o progresso fica numa linha */}
      <p className="m-0 text-xs text-muted-foreground lg:hidden">
        {resumo.estudados}/{resumo.assuntos} assuntos estudados ({resumo.pctEstudados}%)
      </p>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1">
          {blocos.map((b) => (
            <CartaoMateria key={b.materia.id} b={b} maxPrioridade={maxPrioridade} recolhida={ui.recolhidas.includes(b.materia.id) && !ui.busca.trim()} />
          ))}
          {blocos.length === 0 && (
            <p className="m-auto p-6 text-center text-sm text-muted-foreground">{ui.busca.trim() ? `Nada encontrado para "${ui.busca.trim()}".` : 'Nenhuma matéria para mostrar.'}</p>
          )}
        </div>

        {selecionado && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={fechar} aria-hidden />}
        <aside
          aria-label={selecionado ? `Detalhes de ${selecionado.l.nome}` : 'Resumo do edital'}
          className={cn(
            'min-h-0 flex-col overflow-auto rounded-xl border bg-card shadow-sm lg:static lg:z-auto lg:flex lg:w-80 lg:shrink-0',
            selecionado ? 'fixed inset-y-2 right-2 z-40 flex w-[min(22rem,calc(100%-1rem))]' : 'hidden',
          )}
        >
          {selecionado ? (
            <PainelAssunto l={selecionado.l} b={selecionado.b} maxPrioridade={maxPrioridade} fechar={fechar} />
          ) : (
            <ResumoGeral resumo={resumo} certas={completo.total.certas} erradas={completo.total.erradas} />
          )}
        </aside>
      </div>
    </div>
  )
}
