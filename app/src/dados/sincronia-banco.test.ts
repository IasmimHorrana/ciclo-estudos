import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BancoCiclo } from '@/dados/db'
import { campoChave, COLECOES, ESQUEMA_VERSAO } from '@/dominio/sincronia'

/** Travas: se o banco mudar e a sincronização não acompanhar, estes testes avisam. */
describe('sincronização acompanha o banco', () => {
  const db = new BancoCiclo('trava-sincronia')

  it('a versão do esquema enviada à nuvem é a versão do banco', () => {
    expect(ESQUEMA_VERSAO).toBe(db.verno)
  })

  it('toda tabela vai para a nuvem, menos a "local" (só deste aparelho)', () => {
    const tabelas = db.tables.map((t) => t.name).filter((n) => n !== 'local').sort()
    expect([...COLECOES].sort()).toEqual(tabelas)
  })

  it('a chave de cada coleção é a chave primária da tabela', () => {
    for (const c of COLECOES) expect(db.table(c).schema.primKey.name).toBe(campoChave(c))
  })

  it('toda tabela sincronizada tem o índice "sujo" (para achar o que falta enviar)', () => {
    for (const c of COLECOES) expect(db.table(c).schema.idxByName.sujo, c).toBeDefined()
  })
})
