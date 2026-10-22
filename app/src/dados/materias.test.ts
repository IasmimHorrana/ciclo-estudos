import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { carregarCiclo, gerarSemana, mudarConfig } from '@/dados/ciclo'
import { BancoCiclo } from '@/dados/db'
import { renomearMateria } from '@/dados/materias'

const T0 = new Date(2026, 9, 9, 10, 0).getTime()
let n = 0

async function montado() {
  const db = new BancoCiclo(`materias-${++n}`)
  await mudarConfig(db, (c) => ({
    ...c, horas: 4, duracao: 1, modo: 'Livre', dias: [true, true, true, true, true, true, true],
    custom: ['DIREITO CIVIL'], mats: [{ nome: 'DIREITO CIVIL', rep: 2, peso: 3 }, { nome: 'Estatística', rep: 2, peso: 3 }],
  }), T0)
  await gerarSemana(db, T0)
  await db.notas.put({ id: 'n1', titulo: 't', materia: 'DIREITO CIVIL', texto: '', criado: 1, atualizado: 1, atualizadoEm: 1, excluidoEm: null, sujo: 0 })
  return db
}

describe('renomearMateria', () => {
  it('troca o nome no ciclo, nas cores, na semana e nas notas', async () => {
    const db = await montado()
    expect(await renomearMateria(db, 'DIREITO CIVIL', 'Direito Civil', T0)).toBe('ok')
    const c = await carregarCiclo(db)
    expect(c.config.custom).toEqual(['Direito Civil'])
    expect(c.config.mats.map((m) => m.nome)).toContain('Direito Civil')
    expect(c.semana?.passos.some((p) => p.materia === 'DIREITO CIVIL')).toBe(false)
    expect(c.semana?.passos.filter((p) => p.materia === 'Direito Civil')).toHaveLength(2)
    expect(c.cores['Direito Civil']).toBeDefined()
    expect(c.cores['DIREITO CIVIL']).toBeUndefined()
    expect((await db.notas.get('n1'))?.materia).toBe('Direito Civil')
  })

  it('matéria padrão: sai da lista e o nome novo entra como própria', async () => {
    const db = await montado()
    await renomearMateria(db, 'Estatística', 'Estatística Aplicada', T0)
    const c = await carregarCiclo(db)
    expect(c.config.ocultas).toContain('Estatística')
    expect(c.config.custom).toContain('Estatística Aplicada')
  })

  it('recusa nome de outra matéria e nome vazio', async () => {
    const db = await montado()
    expect(await renomearMateria(db, 'DIREITO CIVIL', 'estatística', T0)).toBe('duplicada')
    expect(await renomearMateria(db, 'DIREITO CIVIL', '  ', T0)).toBe('vazia')
  })
})
