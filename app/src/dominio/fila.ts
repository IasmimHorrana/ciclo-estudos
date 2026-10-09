// Fila de estudo do dia: quais cartões aparecem, em que ordem, respeitando os limites diários por baralho.
// Puro: recebe os dados já lidos e devolve a fila. Quem lê/grava no banco é a camada de dados.

import { OPCOES_PADRAO, type EstadoCartao, type OpcoesAgendador } from '@/dominio/sm2'

export interface OpcoesBaralho extends OpcoesAgendador {
  novosPorDia: number
  revisoesPorDia: number
  /** Minutos: cartões em aprendizado que vencem em até isto já podem aparecer (se não houver nada mais). */
  antecipacaoMin: number
  /** Ao responder um cartão, esconde os outros da mesma nota até amanhã. */
  enterrarIrmaos: boolean
}

export const OPCOES_BARALHO_PADRAO: OpcoesBaralho = {
  ...OPCOES_PADRAO,
  novosPorDia: 20,
  revisoesPorDia: 200,
  antecipacaoMin: 20,
  enterrarIrmaos: true,
}

export interface BaralhoFila {
  id: string
  /** Nome completo com `::` entre os níveis: "Informática::Redes". */
  nome: string
  opcoes: OpcoesBaralho
}

export interface CartaoNaFila {
  id: string
  baralhoId: string
  notaId: string
  estado: EstadoCartao
}

/** Quanto já foi estudado hoje (por baralho, só o que foi feito direto nele). */
export interface UsoDoDia {
  novos: number
  revisoes: number
}

export interface RegistroDoDia {
  baralhoId: string
  /** Número do dia (`numeroDoDia`). */
  dia: number
  /** Estado do cartão ANTES da resposta. */
  estadoAntes: EstadoCartao['tipo']
}

/** Conta, por baralho, os cartões novos iniciados e as revisões feitas no dia. */
export function usoDoDia(logs: RegistroDoDia[], hoje: number): Map<string, UsoDoDia> {
  const m = new Map<string, UsoDoDia>()
  for (const l of logs) {
    if (l.dia !== hoje) continue
    const u = m.get(l.baralhoId) ?? { novos: 0, revisoes: 0 }
    if (l.estadoAntes === 'novo') u.novos++
    else if (l.estadoAntes === 'revisao') u.revisoes++
    m.set(l.baralhoId, u)
  }
  return m
}

/** O baralho `nome` está dentro de `raiz` (ou é ele mesmo)? */
export const dentroDe = (nome: string, raiz: string) => nome === raiz || nome.startsWith(raiz + '::')

export const nomePai = (nome: string): string | null => {
  const i = nome.lastIndexOf('::')
  return i < 0 ? null : nome.slice(0, i)
}

export interface Fila {
  aprendendo: CartaoNaFila[]
  revisao: CartaoNaFila[]
  novos: CartaoNaFila[]
  contagem: { novos: number; aprendendo: number; revisao: number }
}

export const filaVazia = (): Fila => ({ aprendendo: [], revisao: [], novos: [], contagem: { novos: 0, aprendendo: 0, revisao: 0 } })

const porId = (a: CartaoNaFila, b: CartaoNaFila) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * Monta a fila de `raizId` (e dos seus subbaralhos). `raizId = null` junta todos os baralhos.
 * O limite de um baralho vale para ele e para os filhos juntos (como no Anki): se "Informática" permite 20 novos
 * por dia, o total de "Informática" + "Informática::Redes" não passa de 20.
 */
