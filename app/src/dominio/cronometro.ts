// Regras do cronômetro livre (puras): conta para cima, sem fases. O estado com relógio fica em src/estado/cronometro.ts.

import { hoje, type DataISO } from '@/dominio/datas'
import { TOLERANCIA_RECARGA_SEG } from '@/dominio/pomodoro'

/** O que está sendo estudado no tempo livre (sem passo: o tempo vai direto para a matéria). */
export interface AlvoLivre {
  materia: string
  tipo: string
  assuntoId: string | null
}

export interface Cronometro {
  rodando: boolean
  /** Instante (ms) em que o relógio voltou a andar pela última vez; só vale com `rodando`. */
  inicioMs: number
  /** Segundos já contados antes do último `inicioMs`. */
  acumuladoSeg: number
  alvo: AlvoLivre | null
}

export const CRONOMETRO_ZERADO: Cronometro = { rodando: false, inicioMs: 0, acumuladoSeg: 0, alvo: null }

/** Segundos contados até `agora`. */
export function decorridoSeg(c: Cronometro, agora: number): number {
  return c.acumuladoSeg + (c.rodando ? Math.max(0, (agora - c.inicioMs) / 1000) : 0)
}

export function iniciar(c: Cronometro, agora: number): Cronometro {
  return c.rodando ? c : { ...c, rodando: true, inicioMs: agora }
}

export function pausar(c: Cronometro, agora: number): Cronometro {
  return c.rodando ? { ...c, rodando: false, inicioMs: 0, acumuladoSeg: decorridoSeg(c, agora) } : c
}

/** Volta a 00:00, mantendo a matéria escolhida para a próxima vez. */
export const zerar = (c: Cronometro): Cronometro => ({ ...CRONOMETRO_ZERADO, alvo: c.alvo })

/** Minutos inteiros (arredondados), para avisos. */
export const minutosDe = (seg: number): number => Math.round(seg / 60)

/**
 * "30 min 20 s", "45 min", "1 h 05 min 07 s". Para mostrar uma sessão: as do cronômetro livre são gravadas com os segundos
 * (minutos fracionados, ex.: 30 min 20 s = 30,333…); os totais continuam em horas e minutos.
 */
export function fmtDuracao(minutos: number): string {
  const s = Math.max(0, Math.round((minutos || 0) * 60))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const partes = [h ? `${h} h` : '', h ? `${String(m).padStart(2, '0')} min` : `${m} min`, seg ? `${String(seg).padStart(2, '0')} s` : '']
  return partes.filter(Boolean).join(' ')
}

/** "05:07" ou, passando de uma hora, "1:05:07". */
export function fmtHHMMSS(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** O que é guardado no navegador para o cronômetro sobreviver a recarregar ou fechar a página. */
export interface CronometroSalvo extends Cronometro {
  /** Último instante (ms) em que o app estava aberto (gravado a cada poucos segundos). */
  visto: number
}

export type RestauracaoLivre =
  | { tipo: 'nada' }
  | { tipo: 'estado'; estado: Cronometro }
  | {
      tipo: 'perguntar'
      /** Parado no ponto em que o app foi visto pela última vez. */
      estado: Cronometro
      minutosEstudados: number
      minutosFora: number
      /** Dia (fuso local) do último instante visto. */
      data: DataISO
    }

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** Lê e valida o texto guardado. Qualquer coisa estranha vira `null` (começa do zero). */
export function lerCronometroSalvo(texto: string | null): CronometroSalvo | null {
  if (!texto) return null
  try {
    const o = JSON.parse(texto) as Record<string, unknown>
    if (!o || typeof o.rodando !== 'boolean' || !num(o.inicioMs) || !num(o.acumuladoSeg) || !num(o.visto)) return null
    const a = o.alvo as Record<string, unknown> | null | undefined
    const alvo: AlvoLivre | null =
      a && typeof a.materia === 'string' && a.materia && typeof a.tipo === 'string'
        ? { materia: a.materia, tipo: a.tipo, assuntoId: typeof a.assuntoId === 'string' ? a.assuntoId : null }
        : null
    return { rodando: o.rodando, inicioMs: o.inicioMs, acumuladoSeg: Math.max(0, o.acumuladoSeg), alvo, visto: o.visto }
  } catch {
    return null
  }
}

/**
 * Decide como o cronômetro volta quando o app abre de novo.
 * - Estava parado: volta parado, com o mesmo tempo.
 * - Estava rodando e a ausência foi curta (recarregar a página): continua rodando.
 * - Estava rodando e o app ficou fechado mais tempo: pergunta, contando só até o último instante em que o app estava aberto.
 */
export function restaurarCronometro(salvo: CronometroSalvo | null, agora: number): RestauracaoLivre {
  if (!salvo) return { tipo: 'nada' }
  const { visto, ...c } = salvo
  if (!c.rodando) return c.acumuladoSeg > 0 || c.alvo ? { tipo: 'estado', estado: c } : { tipo: 'nada' }
  const foraSeg = Math.max(0, (agora - visto) / 1000)
  if (foraSeg <= TOLERANCIA_RECARGA_SEG) return { tipo: 'estado', estado: c }
  const parado = pausar(c, Math.max(c.inicioMs, visto))
  return {
    tipo: 'perguntar',
    estado: parado,
    minutosEstudados: minutosDe(parado.acumuladoSeg),
    minutosFora: Math.round(foraSeg / 60),
    data: hoje(new Date(visto)),
  }
}
