import { describe, expect, it } from 'vitest'
import { adaptarTexto, consultaLigacao, continuarLista, dividirSecoes, indentar, inserirLigacao, mdParaHtml, type ContextoMd } from '@/dominio/markdown'

const ctx = (existentes: string[] = [], fechados: string[] = []): ContextoMd => ({
  existe: (t) => existentes.some((e) => e.toLowerCase() === t.toLowerCase()),
  fechados: new Set(fechados),
})
const md = (t: string, c = ctx()) => mdParaHtml(t, 'n1', c)

describe('markdown → html', () => {
  it('títulos, parágrafos com quebra de linha e separador', () => {
    expect(md('# Título\n\nlinha 1\nlinha 2\n\n---')).toBe('<h1>Título</h1>\n<p>linha 1<br>linha 2</p>\n<hr>')
  })

  it('negrito, itálico, riscado, código e link seguro', () => {
    expect(md('**a** *b* ~~c~~ `d` [x](https://ex.com)')).toBe(
      '<p><b>a</b> <i>b</i> <s>c</s> <code>d</code> <a href="https://ex.com" target="_blank" rel="noopener noreferrer">x</a></p>',
    )
  })

  it('NÃO vira link um endereço perigoso e escapa HTML digitado', () => {
    const h = md('[clique](javascript:alert(1)) <script>x</script> <img src=x onerror=alert(1)>')
    expect(h).not.toContain('href="javascript')
    expect(h).not.toContain('<script>')
    expect(h).not.toContain('<img')
    expect(h).toContain('&lt;script&gt;')
  })

  it('código em bloco não interpreta markdown e escapa tags', () => {
    expect(md('```\n**não** <b>\n```')).toBe('<pre><code>**não** &lt;b&gt;</code></pre>')
  })

  it('citação e tabela', () => {
    expect(md('> dica')).toBe('<blockquote><p>dica</p></blockquote>')
    expect(md('| a | b |\n| - | - |\n| 1 | 2 |')).toBe('<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>')
  })

  it('lista simples, numerada e tarefas', () => {
    expect(md('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(md('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
    expect(md('- [ ] fazer\n- [x] feito')).toBe('<ul><li><input type="checkbox" disabled > fazer</li><li><input type="checkbox" disabled checked> feito</li></ul>')
  })

  it('lista com recuo vira tópicos que recolhem; itens recolhidos não ganham "open"', () => {
    const h = md('- pai\n  - filho')
    expect(h).toContain('<details open')
    const chave = /data-k="([^"]+)"/.exec(h)![1]!
    expect(mdParaHtml('- pai\n  - filho', 'n1', ctx([], [chave]))).not.toContain('<details open')
  })

  it('[[ligação]] marca se a nota existe ou é nova', () => {
    expect(md('veja [[Crase]]', ctx(['crase']))).toBe('<p>veja <a href="#" class="wiki" data-t="Crase">Crase</a></p>')
    expect(md('veja [[Nova]]')).toBe('<p>veja <a href="#" class="wiki novo" data-t="Nova">Nova</a></p>')
  })
})

describe('editor', () => {
  it('Tab recua e Shift+Tab desfaz o recuo, em várias linhas', () => {
    const t = '- a\n- b'
    const e = indentar(t, 0, t.length, false)
    expect(e.inserir).toBe('  - a\n  - b')
    expect(indentar(e.inserir, 0, e.inserir.length, true).inserir).toBe(t)
    expect(indentar('- a', 0, 0, true).inserir).toBe('- a') // nada a desfazer
  })

  it('Enter continua o marcador, a numeração e a tarefa', () => {
    expect(continuarLista('- item', 6)).toMatchObject({ inserir: '\n- ' })
    expect(continuarLista('  2. item', 9)).toMatchObject({ inserir: '\n  3. ' })
    expect(continuarLista('- [x] feito', 11)).toMatchObject({ inserir: '\n- [ ] ' })
  })

  it('Enter num item vazio sai do nível; no primeiro nível encerra a lista; fora de lista não faz nada', () => {
    expect(continuarLista('- a\n  - ', 8)).toMatchObject({ inserir: '- ', inicio: 4 })
    expect(continuarLista('- a\n- ', 6)).toMatchObject({ inserir: '', inicio: 4 })
    expect(continuarLista('texto', 5)).toBeNull()
  })

  it('sugestão de ligação: detecta "[[abc" e completa com o título', () => {
    expect(consultaLigacao('veja [[Cra', 10)).toBe('Cra')
    expect(consultaLigacao('veja [[Crase]] e', 16)).toBeNull()
    const e = inserirLigacao('veja [[Cra', 10, 'Crase')
    expect(e).toMatchObject({ inicio: 7, fim: 10, inserir: 'Crase]]' })
  })
})

describe('importar texto pronto', () => {
  it('remove citações [1], [2, 3], [4-6] e normaliza marcadores e recuos', () => {
    const t = adaptarTexto('• item um [1]\n\t◦ sub [2, 3]\n* outro [4-6]\n– traço', { citacoes: true, marcadores: true })
    expect(t).toBe('- item um\n  - sub\n- outro\n- traço\n')
  })

  it('não mexe em blocos de código; respeita as opções desligadas', () => {
    const t = adaptarTexto('```\n• x [1]\n```\n• y [1]', { citacoes: true, marcadores: true })
    expect(t).toContain('• x [1]')
    expect(adaptarTexto('• y [1]', { citacoes: false, marcadores: false })).toBe('• y [1]\n')
  })

  it('dividir por "## Seção": uma nota por seção, ignorando ## em código', () => {
    const partes = dividirSecoes('intro\n\n## A\ntexto A\n```\n## nao\n```\n## B\ntexto B', 'Base')
    expect(partes.map((p) => p.titulo)).toEqual(['Base', 'Base — A', 'Base — B'])
    expect(partes[1]!.texto).toContain('# A')
    expect(partes[1]!.texto).toContain('## nao')
    expect(dividirSecoes('sem seções', 'Base')).toEqual([{ titulo: 'Base', texto: 'sem seções' }])
  })
})
