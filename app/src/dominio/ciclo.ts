// Regras do ciclo de estudos (portadas do app em HTML): distribuição de passos, geração do ciclo,
// agenda pelos dias da semana, resumo e fechamento. Tudo puro: recebe os dados e devolve cópias novas.

import type { ConfigCiclo, ModeloConfig, Semana } from '@/dados/esquemas'
import { addDias, hoje as hojeDe, segundaDe, type DataISO } from '@/dominio/datas'

export type Passo = Semana['passos'][number]
export type MateriaCfg = ConfigCiclo['mats'][number]

export const MATERIAS_PADRAO = [
  'Língua Portuguesa', 'Direito Constitucional', 'Direito Administrativo', 'Direito Tributário',
  'Contabilidade Geral', 'Estatística', 'Noções de Igualdade Racial', 'Informática',
  'Gestão Organizacional', 'Raciocínio Lógico',
] as const

/** Cores por matéria: tons pastel, legíveis como preenchimento de gráfico. */
export const PALETA = [
  '#8fb0f2', '#f08e7e', '#7fcf8c', '#c49af0', '#f4cd5f', '#5ec9c0', '#f08fb8', '#a8d65a', '#f4a35f', '#9aa4f2',
  '#6fb7a0', '#d9b27a', '#b58ae0', '#e87d7d', '#6cb8e6', '#8fcf6a', '#e8946a', '#e07ab0', '#9aa8b5', '#c4dc6a',
] as const

export const round2 = (x: number) => Math.round(x * 100) / 100
export const soma = <T>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + f(x), 0)

