// Edital verticalizado: leitura do texto colado, prioridade dos assuntos e sugestão de passos no ciclo. Puro.

export interface MateriaLida {
  materia: string
  assuntos: string[]
}

/** Sem acento, minúsculo e com espaços únicos: serve para comparar nomes ao reimportar. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const MARCADOR = /^\s*(?:\d+(?:\.\d+)*[.)]?|[a-z][.)]|[-–—•*·▪●○■])\s+/i
const PREFIXO_MATERIA = /^\s*(?:disciplina|mat[ée]ria)\s*[:\-–—]\s*(.+)$/i
const ABREVIACOES = /(?:\b(?:art|arts|inc|al|cf|ex|dr|dra|sr|sra|v|vs|lc|ec|obs|p|pp|n|nº|no|nos|c\/c)|§|\d)\.$/i

const temMinuscula = (s: string) => /[a-zà-ÿ]/.test(s)
const temLetra = (s: string) => /[A-Za-zÀ-ÿ]/.test(s)
const limpar = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Divide "A; B" e "A. B" (frase nova com maiúscula), sem quebrar "art. 5º" nem "nº 8.112". */
function dividir(item: string): string[] {
  const partes: string[] = []
  for (const bloco of item.split(';')) {
    const palavras = bloco.split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/)
    let atual = ''
    for (const p of palavras) {
      atual = atual ? `${atual} ${p}` : p
      if (!ABREVIACOES.test(atual.trim()) || p === palavras[palavras.length - 1]) {
        partes.push(atual)
        atual = ''
      }
    }
    if (atual) partes.push(atual)
  }
  return partes.map((p) => limpar(p).replace(/[.;,\s]+$/, '')).filter(Boolean)
}

/**
 * Lê o texto de um edital e separa matérias e assuntos.
 * Matéria: "Disciplina: X", linha terminando em ":" ou linha toda em maiúsculas (sem marcador).
 * Assunto: item numerado (1., 1.1, a)), com marcador (-, •) ou frase solta; ";" separa vários numa linha.
 * Linha sem marcador que começa em minúscula continua o assunto anterior.
 */
export function lerEdital(texto: string): MateriaLida[] {
  const materias: MateriaLida[] = []
  let atual: MateriaLida | null = null
  let ultimo = '' // assunto em montagem (pode receber continuação)

  const fechar = () => {
    if (!atual || !ultimo) return
    for (const a of dividir(ultimo)) atual.assuntos.push(a)
    ultimo = ''
  }
  const abrirMateria = (nome: string) => {
    fechar()
    const n = limpar(nome).replace(/[:\s]+$/, '')
    atual = materias.find((m) => normalizar(m.materia) === normalizar(n)) ?? null
    if (!atual) {
      atual = { materia: n, assuntos: [] }
      materias.push(atual)
    }
  }

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = limpar(bruta)
    if (!linha) continue
    const m = PREFIXO_MATERIA.exec(linha)
    if (m) {
      abrirMateria(m[1] as string)
      continue
    }
    const comMarcador = MARCADOR.test(linha)
    if (!comMarcador) {
      const semDoisPontos = linha.replace(/:$/, '')
      const maiuscula = temLetra(linha) && !temMinuscula(linha) && linha.length <= 80
      if (linha.endsWith(':') || maiuscula) {
        abrirMateria(semDoisPontos)
        continue
      }
      // continuação do assunto anterior
      if (ultimo && (/^[a-zà-ÿ(]/.test(linha) || !/[.;]$/.test(ultimo))) {
        ultimo = `${ultimo} ${linha}`
        continue
      }
    }
    fechar()
    if (!atual) abrirMateria('Geral')
    ultimo = comMarcador ? linha.replace(MARCADOR, '') : linha
  }
  fechar()

  // sem repetições dentro de cada matéria
  return materias.map((mat) => {
    const vistos = new Set<string>()
    const assuntos = mat.assuntos.filter((a) => {
      const k = normalizar(a)
      if (!k || vistos.has(k)) return false
      vistos.add(k)
      return true
    })
    return { materia: mat.materia, assuntos }
  })
}

