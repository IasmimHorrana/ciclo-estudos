import { describe, expect, it } from 'vitest'
import { siglaDe } from './sigla'

describe('siglaDe', () => {
  it('uma palavra: as quatro primeiras letras, sem acento', () => {
    expect(siglaDe('Informática')).toBe('INFO')
    expect(siglaDe('Redação')).toBe('REDA')
    expect(siglaDe('Português')).toBe('PORT')
  })

  it('duas palavras: inicial da primeira e três letras da segunda', () => {
    expect(siglaDe('Direito Administrativo')).toBe('DADM')
    expect(siglaDe('Conhecimentos Específicos')).toBe('CESP')
    expect(siglaDe('Língua Portuguesa')).toBe('LPOR')
  })

  it('três ou mais: as iniciais (sem "de", "e"...), até quatro letras', () => {
    expect(siglaDe('Administração Financeira e Orçamentária')).toBe('AFO')
    expect(siglaDe('Noções de Igualdade Racial')).toBe('NIR')
    expect(siglaDe('Legislação Específica do Estado da Bahia Aplicada')).toBe('LEEB')
  })

  it('respeita uma sigla já escrita e não quebra com nome vazio', () => {
    expect(siglaDe('AFO')).toBe('AFO')
    expect(siglaDe('Direito - Penal')).toBe('DPEN')
    expect(siglaDe('  ')).toBe('?')
  })
})
