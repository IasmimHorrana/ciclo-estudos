import { describe, expect, it } from 'vitest'
import {
  agendar, alternarPasso, aplicarSnapshot, atribuirCores, calcularDistribuicao, configPadrao, construirSemana, corDe, diasDisponiveis, fmtH,
  gerarCicloEspacado, limparMarcacoes, normalizarConfig, passosDe, previaAgenda, previaPassos, PALETA, reagendarPendentes, resumoSemana,
  semanaAlvo, snapshotConfig, validarGerar, todasMaterias, type MateriaCfg,
} from '@/dominio/ciclo'
import type { ConfigCiclo } from '@/dados/esquemas'

// 09/10/2026 é sexta-feira (semana de 05/10 a 11/10)
const SEXTA = '2026-10-09'
const AGORA = new Date(2026, 9, 9, 10, 0).getTime()
const cfg = (o: Partial<ConfigCiclo> = {}): ConfigCiclo => ({
  ...configPadrao(), horas: 6, duracao: 1, dias: [false, false, false, false, true, true, true], porDia: null,
  mats: [{ nome: 'RL', rep: 2, peso: 3 }, { nome: 'GO', rep: 1, peso: 3 }, { nome: 'LP', rep: 1, peso: 3 }, { nome: 'INF', rep: 2, peso: 3 }] as MateriaCfg[], ...o,
})

describe('formato e tamanho do ciclo', () => {
  it('fmtH', () => {
    expect(fmtH(0.25)).toBe('15min')
    expect(fmtH(1)).toBe('1h00')
    expect(fmtH(2.5)).toBe('2h30')
  })
  it('passos = horas ÷ duração, no mínimo 1', () => {
    expect(passosDe({ horas: 28, duracao: 1 })).toBe(28)
    expect(passosDe({ horas: 6, duracao: 1.5 })).toBe(4)
    expect(passosDe({ horas: 0.2, duracao: 1 })).toBe(1)
  })
  it('normalizar mantém as repetições dentro do limite e o peso entre 1 e 5', () => {
    const c = normalizarConfig(cfg({ horas: 3, mats: [{ nome: 'A', rep: 9, peso: 9 }, { nome: 'B', rep: -2, peso: 0 }] }))
    expect(c.passos).toBe(3)
    expect(c.mats).toEqual([{ nome: 'A', rep: 3, peso: 5 }, { nome: 'B', rep: 0, peso: 3 }])
  })
  it('lista de matérias: padrão + próprias − tiradas', () => {
    const l = todasMaterias({ custom: ['Inglês'], ocultas: ['Estatística'] })
    expect(l).toContain('Inglês')
    expect(l).not.toContain('Estatística')
    expect(l).toHaveLength(10)
  })
})

describe('distribuição e geração', () => {
  it('distribuição soma exatamente o total e dá ao menos 1 a cada matéria', () => {
    const d = calcularDistribuicao([{ nome: 'A', peso: 5 }, { nome: 'B', peso: 1 }, { nome: 'C', peso: 1 }], 7, 10)
    expect(d.reduce((s, x) => s + x.horas, 0)).toBe(10)
    expect(d.every((x) => x.horas >= 1)).toBe(true)
    expect(d.find((x) => x.nome === 'A')!.horas).toBeGreaterThan(d.find((x) => x.nome === 'B')!.horas)
  })

  it('ciclo espaçado respeita as repetições e evita a mesma matéria em sequência', () => {
    const lista = gerarCicloEspacado([{ nome: 'A', peso: 3 }, { nome: 'B', peso: 2 }, { nome: 'C', peso: 1 }], 6)
    expect(lista).toHaveLength(6)
    expect(lista.filter((x) => x === 'A')).toHaveLength(3)
    expect(lista.filter((x) => x === 'B')).toHaveLength(2)
    for (let i = 1; i < lista.length; i++) expect(lista[i]).not.toBe(lista[i - 1])
  })

  it('prévia: livre usa as repetições; ponderado divide por peso', () => {
    expect(previaPassos(cfg())).toEqual({ RL: 2, GO: 1, LP: 1, INF: 2 })
    const p = previaPassos(cfg({ modo: 'Recomendado', mats: [{ nome: 'A', rep: 0, peso: 4 }, { nome: 'B', rep: 0, peso: 2 }] }))
    expect(p.A! + p.B!).toBe(6)
  })
})

describe('validação ao gerar', () => {
  it('ok quando a soma das repetições é igual ao total de passos', () => {
    expect(validarGerar(cfg())).toEqual({ ok: true })
  })
  it('mensagens claras quando não dá', () => {
    expect(validarGerar(cfg({ mats: [] }))).toMatchObject({ ok: false, erro: expect.stringContaining('ao menos uma matéria') })
    expect(validarGerar(cfg({ horas: 7 }))).toMatchObject({ ok: false, erro: expect.stringContaining('deve ser igual a 7') })
    expect(validarGerar(cfg({ modo: 'Recomendado', horas: 2 }))).toMatchObject({ ok: false, erro: expect.stringContaining('4 matérias para 2 passos') })
  })
})

