import { describe, expect, it } from 'vitest'
import {
  avancarCursor, campoChave, decidir, deNuvem, emLotes, emLotesPorTamanho, ESQUEMA_VERSAO, inicioDaBusca, medirDesvio, paraNuvem, podeExpurgar,
  podeLimparSujo, precisaAtualizar, primeiraSincronizacao, RETENCAO_EXCLUIDOS_MS, servidorAceita, type Colecao, type RegistroLocal, type RegistroNuvem,
} from '@/dominio/sincronia'

const nota = (atualizadoEm: number, sujo: 0 | 1, extra: Partial<RegistroLocal> = {}): RegistroLocal => ({ id: 'n1', titulo: 'T', excluidoEm: null, atualizadoEm, sujo, ...extra })
const remoto = (colecao: Colecao, local: RegistroLocal, desvio: number, servidor = 0): RegistroNuvem => ({ ...paraNuvem(colecao, local, desvio), atualizadoEm: servidor })

describe('relógio', () => {
  it('desvio = servidor menos o meio da chamada', () => {
    expect(medirDesvio(1000, 1200, 6100)).toBe(5000)
    expect(medirDesvio(1000, 1000, 400)).toBe(-600)
  })

  it('ida e volta pela nuvem devolve o mesmo registro, limpo e na hora deste aparelho', () => {
    const r = nota(10_000, 1, { texto: 'oi' })
    const n = paraNuvem('notas', r, 300)
    expect(n).toMatchObject({ colecao: 'notas', id: 'n1', editadoEm: 10_300, excluidoEm: null, esquemaVersao: ESQUEMA_VERSAO })
    expect(n.dados).not.toHaveProperty('sujo')
    expect(deNuvem({ ...n, atualizadoEm: 1 }, 300)).toEqual({ ...r, sujo: 0 })
    // outro aparelho com outro desvio vê a mesma hora real
    expect(deNuvem({ ...n, atualizadoEm: 1 }, -200).atualizadoEm).toBe(10_500)
  })

  it('valores usam a chave; registro sem chave é recusado', () => {
    expect(campoChave('valores')).toBe('chave')
    expect(paraNuvem('valores', { chave: 'config', valor: {}, atualizadoEm: 1, sujo: 1 }, 0).id).toBe('config')
    expect(() => paraNuvem('notas', { atualizadoEm: 1, sujo: 1 }, 0)).toThrow('Registro sem id')
  })

  it('exclusão vai com a hora no relógio do servidor', () => {
    expect(paraNuvem('notas', nota(50, 1, { excluidoEm: 40 }), 1000).excluidoEm).toBe(1040)
  })
})

