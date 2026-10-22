import { Fragment, useState, type DragEvent } from 'react'
import { Check } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { editarPasso, marcarPasso, moverPassosNaSemana, type Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { resumoDaMateria } from '@/dados/notas'
import { useCiclo } from '@/dados/useCiclo'
import { cartoesDaMateria, corDe, fmtH, soma, type CartaoDaMateria } from '@/dominio/ciclo'
import { addDias, fmtData, NOMES_DIA, NOMES_DIA_LONGO } from '@/dominio/datas'
import { abrirDialogo } from '@/estado/dialogo'
import { abrirNota } from '@/lib/abrirNota'
import { cn } from '@/lib/utils'

type SemanaAtual = NonNullable<Ciclo['semana']>

const mudo = 'text-xs text-muted-foreground'

/** Cor de fundo do cartão: a cor da matéria bem diluída, para funcionar no tema claro e no escuro. */
const fundoDe = (cor: string) => `color-mix(in srgb, ${cor} 38%, var(--card))`

/** Edição de um cartão (os passos de uma matéria num dia). Lê os passos ao vivo, então reflete as mudanças na hora. */
function EditarCartao({ ids, fechar }: { ids: number[]; fechar: () => void }) {
  const ciclo = useCiclo()
  const s = ciclo?.semana
  const passos = s ? s.passos.filter((x) => ids.includes(x.id)) : []
  const primeiro = passos[0]
  if (!s || !primeiro) return <p className={mudo}>Passo não encontrado.</p>
  const varios = passos.length > 1
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-xs text-muted-foreground">
        Planejado: {fmtH(soma(passos, (x) => x.horasPlanejadas))} · estudado: {fmtH(soma(passos, (x) => x.horasFeitas))}. O estudado pode passar do planejado.
      </p>
      {passos.map((p, i) => (
        <div key={p.id} className={cn('flex flex-col gap-3', varios && 'rounded-md border p-3')}>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={p.feito} onChange={(e) => void marcarPasso(db, p.id, e.target.checked)} />
            {varios ? `Passo ${i + 1} concluído` : 'Passo concluído'}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs text-muted-foreground">
              Planejado (h)
              <CampoNumero key={`pl${p.horasPlanejadas}`} className="text-center" valor={p.horasPlanejadas} aoConfirmar={(n) => void editarPasso(db, p.id, { horasPlanejadas: n && n > 0 ? n : 1 })} />
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              Estudado (h)
              <CampoNumero key={`fe${p.horasFeitas}`} className="text-center" valor={p.horasFeitas} aoConfirmar={(n) => void editarPasso(db, p.id, { horasFeitas: n && n > 0 ? n : 0 })} />
            </label>
          </div>
          <label className="flex flex-col text-xs text-muted-foreground">
            Anotação
            <Entrada
              key={`nt${p.nota}`}
              autoFocus={i === 0}
              placeholder="Tópico, questões, acertos…"
              defaultValue={p.nota}
              onBlur={(e) => e.target.value !== p.nota && void editarPasso(db, p.id, { nota: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
        </div>
      ))}
      <label className="flex flex-col text-xs text-muted-foreground">
        Dia
        <Selecao value={primeiro.dia ?? ''} onChange={(e) => void Promise.all(passos.map((p) => editarPasso(db, p.id, { dia: e.target.value || null })))}>
          <option value="">Sem dia</option>
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDias(s.seg, i)
            return <option key={d} value={d}>{NOMES_DIA_LONGO[i]} {fmtData(d)}</option>
          })}
        </Selecao>
      </label>
      <div className="flex justify-between gap-2">
        <Button
          variant="outline"
          title="Abrir ou criar o resumo desta matéria"
          onClick={async () => {
            const nota = await resumoDaMateria(db, primeiro.materia)
            fechar()
            abrirNota(nota.id)
          }}
        >
          📝 Resumo
        </Button>
        <Button onClick={fechar}>Pronto</Button>
      </div>
    </div>
  )
}

function abrirEdicao(c: CartaoDaMateria) {
  void abrirDialogo(c.materia, (fechar) => <EditarCartao ids={c.passos.map((p) => p.id)} fechar={() => fechar(null)} />)
}

/** Concluir (ou desmarcar) o cartão marca todos os passos dele. */
const concluirCartao = (c: CartaoDaMateria, feito: boolean) => Promise.all(c.passos.map((p) => marcarPasso(db, p.id, feito)))

/** Linha verde que mostra onde o cartão arrastado vai cair. */
const LinhaDeQueda = () => <div className="-my-1 h-1 shrink-0 rounded-full bg-primary" aria-hidden />

interface Arrasto {
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent) => void
  arrastando: boolean
}

