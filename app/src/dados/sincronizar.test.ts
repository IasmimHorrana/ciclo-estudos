import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { carregarFlashcards } from '@/dados/backup-flashcards'
import { lerArquivo } from '@/dados/converter'
import { BancoCiclo } from '@/dados/db'
import {
  adicionarNota, criarBaralho, desfazerResposta, excluirNota, garantirPadroes, GRUPO_PADRAO, responderCartao, salvarOpcoes,
} from '@/dados/flashcards'
import { carregarDados, substituirDados } from '@/dados/repositorio'
import { contarPendentes, sincronizarAgora, TAMANHO_PAGINA, type OpcoesSincronia, type Servidor } from '@/dados/sincronizar'
import { OPCOES_BARALHO_PADRAO } from '@/dominio/fila'
import { ESQUEMA_VERSAO, servidorAceita, type RegistroNuvem, type RegistroParaEnviar } from '@/dominio/sincronia'

const T0 = new Date(2026, 10, 19, 10, 0).getTime()
const MIN = 60_000
const CICLO = { config: { horas: 2, duracao: 1, mats: [{ nome: 'Informática', rep: 1, peso: 3 }], custom: [], ocultas: [] }, fechadas: [] }

/** Hora "real" da simulação: a nuvem responde com ela; os aparelhos usam ela (ou ela com atraso). */
let agoraReal = T0 + 1000
const em = (t: number) => (agoraReal = t)

/** Nuvem de mentira: as mesmas regras do gatilho do Postgres (servidorAceita) e a hora de gravação sempre crescente. */
function nuvemFalsa(versaoMinima = ESQUEMA_VERSAO) {
  const linhas = new Map<string, RegistroNuvem>()
  let seq = T0
  const aparelhos = new Map<string, number>()
  let envios = 0
  let antesDeGravar: ((lote: RegistroParaEnviar[]) => Promise<void>) | null = null
  const srv: Servidor = {
    agora: async () => agoraReal,
    versaoMinima: async () => versaoMinima,
    temRegistros: async () => linhas.size > 0,
    enviar: async (lote: RegistroParaEnviar[]) => {
      envios++
      if (antesDeGravar) await antesDeGravar(lote)
      for (const r of lote) {
        const k = `${r.colecao}/${r.id}`
        seq = Math.max(seq + 1, agoraReal)
        if (servidorAceita(linhas.get(k), r)) linhas.set(k, { ...structuredClone(r), atualizadoEm: seq })
      }
    },
    buscar: async (desde, deslocamento, limite) =>
      [...linhas.values()]
        .filter((r) => r.atualizadoEm > desde)
        .sort((a, b) => a.atualizadoEm - b.atualizadoEm || a.colecao.localeCompare(b.colecao) || a.id.localeCompare(b.id))
        .slice(deslocamento, deslocamento + limite)
        .map((r) => structuredClone(r)),
    marcarAparelho: async (id, _nome, agora) => void aparelhos.set(id, agora),
  }
  return {
    srv,
    linhas,
    aparelhos,
    get envios() {
      return envios
    },
    aoGravar: (f: ((lote: RegistroParaEnviar[]) => Promise<void>) | null) => (antesDeGravar = f),
  }
}

let n = 0
async function aparelho(nome: string) {
  const db = new BancoCiclo(`sync-${nome}-${++n}`)
  await garantirPadroes(db)
  return db
}
const opcoes = (nome: string, extra: Partial<OpcoesSincronia> = {}): OpcoesSincronia => ({
  usuarioId: 'u1',
  aparelho: { id: `ap-${nome}`, nome },
  relogio: () => agoraReal,
  ...extra,
})

