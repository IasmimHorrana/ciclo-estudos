// Agendador de repetição espaçada SM-2, "como o Anki usa" (agendador v2).
// Tudo aqui é puro: recebe o estado do cartão, as opções e o relógio, e devolve o novo estado.
// Valores finos (variação aleatória, atraso) variam entre versões do Anki: reproduzimos o comportamento
// sem prometer igualdade dia a dia com um Anki específico.

export type Botao = 1 | 2 | 3 | 4 // Errei, Difícil, Bom, Fácil
export type TipoCartao = 'novo' | 'aprendendo' | 'revisao' | 'reaprendendo'

export interface EstadoCartao {
  tipo: TipoCartao
  /** Posição no baralho entre os novos (menor aparece primeiro). */
  ordem: number
  /** Índice do passo atual (só em aprendendo/reaprendendo). */
  passo: number
  /** Intervalo em dias (revisão; em reaprendendo é o intervalo que vale depois de graduar). */
  intervalo: number
  /** Fator de facilidade: 2.5 = 250%. */
  facilidade: number
  lapsos: number
  repeticoes: number
  /** Aprendendo/reaprendendo: quando vence, em ms. */
  venceMs: number
  /** Revisão: dia em que vence (número do dia, ver `numeroDoDia`). */
  venceDia: number
  suspenso: boolean
  /** Enterrado até o dia (número do dia); 0 = não. */
  enterradoAte: number
}

export interface OpcoesAgendador {
  /** Passos de aprendizado, em minutos. */
  passos: number[]
  /** Passos de reaprendizado (depois de errar uma revisão), em minutos. */
  passosReaprender: number[]
  /** Intervalo ao graduar com "Bom", em dias. */
  intervaloGraduacao: number
  /** Intervalo ao graduar com "Fácil", em dias. */
  intervaloFacil: number
  facilidadeInicial: number
  /** Multiplicador extra do Fácil na revisão. */
  bonusFacil: number
  /** Multiplicador do Difícil na revisão. */
  intervaloDificil: number
  /** Multiplicador geral de intervalos. */
  modificadorIntervalo: number
  /** Parte do intervalo que se mantém depois de um lapso (0 = recomeça em `intervaloMinimo`). */
  novoIntervalo: number
  intervaloMinimo: number
  intervaloMaximo: number
  limiteSanguessuga: number
}

export const OPCOES_PADRAO: OpcoesAgendador = {
  passos: [1, 10],
  passosReaprender: [10],
  intervaloGraduacao: 1,
  intervaloFacil: 4,
  facilidadeInicial: 2.5,
  bonusFacil: 1.3,
  intervaloDificil: 1.2,
  modificadorIntervalo: 1,
  novoIntervalo: 0,
  intervaloMinimo: 1,
  intervaloMaximo: 36500,
  limiteSanguessuga: 8,
}

export const FACILIDADE_MINIMA = 1.3
const MIN = 60_000
const DIA_MS = 86_400_000

const arred = (x: number) => Math.round(x * 1000) / 1000

export function novoCartao(ordem: number, opcoes: OpcoesAgendador = OPCOES_PADRAO): EstadoCartao {
  return {
    tipo: 'novo', ordem, passo: 0, intervalo: 0, facilidade: opcoes.facilidadeInicial, lapsos: 0, repeticoes: 0,
    venceMs: 0, venceDia: 0, suspenso: false, enterradoAte: 0,
  }
}

/**
 * Número do dia de estudo. O dia vira às `virada` horas (padrão 4 da manhã), como no Anki:
 * estudar à 1h da madrugada ainda conta como "ontem". Dias são contados no fuso local.
 */
export function numeroDoDia(agoraMs: number, virada = 4): number {
  const d = new Date(agoraMs - virada * 3_600_000)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA_MS)
}

/** Variação aleatória do intervalo (só a partir de 3 dias), para os cartões não vencerem todos juntos. */
export function intervaloComVariacao(ivl: number, rand: () => number): number {
  if (ivl < 3) return ivl
  let v: number
  if (ivl < 7) v = Math.floor(ivl * 0.25)
  else if (ivl < 30) v = Math.max(2, Math.floor(ivl * 0.15))
  else v = Math.max(4, Math.floor(ivl * 0.05))
  v = Math.max(v, 1)
  const min = ivl - v
  return min + Math.floor(rand() * (2 * v + 1))
}