describe('agenda pelo calendário', () => {
  it('só entram os dias marcados de hoje em diante (sex, sáb, dom)', () => {
    expect(diasDisponiveis('2026-10-05', cfg().dias, SEXTA)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11'])
    expect(diasDisponiveis('2026-10-05', cfg().dias, '2026-10-10')).toEqual(['2026-10-10', '2026-10-11'])
  })

  it('sem dia disponível nesta semana, a semana alvo é a próxima', () => {
    expect(semanaAlvo(SEXTA, cfg().dias)).toBe('2026-10-05')
    const soSegunda = [true, false, false, false, false, false, false]
    expect(semanaAlvo(SEXTA, soSegunda)).toBe('2026-10-12')
    expect(semanaAlvo('2026-10-12', soSegunda)).toBe('2026-10-12')
  })

  it('distribui 6 passos em 3 dias, 2 por dia, na ordem', () => {
    const s = construirSemana(cfg(), SEXTA, AGORA)
    expect(s.passos.map((p) => p.dia)).toEqual(['2026-10-09', '2026-10-09', '2026-10-10', '2026-10-10', '2026-10-11', '2026-10-11'])
    expect(s).toMatchObject({ seg: '2026-10-05', dom: '2026-10-11', inicio: SEXTA, meta: null, pomodoros: 0 })
    expect(s.passos.every((p) => p.horasPlanejadas === 1 && !p.feito)).toBe(true)
  })

  it('o que não cabe fica sem dia; "passos por dia" manda na capacidade', () => {
    const base = construirSemana(cfg(), SEXTA, AGORA).passos
    const ag = agendar(base, '2026-10-05', { dias: cfg().dias, porDia: 1 }, SEXTA)
    expect(ag.map((p) => p.dia)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11', null, null, null])
    expect(previaAgenda(cfg({ porDia: 1 }), SEXTA)).toContain('Só cabem 3 dos 6 passos; 3 ficarão sem dia')
  })

  it('reagendar mexe só nos pendentes e preserva os concluídos', () => {
    let s = construirSemana(cfg(), SEXTA, AGORA)
    s = alternarPasso(s, 1, true)
    const r = reagendarPendentes(s, cfg(), '2026-10-10')
    expect(r.passos[0]).toEqual(s.passos[0])
    expect(r.passos.slice(1).every((p) => p.dia === '2026-10-10' || p.dia === '2026-10-11')).toBe(true)
  })
})

describe('semana: marcar, limpar, resumo', () => {
  it('concluir um passo sem horas lança as horas planejadas; com horas, preserva', () => {
    const s = construirSemana(cfg(), SEXTA, AGORA)
    expect(alternarPasso(s, 1, true).passos[0]).toMatchObject({ feito: true, horasFeitas: 1 })
    const com = { ...s, passos: s.passos.map((p) => (p.id === 2 ? { ...p, horasFeitas: 0.5 } : p)) }
    expect(alternarPasso(com, 2, true).passos[1]?.horasFeitas).toBe(0.5)
  })

  it('resumo: ciclo fechado só quando todos os passos estão feitos', () => {
    let s = construirSemana(cfg(), SEXTA, AGORA)
    for (const p of s.passos) s = alternarPasso(s, p.id, true)
    expect(resumoSemana(s, SEXTA, AGORA)).toMatchObject({ cicloFechado: true, pctConcluido: 100, horasEstudadas: 6, metaHoras: 6, horasFaltando: 0 })
    s = alternarPasso(s, 3, false)
    expect(resumoSemana(s, SEXTA, AGORA).cicloFechado).toBe(false)
  })

  it('resumo soma horas por matéria e traz o modelo usado', () => {
    let s = construirSemana(cfg(), SEXTA, AGORA)
    s = alternarPasso(alternarPasso(s, 1, true), 2, true)
    const r = resumoSemana({ ...s, pomodoros: 3 }, SEXTA, AGORA)
    expect(Object.values(r.porMateria).reduce((a, b) => a + b, 0)).toBe(2)
    expect(r.pomodoros).toBe(3)
    expect(r.modelo?.horas).toBe(6)
  })

  it('meta manual substitui a soma dos planejados', () => {
    const s = { ...construirSemana(cfg(), SEXTA, AGORA), meta: 10 }
    expect(resumoSemana(s, SEXTA, AGORA).metaHoras).toBe(10)
  })

  it('limpar marcações zera tudo e reagenda a partir de hoje', () => {
    let s = construirSemana(cfg(), SEXTA, AGORA)
    s = { ...alternarPasso(s, 1, true), pomodoros: 4 }
    const l = limparMarcacoes(s, cfg(), '2026-10-10', AGORA + 1)
    expect(l.passos.every((p) => !p.feito && p.horasFeitas === 0 && p.nota === '')).toBe(true)
    expect(l.pomodoros).toBe(0)
    expect(l.passos[0]?.dia).toBe('2026-10-10')
  })
})

describe('modelos', () => {
  it('aplicar uma foto restaura a montagem e passa a conhecer matérias novas', () => {
    const modelo = snapshotConfig(cfg({ mats: [{ nome: 'Inglês', rep: 6, peso: 3 }] }))
    const c = aplicarSnapshot(configPadrao(), modelo)
    expect(c.mats).toEqual([{ nome: 'Inglês', rep: 6, peso: 3 }])
    expect(c.custom).toContain('Inglês')
    expect(c.passos).toBe(6)
  })
  it('a foto é uma cópia (mudar depois não altera o modelo)', () => {
    const c = cfg()
    const foto = snapshotConfig(c)
    c.mats[0]!.rep = 99
    expect(foto.mats[0]!.rep).toBe(2)
  })
})

describe('cores', () => {
  it('atribui cores diferentes e mantém as que já existem', () => {
    const c = atribuirCores({ A: 3 }, ['A', 'B', 'C'])
    expect(c.A).toBe(3)
    expect(new Set(Object.values(c)).size).toBe(3)
  })
  it('corDe usa a guardada, ou uma estável pelo nome', () => {
    expect(corDe({ A: 2 }, 'A')).toBe(PALETA[2])
    expect(corDe({}, 'Qualquer')).toBe(corDe({}, 'Qualquer'))
  })
})
