// Marcação de texto (marca-texto) nas notas dos Resumos.
// Fica no próprio Markdown: `==trecho==` (amarelo) ou `=={verde}trecho==` (outra cor).
// Assim a marcação vai junto no backup, na sincronia e no .md exportado.

export const CORES_MARCA = ['amarelo', 'laranja', 'verde', 'rosa', 'roxo', 'azul'] as const
export type CorMarca = (typeof CORES_MARCA)[number]
export const COR_PADRAO: CorMarca = 'amarelo'

export const NOMES_COR: Record<CorMarca, string> = {
  amarelo: 'Amarelo',
  laranja: 'Laranja',
  verde: 'Verde',
  rosa: 'Rosa',
  roxo: 'Roxo',
  azul: 'Azul',
}

const ehCor = (c: string | undefined): c is CorMarca => !!c && (CORES_MARCA as readonly string[]).includes(c)
export const corValida = (c: string | undefined): CorMarca => (ehCor(c) ? c : COR_PADRAO)

/** Padrão de uma marcação numa linha. Grupo 1: cor (opcional); grupo 2: o trecho. */
const MARCA = /==(?:\{([a-z]+)\})?([^=\n]+?)==/g

/** Troca as marcações de uma linha (já escapada, sem código) por <mark>. Usado pelo Markdown. */
export function marcasParaHtml(t: string): string {
  return t.replace(MARCA, (_m, c: string | undefined, x: string) => `<mark data-c="${corValida(c)}">${x}</mark>`)
}

/** Numera os <mark> na ordem do documento (data-i), a mesma ordem de `listarMarcas`. */
export function numerarMarcas(html: string): string {
  let n = 0
  return html.replace(/<mark /g, () => `<mark data-i="${n++}" `)
}

export interface Marca {
  /** Posição do primeiro "=" no texto. */
  inicio: number
  /** Posição logo depois do último "=". */
  fim: number
  cor: CorMarca
  /** O trecho marcado (sem os sinais). */
  texto: string
}

/** Percorre as linhas fora de blocos de código, com o código em linha trocado por espaços (mesmo tamanho). */
function linhasUteis(fonte: string): { ini: number; linha: string }[] {
  const out: { ini: number; linha: string }[] = []
  let dentro = false
  let ini = 0
  for (const l of fonte.split('\n')) {
    if (/^\s*```/.test(l)) dentro = !dentro
    else if (!dentro) out.push({ ini, linha: l.replace(/`[^`]+`/g, (m) => ' '.repeat(m.length)) })
    ini += l.length + 1
  }
  return out
}

/** Todas as marcações do texto, na ordem em que aparecem. */
export function listarMarcas(fonte: string): Marca[] {
  const out: Marca[] = []
  for (const { ini, linha } of linhasUteis(fonte)) {
    for (const m of linha.matchAll(MARCA)) {
      const a = ini + (m.index ?? 0)
      out.push({ inicio: a, fim: a + m[0].length, cor: corValida(m[1]), texto: m[2] as string })
    }
  }
  return out
}

/** Tira a marcação número `i`, deixando o texto. */
export function desmarcar(fonte: string, i: number): string {
  const m = listarMarcas(fonte)[i]
  return m ? fonte.slice(0, m.inicio) + m.texto + fonte.slice(m.fim) : fonte
}

/** Troca a cor da marcação número `i`. */
export function trocarCor(fonte: string, i: number, cor: CorMarca): string {
  const m = listarMarcas(fonte)[i]
  return m ? fonte.slice(0, m.inicio) + embrulhar(m.texto, cor) + fonte.slice(m.fim) : fonte
}

const embrulhar = (t: string, cor: CorMarca) => (cor === COR_PADRAO ? `==${t}==` : `=={${cor}}${t}==`)

export type ResultadoMarcar = { ok: true; texto: string } | { ok: false; motivo: string }

const escRe = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Entre duas letras do que foi selecionado, o texto-fonte pode ter sinais de formatação. */
const SINAIS = '(?:\\*|~|`|\\[|\\]|==(?:\\{[a-z]+\\})?)*'

/** Trechos que não podem ser cortados ao meio: ligações [[...]], links [..](..) e código em linha. */
function blocosInteiros(linha: string): [number, number][] {
  const out: [number, number][] = []
  for (const re of [/\[\[[^\]]+\]\]/g, /\[[^\]]+\]\([^)\s]+\)/g, /`[^`]+`/g]) for (const m of linha.matchAll(re)) out.push([m.index ?? 0, (m.index ?? 0) + m[0].length])
  return out
}

/** Formatação aberta e não fechada dentro do trecho (ex.: começa no meio de um **negrito**). */
function formatacaoQuebrada(t: string): boolean {
  const semCodigo = t.replace(/`[^`]*`/g, '')
  if (semCodigo.includes('`')) return true
  const pares = (s: string, p: string) => s.split(p).length % 2 === 1
  if (!pares(semCodigo, '**') || !pares(semCodigo, '~~')) return true
  return !pares(semCodigo.replace(/\*\*/g, ''), '*')
}

