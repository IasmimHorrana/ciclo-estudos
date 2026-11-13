import { describe, expect, it } from 'vitest'
import { campoParaEdicao, inserirMarcador, numerosNoTexto, proximoNumero, removerMarcador, trocarMarcadores } from '@/dominio/imagens'
import { textoParaHtml } from '@/lib/sanitizar'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('imagens nos campos', () => {
  it('troca o marcador pela imagem, depois do texto escapado', () => {
    const html = trocarMarcadores(textoParaHtml('a < b\n[imagem 1]'), { 1: PNG })
    expect(html).toBe(`a &lt; b<br><img src="${PNG}">`)
  })

  it('marcador sem imagem ou com imagem que não é data URL continua como texto', () => {
    expect(trocarMarcadores('[imagem 2]', { 1: PNG })).toBe('[imagem 2]')
    expect(trocarMarcadores('[imagem 1]', { 1: 'https://x.com/a.png' })).toBe('[imagem 1]')
    expect(trocarMarcadores('[imagem 1]', { 1: 'data:image/png;base64,a" onerror="x' })).toBe('[imagem 1]')
  })

  it('números citados, próximo número e remoção', () => {
    expect(numerosNoTexto('[imagem 3] x [imagem 1] [imagem 3]')).toEqual([3, 1])
    expect(proximoNumero({})).toBe(1)
    expect(proximoNumero({ 1: PNG, 4: PNG })).toBe(5)
    expect(removerMarcador('Pergunta\n[imagem 2]\nfim', 2)).toBe('Pergunta\nfim')
  })

  it('campo salvo volta para a caixa com marcadores (ida e volta)', () => {
    const salvo = trocarMarcadores(textoParaHtml('[imagem 1]\nQue órgão é <este>?'), { 1: PNG })
    const e = campoParaEdicao(salvo, 3)
    expect(e).toEqual({ texto: '[imagem 3]\nQue órgão é <este>?', imagens: { 3: PNG }, temFormatacao: false })
    expect(trocarMarcadores(textoParaHtml(e.texto), e.imagens)).toBe(salvo)
  })

  it('divs do Anki viram linhas e formatação é avisada', () => {
    expect(campoParaEdicao('<div>a</div><div>b&nbsp;&amp; c</div>')).toEqual({ texto: 'a\nb & c', imagens: {}, temFormatacao: false })
    expect(campoParaEdicao('<b>negrito</b>').temFormatacao).toBe(true)
    expect(campoParaEdicao('<img src="foto.jpg">x')).toEqual({ texto: 'x', imagens: {}, temFormatacao: true })
  })

  it('insere o marcador em linha própria no lugar do cursor', () => {
    expect(inserirMarcador('', 0, 0, 1)).toEqual({ texto: '[imagem 1]', cursor: 10 })
    expect(inserirMarcador('abc', 3, 3, 1)).toEqual({ texto: 'abc\n[imagem 1]', cursor: 14 })
    expect(inserirMarcador('abXcd', 2, 3, 2).texto).toBe('ab\n[imagem 2]\ncd')
  })
})
