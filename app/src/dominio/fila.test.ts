import { describe, expect, it } from 'vitest'
import {
  irmaosParaEnterrar, montarFila, OPCOES_BARALHO_PADRAO, proximoCartao, usoDoDia,
  type BaralhoFila, type CartaoNaFila, type OpcoesBaralho,
} from '@/dominio/fila'
import { novoCartao, numeroDoDia, type EstadoCartao } from '@/dominio/sm2'

const AGORA = new Date(2026, 9, 9, 10, 0).getTime()
const HOJE = numeroDoDia(AGORA)
const MIN = 60_000

const baralho = (id: string, nome: string, o: Partial<OpcoesBaralho> = {}): BaralhoFila => ({ id, nome, opcoes: { ...OPCOES_BARALHO_PADRAO, ...o } })
const cartao = (id: string, baralhoId: string, e: Partial<EstadoCartao> = {}, notaId = id): CartaoNaFila => ({
  id, baralhoId, notaId, estado: { ...novoCartao(Number(id.replace(/\D/g, '')) || 0), ...e },
})

describe('limites diários', () => {
  it('só mostra 20 novos por dia e respeita a ordem', () => {
    const cs = Array.from({ length: 30 }, (_, i) => cartao(`c${String(i).padStart(2, '0')}`, 'a', { ordem: 30 - i }))
    const f = montarFila([baralho('a', 'A')], cs, 'a', new Map(), AGORA, HOJE)
    expect(f.contagem.novos).toBe(20)
    expect(f.novos[0]?.id).toBe('c29') // menor ordem primeiro
  })

  it('desconta o que já foi estudado hoje', () => {
    const cs = Array.from({ length: 30 }, (_, i) => cartao(`c${i}`, 'a', { ordem: i }))
    const uso = usoDoDia(Array.from({ length: 5 }, () => ({ baralhoId: 'a', dia: HOJE, estadoAntes: 'novo' as const })), HOJE)
    expect(montarFila([baralho('a', 'A')], cs, 'a', uso, AGORA, HOJE).contagem.novos).toBe(15)
  })

  it('usoDoDia ignora outros dias e conta revisões separado', () => {
    const u = usoDoDia(
      [
        { baralhoId: 'a', dia: HOJE, estadoAntes: 'novo' },
        { baralhoId: 'a', dia: HOJE, estadoAntes: 'revisao' },
        { baralhoId: 'a', dia: HOJE, estadoAntes: 'aprendendo' }, // não conta como novo nem revisão
        { baralhoId: 'a', dia: HOJE - 1, estadoAntes: 'novo' },
      ],
      HOJE,
    )
    expect(u.get('a')).toEqual({ novos: 1, revisoes: 1 })
  })

  it('limite de revisões por dia', () => {
    const cs = Array.from({ length: 10 }, (_, i) => cartao(`r${i}`, 'a', { tipo: 'revisao', intervalo: 5, venceDia: HOJE - i }))
    const f = montarFila([baralho('a', 'A', { revisoesPorDia: 4 })], cs, 'a', new Map(), AGORA, HOJE)
    expect(f.contagem.revisao).toBe(4)
    expect(f.revisao[0]?.estado.venceDia).toBe(HOJE - 9) // as mais atrasadas primeiro
  })

  it('o limite do pai vale para ele e os filhos juntos', () => {
    const bs = [baralho('p', 'Info', { novosPorDia: 5 }), baralho('f', 'Info::Redes', { novosPorDia: 20 })]
    const cs = [
      ...Array.from({ length: 4 }, (_, i) => cartao(`p${i}`, 'p', { ordem: i })),
      ...Array.from({ length: 10 }, (_, i) => cartao(`f${i}`, 'f', { ordem: 100 + i })),
    ]
    const todos = montarFila(bs, cs, 'p', new Map(), AGORA, HOJE)
    expect(todos.contagem.novos).toBe(5)
    // estudando só o filho, o limite do pai não entra
    expect(montarFila(bs, cs, 'f', new Map(), AGORA, HOJE).contagem.novos).toBe(10)
  })

  it('o que foi feito num filho conta no limite do pai', () => {
    const bs = [baralho('p', 'Info', { novosPorDia: 5 }), baralho('f', 'Info::Redes')]
    const cs = Array.from({ length: 10 }, (_, i) => cartao(`p${i}`, 'p', { ordem: i }))
    const uso = new Map([['f', { novos: 3, revisoes: 0 }]])
    expect(montarFila(bs, cs, 'p', uso, AGORA, HOJE).contagem.novos).toBe(2)
  })
})