export function montarFila(
  baralhos: BaralhoFila[],
  cartoes: CartaoNaFila[],
  raizId: string | null,
  uso: Map<string, UsoDoDia>,
  agora: number,
  hoje: number,
): Fila {
  const porIdBaralho = new Map(baralhos.map((b) => [b.id, b]))
  const porNome = new Map(baralhos.map((b) => [b.nome, b]))
  const raiz = raizId ? porIdBaralho.get(raizId) : null
  if (raizId && !raiz) return filaVazia()

  const noEscopo = (b: BaralhoFila) => !raiz || dentroDe(b.nome, raiz.nome)

  /** O baralho e os pais dele, de baixo para cima, sem sair da raiz escolhida. */
  const cadeia = (b: BaralhoFila): BaralhoFila[] => {
    const r: BaralhoFila[] = []
    let atual: BaralhoFila | undefined = b
    while (atual && noEscopo(atual)) {
      r.push(atual)
      const pai = nomePai(atual.nome)
      atual = pai ? porNome.get(pai) : undefined
    }
    return r
  }

  // quanto cada baralho ainda pode mostrar hoje (considerando o que já foi feito nele e nos filhos)
  const restoNovos = new Map<string, number>()
  const restoRevisoes = new Map<string, number>()
  for (const b of baralhos) {
    let n = 0
    let r = 0
    for (const o of baralhos) {
      if (!dentroDe(o.nome, b.nome)) continue
      n += uso.get(o.id)?.novos ?? 0
      r += uso.get(o.id)?.revisoes ?? 0
    }
    restoNovos.set(b.id, Math.max(0, b.opcoes.novosPorDia - n))
    restoRevisoes.set(b.id, Math.max(0, b.opcoes.revisoesPorDia - r))
  }

  const elegiveis = cartoes.filter((c) => {
    const b = porIdBaralho.get(c.baralhoId)
    return b && noEscopo(b) && !c.estado.suspenso && c.estado.enterradoAte <= hoje
  })

  const tira = (c: CartaoNaFila, resto: Map<string, number>): boolean => {
    const cad = cadeia(porIdBaralho.get(c.baralhoId) as BaralhoFila)
    if (cad.some((b) => (resto.get(b.id) ?? 0) <= 0)) return false
    for (const b of cad) resto.set(b.id, (resto.get(b.id) ?? 0) - 1)
    return true
  }

  const antecipacao = (c: CartaoNaFila) => (porIdBaralho.get(c.baralhoId)?.opcoes.antecipacaoMin ?? 20) * 60_000
  const aprendendo = elegiveis
    .filter((c) => (c.estado.tipo === 'aprendendo' || c.estado.tipo === 'reaprendendo') && c.estado.venceMs <= agora + antecipacao(c))
    .sort((a, b) => a.estado.venceMs - b.estado.venceMs || porId(a, b))

  const revisao = elegiveis
    .filter((c) => c.estado.tipo === 'revisao' && c.estado.venceDia <= hoje)
    .sort((a, b) => a.estado.venceDia - b.estado.venceDia || porId(a, b))
    .filter((c) => tira(c, restoRevisoes))

  const novos = elegiveis
    .filter((c) => c.estado.tipo === 'novo')
    .sort((a, b) => a.estado.ordem - b.estado.ordem || porId(a, b))
    .filter((c) => tira(c, restoNovos))

  return { aprendendo, revisao, novos, contagem: { novos: novos.length, aprendendo: aprendendo.length, revisao: revisao.length } }
}

export type Origem = 'aprendendo' | 'revisao' | 'novo' | 'antecipado'

/**
 * Próximo cartão: aprendizado já vencido → revisões → novos → aprendizado que ainda vai vencer
 * (dentro da antecipação). `null` quando acabou por hoje.
 */
export function proximoCartao(f: Fila, agora: number): { cartao: CartaoNaFila; origem: Origem } | null {
  const vencido = f.aprendendo.find((c) => c.estado.venceMs <= agora)
  if (vencido) return { cartao: vencido, origem: 'aprendendo' }
  const r = f.revisao[0]
  if (r) return { cartao: r, origem: 'revisao' }
  const n = f.novos[0]
  if (n) return { cartao: n, origem: 'novo' }
  const a = f.aprendendo[0]
  if (a) return { cartao: a, origem: 'antecipado' }
  return null
}

/** Esconde os irmãos (outros cartões da mesma nota) até amanhã. Devolve os ids a enterrar. */
export function irmaosParaEnterrar(cartoes: CartaoNaFila[], respondido: CartaoNaFila): string[] {
  return cartoes
    .filter((c) => c.notaId === respondido.notaId && c.id !== respondido.id && c.estado.tipo !== 'aprendendo' && c.estado.tipo !== 'reaprendendo')
    .map((c) => c.id)
}
