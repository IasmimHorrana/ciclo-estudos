import { describe, expect, it } from 'vitest'
import { folhaParaMd, type NoFolha } from '@/dominio/folha'
import { mdParaHtml } from '@/dominio/markdown'

/** Leitor de HTML mínimo (só para os testes; no app quem lê é o navegador). */
function lerHtml(html: string): NoFolha[] {
  const dec = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  const raiz: { tag: string; attrs: Record<string, string>; filhos: NoFolha[] } = { tag: '#', attrs: {}, filhos: [] }
  const pilha = [raiz]
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g
  for (const m of html.matchAll(re)) {
    const topo = pilha[pilha.length - 1] as (typeof pilha)[number]
    if (m[3] !== undefined) {
      topo.filhos.push({ texto: dec(m[3]) })
      continue
    }
    const tag = (m[1] as string).toLowerCase()
    if (m[0].startsWith('</')) {
      pilha.pop()
      continue
    }
    const attrs: Record<string, string> = {}
    for (const a of (m[2] as string).matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) attrs[a[1] as string] = dec(a[2] ?? '')
    const no = { tag, attrs, filhos: [] as NoFolha[] }
    topo.filhos.push(no)
    if (!['br', 'hr', 'input'].includes(tag)) pilha.push(no)
  }
  return raiz.filhos
}

const ctx = { existe: () => true, fechados: new Set<string>(), folha: true }
const ida = (md: string) => mdParaHtml(md, 'n1', ctx)
const volta = (html: string) => folhaParaMd(lerHtml(html))
const idaEVolta = (md: string) => volta(ida(md))

describe('folha: ida (Markdown → folha)', () => {
  it('uma linha da nota por parágrafo, linha em branco vira parágrafo vazio', () => {
    expect(ida('a\nb\n\nc\n')).toBe('<p>a</p><p>b</p><p><br></p><p>c</p>')
  })
  it('lista simples, sem abrir/fechar, e caixinha como texto', () => {
    expect(ida('- a\n  - b\n- [ ] c')).toBe('<ul><li>a<ul><li>b</li></ul></li><li>[ ] c</li></ul>')
  })
  it('nota vazia ainda tem uma linha para escrever', () => {
    expect(ida('')).toBe('<p><br></p>')
  })
})

describe('folha: ida e volta mantêm o texto', () => {
  const casos = [
    'texto simples\n',
    'linha 1\nlinha 2\n\nparágrafo novo\n',
    '# Título\n## Sub\ntexto\n',
    '- a\n  - b\n    - c\n- d\n',
    '1. um\n2. dois\n',
    '**negrito** *itálico* ~~riscado~~ `código`\n',
    'veja [[Outra nota]] e [site](https://ex.com)\n',
    'o ==Brasil== e =={verde}desafios==\n',
    '> citação\n> segunda\n',
    '```\nbloco **cru**\n```\n',
    '| a | b |\n| - | - |\n| 1 | 2 |\n',
    '---\n',
    '- [x] feito\n- [ ] falta\n',
  ]
  for (const c of casos) it(JSON.stringify(c), () => expect(idaEVolta(c)).toBe(c))
})

describe('folha: volta (o que o navegador produz ao editar)', () => {
  it('Enter cria parágrafos; div e br também viram linhas', () => {
    expect(volta('<p>a</p><p>b</p>')).toBe('a\nb\n')
    expect(volta('<div>a</div><div><br></div><div>b</div>')).toBe('a\n\nb\n')
    expect(volta('a<br>b')).toBe('a\nb\n')
  })
  it('sublista direto dentro da lista (Tab no Chrome)', () => {
    expect(volta('<ul><li>a</li><ul><li>b</li></ul><li>c</li></ul>')).toBe('- a\n  - b\n- c\n')
  })
  it('negrito com espaço na ponta não quebra; negrito vazio some', () => {
    expect(volta('<p><b>forte </b>fim</p>')).toBe('**forte** fim\n')
    expect(volta('<p>a<b></b> b</p>')).toBe('a b\n')
  })
  it('espaço duro vira espaço comum; linhas vazias do fim são tiradas', () => {
    expect(volta('<p>a&nbsp;b</p><p><br></p><p><br></p>'.replace('&nbsp;', String.fromCharCode(160)))).toBe('a b\n')
  })
  it('título e lista criados pelos botões', () => {
    expect(volta('<h2>Tema</h2><ul><li>x</li></ul>')).toBe('## Tema\n- x\n')
  })
  it('folha vazia vira texto vazio', () => {
    expect(volta('<p><br></p>')).toBe('')
  })
})
