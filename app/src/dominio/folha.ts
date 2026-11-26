// Folha dos Resumos: a nota é escrita direto numa página (contentEditable), mas continua guardada em Markdown
// (assim backup, sincronia, busca, importação e marca-texto seguem iguais).
// Aqui fica a volta: a árvore da folha → Markdown. A ida é `mdParaHtml(..., { folha: true })`.
// A árvore é uma interface mínima (não o DOM) para dar para testar sem navegador.

export type NoFolha = { texto: string } | { tag: string; attrs?: Record<string, string>; filhos: NoFolha[] }

const ehTexto = (n: NoFolha): n is { texto: string } => 'texto' in n
const tagDe = (n: NoFolha) => (ehTexto(n) ? '' : n.tag.toLowerCase())
const BLOCOS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'blockquote', 'table', 'hr'])
const ehBloco = (n: NoFolha) => BLOCOS.has(tagDe(n))

/** Texto puro de um nó (para código, tabela e nome de ligação). */
function textoPuro(n: NoFolha): string {
  if (ehTexto(n)) return n.texto
  if (tagDe(n) === 'br') return '\n'
  return n.filhos.map(textoPuro).join('')
}

const INVISIVEIS = new RegExp(`[${String.fromCharCode(0x200b, 0xfeff)}]`, 'g')
const limpar = (s: string) => s.replace(/\xa0/g, ' ').replace(INVISIVEIS, '')

/** Envolve com o sinal, deixando os espaços das pontas de fora (`** a **` não vira negrito). */
function envolver(t: string, a: string, b = a): string {
  const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/) as RegExpMatchArray
  return m[2] ? `${m[1]}${a}${m[2]}${b}${m[3]}` : t
}

/** Conteúdo em linha → Markdown (pode ter "\n" vindo de <br>). */
function emLinha(nos: NoFolha[]): string {
  return nos
    .map((n): string => {
      if (ehTexto(n)) return limpar(n.texto)
      const t = tagDe(n)
      const dentro = () => emLinha(n.filhos)
      switch (t) {
        case 'br':
          return '\n'
        case 'b':
        case 'strong':
          return envolver(dentro(), '**')
        case 'i':
        case 'em':
          return envolver(dentro(), '*')
        case 's':
        case 'strike':
        case 'del':
          return envolver(dentro(), '~~')
        case 'code':
          return envolver(limpar(textoPuro(n)), '`')
        case 'mark': {
          const c = n.attrs?.['data-c']
          return envolver(dentro(), c && c !== 'amarelo' ? `=={${c}}` : '==', '==')
        }
        case 'a': {
          if ((n.attrs?.class ?? '').split(/\s+/).includes('wiki')) return `[[${n.attrs?.['data-t'] || limpar(textoPuro(n))}]]`
          const href = n.attrs?.href ?? ''
          return /^(https?:|mailto:)/.test(href) ? `[${dentro()}](${href})` : dentro()
        }
        case 'input':
          return n.attrs?.checked !== undefined ? '[x] ' : '[ ] '
        default:
          return ehBloco(n) ? `\n${dentro()}\n` : dentro()
      }
    })
    .join('')
}

/** Linhas de uma lista (com o recuo de 2 espaços por nível). */
function linhasLista(lista: NoFolha, nivel: number): string[] {
  if (ehTexto(lista)) return []
  const ord = tagDe(lista) === 'ol'
  const out: string[] = []
  let k = 0
  for (const f of lista.filhos) {
    const t = tagDe(f)
    if (t === 'ul' || t === 'ol') {
      out.push(...linhasLista(f, nivel + 1)) // o Chrome às vezes põe a sublista direto dentro da lista
      continue
    }
    if (ehTexto(f)) {
      if (limpar(f.texto).trim()) out.push(`${'  '.repeat(nivel)}${ord ? `${++k}.` : '-'} ${limpar(f.texto).trim()}`)
      continue
    }
    const proprio = f.filhos.filter((x) => tagDe(x) !== 'ul' && tagDe(x) !== 'ol')
    const texto = emLinha(proprio).replace(/\s*\n\s*/g, ' ').trim()
    out.push(`${'  '.repeat(nivel)}${ord ? `${++k}.` : '-'} ${texto}`.trimEnd())
    for (const s of f.filhos) if (tagDe(s) === 'ul' || tagDe(s) === 'ol') out.push(...linhasLista(s, nivel + 1))
  }
  return out
}

