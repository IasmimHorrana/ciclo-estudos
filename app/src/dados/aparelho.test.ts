import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { aparelhoAtual, nomePadrao } from '@/dados/aparelho'
import { BancoCiclo } from '@/dados/db'

let n = 0
const banco = () => new BancoCiclo(`aparelho-${++n}`)

describe('identidade do aparelho', () => {
  it('cria na primeira vez e devolve sempre a mesma depois', async () => {
    const db = banco()
    const a = await aparelhoAtual(db, 1, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    expect(a).toMatchObject({ nome: 'Computador', criadoEm: 1 })
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await aparelhoAtual(db, 2, 'iPhone')).toEqual(a)
  })

  it('cada banco (navegador) tem a sua', async () => {
    const [a, b] = [await aparelhoAtual(banco()), await aparelhoAtual(banco())]
    expect(a.id).not.toBe(b.id)
  })

  it('fica só na tabela local (que não vai para a nuvem) e não marca nada como sujo', async () => {
    const db = banco()
    await aparelhoAtual(db)
    expect(await db.local.get('aparelho')).toBeDefined()
    expect(await db.valores.where('sujo').equals(1).count()).toBe(0)
  })

  it('nome inicial pelo navegador', () => {
    expect(nomePadrao('Mozilla/5.0 (Linux; Android 14; SM-A546E) Mobile Safari')).toBe('Celular')
    expect(nomePadrao('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('Celular')
    expect(nomePadrao('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('Tablet')
    expect(nomePadrao('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('Computador')
  })
})