/** Computador com ciclo, um baralho, duas notas (uma com imagem) e respostas. */
async function computadorCheio() {
  const db = await aparelho('pc')
  await substituirDados(db, lerArquivo(JSON.stringify(CICLO), T0), T0)
  const b = await criarBaralho(db, 'Informática::Redes', T0)
  const a = await adicionarNota(db, { tipoId: 'basico', baralhoId: b.id, campos: { Frente: 'OSI <img src="data:image/webp;base64,AAAA">', Verso: '7' } }, T0)
  await adicionarNota(db, { tipoId: 'cloze', baralhoId: b.id, campos: { Texto: '{{c1::TCP}} e {{c2::UDP}}', Extra: '' } }, T0 + 1)
  await responderCartao(db, a.cartoes[0]!.id, 3, 2000, T0 + 2, null)
  return { db, cartao: a.cartoes[0]!.id, nota: a.nota.id, baralho: b.id }
}

const resumo = async (db: BancoCiclo) => {
  const f = await carregarFlashcards(db)
  const ids = (l: { id: string }[]) => l.map((x) => x.id).sort()
  return { config: (await carregarDados(db))?.config, baralhos: ids(f.baralhos), notas: ids(f.notas), cartoes: ids(f.cartoes), revlog: ids(f.revlog) }
}

beforeEach(() => void em(T0 + 1000))

