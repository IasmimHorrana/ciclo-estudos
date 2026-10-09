import type { NotaResumo } from '@/dados/esquemas'

/** Nome seguro para arquivo/pasta no Windows, Mac e Linux. */
export const nomeSeguro = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 80) || 'sem-titulo'

/** `Matéria/Título.md`; se dois títulos colidirem, o segundo leva o fim do id. */
export function caminhoNota(n: Pick<NotaResumo, 'id' | 'titulo' | 'materia'>, usados: Set<string>): string {
  const pasta = nomeSeguro(n.materia || 'Sem matéria')
  let c = `${pasta}/${nomeSeguro(n.titulo)}.md`
  if (usados.has(c.toLowerCase())) c = `${pasta}/${nomeSeguro(n.titulo)} (${n.id.slice(-4)}).md`
  usados.add(c.toLowerCase())
  return c
}

/** Conteúdo do `.md` de uma nota: cabeçalho com id/matéria (para reimportar) + o texto em Markdown. */
export const notaParaArquivo = (n: NotaResumo) =>
  `---\nid: ${n.id}\ntitulo: ${n.titulo.replace(/\n/g, ' ')}\nmateria: ${n.materia}\natualizado: ${n.atualizado}\n---\n\n${n.texto}`

export interface MdLido {
  id: string | undefined
  titulo: string
  materia: string
  atualizado: number
  texto: string
}

/** Lê um `.md` (com ou sem o cabeçalho que o app grava). */
export function lerMd(txt: string, nomeArquivo: string): MdLido {
  const meta: Record<string, string> = {}
  let corpo = txt.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const m = corpo.match(/^---\n([\s\S]*?)\n---\n?/)
  if (m) {
    for (const l of (m[1] ?? '').split('\n')) {
      const k = l.match(/^(\w+):\s?(.*)$/)
      if (k) meta[k[1] as string] = (k[2] ?? '').trim()
    }
    corpo = corpo.slice(m[0].length).replace(/^\n+/, '')
  }
  return {
    id: meta.id,
    titulo: meta.titulo || nomeArquivo.replace(/\.(md|markdown|txt)$/i, ''),
    materia: meta.materia ?? '',
    atualizado: parseInt(meta.atualizado ?? '') || 0,
    texto: corpo,
  }
}

/** Hash curto só para saber se o arquivo mudou desde o último backup (não é criptográfico). */
export const hashTexto = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
