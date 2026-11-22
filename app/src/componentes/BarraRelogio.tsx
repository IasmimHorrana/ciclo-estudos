import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleHelp, Clock, MoreHorizontal, Pause, Play, RotateCcw, Square, Target } from 'lucide-react'
import { abrirQuestoes } from '@/componentes/abrirQuestoes'
import { CampoNumero } from '@/componentes/CampoNumero'
import { encerrarLivre, escolherAlvoLivre, iniciarOuPausarLivre } from '@/componentes/cronometro-api'
import { confirmar } from '@/componentes/dialogos-api'
import { escolherAlvo, iniciarOuPausar } from '@/componentes/iniciar-foco-api'
import { Sigla } from '@/componentes/visual'
import { salvarPomo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { carregarEstudo } from '@/dados/desempenho'
import { useCiclo, useHojeISO } from '@/dados/useCiclo'
import { corDe, fmtH, horasFeitasDe, metaEf } from '@/dominio/ciclo'
import { fmtHHMMSS } from '@/dominio/cronometro'
import { diaDe, resumoLivre } from '@/dominio/livre'
import { NOMES_FASE, duracaoSeg, fmtMMSS, type ConfigPomodoro, type Fase } from '@/dominio/pomodoro'
import { useCronometro } from '@/estado/cronometro'
import { usePomodoro } from '@/estado/pomodoro'
import { useUi, type Relogio } from '@/estado/ui'
import { cn } from '@/lib/utils'

const OPCOES: { id: Relogio; rotulo: string; dica: string }[] = [
  { id: 'pomodoro', rotulo: 'Pomodoro', dica: 'Blocos de foco e pausa' },
  { id: 'livre', rotulo: 'Livre', dica: 'Cronômetro que conta para cima, sem blocos' },
]

const FASES: { id: Fase; rotulo: string }[] = [
  { id: 'foco', rotulo: 'Foco' },
  { id: 'pausa', rotulo: 'Pausa curta' },
  { id: 'longa', rotulo: 'Pausa longa' },
]

const CAMPOS: { chave: keyof ConfigPomodoro; rotulo: string }[] = [
  { chave: 'foco', rotulo: 'Foco' },
  { chave: 'pausa', rotulo: 'Pausa' },
  { chave: 'longa', rotulo: 'Longa' },
  { chave: 'ate', rotulo: 'Longa a cada' },
]

/** Caixinha que abre para cima, a partir de um botão. Fecha ao clicar fora ou com Esc. */
function Balao({ rotulo, icone, children }: { rotulo: string; icone: ReactNode; children: (fechar: () => void) => ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])
  return (
    <div ref={caixa} className="relative">
      <button
        className="grid size-8 place-items-center rounded-[9px] border bg-card text-muted-foreground hover:text-foreground"
        aria-label={rotulo}
        title={rotulo}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        {icone}
      </button>
      {aberto && (
        <div role="dialog" aria-label={rotulo} className="absolute bottom-full left-1/2 z-40 mb-2 w-72 -translate-x-1/2 rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl">
          {children(() => setAberto(false))}
        </div>
      )}
    </div>
  )
}

