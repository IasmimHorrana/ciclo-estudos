import { unzipSync } from 'fflate'
import { decompress as zstd } from 'fzstd'
import type { SqlJsStatic, Database } from 'sql.js'
import type { BancoCiclo } from '@/dados/db'
import { novoIdFc } from '@/dados/ids'
import type { Controle } from '@/dados/esquemas'
import { GRUPO_PADRAO, cartoesNovos } from '@/dados/flashcards'
import type { Baralho, NotaFc, TipoNota } from '@/dados/flashcards-tipos'
import {
  ajustarModelo, camposDaNota, embutirMidia, lerProtobuf, nomeDoBaralhoAnki, separarCampos, separarTags, textoProto,
  type NotaAnki, type PacoteAnki, type TipoAnki,
} from '@/dominio/anki'
import { indicesDeCartoes } from '@/dominio/modelo'

const eZstd = (b: Uint8Array) => b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd
const descomprimir = (b: Uint8Array) => (eZstd(b) ? zstd(b) : b)

/**
 * O Anki novo cria colunas com uma ordenação própria ("unicase") que o SQLite do navegador não conhece, e aí
 * consultas em `fields`, `templates` etc. falham. Trocamos pela "nocase" no esquema e reabrimos; só lemos, então não importa.
 */
function trocarOrdenacao(bd: Database, sql: SqlJsStatic): Database {
  bd.run('PRAGMA writable_schema=1')
  bd.run("UPDATE sqlite_master SET sql=replace(sql,'unicase','nocase') WHERE sql LIKE '%unicase%'")
  bd.run('PRAGMA writable_schema=0')
  const novo = new sql.Database(bd.export())
  bd.close()
  return novo
}

/** Lê todas as linhas de uma consulta como objetos. */
function consultar(bd: Database, sql: string): Record<string, unknown>[] {
  const r = bd.exec(sql)[0]
  if (!r) return []
  return r.values.map((linha) => Object.fromEntries(r.columns.map((c, i) => [c, linha[i]])))
}
const temTabela = (bd: Database, nome: string) => consultar(bd, `select name from sqlite_master where name='${nome}'`).length > 0

interface ModeloJson { name: string; type?: number; flds: { name: string; ord: number }[]; tmpls: { name: string; qfmt: string; afmt: string; ord: number }[] }

/** Formato antigo (.anki2/.anki21): baralhos e tipos de nota são JSON na tabela `col`. */
function lerTiposEBaralhosAntigos(bd: Database) {
  const col = consultar(bd, 'select models, decks from col')[0]
  if (!col) throw new Error('O arquivo do Anki está vazio.')
  const modelos = JSON.parse(String(col.models)) as Record<string, ModeloJson>
  const baralhos = JSON.parse(String(col.decks)) as Record<string, { name: string }>
  const tipos = new Map<number, TipoAnki>()
  for (const [id, m] of Object.entries(modelos)) {
    tipos.set(Number(id), {
      id: Number(id),
      nome: m.name,
      campos: [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name),
      modelos: [...m.tmpls].sort((a, b) => a.ord - b.ord).map((t) => ({ nome: t.name, frente: t.qfmt, verso: t.afmt })),
      cloze: m.type === 1,
    })
  }
  const nomes = new Map<number, string>()
  for (const [id, d] of Object.entries(baralhos)) nomes.set(Number(id), nomeDoBaralhoAnki(d.name))
  return { tipos, nomes }
}

/** Formato novo (Anki 2.1.50+): tabelas `notetypes`, `fields`, `templates` e `decks`, com configurações em protobuf. */
function lerTiposEBaralhosNovos(bd: Database) {
  const tipos = new Map<number, TipoAnki>()
  for (const t of consultar(bd, 'select id, name, config from notetypes')) {
    const id = Number(t.id)
    const config = lerProtobuf(t.config as Uint8Array)
    const campos = consultar(bd, `select name from fields where ntid=${id} order by ord`).map((f) => String(f.name))
    const modelos = consultar(bd, `select name, config from templates where ntid=${id} order by ord`).map((m) => {
      const c = lerProtobuf(m.config as Uint8Array)
      return { nome: String(m.name), frente: textoProto(c.find((x) => x.numero === 1)?.valor), verso: textoProto(c.find((x) => x.numero === 2)?.valor) }
    })
    tipos.set(id, { id, nome: String(t.name), campos, modelos, cloze: config.find((x) => x.numero === 1)?.valor === 1 })
  }
  const nomes = new Map<number, string>()
  for (const d of consultar(bd, 'select id, name from decks')) nomes.set(Number(d.id), nomeDoBaralhoAnki(String(d.name)))
  return { tipos, nomes }
}