function linhasTabela(t: NoFolha): string[] {
  const linhas: string[][] = []
  const andar = (n: NoFolha) => {
    if (ehTexto(n)) return
    if (tagDe(n) === 'tr') linhas.push(n.filhos.filter((c) => ['td', 'th'].includes(tagDe(c))).map((c) => emLinha(ehTexto(c) ? [] : c.filhos).replace(/\n/g, ' ').replace(/\|/g, '/').trim()))
    else n.filhos.forEach(andar)
  }
  andar(t)
  if (!linhas.length) return []
  const [cab, ...resto] = linhas as [string[], ...string[][]]
  return [`| ${cab.join(' | ')} |`, `| ${cab.map(() => '-').join(' | ')} |`, ...resto.map((r) => `| ${r.join(' | ')} |`)]
}

/** Linhas de Markdown de uma sequência de nós da folha (cada bloco é uma linha; bloco vazio é linha em branco). */
function linhas(nos: NoFolha[]): string[] {
  const out: string[] = []
  let solto: NoFolha[] = []
  const soltar = () => {
    if (!solto.length) return
    const t = emLinha(solto)
    solto = []
    if (t.trim()) out.push(...t.split('\n').map((l) => l.trimEnd()))
  }
  for (const n of nos) {
    if (!ehBloco(n)) {
      solto.push(n)
      continue
    }
    soltar()
    const t = tagDe(n)
    const filhos = ehTexto(n) ? [] : n.filhos
    if (t === 'p' || t === 'div') {
      if (filhos.some(ehBloco)) out.push(...linhas(filhos))
      else {
        const s = emLinha(filhos)
        out.push(...(s.trim() ? s.split('\n').map((l) => l.trimEnd()) : ['']))
      }
    } else if (/^h[1-6]$/.test(t)) {
      const s = emLinha(filhos).replace(/\s*\n\s*/g, ' ').trim()
      out.push(s ? `${'#'.repeat(Number(t[1]))} ${s}` : '')
    } else if (t === 'ul' || t === 'ol') out.push(...linhasLista(n, 0))
    else if (t === 'li') out.push(...linhasLista({ tag: 'ul', filhos: [n] }, 0))
    else if (t === 'pre') out.push('```', ...limpar(textoPuro(n)).replace(/\n$/, '').split('\n'), '```')
    else if (t === 'blockquote') out.push(...linhas(filhos).map((l) => (l ? `> ${l}` : '>')))
    else if (t === 'table') out.push(...linhasTabela(n))
    else if (t === 'hr') out.push('---')
  }
  soltar()
  return out
}

/** Folha → Markdown. Linhas em branco no fim são tiradas; a nota termina com uma quebra de linha. */
export function folhaParaMd(nos: NoFolha[]): string {
  const l = linhas(nos)
  while (l.length && !(l[l.length - 1] as string).trim()) l.pop()
  return l.length ? `${l.join('\n')}\n` : ''
}

/** Adaptador do DOM do navegador para a árvore da folha. */
export function domParaFolha(el: Node): NoFolha[] {
  const out: NoFolha[] = []
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out.push({ texto: n.textContent ?? '' })
    else if (n.nodeType === 1) {
      const e = n as Element
      const attrs: Record<string, string> = {}
      for (const a of Array.from(e.attributes)) attrs[a.name] = a.value
      if (e.tagName === 'INPUT' && (e as HTMLInputElement).checked) attrs.checked = ''
      out.push({ tag: e.tagName.toLowerCase(), attrs, filhos: domParaFolha(e) })
    }
  })
  return out
}
