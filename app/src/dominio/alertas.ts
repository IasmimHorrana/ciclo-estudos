// Alertas de reforço do Edital: assuntos que pedem atenção (acerto baixo, revisão atrasada, parados há muito tempo,
// prioridade alta sem estudo). Cada assunto entra no máximo uma vez, pelo motivo mais grave. Puro.

import { addDias, type DataISO } from '@/dominio/datas'
import { FAIXAS_PADRAO, MIN_QUESTOES, nivelDe, pctDe, type Faixas } from '@/dominio/desempenho'
import type { LinhaEdital } from '@/dominio/edital'
import { diasDeAtraso } from '@/dominio/revisaoAssuntos'

export type MotivoAlerta = 'revisao' | 'acerto' | 'urgente' | 'parado'

export interface Alerta {
  assuntoId: string
  nome: string
  materia: string
  motivo: MotivoAlerta
  /** Explicação curta para a tela ("Acerto de 45% em 20 questões"). */
  texto: string
}

/** Do mais grave para o menos grave. */
const GRAVIDADE: Record<MotivoAlerta, number> = { revisao: 4, acerto: 3, urgente: 2, parado: 1 }

export interface EntradaAlertas {
  /** Linhas do edital (os tópicos são ignorados: os alertas são dos assuntos de verdade). */
  linhas: readonly { linha: LinhaEdital; materia: string }[]
  questoes: readonly { assuntoId: string | null; data: DataISO }[]
  sessoes: readonly { assuntoId: string | null; data: DataISO }[]
  hoje: DataISO
  /** Maior prioridade do edital (a "alta" é a partir de 66% dela, como os pontos da lista). */
  maxPrioridade: number
  faixas?: Faixas
  /** Estudado e sem questões, tempo nem revisão há esta quantidade de dias. */
  diasParado?: number
  limite?: number
}

const dias = (de: DataISO, ate: DataISO) => Math.round((Date.parse(`${ate}T12:00:00`) - Date.parse(`${de}T12:00:00`)) / 86_400_000)

/** Os alertas mais graves (até `limite`) e quantos havia ao todo. */
export function alertasDeReforco(e: EntradaAlertas): { alertas: Alerta[]; total: number } {
  const faixas = e.faixas ?? FAIXAS_PADRAO
  const diasParado = e.diasParado ?? 30
  const ultima = new Map<string, DataISO>()
  for (const x of [...e.questoes, ...e.sessoes]) {
    if (x.assuntoId && x.data > (ultima.get(x.assuntoId) ?? '')) ultima.set(x.assuntoId, x.data)
  }

  const achados: (Alerta & { prioridade: number })[] = []
  for (const { linha: l, materia } of e.linhas) {
    if (l.temFilhos) continue
    const base = { assuntoId: l.id, nome: l.nome, materia, prioridade: l.prioridade }
    if (l.revisao === 'atrasada') {
      const n = diasDeAtraso(l.revisoes, e.hoje)
      achados.push({ ...base, motivo: 'revisao', texto: `Revisão atrasada há ${n} dia${n === 1 ? '' : 's'}` })
    } else if (l.total >= MIN_QUESTOES && nivelDe(l.total, l.certas, faixas) === 'fraco') {
      achados.push({ ...base, motivo: 'acerto', texto: `Acerto de ${pctDe(l.certas, l.total)}% em ${l.total} questões` })
    } else if (!l.estudado && !l.semDados && l.horasFeitas === 0 && l.prioridade >= 0.66 * Math.max(1, e.maxPrioridade)) {
      achados.push({ ...base, motivo: 'urgente', texto: 'Prioridade alta e ainda sem estudo' })
    } else if (l.estudado && (l.revisao === 'nenhuma' || l.revisao === 'concluida')) {
      const feitas = l.revisoes.map((r) => r.feitaEm).filter((d): d is DataISO => d !== null)
      const desde = [ultima.get(l.id), ...feitas].filter((d): d is DataISO => !!d).sort().at(-1)
      if (desde && desde <= addDias(e.hoje, -diasParado)) {
        achados.push({ ...base, motivo: 'parado', texto: `Sem questões, tempo ou revisão há ${dias(desde, e.hoje)} dias` })
      }
    }
  }
  achados.sort((a, b) => GRAVIDADE[b.motivo] - GRAVIDADE[a.motivo] || b.prioridade - a.prioridade || a.nome.localeCompare(b.nome, 'pt-BR'))
  return { alertas: achados.slice(0, e.limite ?? 8).map(({ prioridade: _p, ...a }) => a), total: achados.length }
}
