import { describe, expect, it } from 'vitest'
import { achatarItens, agruparLinhas, distribuirAssuntos, lerEdital, maiuscula, partirNome, repartirHoras, materiasDoEdital, montarEdital, sugerirAssunto, normalizar, notaDosAssuntos, prioridade, resumoEdital, sugerirRepeticoes } from './edital'

const t = (...nomes: string[]) => nomes.map((nome) => ({ nome, filhos: [] as string[] }))

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
      { materia: 'DIREITO CIVIL', assuntos: t('Teoria das obrigações', 'Posse', 'Propriedade plena') },
      { materia: 'DIREITO PENAL', assuntos: t('Teoria do crime', 'Penas') },
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
    expect(r[0]).toEqual({ materia: 'Português', assuntos: t('Interpretação de texto', 'Crase', 'Concordância') })
    expect(r[1]).toEqual({ materia: 'Matemática', assuntos: t('Porcentagem', 'Juros') })
  })

  it('separa assuntos por ponto e vírgula e por frase, sem quebrar "art. 5º"', () => {
    const r = lerEdital(`DIREITO CONSTITUCIONAL
1. Princípios fundamentais; direitos e garantias fundamentais; organização do Estado.
2. Controle de constitucionalidade. Poder Legislativo. Direitos do art. 5º. Remédios`)
    expect(r[0]?.assuntos).toEqual(t(
      'Princípios fundamentais',
      'Direitos e garantias fundamentais',
      'Organização do Estado',
      'Controle de constitucionalidade',
      'Poder Legislativo',
      'Direitos do art. 5º',
      'Remédios',
    ))
  })

  it('junta linhas de continuação ao assunto anterior', () => {
    const r = lerEdital(`DIREITO CIVIL
1. Responsabilidade civil:
pressupostos e excludentes
2. Posse`)
    // "Responsabilidade civil:" termina em dois-pontos mas tem marcador, então é assunto
    expect(r[0]?.assuntos).toEqual(t('Responsabilidade civil: pressupostos e excludentes', 'Posse'))
  })

  it('remove repetições e junta a mesma matéria escrita duas vezes', () => {
    const r = lerEdital(`DIREITO CIVIL
1. Posse
2. posse
DIREITO CIVIL
3. Contratos`)
    expect(r).toEqual([{ materia: 'DIREITO CIVIL', assuntos: t('Posse', 'Contratos') }])
  })

  it('assuntos antes de qualquer matéria vão para "Geral"; texto vazio dá lista vazia', () => {
    expect(lerEdital('1. Algo solto')).toEqual([{ materia: 'Geral', assuntos: t('Algo solto') }])
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
  const ass = (id: string, materia: string, nome: string, ordem: number, extra = {}) => ({ id, materia, nome, ordem, importancia: 3, horasIdeais: 10, estudado: false, noCiclo: false, noEdital: true, paiId: null as string | null, ...extra })
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

describe('só o que é do edital aparece', () => {
  const materias = [{ id: 'm1', nome: 'Raciocínio Lógico', peso: 3, ordem: 0 }, { id: 'm2', nome: 'Civil', peso: 3, ordem: 1 }, { id: 'm3', nome: 'Vazia', peso: 3, ordem: 2 }]
  const a = (id: string, materia: string, nome: string, noEdital: boolean) => ({ id, materia, nome, ordem: 0, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital, paiId: null })
  const assuntos = [a('a1', 'Raciocínio Lógico', 'Proposições', false), a('a2', 'Civil', 'Posse', true), a('a3', 'Civil', 'Contratos', false)]

  it('matéria que só tem assuntos de fora do edital some; as vazias e as com assunto do edital ficam', () => {
    expect(materiasDoEdital(materias, assuntos).map((m) => m.nome)).toEqual(['Civil', 'Vazia'])
  })

  it('assunto criado fora do edital não entra na tabela nem nos totais', () => {
    const r = montarEdital({ materias, assuntos, questoes: [{ assuntoId: 'a3', feitas: 9, acertos: 9 }], sessoes: [], ordem: 'edital', ocultarEstudados: false, filtroMateria: null })
    expect(r.blocos.map((b) => b.materia.nome)).toEqual(['Civil', 'Vazia'])
    expect(r.blocos[0]?.linhas.map((l) => l.nome)).toEqual(['Posse'])
    expect(r.total).toMatchObject({ questoes: 0 })
    expect(r.total.resumo.assuntos).toBe(1)
  })
})

describe('hierarquia: tópico › subtópico', () => {
  it('"Tópico: parte; parte; parte" vira um tópico com subtópicos', () => {
    const r = lerEdital(`CONHECIMENTOS ESPECÍFICOS
1. Redes de computadores: conceitos básicos e avançados; arquiteturas de redes; modelo OSI e TCP/IP; NAT
2. Segurança da informação: criptografia; certificação digital; ataques
3. Banco de dados`)
    expect(r[0]?.assuntos).toEqual([
      { nome: 'Redes de computadores: conceitos básicos e avançados', filhos: ['Arquiteturas de redes', 'Modelo OSI e TCP/IP', 'NAT'] },
      { nome: 'Segurança da informação: criptografia', filhos: ['Certificação digital', 'Ataques'] },
      { nome: 'Banco de dados', filhos: [] },
    ])
  })

  it('"Item: texto" sem ponto e vírgula continua um assunto só, e vírgulas não separam nada', () => {
    const r = lerEdital(`DIREITO
1. Posse: conceito e natureza jurídica
2. Protocolos de comunicação, segmentação e endereçamento IPv4 e IPv6`)
    expect(r[0]?.assuntos).toEqual(t('Posse: conceito e natureza jurídica', 'Protocolos de comunicação, segmentação e endereçamento IPv4 e IPv6'))
  })

  it('numeração com ponto (1.1, 1.2) depois de um item numerado vira subtópico dele', () => {
    const r = lerEdital(`MATEMÁTICA
1. Matemática financeira
1.1 Porcentagem
1.2 Juros
2. Álgebra
2.1 Equações`)
    expect(r[0]?.assuntos).toEqual([
      { nome: 'Matemática financeira', filhos: ['Porcentagem', 'Juros'] },
      { nome: 'Álgebra', filhos: ['Equações'] },
    ])
  })

  it('repetir um tópico junta os subtópicos dele, sem duplicar', () => {
    const r = lerEdital(`DIREITO
1. Posse: a; b
2. posse: a; c`)
    expect(r[0]?.assuntos.map((i) => i.nome)).toHaveLength(1)
  })

  it('achatar e agrupar são inversos; um subtópico sem tópico acima vira tópico', () => {
    const itens = [{ nome: 'A', filhos: ['a1', 'a2'] }, { nome: 'B', filhos: [] }]
    expect(achatarItens(itens)).toEqual([{ nome: 'A', nivel: 0 }, { nome: 'a1', nivel: 1 }, { nome: 'a2', nivel: 1 }, { nome: 'B', nivel: 0 }])
    expect(agruparLinhas(achatarItens(itens))).toEqual(itens)
    expect(agruparLinhas([{ nome: 'solto', nivel: 1 }])).toEqual([{ nome: 'solto', filhos: [] }])
  })
})

describe('montarEdital com tópicos', () => {
  const materias = [{ id: 'm1', nome: 'Informática', peso: 4, ordem: 0 }]
  const a = (id: string, nome: string, ordem: number, paiId: string | null, extra = {}) => ({
    id, materia: 'Informática', nome, ordem, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: true, paiId, ...extra,
  })
  const assuntos = [
    a('t1', 'Redes', 0, null),
    a('f1', 'NAT', 1, 't1', { horasIdeais: 2, estudado: true }),
    a('f2', 'VLAN', 2, 't1', { horasIdeais: 4, importancia: 5 }),
    a('s1', 'Segurança', 3, null, { horasIdeais: 6 }),
  ]
  const questoes = [{ assuntoId: 'f1', feitas: 10, acertos: 8 }, { assuntoId: 'f2', feitas: 10, acertos: 4 }]
  const sessoes = [{ assuntoId: 'f1', minutos: 60 }, { assuntoId: 'f2', minutos: 30 }]
  const base = { materias, assuntos, questoes, sessoes, ordem: 'edital' as const, ocultarEstudados: false, filtroMateria: null }

  it('lista o tópico seguido dos subtópicos, com o nível de cada um', () => {
    const l = montarEdital(base).blocos[0]?.linhas ?? []
    expect(l.map((x) => `${x.nivel}:${x.nome}`)).toEqual(['0:Redes', '1:NAT', '1:VLAN', '0:Segurança'])
    expect(l.map((x) => x.temFilhos)).toEqual([true, false, false, false])
  })

  it('o tópico soma os subtópicos (questões, horas feitas e ideais, o que falta) e mostra a importância comum ou nenhuma', () => {
    const redes = montarEdital(base).blocos[0]?.linhas[0]
    expect(redes).toMatchObject({ certas: 12, erradas: 8, total: 20, pctAcerto: 60, horasFeitas: 1.5, horasIdeais: 6, folhas: 2, folhasEstudadas: 1, estudado: false })
    expect(redes?.falta).toBe(3.5) // só os não estudados: VLAN tem 4 h ideais e 0,5 h feita (NAT já está estudado)
    expect(redes?.importancia).toBeNull() // 3 e 5
  })

  it('o resumo conta só os assuntos de verdade (sem os tópicos), e os totais de questões não duplicam', () => {
    const r = montarEdital(base)
    expect(r.blocos[0]?.resumo).toMatchObject({ assuntos: 3, estudados: 1 })
    expect(r.total).toMatchObject({ certas: 12, erradas: 8, questoes: 20 })
  })

  it('tópico recolhido esconde os subtópicos, mas os números continuam', () => {
    const l = montarEdital({ ...base, recolhidos: new Set(['t1']) }).blocos[0]?.linhas ?? []
    expect(l.map((x) => x.nome)).toEqual(['Redes', 'Segurança'])
    expect(l[0]?.total).toBe(20)
  })

  it('ocultar estudados esconde subtópico estudado, e o tópico só some quando todos estão estudados', () => {
    expect((montarEdital({ ...base, ocultarEstudados: true }).blocos[0]?.linhas ?? []).map((x) => x.nome)).toEqual(['Redes', 'VLAN', 'Segurança'])
    const tudo = assuntos.map((x) => (x.paiId === 't1' ? { ...x, estudado: true } : x))
    expect((montarEdital({ ...base, assuntos: tudo, ocultarEstudados: true }).blocos[0]?.linhas ?? []).map((x) => x.nome)).toEqual(['Segurança'])
  })

  it('ordenar por prioridade reordena os tópicos e, dentro de cada um, os subtópicos', () => {
    const l = montarEdital({ ...base, ordem: 'prioridade' }).blocos[0]?.linhas ?? []
    const nomes = l.map((x) => x.nome)
    // o tópico vem antes dos subtópicos; dentro de Redes, VLAN (não estudado, importância 5) vem antes de NAT (estudado)
    expect(nomes.indexOf('Redes')).toBeLessThan(nomes.indexOf('VLAN'))
    expect(nomes.indexOf('VLAN')).toBeLessThan(nomes.indexOf('NAT'))
  })

  it('subtópico cujo tópico não é do edital vira linha solta (não some)', () => {
    const solto = assuntos.map((x) => (x.id === 't1' ? { ...x, noEdital: false } : x))
    const l = montarEdital({ ...base, assuntos: solto }).blocos[0]?.linhas ?? []
    expect(l.map((x) => `${x.nivel}:${x.nome}`)).toEqual(['0:NAT', '0:VLAN', '0:Segurança'])
  })
})

describe('apresentação dos nomes', () => {
  it('maiúscula na primeira letra, sem mexer no resto', () => {
    expect(maiuscula('hardware e software')).toBe('Hardware e software')
    expect(maiuscula('NAT')).toBe('NAT')
    expect(maiuscula('óleo')).toBe('Óleo')
    expect(maiuscula('')).toBe('')
  })

  it('partir o nome do tópico no primeiro dois-pontos (só para mostrar)', () => {
    expect(partirNome('Redes de computadores: conceitos básicos e avançados')).toEqual({ titulo: 'Redes de computadores', resto: 'conceitos básicos e avançados' })
    expect(partirNome('Banco de dados')).toEqual({ titulo: 'Banco de dados', resto: '' })
    expect(partirNome('Lei 8.112: art. 5º: tal')).toEqual({ titulo: 'Lei 8.112', resto: 'art. 5º: tal' })
    expect(partirNome('X: y')).toEqual({ titulo: 'X: y', resto: '' }) // título curto demais
    expect(partirNome('Algo:')).toEqual({ titulo: 'Algo:', resto: '' })
  })
})

describe('repartirHoras', () => {
  it('divide em partes iguais e a soma fecha com o total', () => {
    expect(repartirHoras(12, 4)).toEqual([3, 3, 3, 3])
    expect(repartirHoras(10, 3)).toEqual([3.34, 3.33, 3.33])
    const partes = repartirHoras(7.5, 8)
    expect(Math.round(partes.reduce((s, x) => s + x, 0) * 100) / 100).toBe(7.5)
  })
  it('zero, negativo e sem partes', () => {
    expect(repartirHoras(0, 3)).toEqual([0, 0, 0])
    expect(repartirHoras(-2, 2)).toEqual([0, 0])
    expect(repartirHoras(5, 0)).toEqual([])
  })
})

describe('prioridade sem dados', () => {
  const materias = [{ id: 'm1', nome: 'Info', peso: 3, ordem: 0 }]
  const a = (id: string, paiId: string | null, extra = {}) => ({ id, materia: 'Info', nome: id, ordem: 0, importancia: 0, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: true, paiId, ...extra })
  const base = { materias, questoes: [], sessoes: [], ordem: 'edital' as const, ocultarEstudados: false, filtroMateria: null }
  it('sem importância, horas nem questões a linha está "sem dados"; basta definir uma coisa para sair disso', () => {
    const vazio = montarEdital({ ...base, assuntos: [a('x', null)] }).blocos[0]?.linhas[0]
    expect(vazio?.semDados).toBe(true)
    expect(montarEdital({ ...base, assuntos: [a('x', null, { importancia: 5 })] }).blocos[0]?.linhas[0]?.semDados).toBe(false)
    expect(montarEdital({ ...base, assuntos: [a('x', null, { horasIdeais: 2 })] }).blocos[0]?.linhas[0]?.semDados).toBe(false)
  })
  it('o tópico só fica "sem dados" se todos os subtópicos estiverem', () => {
    const l = (extra: object) => montarEdital({ ...base, assuntos: [a('t', null), a('f1', 't'), a('f2', 't', extra)] }).blocos[0]?.linhas[0]
    expect(l({})?.semDados).toBe(true)
    expect(l({ horasIdeais: 3 })?.semDados).toBe(false)
  })
})

describe('importância "não definida" (0)', () => {
  it('conta como média na prioridade, mas escolher 3 de propósito tira a linha de "sem dados"', () => {
    const entrada = { pesoMateria: 4, horasIdeais: 10, horasFeitas: 0, estudado: false, questoes: 0, acertos: 0 }
    expect(prioridade({ ...entrada, importancia: 0 })).toBe(prioridade({ ...entrada, importancia: 3 }))
    const materias = [{ id: 'm1', nome: 'Info', peso: 3, ordem: 0 }]
    const linha = (importancia: number) =>
      montarEdital({
        materias, questoes: [], sessoes: [], ordem: 'edital', ocultarEstudados: false, filtroMateria: null,
        assuntos: [{ id: 'x', materia: 'Info', nome: 'X', ordem: 0, importancia, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: true, paiId: null }],
      }).blocos[0]?.linhas[0]
    expect(linha(0)?.semDados).toBe(true)
    expect(linha(3)?.semDados).toBe(false)
  })
})

describe('busca no edital', () => {
  const materias = [{ id: 'm1', nome: 'Informática', peso: 4, ordem: 0 }, { id: 'm2', nome: 'Direito Penal', peso: 3, ordem: 1 }]
  const a = (id: string, materia: string, nome: string, ordem: number, paiId: string | null = null) => ({
    id, materia, nome, ordem, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: true, paiId,
  })
  const assuntos = [
    a('t1', 'Informática', 'Redes', 0),
    a('f1', 'Informática', 'NAT', 1, 't1'),
    a('f2', 'Informática', 'Segurança de redes', 2, 't1'),
    a('s1', 'Informática', 'Planilhas', 3),
    a('p1', 'Direito Penal', 'Crimes contra a pessoa', 0),
  ]
  const base = { materias, assuntos, questoes: [], sessoes: [], ordem: 'edital' as const, ocultarEstudados: false, filtroMateria: null }
  const nomes = (busca: string, extra = {}) => montarEdital({ ...base, busca, ...extra }).blocos.map((b) => `${b.materia.nome}: ${b.linhas.map((l) => l.nome).join(', ')}`)

  it('acha o subtópico (sem acento e caixa) e mantém o tópico acima; matérias sem nada somem', () => {
    expect(nomes('SEGURANCA')).toEqual(['Informática: Redes, Segurança de redes'])
  })

  it('tópico encontrado mostra todos os subtópicos, mesmo recolhido', () => {
    expect(nomes('redes', { recolhidos: new Set(['t1']) })).toEqual(['Informática: Redes, NAT, Segurança de redes'])
  })

  it('nome da matéria encontrado mostra a matéria inteira', () => {
    expect(nomes('penal')).toEqual(['Direito Penal: Crimes contra a pessoa'])
  })

  it('busca vazia não muda nada, e os totais não dependem da busca', () => {
    expect(nomes('  ')).toEqual(nomes(''))
    expect(montarEdital({ ...base, busca: 'nat' }).total.resumo.assuntos).toBe(4)
    expect(nomes('xyz')).toEqual([])
  })
})

describe('revisões no edital', () => {
  const materias = [{ id: 'm1', nome: 'Informática', peso: 4, ordem: 0 }, { id: 'm2', nome: 'Penal', peso: 3, ordem: 1 }]
  const rev = (dia: string, feitaEm: string | null = null) => ({ dia, feitaEm, resultado: feitaEm ? ('ok' as const) : null })
  const a = (id: string, materia: string, nome: string, ordem: number, paiId: string | null, extra = {}) => ({
    id, materia, nome, ordem, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: true, paiId, ...extra,
  })
  const assuntos = [
    a('t1', 'Informática', 'Redes', 0, null),
    a('f1', 'Informática', 'NAT', 1, 't1', { estudado: true, revisoes: [rev('2026-10-25'), rev('2026-11-30')] }),
    a('f2', 'Informática', 'VLAN', 2, 't1', { estudado: true, revisoes: [rev('2026-10-28')] }),
    a('s1', 'Informática', 'Planilhas', 3, null, { estudado: true, revisoes: [rev('2026-11-02')] }),
    a('p1', 'Penal', 'Penas', 0, null),
  ]
  const base = { materias, assuntos, questoes: [], sessoes: [], ordem: 'edital' as const, ocultarEstudados: false, filtroMateria: null, hoje: '2026-10-28' }

  it('estado e próxima revisão por assunto; o tópico mostra o pior estado e a revisão mais próxima', () => {
    const l = montarEdital(base).blocos[0]?.linhas ?? []
    expect(l.map((x) => `${x.nome}:${x.revisao}:${x.proximaRevisao}`)).toEqual([
      'Redes:atrasada:2026-10-25', 'NAT:atrasada:2026-10-25', 'VLAN:hoje:2026-10-28', 'Planilhas:futura:2026-11-02',
    ])
    expect(montarEdital(base).blocos[1]?.linhas[0]).toMatchObject({ revisao: 'nenhuma', proximaRevisao: null, revisoes: [] })
  })

  it('"Revisões de hoje" mostra só as devidas (mesmo estudadas e com ocultar estudados) e some com matérias vazias', () => {
    const r = montarEdital({ ...base, soRevisar: true, ocultarEstudados: true })
    expect(r.blocos.map((b) => b.linhas.map((x) => x.nome))).toEqual([['Redes', 'NAT', 'VLAN']])
    expect(r.total.resumo.assuntos).toBe(4)
  })
})
