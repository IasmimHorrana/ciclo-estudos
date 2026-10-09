// Markdown → HTML próprio (sem bibliotecas), portado do app em HTML, mais ajudas do editor e do importador.
// Suporta: títulos, listas com recuo (recolhíveis), tarefas [ ] / [x], citações, código, tabelas, **negrito**,
// *itálico*, ~~riscado~~, `código`, links http(s) e [[ligações entre notas]]. Tudo é escapado antes de virar HTML.

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const desesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
export const norm = (s: string) => s.trim().toLowerCase()

/** Hash curto só para identificar um item recolhível. */
export const hashStr = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export interface ContextoMd {
  /** A nota com este título existe? (ligações para notas que não existem aparecem diferentes) */
  existe: (titulo: string) => boolean
  /** Itens de lista recolhidos pelo usuário (chaves `idDaNota:hash`). */
  fechados: ReadonlySet<string>
}

function inl(s: string, ctx: ContextoMd): string {
  const cods: string[] = []
  let t = esc(s).replace(/`([^`]+)`/g, (_m, c: string) => {
    cods.push(c)
    return `${cods.length - 1}`
  })
  t = t.replace(/\[\[([^\]]+)\]\]/g, (_m, n: string) => `<a href="#" class="wiki${ctx.existe(desesc(n)) ? '' : ' novo'}" data-t="${n.trim()}">${n}</a>`)
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<i>$2</i>').replace(/~~(.+?)~~/g, '<s>$1</s>')
  return t.replace(/(\d+)/g, (_m, i: string) => `<code>${cods[Number(i)]}</code>`)
}

const LISTRE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const SEPARADOR = /^\s*([-*_])(\s*\1){2,}\s*$/

interface No {
  indent: number
  ord: boolean
  texto: string
  filhos: No[]
}

function htmlLista(itens: Omit<No, 'filhos'>[], nid: string, ctx: ContextoMd): string {
  const raiz: No = { filhos: [], indent: -1, ord: false, texto: '' }
  const pilha: No[] = [raiz]
  for (const it of itens) {
    while (pilha.length > 1 && it.indent <= (pilha[pilha.length - 1] as No).indent) pilha.pop()
    const no: No = { ...it, filhos: [] }
    ;(pilha[pilha.length - 1] as No).filhos.push(no)
    pilha.push(no)
  }
  const conteudo = (t: string) => {
    const cx = t.match(/^\[( |x|X)\]\s+(.*)$/)
    return cx ? `<input type="checkbox" disabled ${cx[1] === ' ' ? '' : 'checked'}> ${inl(cx[2] as string, ctx)}` : inl(t, ctx)
  }
  const rend = (nos: No[]): string => {
    if (!nos.length) return ''
    const tag = (nos[0] as No).ord ? 'ol' : 'ul'
    return `<${tag}>${nos
      .map((n) => {
        if (!n.filhos.length) return `<li>${conteudo(n.texto)}</li>`
        const k = `${nid}:${hashStr(n.texto)}`
        return `<li class="k"><details ${ctx.fechados.has(k) ? '' : 'open'} data-k="${k}"><summary>${conteudo(n.texto)}</summary>${rend(n.filhos)}</details></li>`
      })
      .join('')}</${tag}>`
  }
  return rend(raiz.filhos)
}

/** Markdown → HTML. Passe o resultado por `sanitizarMarkdown` antes de mostrar. */
export function mdParaHtml(txt: string, nid: string, ctx: ContextoMd): string {
  const L = txt.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  const comecaBloco = (l: string) => /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || LISTRE.test(l) || /^\s*>/.test(l) || SEPARADOR.test(l)
  let i = 0
  while (i < L.length) {
    const l = L[i] as string
    if (/^\s*```/.test(l)) {
      const buf: string[] = []
      i++
      while (i < L.length && !/^\s*```/.test(L[i] as string)) buf.push(L[i++] as string)
      i++
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`)
      continue
    }
    if (!l.trim()) {
      i++
      continue
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      const n = (h[1] as string).length
      out.push(`<h${n}>${inl(h[2] as string, ctx)}</h${n}>`)
      i++
      continue
    }
    if (SEPARADOR.test(l)) {
      out.push('<hr>')
      i++
      continue
    }
    if (/^\s*>/.test(l)) {
      const buf: string[] = []
      while (i < L.length && /^\s*>/.test(L[i] as string)) buf.push((L[i++] as string).replace(/^\s*>\s?/, ''))
      out.push(`<blockquote>${mdParaHtml(buf.join('\n'), nid, ctx)}</blockquote>`)
      continue
    }
    if (l.includes('|') && i + 1 < L.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(L[i + 1] as string)) {
      const cel = (s: string) => s.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim())
      const cab = cel(l)
      i += 2
      const linhas: string[][] = []
      while (i < L.length && (L[i] as string).trim() && (L[i] as string).includes('|')) linhas.push(cel(L[i++] as string))
      out.push(
        `<table><thead><tr>${cab.map((c) => `<th>${inl(c, ctx)}</th>`).join('')}</tr></thead><tbody>${linhas.map((r) => `<tr>${r.map((c) => `<td>${inl(c, ctx)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      )
      continue
    }
    if (LISTRE.test(l)) {
      const itens: Omit<No, 'filhos'>[] = []
      while (i < L.length) {
        const lm = (L[i] as string).match(LISTRE)
        if (lm) {
          itens.push({ indent: (lm[1] as string).replace(/\t/g, '  ').length, ord: /\d/.test(lm[2] as string), texto: lm[3] as string })
          i++
        } else if (!(L[i] as string).trim() && i + 1 < L.length && LISTRE.test(L[i + 1] as string)) i++
        else break
      }
      out.push(htmlLista(itens, nid, ctx))
      continue
    }
    const buf: string[] = []
    while (i < L.length && (L[i] as string).trim() && !comecaBloco(L[i] as string)) buf.push(L[i++] as string)
    if (!buf.length) buf.push(L[i++] as string)
    out.push(`<p>${buf.map((x) => inl(x, ctx)).join('<br>')}</p>`)
  }
  return out.join('\n')
}

// ---------------------------------------------------------------- ajudas do editor (puras)

/** Uma edição de texto: troca [inicio, fim) por `inserir` e deixa a seleção em [selA, selB]. */
export interface Edicao {
  inicio: number
  fim: number
  inserir: string
  selA: number
  selB: number
}

/** Tab / Shift+Tab: recua ou desfaz o recuo das linhas selecionadas (2 espaços). */
export function indentar(v: string, a: number, b: number, volta: boolean): Edicao {
  const ini = v.lastIndexOf('\n', a - 1) + 1
  let fim = v.indexOf('\n', b)
  if (fim < 0) fim = v.length
  let dA = 0
  let dT = 0
  const novas = v.slice(ini, fim).split('\n').map((l, i) => {
    if (!volta) {
      if (i === 0) dA = 2
      dT += 2
      return `  ${l}`
    }
    const r = l.startsWith('  ') ? 2 : l.startsWith(' ') || l.startsWith('\t') ? 1 : 0
    if (i === 0) dA = -r
    dT -= r
    return l.slice(r)
  })
  return { inicio: ini, fim, inserir: novas.join('\n'), selA: Math.max(ini, a + dA), selB: Math.max(ini, b + dT) }
}

/**
 * Enter dentro de uma lista: continua o marcador (ou sai do nível/lista se o item está vazio).
 * Devolve `null` quando não é uma lista (o Enter segue normal).
 */
export function continuarLista(v: string, pos: number): Edicao | null {
  const ini = v.lastIndexOf('\n', pos - 1) + 1
  const linha = v.slice(ini, pos)
  const m = linha.match(/^(\s*)([-*+]|\d+[.)])\s(\[[ xX]\]\s)?/)
  if (!m || pos - ini < m[0].length) return null
  if (!linha.slice(m[0].length).trim()) {
    // marcador vazio: sai do nível (ou encerra a lista)
    const novo = (m[1] as string).length >= 2 ? (m[1] as string).slice(2) + m[0].trimStart() : ''
    return { inicio: ini, fim: pos, inserir: novo, selA: ini + novo.length, selB: ini + novo.length }
  }
  const marc = /\d/.test(m[2] as string) ? `${parseInt(m[2] as string) + 1}${(m[2] as string).slice(-1)}` : (m[2] as string)
  const ins = `\n${m[1]}${marc} ${m[3] ? '[ ] ' : ''}`
  return { inicio: pos, fim: pos, inserir: ins, selA: pos + ins.length, selB: pos + ins.length }
}

/** Texto logo antes do cursor se estiver digitando uma ligação `[[...` (para sugerir notas). */
export function consultaLigacao(v: string, pos: number): string | null {
  const m = v.slice(0, pos).match(/\[\[([^\]\n]*)$/)
  return m ? (m[1] as string) : null
}

/** Troca o que foi digitado depois de `[[` pelo título escolhido, fechando com `]]`. */
export function inserirLigacao(v: string, pos: number, titulo: string): Edicao {
  const ini = v.slice(0, pos).lastIndexOf('[[') + 2
  const fim = v.slice(pos, pos + 2) === ']]' ? pos + 2 : pos
  const ins = `${titulo}]]`
  return { inicio: ini, fim, inserir: ins, selA: ini + ins.length, selB: ini + ins.length }
}

// ---------------------------------------------------------------- importar texto pronto (NotebookLM, ChatGPT, Docs)

export interface OpcoesImportar {
  citacoes: boolean
  marcadores: boolean
  dividir: boolean
}

/** Ajusta o texto para o formato do app: tira citações [1], normaliza marcadores e recuos. */
export function adaptarTexto(t: string, o: Pick<OpcoesImportar, 'citacoes' | 'marcadores'>): string {
  const L = String(t).replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ').split('\n')
  const out: string[] = []
  let dentro = false
  for (let l of L) {
    if (/^\s*```/.test(l)) {
      dentro = !dentro
      out.push(l)
      continue
    }
    if (dentro) {
      out.push(l)
      continue
    }
    if (o.citacoes) l = l.replace(/\s*\[(?:\d+(?:\s*[-–,]\s*\d+)*)\]/g, '')
    if (o.marcadores) {
      l = l.replace(/^(\t+)/, (s) => '  '.repeat(s.length)).replace(/^(\s*)[•◦▪‣∙·●○–—]\s+/, '$1- ').replace(/^(\s*)\*\s+/, '$1- ')
    }
    out.push(l)
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

/** Divide em várias notas a cada "## Título" (ignora ## dentro de blocos de código). */
export function dividirSecoes(texto: string, base: string): { titulo: string; texto: string }[] {
  const partes: { titulo: string; linhas: string[] }[] = []
  let atual = { titulo: base, linhas: [] as string[] }
  let dentro = false
  let achou = 0
  for (const l of texto.split('\n')) {
    if (/^\s*```/.test(l)) dentro = !dentro
    const m = !dentro && l.match(/^##\s+(.+)$/)
    if (m) {
      achou++
      if (atual.linhas.join('').trim()) partes.push(atual)
      atual = { titulo: `${base} — ${(m[1] as string).trim()}`, linhas: [`# ${(m[1] as string).trim()}`] }
    } else atual.linhas.push(l)
  }
  if (atual.linhas.join('').trim()) partes.push(atual)
  return achou < 1 ? [{ titulo: base, texto }] : partes.map((p) => ({ titulo: p.titulo, texto: `${p.linhas.join('\n').trim()}\n` }))
}
