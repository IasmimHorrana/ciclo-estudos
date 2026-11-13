// Imagens nos campos de cartão: na caixa de texto ficam como marcador `[imagem N]`;
// ao salvar, o marcador vira `<img>` com a imagem embutida (data URL), como na importação do Anki.

export type Imagens = Record<number, string>

const MARCADOR = /\[imagem (\d+)\]/g

export const marcador = (n: number): string => `[imagem ${n}]`

/** Só aceita imagem embutida (data URL de imagem, em base64), nada de endereço externo. */
const dataUrlValida = (s: string): boolean => /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(s)

/** Troca cada `[imagem N]` pela imagem N. Marcador sem imagem (ou com imagem inválida) continua como texto. */
export function trocarMarcadores(html: string, imagens: Imagens): string {
  return html.replace(MARCADOR, (m, n: string) => {
    const src = imagens[Number(n)]
    return src && dataUrlValida(src) ? `<img src="${src}">` : m
  })
}

/** Números das imagens citadas no texto, em ordem e sem repetir. */
export function numerosNoTexto(texto: string): number[] {
  const r: number[] = []
  for (const m of texto.matchAll(MARCADOR)) {
    const n = Number(m[1])
    if (!r.includes(n)) r.push(n)
  }
  return r
}

/** Próximo número livre (um a mais que o maior já usado). */
export const proximoNumero = (imagens: Imagens): number => Math.max(0, ...Object.keys(imagens).map(Number)) + 1

/** Tira o marcador da imagem N do texto (e a quebra de linha que sobrar no lugar dele). */
export function removerMarcador(texto: string, n: number): string {
  return texto.replace(new RegExp(`\\n?\\[imagem ${n}\\]`, 'g'), '')
}

/** Insere o marcador entre `ini` e `fim` (substitui a seleção), em linha própria. Devolve o texto e onde fica o cursor. */
export function inserirMarcador(texto: string, ini: number, fim: number, n: number): { texto: string; cursor: number } {
  const antes = texto.slice(0, ini)
  const depois = texto.slice(fim)
  const pre = antes === '' || antes.endsWith('\n') ? '' : '\n'
  const pos = depois === '' || depois.startsWith('\n') ? '' : '\n'
  const meio = pre + marcador(n) + pos
  return { texto: antes + meio + depois, cursor: antes.length + meio.length }
}