describe('sincronização entre computador e celular', () => {
  it('computador envia tudo na primeira vez; celular vazio recebe tudo igual (inclusive imagem e histórico)', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc } = await computadorCheio()
    let backups = 0
    const r1 = await sincronizarAgora(pc, nuvem.srv, opcoes('pc', { antesDaPrimeira: async () => void backups++ }))
    expect(r1).toMatchObject({ tipo: 'ok', primeira: true })
    expect(backups).toBe(1) // o computador tinha dados: baixa um backup antes
    expect(await contarPendentes(pc)).toBe(0)

    const cel = await aparelho('cel')
    let perguntou = false
    const r2 = await sincronizarAgora(cel, nuvem.srv, opcoes('cel', { perguntar: async () => ((perguntou = true), 'juntar') }))
    expect(r2).toMatchObject({ tipo: 'ok', primeira: true })
    expect(perguntou).toBe(false) // celular vazio: só recebe
    expect(await resumo(cel)).toEqual(await resumo(pc))
    expect(JSON.stringify(await cel.notasFc.toArray())).toContain('data:image/webp')
    expect(await contarPendentes(cel)).toBe(0)
    expect(nuvem.aparelhos.size).toBe(2)
  })

  it('padrões de fábrica do celular novo não apagam as opções que ela mudou no computador', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc } = await computadorCheio()
    await salvarOpcoes(pc, GRUPO_PADRAO, { ...OPCOES_BARALHO_PADRAO, novosPorDia: 7 }, T0 + 5)
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    const cel = await aparelho('cel') // cria o grupo "Padrão" com 20 novos/dia
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))
    expect((await cel.gruposOpcoes.get(GRUPO_PADRAO))?.opcoes.novosPorDia).toBe(7)
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    expect((await pc.gruposOpcoes.get(GRUPO_PADRAO))?.opcoes.novosPorDia).toBe(7)
  })

  it('o que ela faz no celular chega ao computador, e vice-versa', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc, baralho } = await computadorCheio()
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    const cel = await aparelho('cel')
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))

    const nova = await adicionarNota(cel, { tipoId: 'basico', baralhoId: baralho, campos: { Frente: 'feita na rua', Verso: 'x' } }, T0 + 10 * MIN)
    em(T0 + 11 * MIN)
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    expect((await pc.notasFc.get(nova.nota.id))?.campos.Frente).toBe('feita na rua')

    const outra = await adicionarNota(pc, { tipoId: 'basico', baralhoId: baralho, campos: { Frente: 'feita no PC', Verso: 'y' } }, T0 + 20 * MIN)
    em(T0 + 21 * MIN)
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))
    expect((await cel.notasFc.get(outra.nota.id))?.campos.Frente).toBe('feita no PC')
    expect(await resumo(cel)).toEqual(await resumo(pc))
  })

  it('mesmo cartão estudado sem internet nos dois: nenhuma resposta se perde e os dois terminam iguais', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc, cartao } = await computadorCheio()
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    const cel = await aparelho('cel')
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))

    await responderCartao(pc, cartao, 3, 1000, T0 + 2 * 86_400_000, null) // computador, dia +2
    await responderCartao(cel, cartao, 1, 1000, T0 + 3 * 86_400_000, null) // celular, dia +3 (mais recente): errou
    const doCelular = (await cel.cartoes.get(cartao))!
    em(T0 + 4 * 86_400_000)
    for (const [db, nome] of [[pc, 'pc'], [cel, 'cel'], [pc, 'pc']] as const) await sincronizarAgora(db, nuvem.srv, opcoes(nome))

    expect((await resumo(pc)).revlog).toHaveLength(3)
    expect(await resumo(cel)).toEqual(await resumo(pc))
    expect(await pc.cartoes.get(cartao)).toEqual(await cel.cartoes.get(cartao))
    // vale o lado da resposta mais recente (o erro no celular)
    const semControle = (c: object) => ({ ...c, sujo: 0, atualizadoEm: 0 })
    expect(semControle((await pc.cartoes.get(cartao))!)).toEqual(semControle(doCelular))
  })

  it('excluir num aparelho não ressuscita pelo outro; resposta desfeita continua desfeita', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc, nota, cartao } = await computadorCheio()
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    const cel = await aparelho('cel')
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))

    await excluirNota(pc, nota, T0 + 5 * MIN)
    const d = await responderCartao(cel, cartao, 4, 1000, T0 + 6 * MIN, null)
    em(T0 + 7 * MIN)
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))
    await desfazerResposta(cel, d, T0 + 8 * MIN)
    em(T0 + 9 * MIN)
    for (const [db, nome] of [[pc, 'pc'], [cel, 'cel'], [pc, 'pc']] as const) await sincronizarAgora(db, nuvem.srv, opcoes(nome))

    for (const db of [pc, cel]) {
      expect((await db.notasFc.get(nota))?.excluidoEm).not.toBeNull()
      expect((await db.revlog.get(d.logId))?.excluidoEm).not.toBeNull()
    }
  })

  it('relógio do celular atrasado 10 min não faz uma edição mais velha vencer', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc, baralho } = await computadorCheio()
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    const cel = await aparelho('cel')
    const ATRASO = 10 * MIN
    const celular = (extra: Partial<OpcoesSincronia> = {}) => opcoes('cel', { relogio: () => agoraReal - ATRASO, ...extra })
    await sincronizarAgora(cel, nuvem.srv, celular())

    const bPc = (await pc.baralhos.get(baralho))!
    const bCel = (await cel.baralhos.get(baralho))!
    // celular renomeia às 10:30 reais (marca 10:20); computador renomeia às 10:25 reais
    await cel.baralhos.put({ ...bCel, nome: 'do celular', atualizadoEm: T0 + 30 * MIN - ATRASO, sujo: 1 })
    await pc.baralhos.put({ ...bPc, nome: 'do PC', atualizadoEm: T0 + 25 * MIN, sujo: 1 })
    // a nuvem "sabe" a hora real: o desvio do celular é medido em cada sincronização
    em(T0 + 31 * MIN)
    await sincronizarAgora(cel, nuvem.srv, celular())
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    await sincronizarAgora(cel, nuvem.srv, celular())
    expect((await pc.baralhos.get(baralho))?.nome).toBe('do celular')
    expect((await cel.baralhos.get(baralho))?.nome).toBe('do celular')
  })
})

