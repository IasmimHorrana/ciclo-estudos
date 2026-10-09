import { describe, expect, it } from 'vitest'
import { distribuirAssuntos, lerEdital, montarEdital, sugerirAssunto, normalizar, notaDosAssuntos, prioridade, resumoEdital, sugerirRepeticoes } from './edital'

describe('normalizar', () => {
  it('tira acento, caixa e espaços repetidos', () => {
    expect(normalizar('  Responsabilidade   CIVIL – Parte I ')).toBe('responsabilidade civil – parte i')
    expect(normalizar('Ação')).toBe('acao')
  })
})

describe('lerEdital', () => {
  it('separa matéria em maiúsculas e assuntos numerados', () => {
    const r = lerEdital(`DIREITO CIVIL
1. Teoria das obrigações
2. Posse
3. Propriedade plena
DIREITO PENAL
1. Teoria do crime
2. Penas`)
    expect(r).toEqual([
      { materia: 'DIREITO CIVIL', assuntos: ['Teoria das obrigações', 'Posse', 'Propriedade plena'] },
      { materia: 'DIREITO PENAL', assuntos: ['Teoria do crime', 'Penas'] },
    ])
  })

  it('aceita "Disciplina:", linha com dois-pontos e marcadores variados', () => {
    const r = lerEdital(`Disciplina: Português
- Interpretação de texto
• Crase
a) Concordância
Matemática:
1.1 Porcentagem
1.2 Juros`)
    expect(r[0]).toEqual({ materia: 'Português', assuntos: ['Interpretação de texto', 'Crase', 'Concordância'] })
    expect(r[1]).toEqual({ materia: 'Matemática', assuntos: ['Porcentagem', 'Juros'] })
  })

  it('separa assuntos por ponto e vírgula e por frase, sem quebrar "art. 5º"', () => {
    const r = lerEdital(`DIREITO CONSTITUCIONAL
1. Princípios fundamentais; direitos e garantias fundamentais; organização do Estado.
2. Controle de constitucionalidade. Poder Legislativo. Direitos do art. 5º. Remédios`)
    expect(r[0]?.assuntos).toEqual([
      'Princípios fundamentais',
      'direitos e garantias fundamentais',
      'organização do Estado',
      'Controle de constitucionalidade',
      'Poder Legislativo',
      'Direitos do art. 5º',
      'Remédios',
    ])
  })

  it('junta linhas de continuação ao assunto anterior', () => {
    const r = lerEdital(`DIREITO CIVIL
1. Responsabilidade civil:
pressupostos e excludentes
2. Posse`)
    // "Responsabilidade civil:" termina em dois-pontos mas tem marcador, então é assunto
    expect(r[0]?.assuntos).toEqual(['Responsabilidade civil: pressupostos e excludentes', 'Posse'])
  })

  it('remove repetições e junta a mesma matéria escrita duas vezes', () => {
    const r = lerEdital(`DIREITO CIVIL
1. Posse
2. posse
DIREITO CIVIL
3. Contratos`)
    expect(r).toEqual([{ materia: 'DIREITO CIVIL', assuntos: ['Posse', 'Contratos'] }])
  })

  it('assuntos antes de qualquer matéria vão para "Geral"; texto vazio dá lista vazia', () => {
    expect(lerEdital('1. Algo solto')).toEqual([{ materia: 'Geral', assuntos: ['Algo solto'] }])
    expect(lerEdital('  \n\n')).toEqual([])
  })
})

const base = { pesoMateria: 4, importancia: 3, horasIdeais: 10, horasFeitas: 0, estudado: false, questoes: 0, acertos: 0 }

describe('prioridade', () => {
  it('cresce com peso e importância', () => {
    expect(prioridade({ ...base, importancia: 5 })).toBeGreaterThan(prioridade(base))
    expect(prioridade({ ...base, pesoMateria: 5 })).toBeGreaterThan(prioridade(base))
  })

  it('cai conforme as horas ideais vão sendo feitas', () => {
    expect(prioridade({ ...base, horasFeitas: 5 })).toBeLessThan(prioridade(base))
    expect(prioridade({ ...base, horasFeitas: 10 })).toBeLessThan(prioridade({ ...base, horasFeitas: 5 }))
  })

  it('acerto baixo (com 3+ questões) sobe a prioridade; com poucas questões não conta', () => {
    expect(prioridade({ ...base, questoes: 10, acertos: 3 })).toBeGreaterThan(prioridade({ ...base, questoes: 10, acertos: 9 }))
    expect(prioridade({ ...base, questoes: 2, acertos: 0 })).toBe(prioridade(base))
  })

  it('assunto estudado cai bastante, menos se o acerto está baixo', () => {
    const feito = prioridade({ ...base, estudado: true, horasFeitas: 10 })
    expect(feito).toBeLessThan(prioridade(base) / 2)
    expect(prioridade({ ...base, estudado: true, horasFeitas: 10, questoes: 10, acertos: 3 })).toBeGreaterThan(feito)
  })

  it('sem horas ideais, o que não foi estudado conta como falta total', () => {
    expect(prioridade({ ...base, horasIdeais: 0 })).toBe(base.pesoMateria * base.importancia * 2)
    expect(prioridade({ ...base, horasIdeais: 0, estudado: true })).toBeLessThan(prioridade({ ...base, horasIdeais: 0 }))
  })
})

describe('sugerirRepeticoes', () => {
  it('cobre as horas que faltam, entre 1 e o total de passos', () => {
    expect(sugerirRepeticoes(6, 2, 14)).toBe(3)
    expect(sugerirRepeticoes(5, 2, 14)).toBe(3)
    expect(sugerirRepeticoes(0, 2, 14)).toBe(1)
    expect(sugerirRepeticoes(100, 2, 14)).toBe(14)
  })
})

