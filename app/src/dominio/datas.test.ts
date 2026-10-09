import { describe, expect, it } from 'vitest'
import { addDias, fmtData, hoje, idxDia, mesGrade, parseISO, segundaDe, toISO, tituloMes } from './datas'

describe('datas (fuso local)', () => {
  it('hoje() usa o dia local, mesmo às 23:30 (o bug do UTC marcava o dia seguinte)', () => {
    expect(hoje(new Date(2026, 9, 9, 23, 30))).toBe('2026-10-09')
    expect(hoje(new Date(2026, 9, 10, 0, 5))).toBe('2026-10-10')
  })

  it('toISO e parseISO são inversos', () => {
    expect(toISO(parseISO('2026-02-28'))).toBe('2026-02-28')
    expect(toISO(parseISO('2028-02-29'))).toBe('2028-02-29')
  })

  it('addDias atravessa mês, ano e fevereiro bissexto', () => {
    expect(addDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('segunda-feira é o primeiro dia da semana', () => {
    expect(idxDia('2026-10-09')).toBe(4) // sexta
    expect(idxDia('2026-10-05')).toBe(0) // segunda
    expect(idxDia('2026-10-11')).toBe(6) // domingo
    expect(segundaDe('2026-10-09')).toBe('2026-10-05')
    expect(segundaDe('2026-10-11')).toBe('2026-10-05')
    expect(segundaDe('2026-10-05')).toBe('2026-10-05')
  })

  it('fmtData mostra dia/mês', () => {
    expect(fmtData('2026-10-09')).toBe('09/10')
  })

  it('mesGrade começa na segunda e tem o nº de linhas que o mês precisa', () => {
    const out = mesGrade(2026, 9) // outubro de 2026 começa numa quinta
    expect(out).toHaveLength(35)
    expect(out[0]).toEqual({ iso: '2026-09-28', doMes: false })
    expect(out[3]).toEqual({ iso: '2026-10-01', doMes: true })
    expect(out.filter((c) => c.doMes)).toHaveLength(31)
    expect(mesGrade(2027, 1)).toHaveLength(28) // fev/2027 começa numa segunda e tem 28 dias
    expect(mesGrade(2026, 7)).toHaveLength(42) // agosto/2026: começa num sábado, 31 dias
  })

  it('tituloMes capitaliza só a primeira letra', () => {
    expect(tituloMes(2026, 9)).toBe('Outubro de 2026')
  })
})