/** 1,5 → "1h30"; 0,25 → "15min". */
export function fmtH(h: number): string {
  const m = Math.round((h || 0) * 60)
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------- configuração

export const configPadrao = (): ConfigCiclo => ({
  horas: 20, duracao: 1, passos: 20, modo: 'Livre', mats: [], custom: [], ocultas: [],
  dias: [true, true, true, true, true, true, false], porDia: null,
})

/** Nº de passos = meta semanal (h) ÷ duração do passo. */
export const passosDe = (c: Pick<ConfigCiclo, 'horas' | 'duracao'>) => Math.max(1, Math.round(c.horas / c.duracao))

/** Garante valores válidos e mantém as repetições dentro do limite de passos. */
export function normalizarConfig(c: ConfigCiclo): ConfigCiclo {
  const duracao = c.duracao > 0 ? c.duracao : 1
  const horas = c.horas > 0 ? c.horas : 20
  const passos = passosDe({ horas, duracao })
  return {
    ...c, horas, duracao, passos,
    mats: c.mats.map((m) => ({
      nome: m.nome,
      rep: Math.min(Math.max(Math.trunc(m.rep) || 0, 0), passos),
      peso: Math.min(Math.max(Math.trunc(m.peso) || 3, 1), 5),
    })),
    dias: c.dias.length === 7 ? c.dias : configPadrao().dias,
  }
}

/** Matérias que aparecem para escolher: as padrão + as próprias, menos as tiradas da lista. */
export const todasMaterias = (c: Pick<ConfigCiclo, 'custom' | 'ocultas'>): string[] =>
  [...MATERIAS_PADRAO, ...c.custom].filter((m) => !c.ocultas.includes(m))

/** Foto da montagem atual, para guardar em modelos e na semana gerada. */
export const snapshotConfig = (c: ConfigCiclo): ModeloConfig => ({
  modo: c.modo, horas: c.horas, duracao: c.duracao, dias: [...c.dias], porDia: c.porDia, mats: c.mats.map((m) => ({ ...m })),
})

/** Carrega uma montagem salva (modelo ou semana anterior) no formulário, sem gerar a semana. */
export function aplicarSnapshot(c: ConfigCiclo, m: ModeloConfig): ConfigCiclo {
  const novo = normalizarConfig({ ...c, modo: m.modo, horas: m.horas, duracao: m.duracao, dias: [...m.dias], porDia: m.porDia, mats: m.mats.map((x) => ({ ...x })) })
  const conhecidas = new Set(todasMaterias(novo).map((x) => x.toLowerCase()))
  const custom = [...novo.custom]
  for (const x of novo.mats) {
    if (!conhecidas.has(x.nome.toLowerCase())) {
      custom.push(x.nome)
      conhecidas.add(x.nome.toLowerCase())
    }
  }
  return { ...novo, custom }
}

// ---------------------------------------------------------------- distribuição e geração

/** Divide `horasTotais` passos entre as matérias, proporcional ao peso (mínimo 1 cada). */
export function calcularDistribuicao(materias: { nome: string; peso: number }[], totalPeso: number, horasTotais: number) {
  if (totalPeso === 0 || horasTotais === 0) return []
  const dist = materias.map((m) => {
    const reais = horasTotais * (m.peso / totalPeso)
    const arred = Math.round(reais)
    const final = arred > 0 ? arred : 1
    return { nome: m.nome, peso: m.peso, horas: final, erro: reais - final }
  })
  let diff = horasTotais - soma(dist, (d) => d.horas)
  while (diff !== 0) {
    if (diff > 0) {
      dist.sort((a, b) => a.erro - b.erro)
      const a = dist[0] as (typeof dist)[number]
      a.horas++
      a.erro -= 1
      diff--
    } else {
      dist.sort((a, b) => b.erro - a.erro)
      const alvo = dist.find((d) => d.horas > 1)
      if (!alvo) break
      alvo.horas--
      alvo.erro += 1
      diff++
    }
  }
  return dist
}

/** Intercala as matérias para que a mesma não apareça em sequência, respeitando as repetições. */
export function gerarCicloEspacado(materias: { nome: string; peso: number }[], totalSlots: number): string[] {
  const mats = materias.map((m) => ({ nome: m.nome, restante: m.peso }))
  const ciclo: string[] = []
  let ultimo = -1
  let primeira = ''
  while (ciclo.length < totalSlots) {
    let melhor = -1
    let maior = -Infinity
    const ultimoSlot = ciclo.length === totalSlots - 1
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i] as (typeof mats)[number]
      if (m.restante <= 0) continue
      let pr = m.restante * 1000 + (i === ultimo ? 0 : 1)
      if (ultimoSlot && primeira && m.nome === primeira) pr -= 20000
      if (pr > maior) {
        maior = pr
        melhor = i
      }
    }
    if (melhor === -1) break
    const m = mats[melhor] as (typeof mats)[number]
    if (ciclo.length === 0) primeira = m.nome
    ciclo.push(m.nome)
    m.restante--
    ultimo = melhor
  }
  return ciclo
}

/** Quantos passos cada matéria terá (prévia da tela Montar). No modo Livre é o que ela digitou. */
export function previaPassos(c: ConfigCiclo): Record<string, number> {
  const passos = passosDe(c)
  const prev: Record<string, number> = {}
  if (c.modo === 'Livre') {
    for (const m of c.mats) prev[m.nome] = m.rep
    return prev
  }
  const total = soma(c.mats, (m) => m.peso)
  if (total && c.mats.length <= passos) {
    for (const d of calcularDistribuicao(c.mats.map((m) => ({ nome: m.nome, peso: m.peso })), total, passos)) prev[d.nome] = d.horas
  }
  return prev
}

export type Validacao = { ok: true } | { ok: false; erro: string }

/** Confere se dá para gerar o ciclo (mesmas mensagens do app em HTML). */
export function validarGerar(c: ConfigCiclo): Validacao {
  const livre = c.modo === 'Livre'
  const passos = passosDe(c)
  if (!c.mats.length) return { ok: false, erro: 'Adicione ao menos uma matéria ao ciclo.' }
  const mats = c.mats.map((m) => ({ nome: m.nome, peso: livre ? m.rep : m.peso })).filter((m) => m.peso > 0)
  const total = soma(mats, (m) => m.peso)
  if (!total) return { ok: false, erro: livre ? 'Defina as repetições de ao menos uma matéria.' : 'Defina o peso de ao menos uma matéria.' }
  if (livre && total !== passos) return { ok: false, erro: `A soma das repetições (${total}) deve ser igual a ${passos} passos.` }
  if (!livre && mats.length > passos) return { ok: false, erro: `São ${mats.length} matérias para ${passos} passos. Aumente a meta de horas ou tire matérias.` }
  return { ok: true }
}