/** Aplica modificador, variação, mínimo (anterior + 1) e máximo. */
function restringe(ivl: number, o: OpcoesAgendador, anterior: number, rand: (() => number) | null): number {
  let r = Math.floor(ivl * o.modificadorIntervalo)
  if (rand) r = intervaloComVariacao(r, rand)
  r = Math.max(r, anterior + 1, 1)
  return Math.min(r, o.intervaloMaximo)
}

/** Tipo de registro no histórico (como no Anki): 0 aprendizado, 1 revisão, 2 reaprendizado. */
export type TipoLog = 0 | 1 | 2

export interface RegistroDeResposta {
  botao: Botao
  tipoLog: TipoLog
  estadoAntes: TipoCartao
  /** Intervalo antes da resposta: dias (>0) ou segundos negativos quando era aprendizado. */
  intervaloAntes: number
  /** Intervalo depois: dias (>0) ou segundos negativos quando ficou em aprendizado. */
  intervaloDepois: number
  facilidade: number
  /** O cartão virou sanguessuga com esta resposta (deve ser marcado e suspenso). */
  sanguessuga: boolean
}

export interface Resposta {
  cartao: EstadoCartao
  log: RegistroDeResposta
}

export function atrasoEmDias(c: EstadoCartao, hoje: number): number {
  return Math.max(0, hoje - c.venceDia)
}

const passoMs = (m: number) => Math.round(m * MIN)

/** Atraso do botão Difícil no aprendizado: média entre este passo e o próximo (ou ×1,5 se for o último). */
function atrasoDificil(passos: number[], idx: number): number {
  const d1 = passos[idx] ?? passos[passos.length - 1] ?? 1
  const d2 = idx + 1 < passos.length ? (passos[idx + 1] as number) : d1 * 2
  return Math.floor((d1 + Math.max(d1, d2)) / 2)
}

function eSanguessuga(lapsos: number, limite: number): boolean {
  if (limite <= 0 || lapsos < limite) return false
  return (lapsos - limite) % Math.max(Math.floor(limite / 2), 1) === 0
}

/**
 * Responde ao cartão. `agora` em ms; `hoje` é `numeroDoDia(agora)`.
 * `rand` é a fonte de aleatoriedade da variação; passe `null` para não variar (rótulos e testes).
 */
export function responder(
  c: EstadoCartao,
  botao: Botao,
  o: OpcoesAgendador,
  agora: number,
  hoje: number,
  rand: (() => number) | null = Math.random,
): Resposta {
  const antes = c.tipo
  const intervaloAntes = c.tipo === 'revisao' ? c.intervalo : c.tipo === 'novo' ? 0 : c.tipo === 'aprendendo' ? -1 : c.intervalo
  const n: EstadoCartao = { ...c, repeticoes: c.repeticoes + 1, enterradoAte: 0 }
  let tipoLog: TipoLog
  let sanguessuga = false

  if (c.tipo === 'revisao') {
    tipoLog = 1
    if (botao === 1) sanguessuga = lapso(n, o, agora, hoje)
    else revisao(n, botao, o, hoje, atrasoEmDias(c, hoje), rand)
  } else {
    tipoLog = c.tipo === 'reaprendendo' ? 2 : 0
    aprendizado(n, botao, o, agora, hoje)
  }

  const depois = n.tipo === 'revisao' ? n.intervalo : -Math.round(Math.max(0, n.venceMs - agora) / 1000)
  return {
    cartao: n,
    log: { botao, tipoLog, estadoAntes: antes, intervaloAntes, intervaloDepois: depois, facilidade: n.facilidade, sanguessuga },
  }
}

function graduar(n: EstadoCartao, o: OpcoesAgendador, hoje: number, facil: boolean) {
  if (n.tipo === 'reaprendendo') {
    // volta a ser revisão com o intervalo reduzido no lapso (+1 dia se foi "Fácil")
    n.intervalo = Math.min(n.intervalo + (facil ? 1 : 0), o.intervaloMaximo)
  } else {
    n.intervalo = Math.min(facil ? o.intervaloFacil : o.intervaloGraduacao, o.intervaloMaximo)
    n.facilidade = o.facilidadeInicial
  }
  n.tipo = 'revisao'
  n.passo = 0
  n.venceDia = hoje + n.intervalo
  n.venceMs = 0
}

