import 'fake-indexeddb/auto'
import { zipSync, strToU8 } from 'fflate'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { importarPacote, lerApkg } from '@/dados/apkg'
import { BancoCiclo } from '@/dados/db'
import { garantirPadroes } from '@/dados/flashcards'
import { renderizarCartao } from '@/dominio/modelo'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])

async function montarApkg(): Promise<{ bytes: Uint8Array; sql: Awaited<ReturnType<typeof initSqlJs>> }> {
  const sql = await initSqlJs()
  const bd = new sql.Database()
  bd.run('create table col (models text, decks text)')
  bd.run('create table notes (id integer, mid integer, flds text, tags text)')
  bd.run('create table cards (id integer, nid integer, did integer, ord integer)')
  const models = {
    '10': {
      name: 'Básico', type: 0, flds: [{ name: 'Frente', ord: 0 }, { name: 'Verso', ord: 1 }],
      tmpls: [{ name: 'Cartão 1', ord: 0, qfmt: '{{Frente}}', afmt: '{{FrontSide}}<hr id=answer>{{hint:Verso}}' }],
    },
    '20': {
      name: 'Cloze', type: 1, flds: [{ name: 'Texto', ord: 0 }, { name: 'Extra', ord: 1 }],
      tmpls: [{ name: 'Cloze', ord: 0, qfmt: '{{cloze:Texto}}', afmt: '{{cloze:Texto}}<br>{{Extra}}' }],
    },
  }
  const decks = { '1': { name: 'Default' }, '2': { name: 'Português::Conceitos' } }
  bd.run('insert into col values (?, ?)', [JSON.stringify(models), JSON.stringify(decks)])
  bd.run('insert into notes values (1, 10, ?, ?)', [`Crase\x1fUsa-se antes de <img src="a%20b.png"> [sound:x.mp3]`, ' gramática  ortografia '])
  bd.run('insert into notes values (2, 20, ?, ?)', ['A {{c1::vírgula}} e o {{c2::ponto}}\x1f', ''])
  bd.run('insert into notes values (3, 10, ?, ?)', ['\x1fsó verso', ''])
  bd.run('insert into notes values (4, 10, ?, ?)', ['sem cartão\x1f', ''])
  bd.run('insert into cards values (1, 1, 2, 0)')
  bd.run('insert into cards values (2, 2, 2, 0)')
  bd.run('insert into cards values (3, 2, 2, 1)')
  bd.run('insert into cards values (4, 3, 1, 0)')
  const banco = bd.export()
  bd.close()
  const bytes = zipSync({ 'collection.anki2': banco, media: strToU8(JSON.stringify({ '0': 'a b.png' })), '0': PNG })
  return { bytes, sql }
}

describe('importar .apkg', () => {
  it('lê tipos, notas, tags, baralhos e mídia', async () => {
    const { bytes, sql } = await montarApkg()
    const p = lerApkg(bytes, sql)
    expect(p.tipos.get(20)?.cloze).toBe(true)
    expect(p.notas.map((n) => n.baralho)).toEqual(['Português::Conceitos', 'Português::Conceitos', 'Default'])
    expect(p.notas[0]?.tags).toEqual(['gramática', 'ortografia'])
    expect([...p.midia.keys()]).toEqual(['a b.png'])
  })

  it('grava baralhos, notas e cartões novos; embute imagem e tira o som', async () => {
    const { bytes, sql } = await montarApkg()
    const db = new BancoCiclo('apkg-1')
    await garantirPadroes(db)
    const r = await importarPacote(db, lerApkg(bytes, sql), (h) => h)
    expect(r).toMatchObject({ notas: 2, cartoes: 3, imagens: 1, sonsIgnorados: 1, puladas: 1 })
    const nomes = (await db.baralhos.toArray()).map((b) => b.nome).sort()
    expect(nomes).toEqual(['Português', 'Português::Conceitos'])
    const notas = await db.notasFc.toArray()
    const crase = notas.find((n) => n.campos.Frente === 'Crase')
    expect(crase?.campos.Verso).toContain('<img src="data:image/png;base64,')
    expect(crase?.campos.Verso).not.toContain('sound')
    expect(crase?.tags).toEqual(['gramática', 'ortografia'])
    const cartoes = await db.cartoes.toArray()
    expect(cartoes).toHaveLength(3)
    const tipo = (await db.tiposNota.toArray()).find((t) => t.nome === 'Básico (Anki)')
    expect(tipo).toBeTruthy()
    if (tipo && crase) expect(renderizarCartao(tipo, crase.campos, 0).verso.html).toContain('Usa-se antes de')
  })

  it('arquivo que não é pacote dá erro em português', async () => {
    const sql = await initSqlJs()
    expect(() => lerApkg(strToU8('nada'), sql)).toThrow(/pacote do Anki/)
    expect(() => lerApkg(zipSync({ 'x.txt': strToU8('oi') }), sql)).toThrow(/banco de dados/)
  })
})