/** Opções do Pomodoro: fase, reiniciar, tempos e focos concluídos. */
function OpcoesPomodoro({ fechar }: { fechar: () => void }) {
  const { fase, rodando, reiniciar, irParaFase, config, focosConcluidos, definirConfig } = usePomodoro()
  function mudar(chave: keyof ConfigPomodoro, n: number | null) {
    if (!n || n < 1) return
    const nova = { ...config, [chave]: Math.trunc(n) }
    definirConfig(nova)
    void salvarPomo(db, nova)
  }
  return (
    <div className="flex flex-col gap-2.5 text-left">
      <div role="tablist" aria-label="Fase do Pomodoro" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5">
        {FASES.map(({ id, rotulo }) => (
          <button
            key={id}
            role="tab"
            aria-selected={fase === id}
            disabled={rodando && fase !== id}
            onClick={() => irParaFase(id)}
            className={cn('rounded-md px-1 py-1 text-[0.68rem] font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50', fase === id && 'bg-card text-primary shadow-sm')}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {CAMPOS.map(({ chave, rotulo }) => (
          <label key={chave} className="flex flex-col gap-0.5 text-[0.62rem] leading-tight text-muted-foreground">
            {rotulo}
            <CampoNumero key={`${chave}${config[chave]}`} className="px-1 py-1 text-center" valor={config[chave]} aoConfirmar={(n) => mudar(chave, n)} />
          </label>
        ))}
      </div>
      <p className="m-0 text-[0.65rem] text-muted-foreground">Tempos em minutos; "Longa a cada" = quantos focos até a pausa longa.</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Focos concluídos: <b className="text-foreground">{focosConcluidos}</b>
        </span>
        <button
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => {
            reiniciar()
            fechar()
          }}
        >
          <RotateCcw className="size-3.5" /> Reiniciar
        </button>
      </div>
    </div>
  )
}

/**
 * Barra fixa embaixo de todas as telas: o que está sendo estudado, o relógio (Pomodoro ou Livre),
 * as horas de hoje e da semana e o atalho para registrar questões. Só um relógio por vez.
 */
export function BarraRelogio() {
  const { relogio, escolherRelogio } = useUi()
  const pomo = usePomodoro()
  const livre = useCronometro()
  const ciclo = useCiclo()
  const hoje = useHojeISO()
  const estudo = useLiveQuery(() => carregarEstudo(db), [])

  const livreAtivo = livre.rodando || livre.seg > 0
  const atual: Relogio = pomo.rodando ? 'pomodoro' : livreAtivo ? 'livre' : relogio
  const travado = pomo.rodando || livreAtivo
  const ehPomo = atual === 'pomodoro'
  const rodando = ehPomo ? pomo.rodando : livre.rodando

  // o que está sendo estudado
  const cores = ciclo?.cores ?? {}
  let materia: string | null
  let texto: string
  let rotulo: string
  if (ehPomo) {
    materia = pomo.alvo ? (ciclo?.semana?.passos.find((p) => p.id === pomo.alvo?.passoId)?.materia ?? null) : null
    texto = pomo.alvo?.rotulo ?? 'Escolha o passo ao iniciar'
    rotulo = pomo.fase !== 'foco' ? NOMES_FASE[pomo.fase] : pomo.rodando ? 'Estudando' : 'Pomodoro'
  } else if (livre.alvo) {
    materia = livre.alvo.materia
    texto = `${livre.alvo.materia} · ${livre.alvo.tipo}`
    rotulo = livre.rodando ? 'Estudando' : livre.seg > 0 ? 'Pausado' : 'Pronto para começar'
  } else {
    const doDia = ciclo?.preferencias.modoEstudo === 'livre' ? diaDe(ciclo.preferencias.diaLivre, hoje).principal : null
    materia = doDia
    texto = doDia ?? 'Escolha a matéria ao iniciar'
    rotulo = doDia ? 'Matéria de hoje' : 'Tempo livre'
  }
  const trocarAlvo = () => void (ehPomo ? escolherAlvo() : escolherAlvoLivre())

  // horas de hoje e da semana
  const r = ciclo && estudo ? resumoLivre(estudo.sessoes, estudo.questoes, ciclo.preferencias.metaLivre, hoje) : null
  const modoCiclo = ciclo?.preferencias.modoEstudo !== 'livre' && ciclo?.semana
  const semanaH = modoCiclo && ciclo.semana ? horasFeitasDe(ciclo.semana) : (r?.progresso.horas ?? 0)
  const semanaMeta = modoCiclo && ciclo.semana ? metaEf(ciclo.semana) : (r?.progresso.meta ?? 0)

  const total = duracaoSeg(pomo.fase, pomo.config)
  const podeEncerrar = ehPomo ? pomo.fase === 'foco' && (pomo.rodando || pomo.restaSeg < total) : livre.seg > 0

  async function zerarLivre() {
    if (livre.seg < 60 || (await confirmar(`Zerar ${fmtHHMMSS(livre.seg)} sem registrar?`, 'Zerar', true))) livre.zerar()
  }

  return (
    <div
      className={cn(
        'grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-card px-4 py-2 shadow-sm',
        'max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-30 max-[900px]:grid-cols-[minmax(0,1fr)_auto] max-[900px]:rounded-none max-[900px]:border-t max-[900px]:px-3 max-[900px]:pb-[max(0.5rem,env(safe-area-inset-bottom))]',
      )}
    >
      <button className="flex min-w-0 items-center gap-2.5 rounded-lg text-left hover:opacity-80" onClick={trocarAlvo} title="Clique para trocar o que está estudando">
        {materia ? <Sigla materia={materia} cor={corDe(cores, materia)} /> : <span className="grid h-6 min-w-10 place-items-center rounded-md bg-muted text-muted-foreground"><Clock className="size-3.5" /></span>}
        <span className="min-w-0 max-[480px]:hidden">
          <span className="block text-[0.6rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">{rotulo}</span>
          <span className="block truncate text-[0.84rem] leading-tight font-semibold">{texto}</span>
        </span>
      </button>

      <div className="flex items-center gap-2 rounded-[14px] border bg-muted p-1.5">
        <div role="radiogroup" aria-label="Relógio" className="flex rounded-[9px] border bg-card p-0.5">
          {OPCOES.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={atual === o.id}
              disabled={travado && atual !== o.id}
              title={travado && atual !== o.id ? 'Termine ou zere o relógio atual para trocar' : o.dica}
              onClick={() => escolherRelogio(o.id)}
              className={cn('rounded-[7px] px-2.5 py-1 text-[0.7rem] font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50', atual === o.id && 'bg-accent text-primary')}
            >
              <span className="max-[480px]:hidden">{o.rotulo}</span>
              <span className="min-[481px]:hidden">{o.rotulo.slice(0, 4)}</span>
            </button>
          ))}
        </div>
        <span className="flex flex-col items-center px-1.5 leading-none">
          <span className={cn('font-mono text-[1.2rem] font-bold tabular-nums', rodando ? 'text-primary' : 'text-muted-foreground')} role="timer" aria-live="off">
            {ehPomo ? fmtMMSS(pomo.restaSeg) : fmtHHMMSS(livre.seg)}
          </span>
          {ehPomo && pomo.fase !== 'foco' && <span className="mt-0.5 text-[0.58rem] font-semibold text-muted-foreground uppercase">{NOMES_FASE[pomo.fase]}</span>}
        </span>
        <button
          className={cn('grid size-8 place-items-center rounded-[9px]', rodando ? 'border bg-card text-primary' : 'bg-primary text-primary-foreground shadow-[0_3px_10px_color-mix(in_oklab,var(--primary)_35%,transparent)]')}
          onClick={() => void (ehPomo ? iniciarOuPausar() : iniciarOuPausarLivre())}
          aria-label={rodando ? 'Pausar' : 'Iniciar'}
          title={rodando ? 'Pausar' : ehPomo ? 'Iniciar o foco' : livre.seg > 0 ? 'Retomar' : 'Iniciar'}
        >
          {rodando ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        {podeEncerrar && (
          <button
            className="grid size-8 place-items-center rounded-[9px] border bg-card text-muted-foreground hover:text-foreground"
            onClick={() => (ehPomo ? pomo.encerrar() : void encerrarLivre())}
            aria-label="Encerrar"
            title={ehPomo ? 'Encerrar o foco agora e somar o tempo estudado' : 'Parar e registrar o tempo, o assunto e as questões'}
          >
            <Square className="size-3.5 fill-current" />
          </button>
        )}
        {ehPomo ? (
          <Balao rotulo="Opções do Pomodoro" icone={<MoreHorizontal className="size-4" />}>
            {(fechar) => <OpcoesPomodoro fechar={fechar} />}
          </Balao>
        ) : (
          !livre.rodando && livre.seg > 0 && (
            <button className="grid size-8 place-items-center rounded-[9px] border bg-card text-muted-foreground hover:text-foreground" onClick={() => void zerarLivre()} aria-label="Zerar sem registrar" title="Zerar sem registrar">
              <RotateCcw className="size-3.5" />
            </button>
          )
        )}
      </div>

      <div className="flex items-center justify-end gap-4 text-xs text-muted-foreground max-[1100px]:gap-3 max-[900px]:hidden">
        <span className="flex items-center gap-1.5 whitespace-nowrap" title="Horas estudadas hoje">
          <Clock className="size-3.5" /> Hoje: <b className="font-semibold text-foreground">{fmtH(r?.hoje.horas ?? 0)}</b>
        </span>
        {semanaMeta > 0 && (
          <span className="flex items-center gap-1.5 whitespace-nowrap max-[1250px]:hidden" title="Horas da semana e a meta">
            <Target className="size-3.5" /> Semana: <b className="font-semibold text-foreground">{fmtH(semanaH)}</b> / {fmtH(semanaMeta)}
          </span>
        )}
        <button className="flex items-center gap-1.5 whitespace-nowrap hover:text-foreground" onClick={() => void abrirQuestoes()} title="Registrar questões">
          <CircleHelp className="size-3.5" /> Questões
        </button>
      </div>
    </div>
  )
}
