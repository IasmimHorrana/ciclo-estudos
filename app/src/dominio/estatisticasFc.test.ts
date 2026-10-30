import { describe, expect, it } from 'vitest'
import {
  acertosNaArvore, acertosPorSemana, cartoesMaisErrados, idsDaArvore, inicioDoPeriodoFc, MIN_RESPOSTAS, nivelFc, resumoRespostas, situacaoCartoes,
  type Resposta,
} from '@/dominio/estatisticasFc'
import type { Botao, TipoCartao } from '@/dominio/sm2'

const HOJE = 20_000
const r = (dia: number, botao: Botao, cartaoId = 'c1', estadoAntes: TipoCartao = 'revisao', baralhoId = 'b1'): Resposta => ({
  cartaoId, baralhoId, dia, botao, estadoAntes, tempoMs: 5000,
})

describe('resumoRespostas', () => {
  it('conta acerto como qualquer botão menos Errei e separa aprendizado de revisão', () => {
    const rs = [r(HOJE, 1, 'c1', 'novo'), r(HOJE, 3, 'c1', 'aprendendo'), r(HOJE, 2, 'c2'), r(HOJE, 4, 'c2'), r(HOJE, 1, 'c3'), r(HOJE, 3, 'c3', 'reaprendendo')]
    const s = resumoRespostas(rs)
    expect(s.total).toEqual({ respostas: 6, acertos: 4 })
    expect(s.aprendizado).toEqual({ respostas: 3, acertos: 2 })
    expect(s.revisao).toEqual({ respostas: 3, acertos: 2 })
    expect(s.botoes).toEqual([2, 1, 2, 1])
    expect(s.cartoes).toBe(3)
    expect(s.tempoMs).toBe(30_000)
    expect(s.pct).toBe(67)
    expect(s.nivel).toBe('na') // menos de 10 respostas
  })

  it('respeita o início do período', () => {
    const rs = [r(HOJE - 30, 3), r(HOJE - 29, 1), r(HOJE - 6, 3), r(HOJE, 3)]
    expect(resumoRespostas(rs, inicioDoPeriodoFc('hoje', HOJE)).total).toEqual({ respostas: 1, acertos: 1 })
    expect(resumoRespostas(rs, inicioDoPeriodoFc('7', HOJE)).total).toEqual({ respostas: 2, acertos: 2 })
    expect(resumoRespostas(rs, inicioDoPeriodoFc('30', HOJE)).total).toEqual({ respostas: 3, acertos: 2 })
    expect(resumoRespostas(rs, inicioDoPeriodoFc('tudo', HOJE)).total.respostas).toBe(4)
  })

  it('sem respostas fica zerado', () => {
    const s = resumoRespostas([])
    expect(s.pct).toBe(0)
    expect(s.nivel).toBe('na')
  })
})

describe('nivelFc', () => {
  it('precisa de 10 respostas e usa as faixas do Desempenho', () => {
    expect(nivelFc({ respostas: MIN_RESPOSTAS - 1, acertos: 9 })).toBe('na')
    expect(nivelFc({ respostas: 10, acertos: 5 })).toBe('fraco')
    expect(nivelFc({ respostas: 10, acertos: 7 })).toBe('medio')
    expect(nivelFc({ respostas: 10, acertos: 8 })).toBe('bom')
    expect(nivelFc({ respostas: 10, acertos: 9 })).toBe('dom')
  })
})

describe('situacaoCartoes', () => {
  it('separa jovens e maduros pelo intervalo de 21 dias e conta suspensos à parte', () => {
    const s = situacaoCartoes([
      { tipo: 'novo', intervalo: 0, suspenso: false },
      { tipo: 'aprendendo', intervalo: 0, suspenso: false },
      { tipo: 'reaprendendo', intervalo: 5, suspenso: false },
      { tipo: 'revisao', intervalo: 20, suspenso: false },
      { tipo: 'revisao', intervalo: 21, suspenso: false },
      { tipo: 'revisao', intervalo: 90, suspenso: true },
    ])
    expect(s).toEqual({ novos: 1, aprendendo: 2, jovens: 1, maduros: 1, suspensos: 1 })
  })
})

describe('acertosPorSemana', () => {
  it('agrupa em blocos de 7 dias terminando hoje, do mais antigo ao mais novo', () => {
    const rs = [r(HOJE, 3), r(HOJE - 6, 1), r(HOJE - 7, 3), r(HOJE - 13, 3), r(HOJE - 14, 1), r(HOJE + 1, 1)]
    const s = acertosPorSemana(rs, HOJE, 2)
    expect(s).toHaveLength(2)
    expect(s[1]).toMatchObject({ inicio: HOJE - 6, fim: HOJE, respostas: 2, acertos: 1, pct: 50 })
    expect(s[0]).toMatchObject({ inicio: HOJE - 13, fim: HOJE - 7, respostas: 2, acertos: 2, pct: 100 })
  })
})

describe('cartoesMaisErrados', () => {
  it('ordena por erros e deixa de fora quem nunca errou', () => {
    const rs = [r(HOJE, 1, 'a'), r(HOJE, 1, 'a'), r(HOJE, 3, 'a'), r(HOJE, 1, 'b'), r(HOJE, 3, 'c'), r(HOJE, 1, 'd'), r(HOJE, 3, 'd')]
    expect(cartoesMaisErrados(rs, 10)).toEqual([
      { cartaoId: 'a', erros: 2, respostas: 3 },
      { cartaoId: 'd', erros: 1, respostas: 2 },
      { cartaoId: 'b', erros: 1, respostas: 1 },
    ])
    expect(cartoesMaisErrados(rs, 1)).toHaveLength(1)
  })
})

describe('árvore de baralhos', () => {
  const baralhos = [
    { id: 'adm', nome: 'Adm' },
    { id: 'lei', nome: 'Adm::Lei 8.112' },
    { id: 'lic', nome: 'Adm::Licitações' },
    { id: 'adm2', nome: 'Administração' }, // começa igual mas não é filho
  ]

  it('soma os subbaralhos no pai', () => {
    const por = new Map([
      ['adm', { respostas: 1, acertos: 1 }],
      ['lei', { respostas: 4, acertos: 2 }],
      ['lic', { respostas: 5, acertos: 5 }],
      ['adm2', { respostas: 3, acertos: 0 }],
    ])
    const s = acertosNaArvore(baralhos, por)
    expect(s.get('adm')).toEqual({ respostas: 10, acertos: 8 })
    expect(s.get('lei')).toEqual({ respostas: 4, acertos: 2 })
    expect(s.get('adm2')).toEqual({ respostas: 3, acertos: 0 })
  })

  it('idsDaArvore pega o baralho e os filhos', () => {
    expect(idsDaArvore(baralhos, 'adm')).toEqual(['adm', 'lei', 'lic'])
    expect(idsDaArvore(baralhos, null)).toHaveLength(4)
    expect(idsDaArvore(baralhos, 'sumiu')).toEqual([])
  })
})