/** Nomes dos arquivos de mídia: JSON no formato antigo, protobuf compactado no novo. */
function lerListaDeMidia(bruto: Uint8Array | undefined): Map<string, string> {
  const mapa = new Map<string, string>() // nome do arquivo no zip → nome original
  if (!bruto) return mapa
  const dados = descomprimir(bruto)
  if (dados[0] === 0x7b) {
    for (const [k, v] of Object.entries(JSON.parse(new TextDecoder().decode(dados)) as Record<string, string>)) mapa.set(k, v)
    return mapa
  }
  lerProtobuf(dados)
    .filter((e) => e.numero === 1 && e.valor instanceof Uint8Array)
    .forEach((e, i) => {
      const campos = lerProtobuf(e.valor as Uint8Array)
      const nome = textoProto(campos.find((c) => c.numero === 1)?.valor)
      if (nome) mapa.set(String(i), nome)
    })
  return mapa
}

/** Abre um `.apkg` e devolve tipos de nota, notas e mídia. Lança `Error` em português se o arquivo não servir. */
export function lerApkg(bytes: Uint8Array, sql: SqlJsStatic): PacoteAnki {
  let arquivos: Record<string, Uint8Array>
  try {
    arquivos = unzipSync(bytes)
  } catch {
    throw new Error('Este arquivo não é um pacote do Anki (.apkg) válido.')
  }
  const nomeBanco = ['collection.anki21b', 'collection.anki21', 'collection.anki2'].find((n) => arquivos[n])
  if (!nomeBanco) throw new Error('Não encontrei o banco de dados do Anki dentro do pacote.')
  let bd = new sql.Database(descomprimir(arquivos[nomeBanco] as Uint8Array))
  try {
    const novo = temTabela(bd, 'notetypes')
    if (novo) bd = trocarOrdenacao(bd, sql)
    const { tipos, nomes } = novo ? lerTiposEBaralhosNovos(bd) : lerTiposEBaralhosAntigos(bd)

    // baralho de cada nota = baralho do primeiro cartão dela
    const baralhoDaNota = new Map<number, string>()
    for (const c of consultar(bd, 'select nid, did from cards order by nid, ord')) {
      const nid = Number(c.nid)
      if (!baralhoDaNota.has(nid)) baralhoDaNota.set(nid, nomes.get(Number(c.did)) ?? '')
    }
    const notas: NotaAnki[] = []
    for (const n of consultar(bd, 'select id, mid, flds, tags from notes order by id')) {
      const id = Number(n.id)
      const baralho = baralhoDaNota.get(id)
      if (baralho === undefined || !tipos.has(Number(n.mid))) continue // nota sem cartão ou de tipo desconhecido
      notas.push({ id, tipoId: Number(n.mid), baralho: baralho || 'Importado', campos: separarCampos(String(n.flds)), tags: separarTags(String(n.tags)) })
    }

    const midia = new Map<string, Uint8Array>()
    for (const [arq, original] of lerListaDeMidia(arquivos.media)) {
      const conteudo = arquivos[arq]
      if (conteudo) midia.set(original, descomprimir(conteudo))
    }
    return { tipos, notas, midia }
  } catch (e) {
    if (e instanceof Error && /Anki|vazio/.test(e.message)) throw e
    throw new Error('Não consegui ler o conteúdo deste pacote do Anki.', { cause: e })
  } finally {
    bd.close()
  }
}

