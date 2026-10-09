import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BancoCiclo } from '@/dados/db'
import { acharPorTitulo, carregarNotas, criarNota, excluirNotaResumo, importarNotas, mudarMateriaNota, renomearNota, resumoDaMateria, salvarTextoNota } from '@/dados/notas'

const T0 = new Date(2026, 9, 9, 10, 0).getTime()
let n = 0
const banco = () => new BancoCiclo(`nt-${++n}`)
const OP = { citacoes: true, marcadores: true, dividir: false }

describe('criar e editar', () => {
  it('cria com texto inicial, título único e grava o texto novo', async () => {
    const db = banco()
    const a = await criarNota(db, 'Crase', 'Língua Portuguesa', undefined, T0)
    const b = await criarNota(db, 'crase', '', undefined, T0 + 1)
    expect(a.texto).toBe('# Crase\n\n- ')
    expect(b.titulo).toBe('crase (2)')
    await salvarTextoNota(db, a.id, '# Crase\n\n- regra', T0 + 5)
    expect((await db.notas.get(a.id))).toMatchObject({ texto: '# Crase\n\n- regra', atualizado: T0 + 5, sujo: 1 })
  })

  it('mudar matéria e achar pelo título', async () => {
    const db = banco()
    const a = await criarNota(db, 'Crase', '', undefined, T0)
    await mudarMateriaNota(db, a.id, 'Língua Portuguesa', T0 + 1)
    const todas = await carregarNotas(db)
    expect(todas[0]?.materia).toBe('Língua Portuguesa')
    expect(acharPorTitulo(todas, ' CRASE ')?.id).toBe(a.id)
    expect(acharPorTitulo(todas, 'Outra')).toBeUndefined()
  })

  it('excluir esconde a nota (fica marcada no banco, para o backup e a nuvem)', async () => {
    const db = banco()
    const a = await criarNota(db, 'Crase', '', undefined, T0)
    await excluirNotaResumo(db, a.id, T0 + 1)
    expect(await carregarNotas(db)).toEqual([])
    expect((await db.notas.get(a.id))?.excluidoEm).toBe(T0 + 1)
  })
})

describe('renomear mantém as ligações', () => {
  it('troca [[Antigo]] nas outras notas e no próprio texto', async () => {
    const db = banco()
    const a = await criarNota(db, 'Crase', '', '# Crase\n[[Crase]] se cita', T0)
    const b = await criarNota(db, 'Outra', '', 'veja [[crase]]', T0 + 1)
    const novo = await renomearNota(db, a.id, 'Acento grave', T0 + 2)
    expect(novo).toBe('Acento grave')
    expect((await db.notas.get(b.id))?.texto).toBe('veja [[Acento grave]]')
    expect((await db.notas.get(a.id))?.texto).toBe('# Crase\n[[Acento grave]] se cita')
  })

  it('não deixa repetir o título de outra nota', async () => {
    const db = banco()
    await criarNota(db, 'Crase', '', undefined, T0)
    const b = await criarNota(db, 'Outra', '', undefined, T0 + 1)
    expect(await renomearNota(db, b.id, 'crase', T0 + 2)).toBe('crase (2)')
  })
})

describe('resumo da matéria e importação', () => {
  it('abre o resumo existente da matéria ou cria "Matéria — resumo"', async () => {
    const db = banco()
    const nova = await resumoDaMateria(db, 'Informática', T0)
    expect(nova).toMatchObject({ titulo: 'Informática — resumo', materia: 'Informática' })
    expect((await resumoDaMateria(db, 'Informática', T0 + 1)).id).toBe(nova.id)
    expect(await carregarNotas(db)).toHaveLength(1)
  })

  it('importar adapta o texto, ganha "# Título" quando falta e divide em seções', async () => {
    const db = banco()
    const um = await importarNotas(db, [{ titulo: 'Redes', materia: 'Informática', texto: '• camada [1]\n• outra' }], OP, T0)
    expect(um).toHaveLength(1)
    expect(um[0]?.texto).toBe('# Redes\n\n- camada\n- outra\n')
    const varios = await importarNotas(db, [{ titulo: 'Guia', materia: '', texto: '## A\ntexto A\n## B\ntexto B' }], { ...OP, dividir: true }, T0 + 10)
    expect(varios.map((x) => x.titulo)).toEqual(['Guia — A', 'Guia — B'])
    expect(varios[0]?.texto.startsWith('# A')).toBe(true)
  })
})
