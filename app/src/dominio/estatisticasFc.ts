// Estatísticas dos flashcards: % de acertos, situação dos cartões e evolução por semana. Tudo puro.
// Acerto = qualquer botão menos "Errei" (como a "retenção" do Anki).

import { FAIXAS_PADRAO, nivelDe, pctDe, type Faixas, type Nivel } from '@/dominio/desempenho'
import { dentroDe } from '@/dominio/fila'
import type { Botao, TipoCartao } from '@/dominio/sm2'

/** Abaixo disso o nível fica "Poucos dados". */
export const MIN_RESPOSTAS = 10
/** A partir deste intervalo (em dias) o cartão é "maduro", como no Anki. */
export const DIAS_MADURO = 21

export type PeriodoFc = '7' | '30' | 'tudo'

/** O que importa de uma linha do histórico (`RegistroRevisao`). */
export interface Resposta {
  cartaoId: string
  baralhoId: string
  dia: number
  botao: Botao
  estadoAntes: TipoCartao
  tempoMs: number
}

export interface Acertos {
  respostas: number
  acertos: number
}

export const acertou = (botao: Botao) => botao >= 2

/** Primeiro dia do período (inclusive); `tudo` pega o histórico inteiro. */
export const inicioDoPeriodoFc = (p: PeriodoFc, hoje: number): number => (p === 'tudo' ? -Infinity : hoje - Number(p) + 1)

export const nivelFc = (a: Acertos, faixas: Faixas = FAIXAS_PADRAO): Nivel => nivelDe(a.respostas, a.acertos, faixas, MIN_RESPOSTAS)

const somar = (a: Acertos, r: Resposta) => {
  a.respostas++
  if (acertou(r.botao)) a.acertos++
}

export interface ResumoRespostas {
  total: Acertos
  /** Cartões novos, em aprendizado ou reaprendendo depois de um erro. */
  aprendizado: Acertos
  /** Revisões de cartões já aprendidos: é o número que mostra a memória de verdade. */
  revisao: Acertos
  /** Quantas vezes cada botão foi usado: [Errei, Difícil, Bom, Fácil]. */
  botoes: [number, number, number, number]
  /** Cartões diferentes respondidos. */
  cartoes: number
  tempoMs: number
  pct: number
  nivel: Nivel
}

/** Resumo das respostas a partir de `desdeDia` (inclusive). */
export function resumoRespostas(rs: readonly Resposta[], desdeDia = -Infinity, faixas: Faixas = FAIXAS_PADRAO): ResumoRespostas {
  const total = { respostas: 0, acertos: 0 }
  const aprendizado = { respostas: 0, acertos: 0 }
  const revisao = { respostas: 0, acertos: 0 }
  const botoes: [number, number, number, number] = [0, 0, 0, 0]
  const cartoes = new Set<string>()
  let tempoMs = 0
  for (const r of rs) {
    if (r.dia < desdeDia) continue
    somar(total, r)
    somar(r.estadoAntes === 'revisao' ? revisao : aprendizado, r)
    botoes[r.botao - 1]++
    cartoes.add(r.cartaoId)
    tempoMs += r.tempoMs
  }
  return { total, aprendizado, revisao, botoes, cartoes: cartoes.size, tempoMs, pct: pctDe(total.acertos, total.respostas), nivel: nivelFc(total, faixas) }
}

export interface SituacaoCartoes {
  novos: number
  /** Aprendendo ou reaprendendo. */
  aprendendo: number
  /** Em revisão com intervalo menor que `DIAS_MADURO`. */
  jovens: number
  maduros: number
  suspensos: number
}

/** Em que pé estão os cartões (suspensos contam à parte, seja qual for o tipo). */
export function situacaoCartoes(cartoes: readonly { tipo: TipoCartao; intervalo: number; suspenso: boolean }[]): SituacaoCartoes {
  const s: SituacaoCartoes = { novos: 0, aprendendo: 0, jovens: 0, maduros: 0, suspensos: 0 }
  for (const c of cartoes) {
    if (c.suspenso) s.suspensos++
    else if (c.tipo === 'novo') s.novos++
    else if (c.tipo === 'revisao' && c.intervalo >= DIAS_MADURO) s.maduros++
    else if (c.tipo === 'revisao') s.jovens++
    else s.aprendendo++
  }
  return s
}

export interface SemanaFc extends Acertos {
  /** Primeiro e último dia do bloco (números do dia). */
  inicio: number
  fim: number
  pct: number
}

/** Acertos em blocos de 7 dias terminando hoje, do mais antigo ao mais recente. */
export function acertosPorSemana(rs: readonly Resposta[], hoje: number, semanas = 10): SemanaFc[] {
  const blocos = Array.from({ length: semanas }, (_, i) => {
    const fim = hoje - (semanas - 1 - i) * 7
    return { inicio: fim - 6, fim, respostas: 0, acertos: 0, pct: 0 }
  })
  const primeiro = blocos[0]?.inicio ?? hoje
  for (const r of rs) {
    if (r.dia < primeiro || r.dia > hoje) continue
    const b = blocos[Math.floor((r.dia - primeiro) / 7)]
    if (b) somar(b, r)
  }
  for (const b of blocos) b.pct = pctDe(b.acertos, b.respostas)
  return blocos
}

export interface CartaoErrado {
  cartaoId: string
  erros: number
  respostas: number
}

/** Os `n` cartões com mais "Errei" (empate: o que foi mais respondido primeiro). Só entra quem errou ao menos uma vez. */
export function cartoesMaisErrados(rs: readonly Resposta[], n = 10, desdeDia = -Infinity): CartaoErrado[] {
  const m = new Map<string, CartaoErrado>()
  for (const r of rs) {
    if (r.dia < desdeDia) continue
    const c = m.get(r.cartaoId) ?? { cartaoId: r.cartaoId, erros: 0, respostas: 0 }
    c.respostas++
    if (!acertou(r.botao)) c.erros++
    m.set(r.cartaoId, c)
  }
  return [...m.values()]
    .filter((c) => c.erros > 0)
    .sort((a, b) => b.erros - a.erros || b.respostas - a.respostas || a.cartaoId.localeCompare(b.cartaoId))
    .slice(0, n)
}

/** Soma por baralho, já incluindo os subbaralhos (pelo nome: "A::B" conta em "A"). */
export function acertosNaArvore(baralhos: readonly { id: string; nome: string }[], porBaralho: ReadonlyMap<string, Acertos>): Map<string, Acertos> {
  const r = new Map<string, Acertos>()
  for (const b of baralhos) {
    const a = { respostas: 0, acertos: 0 }
    for (const f of baralhos) {
      if (!dentroDe(f.nome, b.nome)) continue
      const x = porBaralho.get(f.id)
      if (x) {
        a.respostas += x.respostas
        a.acertos += x.acertos
      }
    }
    r.set(b.id, a)
  }
  return r
}

/** Ids do baralho e de todos os subbaralhos dele (`null` = todos). */
export function idsDaArvore(baralhos: readonly { id: string; nome: string }[], raizId: string | null): string[] {
  const raiz = raizId === null ? null : baralhos.find((b) => b.id === raizId)
  if (raizId !== null && !raiz) return []
  return baralhos.filter((b) => !raiz || dentroDe(b.nome, raiz.nome)).map((b) => b.id)
}
