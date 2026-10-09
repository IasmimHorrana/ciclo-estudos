import { describe, expect, it } from 'vitest'
import { envolverCloze, indicesCloze, renderizarCloze } from '@/dominio/cloze'
import { indicesDeCartoes, renderizarCartao, textoPuro, TIPOS_DE_FABRICA } from '@/dominio/modelo'

const tipo = (id: string) => TIPOS_DE_FABRICA.find((t) => t.id === id)!

describe('cloze', () => {
  it('acha os números sem repetir, em ordem', () => {
    expect(indicesCloze('{{c2::a}} e {{c1::b}} e {{c2::c}}')).toEqual([1, 2])
    expect(indicesCloze('sem omissão')).toEqual([])
  })

  it('cartão 1 esconde só a omissão 1; a 2 aparece normal', () => {
    const t = 'A capital é {{c1::Brasília}} e a maior cidade é {{c2::São Paulo}}.'
    expect(renderizarCloze(t, 1, 'frente')).toBe('A capital é <span class="cloze">[...]</span> e a maior cidade é São Paulo.')
    expect(renderizarCloze(t, 2, 'verso')).toBe('A capital é Brasília e a maior cidade é <span class="cloze">São Paulo</span>.')
  })

  it('usa a dica quando existe', () => {
    expect(renderizarCloze('{{c1::Brasília::capital}}', 1, 'frente')).toBe('<span class="cloze">[capital]</span>')
  })

  it('omissão que abrange várias linhas', () => {
    expect(renderizarCloze('{{c1::linha 1\nlinha 2}}', 1, 'frente')).toContain('[...]')
  })

  it('envolverCloze usa o próximo número livre ou o pedido', () => {
    expect(envolverCloze('um dois três', 3, 7)).toBe('um {{c1::dois}} três')
    expect(envolverCloze('{{c1::um}} dois', 11, 15)).toBe('{{c1::um}} {{c2::dois}}')
    expect(envolverCloze('um dois', 0, 2, 1)).toBe('{{c1::um}} dois')
  })
})

describe('tipos de nota e modelos', () => {
  it('Básico: frente e verso (o verso repete a frente)', () => {
    const r = renderizarCartao(tipo('basico'), { Frente: 'Q', Verso: 'R' }, 0)
    expect(r.frente.html).toBe('Q')
    expect(r.verso.html).toBe('Q<hr id="resposta">R')
  })

  it('Invertido: gera 2 cartões, o segundo ao contrário', () => {
    const c = { Frente: 'Q', Verso: 'R' }
    expect(indicesDeCartoes(tipo('basico-invertido'), c)).toEqual([0, 1])
    expect(renderizarCartao(tipo('basico-invertido'), c, 1).frente.html).toBe('R')
  })

  it('Invertido opcional: só gera o 2º cartão se "Adicionar invertido" tiver algo', () => {
    const t = tipo('basico-invertido-opcional')
    expect(indicesDeCartoes(t, { Frente: 'Q', Verso: 'R', 'Adicionar invertido': '' })).toEqual([0])
    expect(indicesDeCartoes(t, { Frente: 'Q', Verso: 'R', 'Adicionar invertido': 'x' })).toEqual([0, 1])
  })

  it('Digitar a resposta: marca o campo a digitar só na frente e não mostra o campo', () => {
    const r = renderizarCartao(tipo('basico-digitar'), { Frente: 'Q', Verso: 'R' }, 0)
    expect(r.frente).toEqual({ html: 'Q<br>', digitar: 'Verso' })
    expect(r.verso.html).toBe('Q<hr id="resposta">R')
  })

  it('Cloze com 2 omissões gera 2 cartões; cada um esconde a sua', () => {
    const c = { Texto: '{{c1::A}} e {{c2::B}}', Extra: 'obs' }
    expect(indicesDeCartoes(tipo('cloze'), c)).toEqual([0, 1])
    expect(renderizarCartao(tipo('cloze'), c, 1).frente.html).toBe('A e <span class="cloze">[...]</span>')
    expect(renderizarCartao(tipo('cloze'), c, 0).verso.html).toBe('<span class="cloze">A</span> e B<br>obs')
  })

  it('nota sem frente ou cloze sem omissão não gera cartão', () => {
    expect(indicesDeCartoes(tipo('basico'), { Frente: '  <br> ', Verso: 'R' })).toEqual([])
    expect(indicesDeCartoes(tipo('cloze'), { Texto: 'sem omissão', Extra: '' })).toEqual([])
  })

  it('seção negada {{^Campo}} aparece só quando o campo está vazio', () => {
    const t = { ...tipo('basico'), modelos: [{ nome: 'x', frente: '{{^Verso}}sem verso{{/Verso}}{{Frente}}', verso: '' }] }
    expect(renderizarCartao(t, { Frente: 'Q', Verso: '' }, 0).frente.html).toBe('sem versoQ')
    expect(renderizarCartao(t, { Frente: 'Q', Verso: 'R' }, 0).frente.html).toBe('Q')
  })

  it('campo inexistente vira vazio e textoPuro tira tags e entidades', () => {
    expect(renderizarCartao(tipo('basico'), { Frente: 'Q' }, 0).verso.html).toBe('Q<hr id="resposta">')
    expect(textoPuro('<p>a&nbsp;&amp; <b>b</b></p><br>c')).toBe('a & b c')
  })
})