describe('primeira vez com dados dos dois lados', () => {
  async function doisCheios() {
    const nuvem = nuvemFalsa()
    const { db: pc } = await computadorCheio()
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    const cel = await aparelho('cel')
    const b = await criarBaralho(cel, 'Só no celular', T0 + 50)
    await adicionarNota(cel, { tipoId: 'basico', baralhoId: b.id, campos: { Frente: 'só aqui', Verso: '-' } }, T0 + 51)
    return { nuvem, pc, cel, soCel: b.id }
  }

  it('pergunta; cancelar não muda nada', async () => {
    const { nuvem, cel } = await doisCheios()
    const antes = await resumo(cel)
    const envios = nuvem.envios
    expect(await sincronizarAgora(cel, nuvem.srv, opcoes('cel', { perguntar: async () => null }))).toEqual({ tipo: 'cancelado' })
    expect(await resumo(cel)).toEqual(antes)
    expect(nuvem.envios).toBe(envios)
  })

  it('"juntar": o que era só do celular vai para a nuvem e o resto chega ao celular', async () => {
    const { nuvem, pc, cel, soCel } = await doisCheios()
    let backup = 0
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel', { perguntar: async () => 'juntar', antesDaPrimeira: async () => void backup++ }))
    expect(backup).toBe(1)
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    expect((await pc.baralhos.get(soCel))?.nome).toBe('Só no celular')
    expect(await resumo(cel)).toEqual(await resumo(pc))
  })

  it('"ficar com a nuvem": o celular fica igual à nuvem e nada dele sobe', async () => {
    const { nuvem, pc, cel, soCel } = await doisCheios()
    const envios = nuvem.envios
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel', { perguntar: async () => 'nuvem' }))
    expect(nuvem.envios).toBe(envios)
    expect((await cel.baralhos.get(soCel))?.excluidoEm).not.toBeNull() // saiu daqui (marcado, não apagado)
    expect(await resumo(cel)).toEqual(await resumo(pc))
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))
    expect(nuvem.linhas.has(`baralhos/${soCel}`)).toBe(false)
  })
})

describe('segurança do motor', () => {
  it('versão mínima maior que a do app: não envia nada e pede para atualizar', async () => {
    const nuvem = nuvemFalsa(ESQUEMA_VERSAO + 1)
    const { db: pc } = await computadorCheio()
    expect(await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))).toEqual({ tipo: 'atualize' })
    expect(nuvem.envios).toBe(0)
    expect(await contarPendentes(pc)).toBeGreaterThan(0)
  })

  it('edição feita durante o envio não é marcada como enviada (vai na próxima)', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc, baralho } = await computadorCheio()
    let uma = true
    nuvem.aoGravar(async (lote) => {
      if (!uma || lote[0]?.colecao !== 'baralhos') return
      uma = false
      const b = (await pc.baralhos.get(baralho))!
      await pc.baralhos.put({ ...b, nome: 'mudou no meio', atualizadoEm: T0 + 99, sujo: 1 })
    })
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    nuvem.aoGravar(null)
    expect((await pc.baralhos.get(baralho))?.sujo).toBe(1)
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    expect(nuvem.linhas.get(`baralhos/${baralho}`)?.dados.nome).toBe('mudou no meio')
  })

  it('base grande: recebe em páginas sem perder nenhum registro', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc, baralho } = await computadorCheio()
    const muitas = TAMANHO_PAGINA * 2 + 37
    await pc.transaction('rw', pc.questoes, async () => {
      for (let i = 0; i < muitas; i++) {
        await pc.questoes.put({ id: `q${i}`, data: '2026-11-19', materia: 'Informática', assuntoId: null, feitas: 1, acertos: 1, atualizadoEm: T0, excluidoEm: null, sujo: 1 })
      }
    })
    await sincronizarAgora(pc, nuvem.srv, opcoes('pc'))
    const cel = await aparelho('cel')
    await sincronizarAgora(cel, nuvem.srv, opcoes('cel'))
    expect(await cel.questoes.count()).toBe(muitas)
    expect(await cel.baralhos.get(baralho)).toBeDefined()
  }, 30_000) // mais de mil registros: a máquina do GitHub é lenta

  it('só uma sincronização por vez', async () => {
    const nuvem = nuvemFalsa()
    const { db: pc } = await computadorCheio()
    const [a, b] = [sincronizarAgora(pc, nuvem.srv, opcoes('pc')), sincronizarAgora(pc, nuvem.srv, opcoes('pc'))]
    expect(a).toBe(b)
    await a
  })
})