describe('notaDosAssuntos e resumoEdital', () => {
  it('junta os assuntos com ponto e vírgula', () => {
    expect(notaDosAssuntos(['Posse', 'Contratos'])).toBe('Posse; Contratos')
  })

  it('resume progresso por assuntos e por horas (sem passar do ideal)', () => {
    const r = resumoEdital([
      { estudado: true, horasIdeais: 10, horasFeitas: 12 },
      { estudado: false, horasIdeais: 10, horasFeitas: 5 },
      { estudado: false, horasIdeais: 0, horasFeitas: 3 },
      { estudado: false, horasIdeais: 0, horasFeitas: 0 },
    ])
    expect(r).toMatchObject({ assuntos: 4, estudados: 1, pctEstudados: 25, horasIdeais: 20, horasFeitas: 20, pctHoras: 75 })
  })
})

describe('distribuirAssuntos', () => {
  const passos = [
    { id: 1, materia: 'Civil', nota: '' },
    { id: 2, materia: 'Penal', nota: '' },
    { id: 3, materia: 'Civil', nota: '' },
    { id: 4, materia: 'Civil', nota: 'minha nota' },
  ]
  it('reparte em rodízio entre os passos da matéria e respeita nota já escrita', () => {
    const r = distribuirAssuntos(passos, { Civil: ['Posse', 'Contratos', 'Obrigações'], Penal: ['Penas'] })
    expect(r.map((p) => p.nota)).toEqual(['Posse; Obrigações', 'Penas', 'Contratos', 'minha nota'])
  })

  it('sem assuntos escolhidos não muda nada', () => {
    expect(distribuirAssuntos(passos, {})).toEqual(passos)
  })

  it('mais passos que assuntos: os que sobram ficam sem anotação', () => {
    const r = distribuirAssuntos(passos, { Civil: ['Posse'] })
    expect(r.map((p) => p.nota)).toEqual(['Posse', '', '', 'minha nota'])
  })
})

describe('montarEdital', () => {
  const materias = [{ id: 'm1', nome: 'Civil', peso: 5, ordem: 0 }, { id: 'm2', nome: 'Penal', peso: 2, ordem: 1 }]
  const ass = (id: string, materia: string, nome: string, ordem: number, extra = {}) => ({ id, materia, nome, ordem, importancia: 3, horasIdeais: 10, estudado: false, noCiclo: false, ...extra })
  const assuntos = [
    ass('a1', 'Civil', 'Posse', 0),
    ass('a2', 'civil', 'Contratos', 1, { importancia: 5 }),
    ass('a3', 'Penal', 'Penas', 0, { estudado: true }),
  ]
  const questoes = [{ assuntoId: 'a1', feitas: 10, acertos: 7 }, { assuntoId: 'a1', feitas: 5, acertos: 5 }, { assuntoId: null, feitas: 9, acertos: 9 }]
  const sessoes = [{ assuntoId: 'a1', minutos: 90 }, { assuntoId: 'a1', minutos: 30 }]
  const base = { materias, assuntos, questoes, sessoes, ordem: 'edital' as const, ocultarEstudados: false, filtroMateria: null }

  it('soma certas, erradas, total e horas por assunto (casando matéria sem diferenciar caixa)', () => {
    const { blocos } = montarEdital(base)
    const posse = blocos[0]?.linhas[0]
    expect(posse).toMatchObject({ nome: 'Posse', certas: 12, erradas: 3, total: 15, pctAcerto: 80, horasFeitas: 2, falta: 8 })
    expect(blocos[0]?.linhas.map((l) => l.nome)).toEqual(['Posse', 'Contratos'])
    expect(blocos[0]?.linhas[1]).toMatchObject({ total: 0, pctAcerto: null })
  })

  it('totais ignoram questões sem assunto e somam as matérias mostradas', () => {
    const { total } = montarEdital(base)
    expect(total).toMatchObject({ certas: 12, erradas: 3, questoes: 15 })
    expect(total.resumo).toMatchObject({ assuntos: 3, estudados: 1, pctEstudados: 33 })
  })

  it('ordena por prioridade (assuntos e matérias) e esconde estudados sem mudar os totais', () => {
    const r = montarEdital({ ...base, ordem: 'prioridade', ocultarEstudados: true })
    expect(r.blocos.map((b) => b.materia.nome)).toEqual(['Civil', 'Penal'])
    expect(r.blocos[0]?.linhas.map((l) => l.nome)).toEqual(['Contratos', 'Posse']) // importância 5 vence
    expect(r.blocos[1]?.linhas).toEqual([])
    expect(r.total.resumo.assuntos).toBe(3)
  })

  it('filtra por matéria', () => {
    const r = montarEdital({ ...base, filtroMateria: 'm2' })
    expect(r.blocos.map((b) => b.materia.nome)).toEqual(['Penal'])
    expect(r.total.resumo.assuntos).toBe(1)
  })
})

describe('sugerirAssunto', () => {
  const assuntos = [{ id: 'a1', nome: 'Posse' }, { id: 'a2', nome: 'Contratos' }]
  it('acha o primeiro assunto citado na anotação (sem acento e caixa)', () => {
    expect(sugerirAssunto('contratos; Posse', assuntos)).toBe('a2')
    expect(sugerirAssunto('POSSE', assuntos)).toBe('a1')
  })
  it('sem correspondência ou sem anotação, não sugere nada', () => {
    expect(sugerirAssunto('revisar tudo', assuntos)).toBeNull()
    expect(sugerirAssunto('', assuntos)).toBeNull()
  })
})
