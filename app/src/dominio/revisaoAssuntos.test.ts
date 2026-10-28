import { describe, expect, it } from 'vitest'
import { agendarRevisoes, aoMudarEstudado, diasDeAtraso, estadoRevisoes, lerIntervalos, piorEstado, proximaRevisao, responderRevisao } from './revisaoAssuntos'

const HOJE = '2026-10-28'

describe('agendar e estado', () => {
  it('agenda 1, 7 e 30 dias depois, na virada do mês', () => {
    expect(agendarRevisoes(HOJE).map((r) => r.dia)).toEqual(['2026-10-29', '2026-11-04', '2026-11-27'])
    expect(agendarRevisoes(HOJE, [2])).toEqual([{ dia: '2026-10-30', feitaEm: null, resultado: null }])
  })

  it('nenhuma, futura, hoje, atrasada e concluída', () => {
    const r = agendarRevisoes('2026-10-27') // a primeira vence hoje
    expect(estadoRevisoes([], HOJE)).toBe('nenhuma')
    expect(estadoRevisoes(r, '2026-10-27')).toBe('futura')
    expect(estadoRevisoes(r, HOJE)).toBe('hoje')
    expect(estadoRevisoes(r, '2026-10-31')).toBe('atrasada')
    expect(diasDeAtraso(r, '2026-10-31')).toBe(3)
    expect(diasDeAtraso(r, HOJE)).toBe(0)
    const tudo = r.map((x) => ({ ...x, feitaEm: HOJE, resultado: 'ok' as const }))
    expect(estadoRevisoes(tudo, HOJE)).toBe('concluida')
    expect(proximaRevisao(tudo)).toBeNull()
  })

  it('o pior estado manda', () => {
    expect(piorEstado(['concluida', 'futura', 'atrasada', 'hoje'])).toBe('atrasada')
    expect(piorEstado([])).toBe('nenhuma')
  })
})

describe('responder', () => {
  const r = agendarRevisoes('2026-10-27')

  it('"Entendi" conclui só a próxima', () => {
    const d = responderRevisao(r, HOJE, 'ok')
    expect(d[0]).toEqual({ dia: HOJE, feitaEm: HOJE, resultado: 'ok' })
    expect(d.slice(1)).toEqual(r.slice(1))
    expect(estadoRevisoes(d, HOJE)).toBe('futura')
  })

  it('"Preciso rever" conclui a próxima e recomeça a sequência a partir de hoje', () => {
    const d = responderRevisao(r, HOJE, 'rever')
    expect(d).toHaveLength(4)
    expect(d[0]).toMatchObject({ feitaEm: HOJE, resultado: 'rever' })
    expect(d.slice(1).map((x) => x.dia)).toEqual(['2026-10-29', '2026-11-04', '2026-11-27'])
  })

  it('sem nada pendente não muda', () => {
    const tudo = r.map((x) => ({ ...x, feitaEm: HOJE, resultado: 'ok' as const }))
    expect(responderRevisao(tudo, HOJE, 'rever')).toEqual(tudo)
  })
})

describe('marcar e desmarcar estudado', () => {
  it('marcar agenda; desmarcar tira as pendentes e guarda as feitas; sem mudança devolve null', () => {
    const marcado = aoMudarEstudado({ estudado: false }, true, HOJE, [1, 7])
    expect(marcado).toEqual({ estudadoEm: HOJE, revisoes: agendarRevisoes(HOJE, [1, 7]) })
    const umaFeita = responderRevisao(marcado?.revisoes ?? [], '2026-10-29', 'ok')
    expect(aoMudarEstudado({ estudado: true, revisoes: umaFeita }, false, HOJE)).toEqual({ estudadoEm: null, revisoes: [umaFeita[0]] })
    expect(aoMudarEstudado({ estudado: true }, true, HOJE)).toBeNull()
  })
})

describe('lerIntervalos', () => {
  it('aceita vírgula, espaço ou ponto e vírgula; exige crescentes de 1 a 365', () => {
    expect(lerIntervalos('1, 7, 30')).toEqual([1, 7, 30])
    expect(lerIntervalos(' 2 10;40 ')).toEqual([2, 10, 40])
    expect(lerIntervalos('7, 1')).toBeNull()
    expect(lerIntervalos('0, 7')).toBeNull()
    expect(lerIntervalos('1,5')).toEqual([1, 5])
    expect(lerIntervalos('1.5')).toBeNull()
    expect(lerIntervalos('')).toBeNull()
  })
})