// ---------------------------------------------------------------- agenda (calendário)

/** Dias de estudo marcados que ainda não passaram (de hoje em diante) nesta semana. */
export function diasDisponiveis(seg: DataISO, dias: boolean[], hojeISO: DataISO): DataISO[] {
  const out: DataISO[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDias(seg, i)
    if (dias[i] && d >= hojeISO) out.push(d)
  }
  return out
}

/** Semana alvo: a atual, se ainda houver dia de estudo de hoje em diante; senão a próxima. */
export function semanaAlvo(hojeISO: DataISO, dias: boolean[]): DataISO {
  const seg = segundaDe(hojeISO)
  return diasDisponiveis(seg, dias, hojeISO).length ? seg : addDias(seg, 7)
}

export const porDiaEf = (n: number, nDias: number, porDia: number | null) =>
  porDia && porDia > 0 ? porDia : Math.max(1, Math.ceil(n / Math.max(1, nDias)))

/** Atribui o dia a cada passo, em ordem, a partir de hoje; o que não couber fica sem dia (null). */
export function agendar(passos: Passo[], seg: DataISO, c: Pick<ConfigCiclo, 'dias' | 'porDia'>, hojeISO: DataISO): Passo[] {
  const dias = diasDisponiveis(seg, c.dias, hojeISO)
  const cap = porDiaEf(passos.length, dias.length, c.porDia)
  return passos.map((p, i) => ({ ...p, dia: dias[Math.floor(i / cap)] ?? null }))
}

/** Texto de apoio abaixo dos dias de estudo na tela Montar. */
export function previaAgenda(c: ConfigCiclo, hojeISO: DataISO): string {
  const seg = semanaAlvo(hojeISO, c.dias)
  const dias = diasDisponiveis(seg, c.dias, hojeISO)
  const n = passosDe(c)
  const cap = porDiaEf(n, dias.length, c.porDia)
  const cabem = cap * dias.length
  const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  let t = `Semana ${fmt(seg)} → ${fmt(addDias(seg, 6))}${seg > segundaDe(hojeISO) ? ' (próxima, pois não há mais dia de estudo nesta)' : ''} · ${dias.length} dia(s) de estudo disponíveis · ${cap} passo(s) por dia.`
  if (cabem < n) t += ` ⚠️ Só cabem ${cabem} dos ${n} passos; ${n - cabem} ficarão sem dia.`
  return t
}

// ---------------------------------------------------------------- semana

/** Monta a semana a partir da configuração. Chame `validarGerar` antes. */
export function construirSemana(c: ConfigCiclo, hojeISO: DataISO, agora: number): Semana {
  const livre = c.modo === 'Livre'
  const passos = passosDe(c)
  const mats = c.mats.map((m) => ({ nome: m.nome, peso: livre ? m.rep : m.peso })).filter((m) => m.peso > 0)
  const total = soma(mats, (m) => m.peso)
  const lista = livre
    ? gerarCicloEspacado(mats, total)
    : gerarCicloEspacado(calcularDistribuicao(mats, total, passos).map((d) => ({ nome: d.nome, peso: d.horas })), passos)
  const seg = semanaAlvo(hojeISO, c.dias)
  const base: Passo[] = lista.map((nome, i) => ({ id: i + 1, materia: nome, dia: null, horasPlanejadas: c.duracao, horasFeitas: 0, feito: false, nota: '' }))
  return {
    id: agora, inicio: hojeISO, seg, dom: addDias(seg, 6), meta: null, pomodoros: 0, modelo: snapshotConfig(c),
    passos: agendar(base, seg, c, hojeISO),
  }
}

