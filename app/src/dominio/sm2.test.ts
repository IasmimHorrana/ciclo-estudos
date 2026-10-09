import { describe, expect, it } from 'vitest'
import {
  formatarIntervalo, intervaloComVariacao, novoCartao, numeroDoDia, OPCOES_PADRAO, previsaoDeBotoes, responder,
  type Botao, type EstadoCartao,
} from '@/dominio/sm2'

const O = OPCOES_PADRAO
const T0 = new Date(2026, 9, 9, 10, 0).getTime() // 09/10/2026 10:00 local
const H0 = numeroDoDia(T0)
const MIN = 60_000

const revisao = (o: Partial<EstadoCartao> = {}): EstadoCartao => ({
  ...novoCartao(1), tipo: 'revisao', intervalo: 10, facilidade: 2.5, venceDia: H0, repeticoes: 5, ...o,
})
const resp = (c: EstadoCartao, b: Botao, agora = T0, hoje = H0) => responder(c, b, O, agora, hoje, null)

describe('cartão novo / aprendendo', () => {
  it('Bom → passo 2 (10 min) → Bom → gradua com 1 dia e facilidade 250%', () => {
    const a = resp(novoCartao(1), 3)
    expect(a.cartao).toMatchObject({ tipo: 'aprendendo', passo: 1, venceMs: T0 + 10 * MIN })
    const b = resp(a.cartao, 3, T0 + 10 * MIN)
    expect(b.cartao).toMatchObject({ tipo: 'revisao', intervalo: 1, venceDia: H0 + 1, facilidade: 2.5 })
  })

  it('Errei volta ao 1º passo (1 min)', () => {
    const a = resp(novoCartao(1), 3).cartao
    expect(resp(a, 1).cartao).toMatchObject({ tipo: 'aprendendo', passo: 0, venceMs: T0 + 1 * MIN })
  })

  it('Difícil repete o passo com a média dos dois primeiros (1 e 10 → 5 min)', () => {
    expect(resp(novoCartao(1), 2).cartao).toMatchObject({ passo: 0, venceMs: T0 + 5 * MIN })
  })

  it('Difícil com um passo só vale ×1,5', () => {
    const r = responder(novoCartao(1), 2, { ...O, passos: [10] }, T0, H0, null)
    expect(r.cartao.venceMs).toBe(T0 + 15 * MIN)
  })

  it('Fácil gradua direto com 4 dias', () => {
    expect(resp(novoCartao(1), 4).cartao).toMatchObject({ tipo: 'revisao', intervalo: 4, venceDia: H0 + 4 })
  })

  it('sem passos configurados, Bom gradua direto', () => {
    const r = responder(novoCartao(1), 3, { ...O, passos: [] }, T0, H0, null)
    expect(r.cartao).toMatchObject({ tipo: 'revisao', intervalo: 1 })
  })

  it('conta a repetição e registra o estado de antes', () => {
    const r = resp(novoCartao(1), 3)
    expect(r.cartao.repeticoes).toBe(1)
    expect(r.log).toMatchObject({ estadoAntes: 'novo', tipoLog: 0, botao: 3 })
  })
})

