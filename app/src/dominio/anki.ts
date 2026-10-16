// Peças puras para ler pacotes do Anki (.apkg): separar campos e tags, ajustar modelos e trocar mídia.
// Nada aqui toca em arquivo, banco ou tela; a leitura do pacote fica em `dados/apkg.ts`.

import type { Campos } from '@/dominio/modelo'

/** Tipo de nota como veio do Anki. */
export interface TipoAnki {
  id: number
  nome: string
  campos: string[]
  modelos: { nome: string; frente: string; verso: string }[]
  cloze: boolean
}

export interface NotaAnki {
  id: number
  tipoId: number
  /** Baralho (nome já com "::") do primeiro cartão da nota. */
  baralho: string
  campos: string[]
  tags: string[]
}

export interface PacoteAnki {
  tipos: Map<number, TipoAnki>
  notas: NotaAnki[]
  /** Arquivos de mídia: nome original → conteúdo. */
  midia: Map<string, Uint8Array>
}

/** O Anki guarda os campos de uma nota num texto só, separados pelo caractere 0x1F. */
export const separarCampos = (flds: string): string[] => flds.split('\x1f')

/** Tags separadas por espaço; o Anki põe espaços nas pontas. Hierarquia "a::b" é mantida. */
export const separarTags = (tags: string): string[] => tags.split(/\s+/).filter(Boolean)

/** Nome de baralho do Anki (novo formato usa 0x1F entre os níveis) → "A::B", sem níveis vazios. */
export const nomeDoBaralhoAnki = (nome: string): string =>
  nome
    .replaceAll('\x1f', '::')
    .split('::')
    .map((n) => n.replace(/:+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('::')

/** Campos da nota pelo nome do campo (campos a mais ou a menos que o tipo são ignorados/ficam vazios). */
export function camposDaNota(tipo: TipoAnki, valores: string[]): Campos {
  const c: Campos = {}
  tipo.campos.forEach((nome, i) => (c[nome] = valores[i] ?? ''))
  return c
}

/**
 * Ajusta um modelo do Anki ao que o nosso renderizador entende: filtros como `{{text:Campo}}` e
 * `{{hint:Campo}}` viram `{{Campo}}`; `{{cloze:}}`, `{{type:}}`, seções e `{{FrontSide}}` ficam.
 */
export function ajustarModelo(tpl: string): string {
  return tpl.replace(/\{\{([^{}#^/]+?)\}\}/g, (m, bruto: string) => {
    const t = bruto.trim()
    const i = t.indexOf(':')
    if (i < 0) return m
    const filtro = t.slice(0, i).trim().toLowerCase()
    if (filtro === 'cloze' || filtro === 'type') return m
    return `{{${t.slice(t.lastIndexOf(':') + 1).trim()}}}`
  })
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
}
export const mimeDaImagem = (nome: string): string | null => MIME[nome.split('.').pop()?.toLowerCase() ?? ''] ?? null

export function paraBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export interface ResultadoMidia {
  html: string
  imagens: number
  /** Imagens citadas que não vieram no pacote. */
  faltando: number
  /** Sons e vídeos descartados. */
  sonsIgnorados: number
}

/**
 * Troca `<img src="arquivo.png">` pelo próprio arquivo embutido (data URL), para o cartão não depender de pasta.
 * `[sound:...]` é removido (o app ainda não toca áudio).
 */
export function embutirMidia(html: string, midia: Map<string, Uint8Array>): ResultadoMidia {
  let imagens = 0
  let faltando = 0
  let sonsIgnorados = 0
  const decodificar = (s: string) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  }
  let saida = html.replace(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi, (tag, a?: string, b?: string, c?: string) => {
    const origem = (a ?? b ?? c ?? '').trim()
    if (/^(data:|https?:)/i.test(origem)) return tag
    const nome = decodificar(origem)
    const bytes = midia.get(nome)
    const mime = mimeDaImagem(nome)
    if (!bytes || !mime) {
      faltando++
      return ''
    }
    imagens++
    return `<img src="data:${mime};base64,${paraBase64(bytes)}">`
  })
  saida = saida.replace(/\[sound:[^\]]*\]/gi, () => {
    sonsIgnorados++
    return ''
  })
  return { html: saida, imagens, faltando, sonsIgnorados }
}

// ---------------------------------------------------------------- protobuf mínimo (formato novo do Anki)

export interface CampoProto {
  numero: number
  /** Inteiro (tipo 0) ou bytes (tipo 2). Outros tipos são lidos e descartados. */
  valor: number | Uint8Array
}

/** Lê mensagens protobuf simples: só varint e blocos com tamanho, que é o que o Anki usa nos modelos. */
export function lerProtobuf(bytes: Uint8Array): CampoProto[] {
  const out: CampoProto[] = []
  let i = 0
  const varint = (): number => {
    let r = 0
    let mult = 1
    for (;;) {
      const b = bytes[i++]
      if (b === undefined) throw new Error('Dados do Anki cortados no meio.')
      r += (b & 0x7f) * mult
      if (!(b & 0x80)) return r
      mult *= 128
    }
  }
  while (i < bytes.length) {
    const chave = varint()
    const numero = Math.floor(chave / 8)
    const tipo = chave % 8
    if (tipo === 0) out.push({ numero, valor: varint() })
    else if (tipo === 2) {
      const n = varint()
      out.push({ numero, valor: bytes.subarray(i, i + n) })
      i += n
    } else if (tipo === 1) i += 8
    else if (tipo === 5) i += 4
    else throw new Error('Formato de dados do Anki não reconhecido.')
  }
  return out
}

const dec = new TextDecoder()
export const textoProto = (v: number | Uint8Array | undefined): string => (v instanceof Uint8Array ? dec.decode(v) : '')