describe('quem entra e quem não entra', () => {
  it('ignora suspensos, enterrados e revisões de amanhã', () => {
    const cs = [
      cartao('c1', 'a', { suspenso: true }),
      cartao('c2', 'a', { enterradoAte: HOJE + 1 }),
      cartao('c3', 'a', { tipo: 'revisao', venceDia: HOJE + 1 }),
      cartao('c4', 'a'),
    ]
    const f = montarFila([baralho('a', 'A')], cs, null, new Map(), AGORA, HOJE)
    expect(f.novos.map((c) => c.id)).toEqual(['c4'])
    expect(f.contagem).toEqual({ novos: 1, aprendendo: 0, revisao: 0 })
  })

  it('"todos os baralhos" (raiz nula) junta tudo e baralho desconhecido dá fila vazia', () => {
    const bs = [baralho('a', 'A'), baralho('b', 'B')]
    const cs = [cartao('c1', 'a'), cartao('c2', 'b')]
    expect(montarFila(bs, cs, null, new Map(), AGORA, HOJE).contagem.novos).toBe(2)
    expect(montarFila(bs, cs, 'a', new Map(), AGORA, HOJE).contagem.novos).toBe(1)
    expect(montarFila(bs, cs, 'xx', new Map(), AGORA, HOJE).contagem.novos).toBe(0)
  })

  it('"Info" não pega "Informática" (só subbaralhos de verdade)', () => {
    const bs = [baralho('i', 'Info'), baralho('n', 'Informática')]
    const cs = [cartao('c1', 'i'), cartao('c2', 'n')]
    expect(montarFila(bs, cs, 'i', new Map(), AGORA, HOJE).novos.map((c) => c.id)).toEqual(['c1'])
  })
})

describe('próximo cartão', () => {
  const bs = [baralho('a', 'A')]
  const montar = (cs: CartaoNaFila[]) => montarFila(bs, cs, 'a', new Map(), AGORA, HOJE)

  it('ordem: aprendizado vencido → revisão → novo', () => {
    const f = montar([
      cartao('n1', 'a'),
      cartao('r1', 'a', { tipo: 'revisao', venceDia: HOJE }),
      cartao('l1', 'a', { tipo: 'aprendendo', venceMs: AGORA - MIN }),
    ])
    expect(proximoCartao(f, AGORA)?.cartao.id).toBe('l1')
    expect(proximoCartao({ ...f, aprendendo: [] }, AGORA)?.cartao.id).toBe('r1')
    expect(proximoCartao({ ...f, aprendendo: [], revisao: [] }, AGORA)?.cartao.id).toBe('n1')
  })

  it('aprendizado que ainda não venceu só aparece quando não há mais nada (antecipação de 20 min)', () => {
    const l = cartao('l1', 'a', { tipo: 'aprendendo', venceMs: AGORA + 10 * MIN })
    const comNovo = montar([l, cartao('n1', 'a')])
    expect(proximoCartao(comNovo, AGORA)).toMatchObject({ cartao: { id: 'n1' }, origem: 'novo' })
    expect(proximoCartao(montar([l]), AGORA)).toMatchObject({ cartao: { id: 'l1' }, origem: 'antecipado' })
  })

  it('aprendizado além da antecipação fica de fora; sem nada, devolve null', () => {
    const longe = cartao('l1', 'a', { tipo: 'aprendendo', venceMs: AGORA + 30 * MIN })
    const f = montar([longe])
    expect(f.contagem.aprendendo).toBe(0)
    expect(proximoCartao(f, AGORA)).toBeNull()
  })

  it('mais de um aprendizado vencido: o mais antigo primeiro', () => {
    const f = montar([
      cartao('l1', 'a', { tipo: 'aprendendo', venceMs: AGORA - 1 * MIN }),
      cartao('l2', 'a', { tipo: 'reaprendendo', venceMs: AGORA - 5 * MIN }),
    ])
    expect(proximoCartao(f, AGORA)?.cartao.id).toBe('l2')
  })
})

describe('irmãos', () => {
  it('enterra os outros cartões da mesma nota, menos os que estão em aprendizado', () => {
    const a = cartao('c1', 'a', {}, 'nota1')
    const cs = [
      a,
      cartao('c2', 'a', {}, 'nota1'),
      cartao('c3', 'a', { tipo: 'aprendendo' }, 'nota1'),
      cartao('c4', 'a', {}, 'nota2'),
    ]
    expect(irmaosParaEnterrar(cs, a)).toEqual(['c2'])
  })
})