export interface EntradaPrioridade {
  /** Peso da matéria na prova, 1 a 5. */
  pesoMateria: number
  /** Importância/dificuldade do assunto para você, 1 a 5. */
  importancia: number
  horasIdeais: number
  horasFeitas: number
  estudado: boolean
  questoes: number
  acertos: number
}

/**
 * Quanto maior, mais cedo estudar. peso × importância, mais forte quanto mais falta das horas ideais
 * e quanto pior o acerto (a partir de 3 questões). Assunto já estudado cai bastante; só volta um pouco se o acerto está baixo.
 */
export function prioridade(e: EntradaPrioridade): number {
  const base = Math.max(0, e.pesoMateria) * Math.max(0, e.importancia)
  const falta = e.horasIdeais > 0 ? Math.max(0, e.horasIdeais - e.horasFeitas) / e.horasIdeais : e.estudado ? 0 : 1
  const taxa = e.questoes >= 3 ? e.acertos / e.questoes : null
  const fatorAcerto = taxa === null ? 1 : 1 + (1 - taxa)
  const fatorEstudo = e.estudado ? (taxa !== null && taxa < 0.6 ? 0.6 : 0.25) : 1
  return Math.round(base * (1 + falta) * fatorAcerto * fatorEstudo * 100) / 100
}

/** Quantos passos de uma matéria colocar no ciclo para cobrir as horas que faltam (no mínimo 1, no máximo o total do ciclo). */
export function sugerirRepeticoes(horasQueFaltam: number, duracaoPasso: number, totalPassos: number): number {
  if (duracaoPasso <= 0 || totalPassos <= 0) return 1
  const n = horasQueFaltam > 0 ? Math.ceil(horasQueFaltam / duracaoPasso - 1e-9) : 1
  return Math.min(Math.max(1, n), totalPassos)
}

/** Texto que vai na anotação do passo com os assuntos escolhidos. */
export const notaDosAssuntos = (nomes: readonly string[]): string => nomes.join('; ')

/**
 * Reparte os assuntos escolhidos de cada matéria entre os passos dela (em rodízio) e os escreve na anotação.
 * Passos com anotação já preenchida e matérias sem assuntos ficam como estão.
 */
export function distribuirAssuntos<P extends { materia: string; nota: string }>(passos: readonly P[], porMateria: Readonly<Record<string, readonly string[]>>): P[] {
  const contador = new Map<string, number>()
  const total = new Map<string, number>()
  for (const p of passos) if (!p.nota) total.set(p.materia, (total.get(p.materia) ?? 0) + 1)
  return passos.map((p) => {
    const assuntos = porMateria[p.materia]
    const n = total.get(p.materia) ?? 1
    if (!assuntos?.length || p.nota) return p
    const i = contador.get(p.materia) ?? 0
    contador.set(p.materia, i + 1)
    const meus = assuntos.filter((_, k) => k % n === i)
    return meus.length ? { ...p, nota: notaDosAssuntos(meus) } : p
  })
}

export interface ResumoEdital {
  assuntos: number
  estudados: number
  pctEstudados: number
  horasIdeais: number
  horasFeitas: number
  /** Horas feitas (limitadas ao ideal em cada assunto) ÷ horas ideais, de 0 a 100. */
  pctHoras: number
}

export function resumoEdital(itens: readonly { estudado: boolean; horasIdeais: number; horasFeitas: number }[]): ResumoEdital {
  const estudados = itens.filter((i) => i.estudado).length
  const horasIdeais = itens.reduce((s, i) => s + i.horasIdeais, 0)
  const horasFeitas = itens.reduce((s, i) => s + i.horasFeitas, 0)
  const uteis = itens.reduce((s, i) => s + (i.horasIdeais > 0 ? Math.min(i.horasFeitas, i.horasIdeais) : 0), 0)
  return {
    assuntos: itens.length,
    estudados,
    pctEstudados: itens.length ? Math.round((estudados / itens.length) * 100) : 0,
    horasIdeais,
    horasFeitas,
    pctHoras: horasIdeais > 0 ? Math.round((uteis / horasIdeais) * 100) : 0,
  }
}
