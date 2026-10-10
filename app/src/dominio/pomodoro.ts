// Regras do Pomodoro (puras, sem relógio nem tela): o estado do cronômetro fica em src/estado/pomodoro.ts.

export type Fase = 'foco' | 'pausa' | 'longa'

export interface ConfigPomodoro {
  foco: number // minutos
  pausa: number
  longa: number
  /** a cada quantos focos concluídos vem a pausa longa */
  ate: number
}

export const CONFIG_PADRAO: ConfigPomodoro = { foco: 25, pausa: 5, longa: 15, ate: 4 }

export const NOMES_FASE: Record<Fase, string> = {
  foco: 'Foco',
  pausa: 'Pausa',
  longa: 'Pausa longa',
}

export const duracaoSeg = (fase: Fase, cfg: ConfigPomodoro): number => cfg[fase] * 60

/** Qual é a fase seguinte e quantos focos já foram concluídos. */
export function proximaFase(fase: Fase, focosConcluidos: number, cfg: ConfigPomodoro): { fase: Fase; focosConcluidos: number } {
  if (fase !== 'foco') return { fase: 'foco', focosConcluidos }
  const total = focosConcluidos + 1
  return { fase: total % cfg.ate === 0 ? 'longa' : 'pausa', focosConcluidos: total }
}

/** "25:00" */
export function fmtMMSS(seg: number): string {
  const s = Math.max(0, Math.round(seg))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Minutos já estudados num foco interrompido (arredondados). */
export function minutosDecorridos(cfg: ConfigPomodoro, restaSeg: number): number {
  return Math.round((duracaoSeg('foco', cfg) - restaSeg) / 60)
}

/** O que está sendo estudado neste foco (escolhido ao clicar em Iniciar). `passoId` 0 = estudar sem registrar. */
export interface AlvoFoco {
  passoId: number
  tipo: string
  assuntoId: string | null
  /** Texto para mostrar no cartão, ex.: "3. Direito Civil · Teoria". */
  rotulo: string
}

/** O que é guardado no navegador para o cronômetro sobreviver a recarregar a página, fechar o navegador ou faltar luz. */
export interface PomodoroSalvo {
  fase: Fase
  rodando: boolean
  /** Instante (ms) em que a fase termina; só vale com `rodando`. */
  fimMs: number
  restaSeg: number
  focosConcluidos: number
  alvo: AlvoFoco | null
  /** Último instante (ms) em que o app estava aberto e o relógio andando (gravado a cada poucos segundos). */
  visto: number
}

export type EstadoRestaurado = Pick<PomodoroSalvo, 'fase' | 'rodando' | 'fimMs' | 'restaSeg' | 'focosConcluidos' | 'alvo'>

export type Restauracao =
  | { tipo: 'nada' }
  | { tipo: 'estado'; estado: EstadoRestaurado }
  | {
      tipo: 'perguntar'
      /** Estado parado no ponto em que o app foi visto pela última vez (para "continuar"). */
      estado: EstadoRestaurado
      minutosEstudados: number
      minutosFora: number
      focoCompleto: boolean
    }

/** Ausência menor que isto (recarregar a página) não incomoda: o relógio segue como se nada tivesse acontecido. */
export const TOLERANCIA_RECARGA_SEG = 20

const FASES: readonly string[] = ['foco', 'pausa', 'longa']
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Lê e valida o texto guardado. Qualquer coisa estranha vira `null` (começa do zero). */
export function lerPomodoroSalvo(texto: string | null): PomodoroSalvo | null {
  if (!texto) return null
  try {
    const o = JSON.parse(texto) as Record<string, unknown>
    if (!o || typeof o.fase !== 'string' || !FASES.includes(o.fase)) return null
    if (typeof o.rodando !== 'boolean' || !num(o.fimMs) || !num(o.restaSeg) || !num(o.focosConcluidos) || !num(o.visto)) return null
    const a = o.alvo as Record<string, unknown> | null | undefined
    const alvo: AlvoFoco | null =
      a && num(a.passoId) && typeof a.tipo === 'string' && typeof a.rotulo === 'string'
        ? { passoId: a.passoId, tipo: a.tipo, assuntoId: typeof a.assuntoId === 'string' ? a.assuntoId : null, rotulo: a.rotulo }
        : null
    return { fase: o.fase as Fase, rodando: o.rodando, fimMs: o.fimMs, restaSeg: Math.max(0, o.restaSeg), focosConcluidos: Math.max(0, Math.trunc(o.focosConcluidos)), alvo, visto: o.visto }
  } catch {
    return null
  }
}

/**
 * Decide como o cronômetro volta quando o app abre de novo.
 * - Estava parado: volta parado, do mesmo ponto.
 * - Estava rodando e a ausência foi curta (recarregar a página): continua rodando, sem perder um segundo.
 * - Foco rodando e o app ficou fechado por mais tempo (fechou o navegador, faltou luz): pergunta o que fazer,
 *   porque não há como saber se você continuou estudando. O tempo estudado conta até o último instante em que o app estava aberto.
 * - Pausa rodando: segue a contagem real; se já acabou, vem o próximo foco, parado.
 */
export function restaurarPomodoro(salvo: PomodoroSalvo | null, agora: number, cfg: ConfigPomodoro): Restauracao {
  if (!salvo) return { tipo: 'nada' }
  const cheio = duracaoSeg(salvo.fase, cfg)
  const base = { fase: salvo.fase, focosConcluidos: salvo.focosConcluidos, alvo: salvo.alvo }

  if (!salvo.rodando) {
    return { tipo: 'estado', estado: { ...base, rodando: false, fimMs: 0, restaSeg: Math.min(salvo.restaSeg, cheio) } }
  }

  const foraSeg = Math.max(0, (agora - salvo.visto) / 1000)

  if (salvo.fase !== 'foco') {
    if (agora < salvo.fimMs) {
      return { tipo: 'estado', estado: { ...base, rodando: true, fimMs: salvo.fimMs, restaSeg: Math.ceil((salvo.fimMs - agora) / 1000) } }
    }
    const prox = proximaFase(salvo.fase, salvo.focosConcluidos, cfg)
    return { tipo: 'estado', estado: { fase: prox.fase, focosConcluidos: prox.focosConcluidos, alvo: null, rodando: false, fimMs: 0, restaSeg: duracaoSeg(prox.fase, cfg) } }
  }

  if (agora < salvo.fimMs && foraSeg <= TOLERANCIA_RECARGA_SEG) {
    return { tipo: 'estado', estado: { ...base, rodando: true, fimMs: salvo.fimMs, restaSeg: Math.ceil((salvo.fimMs - agora) / 1000) } }
  }

  const restaVisto = Math.min(cheio, Math.max(0, Math.ceil((salvo.fimMs - salvo.visto) / 1000)))
  return {
    tipo: 'perguntar',
    estado: { ...base, rodando: false, fimMs: 0, restaSeg: restaVisto },
    minutosEstudados: minutosDecorridos(cfg, restaVisto),
    minutosFora: Math.round(foraSeg / 60),
    focoCompleto: restaVisto === 0,
  }
}
