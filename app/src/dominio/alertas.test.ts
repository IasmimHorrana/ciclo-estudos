import { describe, expect, it } from 'vitest'
import { alertasDeReforco } from './alertas'
import type { LinhaEdital } from './edital'

const HOJE = '2026-10-28'
const linha = (id: string, extra: Partial<LinhaEdital> = {}): LinhaEdital => ({
  id, nome: id, nivel: 0, paiId: null, temFilhos: false, folhas: 1, folhasEstudadas: 0, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false,
  certas: 0, erradas: 0, total: 0, pctAcerto: null, horasFeitas: 0, falta: 0, prioridade: 1, semDados: false,
  revisao: 'nenhuma', proximaRevisao: null, revisoes: [], ...extra,
})
const em = (...ls: LinhaEdital[]) => ls.map((l) => ({ linha: l, materia: 'Informática' }))
const base = { questoes: [], sessoes: [], hoje: HOJE, maxPrioridade: 10 }

describe('alertasDeReforco', () => {
  it('acerto na faixa Fraco (com o mínimo de questões) e respeitando as faixas escolhidas', () => {
    const l = linha('Redes', { total: 20, certas: 11, erradas: 9 }) // 55%
    expect(alertasDeReforco({ ...base, linhas: em(l) }).alertas).toEqual([
      { assuntoId: 'Redes', nome: 'Redes', materia: 'Informática', motivo: 'acerto', texto: 'Acerto de 55% em 20 questões' },
    ])
    expect(alertasDeReforco({ ...base, linhas: em(l), faixas: { fraco: 50, medio: 70, bom: 90 } }).total).toBe(0)
    expect(alertasDeReforco({ ...base, linhas: em(linha('Pouco', { total: 4, certas: 0 })) }).total).toBe(0)
  })

  it('revisão atrasada vem primeiro, com os dias de atraso', () => {
    const atrasada = linha('NAT', { estudado: true, revisao: 'atrasada', revisoes: [{ dia: '2026-10-25', feitaEm: null, resultado: null }] })
    const fraco = linha('VLAN', { total: 10, certas: 2 })
    const r = alertasDeReforco({ ...base, linhas: em(fraco, atrasada) })
    expect(r.alertas.map((a) => `${a.nome}:${a.texto}`)).toEqual(['NAT:Revisão atrasada há 3 dias', 'VLAN:Acerto de 20% em 10 questões'])
  })

  it('prioridade alta e sem estudo; prioridade baixa, sem dados ou já com horas não alertam', () => {
    const r = alertasDeReforco({
      ...base,
      linhas: em(linha('Alta', { prioridade: 9 }), linha('Baixa', { prioridade: 3 }), linha('SemDados', { prioridade: 9, semDados: true }), linha('ComHoras', { prioridade: 9, horasFeitas: 1 })),
    })
    expect(r.alertas.map((a) => a.nome)).toEqual(['Alta'])
  })

  it('estudado e parado há 30 dias ou mais (conta a última questão, sessão ou revisão feita)', () => {
    const parado = linha('Parado', { estudado: true })
    const recente = linha('Recente', { estudado: true })
    const revisado = linha('Revisado', { estudado: true, revisao: 'concluida', revisoes: [{ dia: '2026-10-20', feitaEm: '2026-10-20', resultado: 'ok' }] })
    const r = alertasDeReforco({
      ...base,
      linhas: em(parado, recente, revisado),
      questoes: [{ assuntoId: 'Parado', data: '2026-09-01' }, { assuntoId: 'Revisado', data: '2026-08-01' }],
      sessoes: [{ assuntoId: 'Recente', data: '2026-10-10' }],
    })
    expect(r.alertas.map((a) => `${a.nome}:${a.texto}`)).toEqual(['Parado:Sem questões, tempo ou revisão há 57 dias'])
  })

  it('ignora tópicos, um alerta por assunto e limita a quantidade', () => {
    const topico = linha('Tópico', { temFilhos: true, total: 20, certas: 1 })
    const muitos = Array.from({ length: 12 }, (_, i) => linha(`A${i}`, { total: 10, certas: 1 }))
    const r = alertasDeReforco({ ...base, linhas: em(topico, ...muitos), limite: 5 })
    expect(r.total).toBe(12)
    expect(r.alertas).toHaveLength(5)
    expect(r.alertas.some((a) => a.nome === 'Tópico')).toBe(false)
  })
})
