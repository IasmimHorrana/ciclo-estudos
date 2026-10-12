import { describe, expect, it } from 'vitest'
import { linhasDaArvore, nomesComFilhos } from './arvore'

const b = (nome: string) => ({ nome })
const lista = [b('Informática::Redes'), b('Gestão'), b('Informática'), b('Gestão::Introdução'), b('Informática::Redes::Camadas'), b('Gestão Avançada'), b('Língua')]

describe('linhasDaArvore', () => {
  it('põe cada subbaralho logo abaixo do pai, mesmo com nomes parecidos, e calcula nível e rótulo', () => {
    const l = linhasDaArvore(lista, new Set())
    expect(l.map((x) => x.item.nome)).toEqual(['Gestão', 'Gestão::Introdução', 'Gestão Avançada', 'Informática', 'Informática::Redes', 'Informática::Redes::Camadas', 'Língua'])
    expect(l.map((x) => x.nivel)).toEqual([0, 1, 0, 0, 1, 2, 0])
    expect(l[1]?.rotulo).toBe('Introdução')
  })

  it('sabe quem tem subbaralhos', () => {
    const l = linhasDaArvore(lista, new Set())
    expect(l.filter((x) => x.temFilhos).map((x) => x.item.nome)).toEqual(['Gestão', 'Informática', 'Informática::Redes'])
  })

  it('recolher um baralho esconde todos os níveis abaixo dele, e só eles', () => {
    expect(linhasDaArvore(lista, new Set(['Informática'])).map((x) => x.item.nome)).toEqual(['Gestão', 'Gestão::Introdução', 'Gestão Avançada', 'Informática', 'Língua'])
    expect(linhasDaArvore(lista, new Set(['Informática::Redes'])).map((x) => x.item.nome)).toContain('Informática::Redes')
    expect(linhasDaArvore(lista, new Set(['Informática::Redes'])).map((x) => x.item.nome)).not.toContain('Informática::Redes::Camadas')
  })

  it('recolher um que não tem filhos não muda nada', () => {
    expect(linhasDaArvore(lista, new Set(['Língua'])).length).toBe(7)
  })
})

describe('nomesComFilhos', () => {
  it('lista só os que têm subbaralhos', () => {
    expect(nomesComFilhos(lista.map((x) => x.nome)).sort()).toEqual(['Gestão', 'Informática', 'Informática::Redes'])
  })
})