describe('decidir conflitos', () => {
  it('sem registro local ou sem mudança pendente: aplica o da nuvem', () => {
    const r = remoto('notas', nota(100, 1), 0)
    expect(decidir('notas', undefined, r, 0)).toBe('aplicar')
    expect(decidir('notas', nota(999, 0), r, 0)).toBe('aplicar')
  })

  it('com mudança pendente: vence a edição mais recente; empate fica com a nuvem', () => {
    const r = remoto('notas', nota(100, 1), 0)
    expect(decidir('notas', nota(150, 1), r, 0)).toBe('manter')
    expect(decidir('notas', nota(50, 1), r, 0)).toBe('aplicar')
    expect(decidir('notas', nota(100, 1), r, 0)).toBe('aplicar')
  })

  it('relógio atrasado não inverte o vencedor', () => {
    // Celular editou às 10:00 reais com o relógio 5 min atrasado (marca 9:55); o computador editou às 9:58 reais, relógio certo.
    const MIN = 60_000
    const celular = nota(-5 * MIN, 1) // 10:00 real = 0; relógio do celular marca −5 min
    const doComputador = remoto('notas', nota(-2 * MIN, 1), 0) // 9:58 real
    expect(decidir('notas', celular, doComputador, 5 * MIN)).toBe('manter') // o celular é mais recente de verdade
    // sem a correção, o celular perderia (−5 < −2)
    expect(decidir('notas', celular, doComputador, 0)).toBe('aplicar')
  })

  it('exclusão é uma edição com hora: mais nova vence edição mais velha, e vice-versa', () => {
    const excluidaNaNuvem = remoto('notas', nota(200, 1, { excluidoEm: 200 }), 0)
    expect(decidir('notas', nota(150, 1), excluidaNaNuvem, 0)).toBe('aplicar')
    expect(decidir('notas', nota(250, 1), excluidaNaNuvem, 0)).toBe('manter')
  })

  it('histórico: resposta desfeita em qualquer lado continua desfeita', () => {
    const viva = (sujo: 0 | 1): RegistroLocal => ({ id: 'r1', cartaoId: 'c', excluidoEm: null, atualizadoEm: 10, sujo })
    const desfeita = (sujo: 0 | 1): RegistroLocal => ({ ...viva(sujo), excluidoEm: 20, atualizadoEm: 20 })
    expect(decidir('revlog', viva(0), remoto('revlog', desfeita(1), 0), 0)).toBe('aplicar')
    expect(decidir('revlog', desfeita(0), remoto('revlog', viva(1), 0), 0)).toBe('manter')
    expect(decidir('revlog', desfeita(1), remoto('revlog', viva(1), 9_999), 0)).toBe('manter')
    expect(decidir('revlog', undefined, remoto('revlog', viva(1), 0), 0)).toBe('aplicar')
  })
})

/**
 * Dois aparelhos e uma nuvem em memória, usando só as regras acima (o motor de verdade, na 5.4, segue o mesmo roteiro):
 * enviar o que está sujo (o servidor guarda o último enviado), depois puxar e decidir registro a registro.
 */
