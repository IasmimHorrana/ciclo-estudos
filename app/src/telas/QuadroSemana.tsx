import { Fragment, useState, type DragEvent } from 'react'
import { Check } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { editarPasso, marcarPasso, moverPassoNaSemana, type Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { resumoDaMateria } from '@/dados/notas'
import { useCiclo } from '@/dados/useCiclo'
import { corDe, fmtH, soma, type Passo } from '@/dominio/ciclo'
import { addDias, fmtData, NOMES_DIA, NOMES_DIA_LONGO } from '@/dominio/datas'
import { abrirDialogo } from '@/estado/dialogo'
import { abrirNota } from '@/lib/abrirNota'
import { cn } from '@/lib/utils'

type SemanaAtual = NonNullable<Ciclo['semana']>

const mudo = 'text-xs text-muted-foreground'

/** Cor de fundo do cartão: a cor da matéria bem diluída, para funcionar no tema claro e no escuro. */
const fundoDe = (cor: string) => `color-mix(in srgb, ${cor} 38%, var(--card))`

/** Edição de um passo (aberta ao clicar no cartão). Lê o passo ao vivo, então reflete as mudanças na hora. */
function EditarPasso({ id, fechar }: { id: number; fechar: () => void }) {
  const ciclo = useCiclo()
  const s = ciclo?.semana
  const p = s?.passos.find((x) => x.id === id)
  if (!s || !p) return <p className={mudo}>Passo não encontrado.</p>
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={p.feito} onChange={(e) => void marcarPasso(db, p.id, e.target.checked)} />
        Passo concluído
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-xs text-muted-foreground">
          Planejado (h)
          <CampoNumero key={`pl${p.horasPlanejadas}`} className="text-center" valor={p.horasPlanejadas} aoConfirmar={(n) => void editarPasso(db, p.id, { horasPlanejadas: n && n > 0 ? n : 1 })} />
        </label>
        <label className="flex flex-col text-xs text-muted-foreground">
          Feito (h)
          <CampoNumero key={`fe${p.horasFeitas}`} className="text-center" valor={p.horasFeitas} aoConfirmar={(n) => void editarPasso(db, p.id, { horasFeitas: n && n > 0 ? n : 0 })} />
        </label>
      </div>
      <label className="flex flex-col text-xs text-muted-foreground">
        Dia
        <Selecao value={p.dia ?? ''} onChange={(e) => void editarPasso(db, p.id, { dia: e.target.value || null })}>
          <option value="">Sem dia</option>
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDias(s.seg, i)
            return <option key={d} value={d}>{NOMES_DIA_LONGO[i]} {fmtData(d)}</option>
          })}
        </Selecao>
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Anotação
        <Entrada
          key={`nt${p.nota}`}
          autoFocus
          placeholder="Tópico, questões, acertos…"
          defaultValue={p.nota}
          onBlur={(e) => e.target.value !== p.nota && void editarPasso(db, p.id, { nota: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>
      <div className="flex justify-between gap-2">
        <Button
          variant="outline"
          title="Abrir ou criar o resumo desta matéria"
          onClick={async () => {
            const nota = await resumoDaMateria(db, p.materia)
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

function abrirEdicao(p: Passo) {
  void abrirDialogo(`${p.id}. ${p.materia}`, (fechar) => <EditarPasso id={p.id} fechar={() => fechar(null)} />)
}

/** Linha verde que mostra onde o cartão arrastado vai cair. */
const LinhaDeQueda = () => <div className="-my-1 h-1 shrink-0 rounded-full bg-primary" aria-hidden />

interface Arrasto {
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent) => void
  arrastando: boolean
}

function CartaoPasso({ p, cores, arrasto }: { p: Passo; cores: Record<string, number>; arrasto: Arrasto }) {
  const cor = corDe(cores, p.materia)
  return (
    <div
      draggable
      onDragStart={arrasto.onDragStart}
      onDragEnd={arrasto.onDragEnd}
      onDragOver={arrasto.onDragOver}
      role="button"
      tabIndex={0}
      onClick={() => abrirEdicao(p)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrirEdicao(p))}
      title={`Planejado ${fmtH(p.horasPlanejadas)} · clique para editar; arraste para mudar o dia ou a ordem`}
      className={cn('group relative flex shrink-0 cursor-pointer flex-col gap-1 overflow-hidden rounded-sm border-l-4 px-2.5 py-2 shadow-sm outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring', p.feito && 'opacity-55', arrasto.arrastando && 'opacity-30')}
      style={{ background: fundoDe(cor), borderLeftColor: cor }}
    >
      <div className="flex items-start gap-1.5">
        <b className={cn('min-w-0 flex-1 text-sm leading-tight break-words', p.feito && 'line-through')}>{p.materia}</b>
        <button
          onClick={(e) => {
            e.stopPropagation()
            void marcarPasso(db, p.id, !p.feito)
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={p.feito ? 'Desmarcar passo' : 'Concluir passo'}
          aria-pressed={p.feito}
          title={p.feito ? 'Desmarcar' : 'Concluir'}
          className={cn('flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-foreground/40 bg-card/70', p.feito && 'border-primary bg-primary text-primary-foreground')}
        >
          {p.feito && <Check className="size-3" strokeWidth={3} />}
        </button>
      </div>
      <span className={cn('text-xs tabular-nums', p.horasFeitas > 0 ? 'font-semibold text-foreground/80' : 'text-muted-foreground')}>{fmtH(p.horasFeitas)}</span>
      {p.nota && <p className="m-0 truncate text-[0.7rem] leading-snug text-muted-foreground" title={p.nota}>{p.nota}</p>}
    </div>
  )
}

/** O ciclo da semana como um calendário: uma coluna por dia (do cabeçalho ao rodapé do quadro), um cartão colorido por passo. */
export function QuadroSemana({ s, cores, diasDeEstudo, hojeISO }: { s: SemanaAtual; cores: Record<string, number>; diasDeEstudo: boolean[]; hojeISO: string }) {
  const colunas: { chave: string; dia: string | null; i: number; itens: Passo[] }[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDias(s.seg, i)
    return { chave: d, dia: d, i, itens: s.passos.filter((p) => p.dia === d) }
  })
  // passo que está sendo arrastado e onde ele cairia ("antes" = id do passo logo abaixo; null = fim da coluna)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<{ chave: string; antes: number | null } | null>(null)
  const parar = () => {
    setArrastando(null)
    setAlvo(null)
  }
  const soltar = (dia: string | null) => {
    if (arrastando !== null && alvo) void moverPassoNaSemana(db, arrastando, dia, alvo.antes)
    parar()
  }
  const semDia = s.passos.filter((p) => !p.dia || p.dia < s.seg || p.dia > s.dom)
  if (semDia.length) colunas.push({ chave: 'sem', dia: null, i: -1, itens: semDia })

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
      <div className="grid min-h-full auto-cols-[minmax(8.5rem,1fr)] grid-flow-col">
        {colunas.map(({ chave, dia, i, itens }, k) => {
          const hoje = dia === hojeISO
          const fe = itens.filter((p) => p.feito).length
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
                  {itens.length ? `${fe}/${itens.length} · ${fmtH(soma(itens, (p) => p.horasFeitas))}` : '—'}
                  {dia && dia < hojeISO && pend > 0 && <span className="font-bold text-erro"> · {pend} atrasado(s)</span>}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {itens.map((p, idx) => (
                  <Fragment key={p.id}>
                    {arrastando !== null && alvo?.chave === chave && alvo.antes === p.id && p.id !== arrastando && <LinhaDeQueda />}
                    <CartaoPasso
                      p={p}
                      cores={cores}
                      arrasto={{
                        arrastando: arrastando === p.id,
                        onDragStart: (e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', String(p.id))
                          setArrastando(p.id)
                        },
                        onDragEnd: parar,
                        onDragOver: (e) => {
                          if (arrastando === null) return
                          e.preventDefault()
                          e.stopPropagation()
                          const r = e.currentTarget.getBoundingClientRect()
                          const abaixo = e.clientY > r.top + r.height / 2
                          setAlvo({ chave, antes: abaixo ? (itens[idx + 1]?.id ?? null) : p.id })
                        },
                      }}
                    />
                  </Fragment>
                ))}
                {arrastando !== null && alvo?.chave === chave && alvo.antes === null && itens.some((p) => p.id !== arrastando) && <LinhaDeQueda />}
                {!itens.length && <span className="m-auto text-xs text-muted-foreground/70">{folga ? 'folga' : 'sem passos'}</span>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