/**
 * Marca no texto-fonte o que foi selecionado na pré-visualização.
 * `selecionado` é o texto da seleção; `ordem` diz qual ocorrência é (0 = a primeira), contada na pré-visualização.
 */
export function marcarTrecho(fonte: string, selecionado: string, ordem: number, cor: CorMarca): ResultadoMarcar {
  const sel = selecionado.trim()
  if (!sel) return { ok: false, motivo: 'Selecione um trecho do texto.' }
  if (/\n/.test(sel)) return { ok: false, motivo: 'Marque uma linha (ou um tópico) de cada vez.' }
  if (sel.includes('=')) return { ok: false, motivo: 'Trechos com o sinal "=" não podem ser marcados.' }
  const padrao = [...sel].map((c) => (/\s/.test(c) ? '[ \\t]+' : escRe(c))).join(SINAIS)
  const re = new RegExp(padrao, 'g')
  const achados: { linha: string; ini: number; a: number; b: number }[] = []
  let dentro = false
  let ini = 0
  for (const linha of fonte.split('\n')) {
    if (/^\s*```/.test(linha)) dentro = !dentro
    else if (!dentro) for (const m of linha.matchAll(re)) achados.push({ linha, ini, a: m.index ?? 0, b: (m.index ?? 0) + m[0].length })
    ini += linha.length + 1
  }
  const alvo = achados[Math.min(Math.max(ordem, 0), achados.length - 1)]
  if (!alvo) return { ok: false, motivo: 'Não achei esse trecho no texto da nota. Tente selecionar um pedaço menor.' }
  let { a, b } = alvo
  // seleção que começa ou termina no meio de uma palavra pega a palavra inteira
  const letra = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c)
  while (a > 0 && letra(alvo.linha[a - 1]) && letra(alvo.linha[a])) a--
  while (b < alvo.linha.length && letra(alvo.linha[b]) && letra(alvo.linha[b - 1])) b++
  for (const [x, y] of blocosInteiros(alvo.linha)) {
    const corta = a < y && b > x && (a > x || b < y)
    if (!corta) continue
    if (a >= x && b <= y) {
      a = x
      b = y
    } else return { ok: false, motivo: 'O trecho corta uma ligação ou um código ao meio. Inclua-o inteiro ou selecione só fora dele.' }
  }
  // se a seleção deixou de fora o ** (ou * ~~ `) que fecha/abre a formatação, inclui esses sinais
  const antes = alvo.linha.slice(0, a).match(/[*~`]*$/)?.[0].length ?? 0
  const depois = alvo.linha.slice(b).match(/^[*~`]*/)?.[0].length ?? 0
  const opcoes: [number, number][] = [[a, b], [a, b + depois], [a - antes, b], [a - antes, b + depois]]
  const boa = opcoes.find(([x, y]) => !formatacaoQuebrada(alvo.linha.slice(x, y)))
  if (boa) [a, b] = boa
  else {
    // ainda corta um **negrito**, *itálico* ou ~~riscado~~ ao meio: estende até incluí-lo inteiro
    for (const re of [/\*\*[^*\n]+?\*\*/g, /~~[^~\n]+?~~/g, /(?<!\*)\*[^*\s][^*\n]*?\*(?!\*)/g]) {
      for (const m of alvo.linha.matchAll(re)) {
        const x = m.index ?? 0
        const y = x + m[0].length
        if (a < y && b > x && (a > x || b < y)) {
          a = Math.min(a, x)
          b = Math.max(b, y)
        }
      }
    }
  }
  const trecho = alvo.linha.slice(a, b)
  if (formatacaoQuebrada(trecho)) return { ok: false, motivo: 'O trecho corta um negrito ou itálico ao meio. Inclua a formatação inteira ou selecione só dentro dela.' }
  const A = alvo.ini + a
  const B = alvo.ini + b
  if (listarMarcas(fonte).some((m) => A < m.fim && B > m.inicio)) return { ok: false, motivo: 'Já há marcação aqui. Clique nela para trocar a cor ou remover.' }
  return { ok: true, texto: fonte.slice(0, A) + embrulhar(trecho, cor) + fonte.slice(B) }
}

/** Quantas vezes `sel` aparece (sem sobreposição) em `t`. Serve para achar a `ordem` da seleção. */
export function contarOcorrencias(t: string, sel: string): number {
  const s = sel.trim()
  if (!s) return 0
  let n = 0
  let p = t.indexOf(s)
  while (p >= 0) {
    n++
    p = t.indexOf(s, p + s.length)
  }
  return n
}