describe('simulação com dois aparelhos', () => {
  type Banco = Map<string, RegistroLocal>
  const chave = (c: Colecao, id: string) => `${c}/${id}`
  function criar() {
    const nuvem = new Map<string, RegistroNuvem>()
    let relogioServidor = 1_000_000
    const sincronizar = (b: Banco, desvio: number) => {
      for (const [k, r] of b) {
        if (!r.sujo) continue
        const c = k.split('/')[0] as Colecao
        const atual = nuvem.get(k)
        const enviar = paraNuvem(c, r, desvio)
        // o servidor também decide: não deixa uma edição mais velha sobrescrever uma mais nova
        if (servidorAceita(atual, enviar)) nuvem.set(k, { ...enviar, atualizadoEm: ++relogioServidor })
        b.set(k, { ...r, sujo: 0 })
      }
      for (const [k, r] of nuvem) {
        if (decidir(r.colecao, b.get(k), r, desvio) === 'aplicar') b.set(k, deNuvem(r, desvio))
      }
    }
    return { nuvem, sincronizar }
  }
  const sem = (b: Banco) => [...b.entries()].map(([k, r]) => [k, { ...r, atualizadoEm: 0, sujo: 0 }]).sort()

  it('edições offline nos dois aparelhos convergem para a mais recente, e os dois ficam iguais', () => {
    const { sincronizar } = criar()
    const pc: Banco = new Map(), cel: Banco = new Map()
    const DESVIO_CEL = 3 * 60_000 // relógio do celular 3 min atrasado
    pc.set(chave('notas', 'n1'), nota(100, 1, { texto: 'versão do PC' }))
    sincronizar(pc, 0)
    sincronizar(cel, DESVIO_CEL)
    expect(cel.get(chave('notas', 'n1'))?.texto).toBe('versão do PC')

    // offline: PC edita às 500 reais; celular edita às 900 reais (marca 900 − 3 min)
    pc.set(chave('notas', 'n1'), { ...pc.get(chave('notas', 'n1'))!, texto: 'PC offline', atualizadoEm: 500, sujo: 1 })
    cel.set(chave('notas', 'n1'), { ...cel.get(chave('notas', 'n1'))!, texto: 'celular offline', atualizadoEm: 900 - DESVIO_CEL, sujo: 1 })
    sincronizar(pc, 0)
    sincronizar(cel, DESVIO_CEL)
    sincronizar(pc, 0)
    expect(pc.get(chave('notas', 'n1'))?.texto).toBe('celular offline')
    expect(sem(pc)).toEqual(sem(cel))
  })

  it('mesmo cartão estudado offline nos dois: as respostas dos dois lados ficam no histórico', () => {
    const { sincronizar } = criar()
    const pc: Banco = new Map(), cel: Banco = new Map()
    const cartao = (atualizadoEm: number, repeticoes: number): RegistroLocal => ({ id: 'c1', repeticoes, excluidoEm: null, atualizadoEm, sujo: 1 })
    const resp = (id: string, instante: number): RegistroLocal => ({ id, cartaoId: 'c1', instante, excluidoEm: null, atualizadoEm: instante, sujo: 1 })
    pc.set(chave('cartoes', 'c1'), cartao(100, 1))
    pc.set(chave('revlog', 'rPC'), resp('rPC', 100))
    cel.set(chave('cartoes', 'c1'), cartao(200, 1))
    cel.set(chave('revlog', 'rCel'), resp('rCel', 200))
    sincronizar(pc, 0)
    sincronizar(cel, 0)
    sincronizar(pc, 0)
    for (const b of [pc, cel]) {
      expect(b.has(chave('revlog', 'rPC')) && b.has(chave('revlog', 'rCel'))).toBe(true)
      expect(b.get(chave('cartoes', 'c1'))?.atualizadoEm).toBe(200) // vale o lado da resposta mais recente
    }
  })

  it('excluir num aparelho não ressuscita pelo outro (que só tinha a versão antiga)', () => {
    const { sincronizar } = criar()
    const pc: Banco = new Map(), cel: Banco = new Map()
    pc.set(chave('cartoes', 'c1'), { id: 'c1', excluidoEm: null, atualizadoEm: 100, sujo: 1 })
    sincronizar(pc, 0)
    sincronizar(cel, 0)
    pc.set(chave('cartoes', 'c1'), { id: 'c1', excluidoEm: 300, atualizadoEm: 300, sujo: 1 })
    sincronizar(pc, 0)
    sincronizar(cel, 0)
    sincronizar(pc, 0)
    expect(cel.get(chave('cartoes', 'c1'))?.excluidoEm).toBe(300)
    expect(pc.get(chave('cartoes', 'c1'))?.excluidoEm).toBe(300)
  })

  it('resposta desfeita no celular não volta pelo computador', () => {
    const { sincronizar } = criar()
    const pc: Banco = new Map(), cel: Banco = new Map()
    cel.set(chave('revlog', 'r1'), { id: 'r1', excluidoEm: null, atualizadoEm: 100, sujo: 1 })
    sincronizar(cel, 0)
    sincronizar(pc, 0)
    cel.set(chave('revlog', 'r1'), { id: 'r1', excluidoEm: 150, atualizadoEm: 150, sujo: 1 })
    pc.set(chave('revlog', 'r1'), { ...pc.get(chave('revlog', 'r1'))!, sujo: 1 }) // o PC reenvia a versão viva
    sincronizar(pc, 0)
    sincronizar(cel, 0)
    sincronizar(pc, 0)
    expect(pc.get(chave('revlog', 'r1'))?.excluidoEm).toBe(150)
    expect(cel.get(chave('revlog', 'r1'))?.excluidoEm).toBe(150)
  })
})

