import { describe, expect, it } from 'vitest'
import { agruparNotas, filtrarNotas, mencionadaEm, renomearLigacoes, sugerirNotas, tituloUnico } from '@/dominio/notas'

const n = (id: string, titulo: string, materia = '', texto = '') => ({ id, titulo, materia, texto })

describe('título único', () => {
  it('acrescenta (2), (3)... sem diferenciar maiúsculas', () => {
    expect(tituloUnico(['Crase'], 'Crase')).toBe('Crase (2)')
    expect(tituloUnico(['Crase', 'Crase (2)'], 'crase')).toBe('crase (3)')
    expect(tituloUnico([], '  ')).toBe('Sem título')
    expect(tituloUnico(['A'], 'B')).toBe('B')
  })
})

describe('ligações', () => {
  it('renomear troca [[antigo]] em qualquer caixa e com espaços, sem tocar em outros textos', () => {
    expect(renomearLigacoes('veja [[Crase]] e [[ crase ]] mas não Crase nem [[Outra]]', 'Crase', 'Crase 2')).toBe(
      'veja [[Crase 2]] e [[Crase 2]] mas não Crase nem [[Outra]]',
    )
  })
  it('título com caracteres especiais não quebra a expressão', () => {
    expect(renomearLigacoes('[[a+b (1)]]', 'a+b (1)', 'x')).toBe('[[x]]')
  })
  it('"mencionada em" lista só quem cita a nota (e não ela mesma)', () => {
    const a = n('1', 'Crase', '', 'texto [[Crase]]')
    const b = n('2', 'Outra', '', 'cita [[crase]]')
    const c = n('3', 'Alheia', '', 'cita [[Outra]]')
    expect(mencionadaEm([a, b, c], a).map((x) => x.id)).toEqual(['2'])
  })
  it('sugestões: pelo título, sem a atual, no máximo 6', () => {
    const lista = Array.from({ length: 9 }, (_, i) => n(String(i), `Regra ${i}`))
    expect(sugerirNotas(lista, '0', 'regra')).toHaveLength(6)
    expect(sugerirNotas(lista, '0', 'regra 0')).toEqual([])
  })
})

describe('busca e grupos', () => {
  const lista = [n('1', 'Crase', 'Língua Portuguesa', 'acento grave'), n('2', 'Redes', 'Informática', 'TCP'), n('3', 'Solta', '', 'sem matéria'), n('4', 'Pessoal', 'Minha Matéria', '')]
  it('busca no título e no texto, ignorando maiúsculas', () => {
    expect(filtrarNotas(lista, 'ACENTO').map((x) => x.id)).toEqual(['1'])
    expect(filtrarNotas(lista, 'redes').map((x) => x.id)).toEqual(['2'])
    expect(filtrarNotas(lista, '')).toHaveLength(4)
  })
  it('grupos: ordem da lista, depois matérias próprias, por fim "sem matéria"; vazios somem', () => {
    const g = agruparNotas(lista, ['Língua Portuguesa', 'Direito', 'Informática'])
    expect(g.map((x) => x.materia)).toEqual(['Língua Portuguesa', 'Informática', 'Minha Matéria', ''])
    expect(g[3]!.notas.map((x) => x.id)).toEqual(['3'])
  })
})