describe('revisão', () => {
  it('Bom: 10 d × 2,5 = 25 d, facilidade igual', () => {
    expect(resp(revisao(), 3).cartao).toMatchObject({ intervalo: 25, venceDia: H0 + 25, facilidade: 2.5, tipo: 'revisao' })
  })

  it('Difícil: ×1,2 e facilidade −0,15', () => {
    expect(resp(revisao(), 2).cartao).toMatchObject({ intervalo: 12, facilidade: 2.35 })
  })

  it('Fácil: ×facilidade×1,3 e facilidade +0,15', () => {
    expect(resp(revisao(), 4).cartao).toMatchObject({ intervalo: 32, facilidade: 2.65 })
  })

  it('Errei: lapso, facilidade −0,20, reaprendizado em 10 min e intervalo volta ao mínimo', () => {
    const r = resp(revisao(), 1)
    expect(r.cartao).toMatchObject({ tipo: 'reaprendendo', lapsos: 1, facilidade: 2.3, intervalo: 1, venceMs: T0 + 10 * MIN })
    expect(r.log).toMatchObject({ tipoLog: 1, estadoAntes: 'revisao' })
  })

  it('facilidade nunca passa de 130% para baixo', () => {
    let c = revisao({ facilidade: 1.35 })
    c = resp(c, 1).cartao
    expect(c.facilidade).toBe(1.3)
    expect(resp(revisao({ facilidade: 1.4 }), 2).cartao.facilidade).toBe(1.3)
  })

  it('"novo intervalo" 50% mantém metade do intervalo depois do lapso', () => {
    const r = responder(revisao({ intervalo: 20 }), 1, { ...O, novoIntervalo: 0.5 }, T0, H0, null)
    expect(r.cartao.intervalo).toBe(10)
  })

  it('reaprendendo: Bom gradua e volta a ser revisão com o intervalo reduzido', () => {
    const lapso = resp(revisao(), 1).cartao
    const volta = resp(lapso, 3, T0 + 10 * MIN)
    expect(volta.cartao).toMatchObject({ tipo: 'revisao', intervalo: 1, venceDia: H0 + 1 })
    expect(volta.log.tipoLog).toBe(2)
  })

  it('reaprendendo: Fácil soma 1 dia', () => {
    const lapso = resp(revisao(), 1).cartao
    expect(resp(lapso, 4, T0 + 10 * MIN).cartao.intervalo).toBe(2)
  })

  it('sem passos de reaprendizado, o cartão segue como revisão', () => {
    const r = responder(revisao(), 1, { ...O, passosReaprender: [] }, T0, H0, null)
    expect(r.cartao).toMatchObject({ tipo: 'revisao', intervalo: 1, venceDia: H0 + 1, lapsos: 1 })
  })

  it('atraso entra na conta: 4 dias atrasado, Bom = (10+2)×2,5 = 30; Difícil = (10+1)×1,2 = 13', () => {
    const atrasado = revisao({ venceDia: H0 - 4 })
    expect(resp(atrasado, 3).cartao.intervalo).toBe(30)
    expect(resp(atrasado, 2).cartao.intervalo).toBe(13)
  })

  it('sempre difícil < bom < fácil, mesmo com intervalo e facilidade mínimos', () => {
    const c = revisao({ intervalo: 1, facilidade: 1.3 })
    const [d, b, f] = [2, 3, 4].map((x) => resp(c, x as Botao).cartao.intervalo) as [number, number, number]
    expect(d).toBeLessThan(b)
    expect(b).toBeLessThan(f)
  })

  it('respeita o intervalo máximo (36500 dias)', () => {
    const r = resp(revisao({ intervalo: 30000, facilidade: 3 }), 4)
    expect(r.cartao.intervalo).toBe(36500)
  })

  it('sanguessuga: suspende no 8º lapso e de novo no 12º, mas não nos intermediários', () => {
    const lapsosDepois = (n: number) => resp(revisao({ lapsos: n - 1 }), 1).log.sanguessuga
    expect(lapsosDepois(7)).toBe(false)
    expect(lapsosDepois(8)).toBe(true)
    expect(lapsosDepois(9)).toBe(false)
    expect(lapsosDepois(12)).toBe(true)
    expect(resp(revisao({ lapsos: 7 }), 1).cartao.suspenso).toBe(true)
  })

  it('não altera o cartão recebido', () => {
    const c = revisao()
    const copia = { ...c }
    resp(c, 3)
    expect(c).toEqual(copia)
  })
})

describe('variação aleatória', () => {
  it('não varia abaixo de 3 dias', () => {
    expect(intervaloComVariacao(1, () => 0.99)).toBe(1)
    expect(intervaloComVariacao(2, () => 0.99)).toBe(2)
  })

  it('25 dias varia de 22 a 28', () => {
    expect(intervaloComVariacao(25, () => 0)).toBe(22)
    expect(intervaloComVariacao(25, () => 0.999)).toBe(28)
  })

  it('o intervalo real fica dentro da faixa e Bom continua > Difícil', () => {
    for (const r of [0, 0.3, 0.7, 0.999]) {
      const bom = responder(revisao(), 3, O, T0, H0, () => r).cartao.intervalo
      expect(bom).toBeGreaterThanOrEqual(22)
      expect(bom).toBeLessThanOrEqual(28)
    }
  })
})

describe('virada do dia às 4h', () => {
  it('1h da madrugada ainda é o dia anterior; 5h já é o dia novo', () => {
    const umaDaManha = new Date(2026, 9, 9, 1, 0).getTime()
    const cincoDaManha = new Date(2026, 9, 9, 5, 0).getTime()
    expect(numeroDoDia(cincoDaManha) - numeroDoDia(umaDaManha)).toBe(1)
    expect(numeroDoDia(new Date(2026, 9, 9, 23, 59).getTime())).toBe(numeroDoDia(cincoDaManha))
  })
})

describe('rótulos dos botões', () => {
  it('cartão novo: <1 min · 5 min · 10 min · 4 d', () => {
    expect(previsaoDeBotoes(novoCartao(1), O, T0, H0).map((p) => p.texto)).toEqual(['1 min', '5 min', '10 min', '4 d'])
  })

  it('revisão de 10 d: 10 min · 12 d · 25 d · 1,1 mês (32 d)', () => {
    expect(previsaoDeBotoes(revisao(), O, T0, H0).map((p) => p.texto)).toEqual(['10 min', '12 d', '25 d', '1,1 mês'])
  })

  it('o rótulo bate com o resultado sem variação, para todos os botões', () => {
    const c = revisao({ intervalo: 7, facilidade: 2.1, venceDia: H0 - 2 })
    for (const p of previsaoDeBotoes(c, O, T0, H0)) {
      const r = resp(c, p.botao).cartao
      const esperado = r.tipo === 'revisao' ? r.intervalo * 86_400_000 : r.venceMs - T0
      expect(p.ms).toBe(esperado)
    }
  })

  it('formatarIntervalo', () => {
    expect(formatarIntervalo(30_000)).toBe('<1 min')
    expect(formatarIntervalo(5 * MIN)).toBe('5 min')
    expect(formatarIntervalo(90 * MIN)).toBe('1,5 h')
    expect(formatarIntervalo(3 * 86_400_000)).toBe('3 d')
    expect(formatarIntervalo(75 * 86_400_000)).toBe('2,5 meses')
    expect(formatarIntervalo(400 * 86_400_000)).toBe('1,1 ano')
  })
})