describe('servidor', () => {
  it('aceita edição igual ou mais nova e recusa a mais velha', () => {
    const atual = remoto('notas', nota(200, 1), 0)
    expect(servidorAceita(undefined, paraNuvem('notas', nota(1, 1), 0))).toBe(true)
    expect(servidorAceita(atual, paraNuvem('notas', nota(300, 1), 0))).toBe(true)
    expect(servidorAceita(atual, paraNuvem('notas', nota(200, 1), 0))).toBe(true)
    expect(servidorAceita(atual, paraNuvem('notas', nota(100, 1), 0))).toBe(false)
  })

  it('histórico: não aceita linha viva por cima de uma desfeita', () => {
    const viva: RegistroLocal = { id: 'r1', excluidoEm: null, atualizadoEm: 10, sujo: 1 }
    const desfeita: RegistroLocal = { ...viva, excluidoEm: 5, atualizadoEm: 5 }
    expect(servidorAceita(remoto('revlog', desfeita, 0), paraNuvem('revlog', viva, 0))).toBe(false)
    expect(servidorAceita(remoto('revlog', viva, 0), paraNuvem('revlog', desfeita, 0))).toBe(true)
  })
})

describe('envio, lotes e cursor', () => {
  it('só limpa o sujo se o registro não mudou durante o envio', () => {
    expect(podeLimparSujo(100, nota(100, 1))).toBe(true)
    expect(podeLimparSujo(100, nota(101, 1))).toBe(false)
    expect(podeLimparSujo(100, undefined)).toBe(false)
  })

  it('lotes: 3.000 registros em páginas de 500', () => {
    const l = Array.from({ length: 3000 }, (_, i) => i)
    const lotes = emLotes(l, 500)
    expect(lotes).toHaveLength(6)
    expect(lotes.every((x) => x.length === 500)).toBe(true)
    expect(lotes.flat()).toEqual(l)
    expect(emLotes([1, 2, 3], 2)).toEqual([[1, 2], [3]])
    expect(emLotes([], 2)).toEqual([])
    expect(() => emLotes([1], 0)).toThrow()
  })

  it('lotes por tamanho: fecha antes de passar do limite; item grande vai sozinho', () => {
    const t = (x: number) => x
    expect(emLotesPorTamanho([3, 3, 3, 3], t, 7, 10)).toEqual([[3, 3], [3, 3]])
    expect(emLotesPorTamanho([2, 20, 2], t, 7, 10)).toEqual([[2], [20], [2]])
    expect(emLotesPorTamanho([1, 1, 1], t, 100, 2)).toEqual([[1, 1], [1]])
    expect(emLotesPorTamanho([], t, 5, 5)).toEqual([])
  })

  it('cursor: puxa com folga de 1 min e avança para a maior hora recebida', () => {
    expect(inicioDaBusca(100_000)).toBe(40_000)
    expect(inicioDaBusca(10)).toBe(0)
    expect(avancarCursor(500, [{ atualizadoEm: 700 }, { atualizadoEm: 600 }])).toBe(700)
    expect(avancarCursor(500, [])).toBe(500)
    expect(avancarCursor(900, [{ atualizadoEm: 700 }])).toBe(900)
  })

  it('versão mínima da nuvem acima da deste app pede atualização', () => {
    expect(precisaAtualizar(ESQUEMA_VERSAO)).toBe(false)
    expect(precisaAtualizar(ESQUEMA_VERSAO + 1)).toBe(true)
  })
})

describe('primeira sincronização e limpeza', () => {
  it('decide enviar, receber, perguntar ou nada', () => {
    expect(primeiraSincronizacao(true, false)).toBe('enviar')
    expect(primeiraSincronizacao(false, true)).toBe('receber')
    expect(primeiraSincronizacao(true, true)).toBe('perguntar')
    expect(primeiraSincronizacao(false, false)).toBe('nada')
  })

  it('marca de exclusão só sai depois de 90 dias e de todos os aparelhos sincronizarem', () => {
    const exc = 1_000
    const depois = exc + RETENCAO_EXCLUIDOS_MS
    expect(podeExpurgar(exc, depois - 1, [depois])).toBe(false)
    expect(podeExpurgar(exc, depois, [exc + 5, depois])).toBe(true)
    expect(podeExpurgar(exc, depois, [exc - 5, depois])).toBe(false) // um aparelho parado desde antes da exclusão
  })
})
