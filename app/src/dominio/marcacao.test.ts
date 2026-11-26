import { describe, expect, it } from 'vitest'
import { contarOcorrencias, desmarcar, listarMarcas, marcarTrecho, numerarMarcas, trocarCor } from '@/dominio/marcacao'
import { mdParaHtml } from '@/dominio/markdown'

const md = (t: string) => numerarMarcas(mdParaHtml(t, 'n1', { existe: () => true, fechados: new Set() }))
const marcar = (f: string, sel: string, ordem = 0, cor: Parameters<typeof marcarTrecho>[3] = 'amarelo') => {
  const r = marcarTrecho(f, sel, ordem, cor)
  return r.ok ? r.texto : `ERRO: ${r.motivo}`
}

describe('marcação no markdown', () => {
  it('vira <mark> com a cor e o número', () => {
    expect(md('a ==b== c =={verde}d==')).toBe('<p>a <mark data-i="0" data-c="amarelo">b</mark> c <mark data-i="1" data-c="verde">d</mark></p>')
  })
  it('cor desconhecida vira amarelo; dentro de código não marca', () => {
    expect(md('=={xyz}a==')).toContain('data-c="amarelo"')
    expect(md('`==a==`')).toBe('<p><code>==a==</code></p>')
    expect(md('```\n==a==\n```')).not.toContain('<mark')
  })
  it('formatação dentro da marcação continua valendo', () => {
    expect(md('==**a** b==')).toBe('<p><mark data-i="0" data-c="amarelo"><b>a</b> b</mark></p>')
  })
})

describe('listarMarcas', () => {
  it('acha na mesma ordem da pré-visualização e ignora código', () => {
    const f = '# ==t==\n```\n==x==\n```\n- `==y==` ==a== e =={rosa}b==\n| ==c== | d |'
    expect(listarMarcas(f).map((m) => `${m.texto}:${m.cor}`)).toEqual(['t:amarelo', 'a:amarelo', 'b:rosa', 'c:amarelo'])
    const html = md(f)
    expect(html.match(/data-i="\d+"/g)).toHaveLength(4)
  })
})

describe('marcarTrecho', () => {
  it('marca um trecho simples, com e sem cor', () => {
    expect(marcar('o Brasil enfrenta desafios', 'Brasil enfrenta')).toBe('o ==Brasil enfrenta== desafios')
    expect(marcar('o Brasil enfrenta desafios', 'desafios', 0, 'azul')).toBe('o Brasil enfrenta =={azul}desafios==')
  })
  it('usa a ocorrência certa', () => {
    expect(marcar('ia e ia e ia', 'ia', 1)).toBe('ia e ==ia== e ia')
    expect(marcar('ia e ia', 'ia', 9)).toBe('ia e ==ia==')
  })
  it('atravessa formatação inteira', () => {
    expect(marcar('texto **forte** aqui', 'texto forte')).toBe('==texto **forte**== aqui')
    expect(marcar('texto **forte** aqui', 'forte')).toBe('texto **==forte==** aqui')
  })
  it('seleção que corta negrito/itálico ao meio inclui a formatação inteira', () => {
    expect(marcar('ab **cd ef** gh', 'ef gh')).toBe('ab ==**cd ef** gh==')
    expect(marcar('ab **cd ef** gh', 'ab cd')).toBe('==ab **cd ef**== gh')
    expect(marcar('x *um dois* y', 'dois y')).toBe('x ==*um dois* y==')
  })
  it('ligação e código inteiros: dentro deles, marca o bloco todo', () => {
    expect(marcar('veja [[Outra nota]] já', 'Outra')).toBe('veja ==[[Outra nota]]== já')
    expect(marcar('use `npm` sempre', 'npm')).toBe('use ==`npm`== sempre')
    expect(marcar('veja [[Outra nota]] já', 'veja Outra')).toMatch(/^ERRO/)
  })
  it('recusa várias linhas, sobreposição e trecho que não existe', () => {
    expect(marcar('a\nb', 'a\nb')).toMatch(/^ERRO/)
    expect(marcar('um ==dois== tres', 'dois tres')).toMatch(/^ERRO/)
    expect(marcar('abc', 'xyz')).toMatch(/^ERRO/)
  })
  it('não procura dentro de bloco de código', () => {
    expect(marcar('```\nalvo\n```\nalvo', 'alvo')).toBe('```\nalvo\n```\n==alvo==')
  })
  it('palavra cortada ao meio é marcada inteira', () => {
    expect(marcar('é necessário analisar', 'o analis')).toBe('é ==necessário analisar==')
  })
  it('funciona em tópicos de lista', () => {
    expect(marcar('- Primeiramente, é necessário', 'é necessário')).toBe('- Primeiramente, ==é necessário==')
  })
})

describe('desmarcar e trocarCor', () => {
  it('tira e troca pela posição', () => {
    const f = '==a== e =={verde}b=='
    expect(desmarcar(f, 1)).toBe('==a== e b')
    expect(trocarCor(f, 0, 'rosa')).toBe('=={rosa}a== e =={verde}b==')
    expect(trocarCor(f, 1, 'amarelo')).toBe('==a== e ==b==')
    expect(desmarcar(f, 5)).toBe(f)
  })
})

it('contarOcorrencias', () => {
  expect(contarOcorrencias('ia e ia e ia', 'ia')).toBe(3)
  expect(contarOcorrencias('aaa', 'aa')).toBe(1)
  expect(contarOcorrencias('x', ' ')).toBe(0)
})