function aprendizado(n: EstadoCartao, botao: Botao, o: OpcoesAgendador, agora: number, hoje: number) {
  const reaprende = n.tipo === 'reaprendendo'
  const passos = reaprende ? o.passosReaprender : o.passos
  if (n.tipo === 'novo') {
    n.tipo = 'aprendendo'
    n.passo = 0
  }
  if (botao === 4) return graduar(n, o, hoje, true)
  if (botao === 1) {
    n.passo = 0
  } else if (botao === 3) {
    if (n.passo + 1 >= passos.length) return graduar(n, o, hoje, false) // também cobre "sem passos"
    n.passo += 1
  }
  // Difícil (2) repete o passo; Errei (1) volta ao primeiro; Bom (3) avançou acima
  const minutos = botao === 2 ? atrasoDificil(passos, n.passo) : (passos[n.passo] ?? 1)
  n.venceMs = agora + passoMs(minutos)
}

/** Errou uma revisão. Devolve `true` se virou sanguessuga. */
function lapso(n: EstadoCartao, o: OpcoesAgendador, agora: number, hoje: number): boolean {
  n.lapsos += 1
  n.facilidade = arred(Math.max(FACILIDADE_MINIMA, n.facilidade - 0.2))
  n.intervalo = Math.max(o.intervaloMinimo, Math.floor(n.intervalo * o.novoIntervalo), 1)
  const leech = eSanguessuga(n.lapsos, o.limiteSanguessuga)
  if (leech) n.suspenso = true
  if (o.passosReaprender.length) {
    n.tipo = 'reaprendendo'
    n.passo = 0
    n.venceMs = agora + passoMs(o.passosReaprender[0] as number)
  } else {
    n.venceDia = hoje + n.intervalo
  }
  return leech
}

/** Os três intervalos possíveis de uma revisão (Difícil, Bom, Fácil), em dias, garantindo difícil < bom < fácil. */
export function intervalosDeRevisao(
  c: EstadoCartao,
  o: OpcoesAgendador,
  atraso: number,
  rand: (() => number) | null,
): { dificil: number; bom: number; facil: number } {
  const ivl = c.intervalo
  const dificil = restringe((ivl + Math.floor(atraso / 4)) * o.intervaloDificil, o, ivl, null)
  const bom = restringe((ivl + Math.floor(atraso / 2)) * c.facilidade, o, dificil, rand)
  const facil = restringe((ivl + atraso) * c.facilidade * o.bonusFacil, o, bom, rand)
  return { dificil, bom, facil }
}

function revisao(n: EstadoCartao, botao: Exclude<Botao, 1>, o: OpcoesAgendador, hoje: number, atraso: number, rand: (() => number) | null) {
  const r = intervalosDeRevisao(n, o, atraso, rand)
  if (botao === 2) {
    n.facilidade = arred(Math.max(FACILIDADE_MINIMA, n.facilidade - 0.15))
    n.intervalo = r.dificil
  } else if (botao === 3) {
    n.intervalo = r.bom
  } else {
    n.facilidade = arred(n.facilidade + 0.15)
    n.intervalo = r.facil
  }
  n.venceDia = hoje + n.intervalo
}

// ---------------- rótulos dos botões ----------------

export interface PrevisaoBotao {
  botao: Botao
  /** Quanto falta para ver de novo, em ms (0 = hoje, sem espera). */
  ms: number
  texto: string
}

/** "10 min", "1 d", "2,5 meses"... como o Anki mostra acima dos botões. */
export function formatarIntervalo(ms: number): string {
  const seg = ms / 1000
  if (seg < 60) return '<1 min'
  const min = seg / 60
  if (min < 60) return `${Math.round(min)} min`
  const h = min / 60
  if (h < 24) return `${fmt1(h)} h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)} d`
  if (d < 365) return `${fmt1(d / 30)} ${d / 30 >= 1.95 ? 'meses' : 'mês'}`
  return `${fmt1(d / 365)} ${d / 365 >= 1.95 ? 'anos' : 'ano'}`
}
const fmt1 = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',')

/** O que cada botão vai fazer, sem variação aleatória (o rótulo bate com o resultado sem variação). */
export function previsaoDeBotoes(c: EstadoCartao, o: OpcoesAgendador, agora: number, hoje: number): PrevisaoBotao[] {
  return ([1, 2, 3, 4] as Botao[]).map((botao) => {
    const r = responder(c, botao, o, agora, hoje, null).cartao
    const ms = r.tipo === 'revisao' ? Math.max(0, r.intervalo) * DIA_MS : Math.max(0, r.venceMs - agora)
    return { botao, ms, texto: formatarIntervalo(ms) }
  })
}