export const metaEf = (s: Semana) => (s.meta != null ? s.meta : round2(soma(s.passos, (p) => p.horasPlanejadas)))
export const horasFeitasDe = (s: Semana) => round2(soma(s.passos, (p) => p.horasFeitas))
export const temProgresso = (s: Semana | null) => !!s && s.passos.some((p) => p.feito || p.horasFeitas > 0)

/** Marca/desmarca um passo. Ao concluir sem horas lançadas, lança as horas planejadas. */
export function alternarPasso(s: Semana, id: number, feito: boolean): Semana {
  return { ...s, passos: s.passos.map((p) => (p.id !== id ? p : { ...p, feito, horasFeitas: feito && p.horasFeitas === 0 ? p.horasPlanejadas : p.horasFeitas })) }
}

export const alterarPasso = (s: Semana, id: number, mudanca: Partial<Passo>): Semana => ({ ...s, passos: s.passos.map((p) => (p.id === id ? { ...p, ...mudanca } : p)) })

/** Redistribui os passos não concluídos a partir de hoje, nos dias de estudo. */
export function reagendarPendentes(s: Semana, c: ConfigCiclo, hojeISO: DataISO): Semana {
  const pend = agendar(s.passos.filter((p) => !p.feito), s.seg, c, hojeISO)
  const novo = new Map(pend.map((p) => [p.id, p]))
  return { ...s, passos: s.passos.map((p) => novo.get(p.id) ?? p) }
}

/** Zera marcações, horas e anotações e recomeça na semana real de hoje (sem salvar estatísticas). */
export function limparMarcacoes(s: Semana, c: ConfigCiclo, hojeISO: DataISO, agora: number): Semana {
  const seg = semanaAlvo(hojeISO, c.dias)
  const zerados = s.passos.map((p) => ({ ...p, feito: false, horasFeitas: 0, nota: '' }))
  return { ...s, id: agora, inicio: hojeISO, seg, dom: addDias(seg, 6), pomodoros: 0, passos: agendar(zerados, seg, c, hojeISO) }
}

/** Resumo da semana (o que é guardado ao fechar). */
export function resumoSemana(s: Semana, hojeISO: DataISO, agora: number) {
  const n = s.passos.length
  const feitos = s.passos.filter((p) => p.feito).length
  const horas = horasFeitasDe(s)
  const meta = metaEf(s)
  const porMateria: Record<string, number> = {}
  for (const p of s.passos) if (p.horasFeitas > 0) porMateria[p.materia] = round2((porMateria[p.materia] ?? 0) + p.horasFeitas)
  return {
    id: agora, inicio: s.seg || s.inicio, fim: s.dom || hojeISO,
    cicloFechado: n > 0 && feitos === n, passosFeitos: feitos, passosTotal: n,
    pctConcluido: n ? Math.round((feitos / n) * 100) : 0,
    horasEstudadas: horas, metaHoras: meta, horasFaltando: Math.max(0, round2(meta - horas)),
    porMateria, pomodoros: s.pomodoros || 0, modelo: s.modelo,
  }
}
export type ResumoSemana = ReturnType<typeof resumoSemana>

// ---------------------------------------------------------------- cores

/** Cor da matéria: a guardada, ou uma estável calculada pelo nome (sem alterar nada). */
export function corDe(cores: Record<string, number>, nome: string): string {
  const i = cores[nome]
  if (i !== undefined) return PALETA[i % PALETA.length] as string
  let h = 0
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETA[h % PALETA.length] as string
}

/** Guarda uma cor para cada matéria que ainda não tem, evitando repetir enquanto houver cor livre. */
export function atribuirCores(cores: Record<string, number>, nomes: string[]): Record<string, number> {
  const novo = { ...cores }
  for (const nome of nomes) {
    if (novo[nome] !== undefined) continue
    const usados = new Set(Object.values(novo).map((v) => v % PALETA.length))
    let i = 0
    while (usados.has(i) && usados.size < PALETA.length) i++
    novo[nome] = i % PALETA.length
  }
  return novo
}

export { hojeDe }