function CartaoMateria({ c, cores, arrasto }: { c: CartaoDaMateria; cores: Record<string, number>; arrasto: Arrasto }) {
  const cor = corDe(cores, c.materia)
  const notas = c.passos.map((p) => p.nota).filter(Boolean).join(' · ')
  return (
    <div
      draggable
      onDragStart={arrasto.onDragStart}
      onDragEnd={arrasto.onDragEnd}
      onDragOver={arrasto.onDragOver}
      role="button"
      tabIndex={0}
      onClick={() => abrirEdicao(c)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrirEdicao(c))}
      title={`Planejado ${fmtH(c.planejadas)} · estudado ${fmtH(c.feitas)} · clique para editar; arraste para mudar o dia ou a ordem`}
      className={cn('group relative flex shrink-0 cursor-pointer flex-col gap-1 overflow-hidden rounded-sm border-l-4 px-2.5 py-2 shadow-sm outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring', c.feito && 'opacity-55', arrasto.arrastando && 'opacity-30')}
      style={{ background: fundoDe(cor), borderLeftColor: cor }}
    >
      <div className="flex items-start gap-1.5">
        <b className={cn('min-w-0 flex-1 text-sm leading-tight break-words', c.feito && 'line-through')}>{c.materia}</b>
        <button
          onClick={(e) => {
            e.stopPropagation()
            void concluirCartao(c, !c.feito)
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={c.feito ? 'Desmarcar' : 'Concluir'}
          aria-pressed={c.feito}
          title={c.feito ? 'Desmarcar' : 'Concluir'}
          className={cn('flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-foreground/40 bg-card/70', c.feito && 'border-primary bg-primary text-primary-foreground')}
        >
          {c.feito && <Check className="size-3" strokeWidth={3} />}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={cn('text-xs tabular-nums', c.feitas > 0 ? 'font-semibold text-foreground/80' : 'text-muted-foreground', c.feitas > c.planejadas && 'text-ok')}>{fmtH(c.feitas)}</span>
        <span className="rounded-full bg-card/80 px-1.5 py-px text-[0.65rem] font-semibold text-muted-foreground" title="Tempo planejado para esta matéria neste dia; pode estudar mais">meta {fmtH(c.planejadas)}</span>
      </div>
      {notas && <p className="m-0 truncate text-[0.7rem] leading-snug text-muted-foreground" title={notas}>{notas}</p>}
    </div>
  )
}

/** O ciclo da semana como um calendário: uma coluna por dia (do cabeçalho ao rodapé do quadro), um cartão colorido por passo. */
export function QuadroSemana({ s, cores, diasDeEstudo, hojeISO }: { s: SemanaAtual; cores: Record<string, number>; diasDeEstudo: boolean[]; hojeISO: string }) {
  const colunas: { chave: string; dia: string | null; i: number; itens: CartaoDaMateria[] }[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDias(s.seg, i)
    return { chave: d, dia: d, i, itens: cartoesDaMateria(s.passos.filter((p) => p.dia === d)) }
  })
  // cartão arrastado (id do primeiro passo dele) e onde cairia ("antes" = id do primeiro passo do cartão logo abaixo; null = fim da coluna)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<{ chave: string; antes: number | null } | null>(null)
  const parar = () => {
    setArrastando(null)
    setAlvo(null)
  }
  const soltar = (dia: string | null) => {
    const ids = colunas.flatMap((c) => c.itens).find((c) => c.passos[0]?.id === arrastando)?.passos.map((p) => p.id)
    if (ids && alvo) void moverPassosNaSemana(db, ids, dia, alvo.antes)
    parar()
  }
  const semDia = s.passos.filter((p) => !p.dia || p.dia < s.seg || p.dia > s.dom)
  if (semDia.length) colunas.push({ chave: 'sem', dia: null, i: -1, itens: cartoesDaMateria(semDia) })

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
      <div className="grid min-h-full auto-cols-[minmax(8.5rem,1fr)] grid-flow-col">
        {colunas.map(({ chave, dia, i, itens }, k) => {
          const hoje = dia === hojeISO
          const fe = itens.filter((c) => c.feito).length
          const pend = itens.length - fe
          const folga = dia !== null && !diasDeEstudo[i] && !itens.length
          return (
            <section
              key={chave}
              className={cn('flex min-w-0 flex-col', k > 0 && 'border-l', hoje && 'bg-primary/5', arrastando !== null && alvo?.chave === chave && 'bg-primary/10')}
              onDragOver={(e) => {
                if (arrastando === null) return
                e.preventDefault()
                setAlvo({ chave, antes: null }) // área fora dos cartões: vai para o fim do dia
              }}
              onDrop={(e) => {
                e.preventDefault()
                soltar(dia)
              }}
            >
              <header
                id={dia ? `dia-${dia}` : undefined}
                className={cn('sticky top-0 z-10 border-b px-2 py-2 text-center', hoje ? 'bg-primary text-primary-foreground' : 'bg-card')}
              >
                <b className="block text-sm">{dia ? `${NOMES_DIA[i]}, ${fmtData(dia).slice(0, 2)}` : 'Sem dia'}</b>
                <span className={cn('block text-[0.68rem]', hoje ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                  {itens.length ? `${fe}/${itens.length} · ${fmtH(soma(itens, (c) => c.feitas))}` : '—'}
                  {dia && dia < hojeISO && pend > 0 && <span className="font-bold text-erro"> · {pend} atrasado(s)</span>}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {itens.map((c, idx) => {
                  const id = c.passos[0]?.id as number
                  return (
                  <Fragment key={id}>
                    {arrastando !== null && alvo?.chave === chave && alvo.antes === id && id !== arrastando && <LinhaDeQueda />}
                    <CartaoMateria
                      c={c}
                      cores={cores}
                      arrasto={{
                        arrastando: arrastando === id,
                        onDragStart: (e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', String(id))
                          setArrastando(id)
                        },
                        onDragEnd: parar,
                        onDragOver: (e) => {
                          if (arrastando === null) return
                          e.preventDefault()
                          e.stopPropagation()
                          const r = e.currentTarget.getBoundingClientRect()
                          const abaixo = e.clientY > r.top + r.height / 2
                          setAlvo({ chave, antes: abaixo ? (itens[idx + 1]?.passos[0]?.id ?? null) : id })
                        },
                      }}
                    />
                  </Fragment>
                  )
                })}
                {arrastando !== null && alvo?.chave === chave && alvo.antes === null && itens.some((c) => c.passos[0]?.id !== arrastando) && <LinhaDeQueda />}
                {!itens.length && <span className="m-auto text-xs text-muted-foreground/70">{folga ? 'folga' : 'sem passos'}</span>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