export interface ResumoImportacao {
  baralhos: number
  notas: number
  cartoes: number
  imagens: number
  imagensFaltando: number
  sonsIgnorados: number
  /** Notas puladas por não gerarem nenhum cartão (frente vazia). */
  puladas: number
}

const novo = (agora: number): Controle => ({ atualizadoEm: agora, excluidoEm: null, sujo: 1 })

/**
 * Grava o pacote no banco: um tipo de nota por tipo do Anki ("Nome (Anki)"), baralhos pelos nomes originais
 * (reaproveita os que já existem), notas e cartões **novos** (sem o histórico de estudo do Anki).
 * `sanitizar` limpa o HTML de cada campo; vem de fora porque depende do navegador.
 */
export async function importarPacote(db: BancoCiclo, pacote: PacoteAnki, sanitizar: (html: string) => string, agora = Date.now()): Promise<ResumoImportacao> {
  const r: ResumoImportacao = { baralhos: 0, notas: 0, cartoes: 0, imagens: 0, imagensFaltando: 0, sonsIgnorados: 0, puladas: 0 }
  let seq = 0
  const id = (p: string) => novoIdFc(p, agora + seq++)

  // campos já processados (mídia embutida + sanitização) por nota, para não repetir
  const tiposUsados = new Set(pacote.notas.map((n) => n.tipoId))
  const tiposNossos = new Map<number, TipoNota>()
  for (const t of tiposUsados) {
    const a = pacote.tipos.get(t)
    if (!a) continue
    const modelos = a.modelos.map((m) => ({ nome: m.nome, frente: ajustarModelo(m.frente), verso: ajustarModelo(m.verso) }))
    tiposNossos.set(t, { id: id('t'), nome: `${a.nome} (Anki)`, campos: a.campos, modelos, cloze: a.cloze, ...novo(agora) })
  }

  await db.transaction('rw', [db.baralhos, db.tiposNota, db.notasFc, db.cartoes], async () => {
    const existentes = new Map((await db.baralhos.toArray()).filter((b) => b.excluidoEm === null).map((b) => [b.nome.toLowerCase(), b]))
    const baralhoId = async (nome: string): Promise<string> => {
      const ja = existentes.get(nome.toLowerCase())
      if (ja) return ja.id
      const partes = nome.split('::')
      let ultimo = ''
      for (let k = 1; k <= partes.length; k++) {
        const caminho = partes.slice(0, k).join('::')
        let b = existentes.get(caminho.toLowerCase())
        if (!b) {
          b = { id: id('b'), nome: caminho, grupoId: GRUPO_PADRAO, origem: 'manual', criadoEm: agora, ...novo(agora) } satisfies Baralho
          await db.baralhos.put(b)
          existentes.set(caminho.toLowerCase(), b)
          r.baralhos++
        }
        ultimo = b.id
      }
      return ultimo
    }

    const tiposGravados = new Set<number>()
    for (const n of pacote.notas) {
      const tipo = tiposNossos.get(n.tipoId)
      const anki = pacote.tipos.get(n.tipoId)
      if (!tipo || !anki) continue
      const campos = camposDaNota(anki, n.campos)
      for (const k of Object.keys(campos)) {
        const m = embutirMidia(campos[k] ?? '', pacote.midia)
        r.imagens += m.imagens
        r.imagensFaltando += m.faltando
        r.sonsIgnorados += m.sonsIgnorados
        campos[k] = sanitizar(m.html)
      }
      if (!indicesDeCartoes(tipo, campos).length) {
        r.puladas++
        continue
      }
      if (!tiposGravados.has(n.tipoId)) {
        await db.tiposNota.put(tipo)
        tiposGravados.add(n.tipoId)
      }
      const nota: NotaFc = { id: id('n'), tipoId: tipo.id, baralhoId: await baralhoId(n.baralho), campos, tags: n.tags, criadoEm: agora, ...novo(agora) }
      const cartoes = cartoesNovos(nota, tipo, new Set(), agora + seq++)
      await db.notasFc.put(nota)
      await db.cartoes.bulkPut(cartoes)
      r.notas++
      r.cartoes += cartoes.length
    }
  })
  return r
}
