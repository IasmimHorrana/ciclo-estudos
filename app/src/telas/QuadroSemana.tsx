import { Check } from 'lucide-react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { editarPasso, marcarPasso, type Ciclo } from '@/dados/ciclo'
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

function CartaoPasso({ p, cores }: { p: Passo; cores: Record<string, number> }) {
  const cor = corDe(cores, p.materia)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => abrirEdicao(p)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrirEdicao(p))}
      title="Clique para editar o passo"
      className={cn('group relative cursor-pointer rounded-lg border-l-4 px-2.5 py-2 shadow-sm outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring', p.feito && 'opacity-55')}
      style={{ background: fundoDe(cor), borderLeftColor: cor }}
    >
      <div className="flex items-start gap-1.5">
        <b className={cn('min-w-0 flex-1 text-[0.8rem] leading-tight', p.feito && 'line-through')}>{p.materia}</b>
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
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="rounded-full bg-card/80 px-1.5 py-px text-[0.65rem] font-bold">{fmtH(p.horasPlanejadas)}</span>
        {p.horasFeitas > 0 && <span className="rounded-full bg-card/80 px-1.5 py-px text-[0.65rem] font-semibold text-muted-foreground">feito {fmtH(p.horasFeitas)}</span>}
      </div>
      {p.nota && <p className="m-0 mt-1 line-clamp-2 text-[0.7rem] leading-snug text-muted-foreground">{p.nota}</p>}
    </div>
  )
}

/** O ciclo da semana como um quadro: uma coluna por dia, um cartão colorido por passo. */
export function QuadroSemana({ s, cores, diasDeEstudo, hojeISO }: { s: SemanaAtual; cores: Record<string, number>; diasDeEstudo: boolean[]; hojeISO: string }) {
  const colunas: { chave: string; dia: string | null; i: number; itens: Passo[] }[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDias(s.seg, i)
    return { chave: d, dia: d, i, itens: s.passos.filter((p) => p.dia === d) }
  })
  const semDia = s.passos.filter((p) => !p.dia || p.dia < s.seg || p.dia > s.dom)
  if (semDia.length) colunas.push({ chave: 'sem', dia: null, i: -1, itens: semDia })

  return (
    <div className="grid min-h-0 flex-1 auto-cols-[minmax(6.5rem,1fr)] grid-flow-col gap-2 overflow-auto">
      {colunas.map(({ chave, dia, i, itens }) => {
        const hoje = dia === hojeISO
        const fe = itens.filter((p) => p.feito).length
        const pend = itens.length - fe
        const folga = dia !== null && !diasDeEstudo[i] && !itens.length
        return (
          <section key={chave} className={cn('flex min-w-0 flex-col gap-2', folga && 'opacity-55')}>
            <header
              id={dia ? `dia-${dia}` : undefined}
              className={cn('sticky top-0 z-10 rounded-lg border px-2 py-1.5 text-center', hoje ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
            >
              <b className="block text-sm">{dia ? `${NOMES_DIA[i]}, ${fmtData(dia).slice(0, 2)}` : 'Sem dia'}</b>
              <span className={cn('block text-[0.65rem]', hoje ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                {itens.length ? `${fe}/${itens.length} · ${fmtH(soma(itens, (p) => p.horasPlanejadas))}` : folga ? 'folga' : '—'}
                {dia && dia < hojeISO && pend > 0 && <span className="font-bold text-erro"> · {pend} atrasado(s)</span>}
              </span>
            </header>
            {itens.map((p) => (
              <CartaoPasso key={p.id} p={p} cores={cores} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
