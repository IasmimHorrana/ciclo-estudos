import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { carregarCiclo } from '@/dados/ciclo'
import { lerArquivo } from '@/dados/converter'
import { BancoCiclo } from '@/dados/db'
import { ajustarMetaDaSemana, definirMetaLivre, definirModo, escolherDia } from '@/dados/livre'
import { carregarDados, substituirDados } from '@/dados/repositorio'
import { metaDaSemana } from '@/dominio/livre'

const AGORA = new Date(2026, 9, 29, 15).getTime() // quinta 29/10
let n = 0

async function banco() {
  const db = new BancoCiclo(`livre-${++n}`)
  await substituirDados(db, lerArquivo(JSON.stringify({ config: { horas: 2, duracao: 1, mats: [], custom: [], ocultas: [] }, fechadas: [] }), AGORA), AGORA)
  return db
}

describe('modo Livre no banco', () => {
  it('começa no ciclo, com meta 28/32 e sem dia escolhido', async () => {
    const p = (await carregarCiclo(await banco())).preferencias
    expect(p).toMatchObject({ modoEstudo: 'ciclo', metaLivre: { base: 28, estendida: 32, ajustes: {} }, diaLivre: null })
  })

  it('grava modo, meta, ajuste da semana e dia, sem mexer nas outras preferências', async () => {
    const db = await banco()
    await definirModo(db, 'livre', AGORA)
    expect(await definirMetaLivre(db, 25, 30, AGORA)).toBeNull()
    expect(await definirMetaLivre(db, 25, 20, AGORA)).toMatch('estendida')
    await ajustarMetaDaSemana(db, '2026-10-29', 18, AGORA)
    await escolherDia(db, { data: '2026-10-29', principal: 'Português', secundaria: 'Direito Adm.' }, AGORA)
    const p = (await carregarCiclo(db)).preferencias
    expect(p.modoEstudo).toBe('livre')
    expect(p.metaLivre).toEqual({ base: 25, estendida: 30, ajustes: { '2026-10-26': 18 } })
    expect(metaDaSemana(p.metaLivre, '2026-11-02')).toBe(25)
    expect(p.diaLivre).toEqual({ data: '2026-10-29', principal: 'Português', secundaria: 'Direito Adm.' })
    expect(p.faixas).toEqual({ fraco: 60, medio: 75, bom: 90 })
  })

  it('o backup leva e traz tudo igual', async () => {
    const db = await banco()
    await definirModo(db, 'livre', AGORA)
    await ajustarMetaDaSemana(db, '2026-10-29', 18, AGORA)
    await escolherDia(db, { data: '2026-10-29', principal: 'Português', secundaria: null }, AGORA)
    const antes = await carregarDados(db)
    const outro = new BancoCiclo(`livre-${++n}`)
    await substituirDados(outro, lerArquivo(JSON.stringify(antes), AGORA), AGORA)
    expect((await carregarDados(outro))?.preferencias).toEqual(antes?.preferencias)
  })

  it('backup antigo ou estragado: valores padrão, sem perder as outras preferências', () => {
    const base = { config: { horas: 2, duracao: 1, mats: [], custom: [], ocultas: [] }, fechadas: [] }
    const p = lerArquivo(JSON.stringify({ ...base, preferencias: { faixas: { fraco: 50, medio: 70, bom: 85 }, modoEstudo: 'x', metaLivre: { base: 'abc', estendida: 10 }, diaLivre: 3 } }), AGORA).preferencias
    expect(p).toMatchObject({ faixas: { fraco: 50, medio: 70, bom: 85 }, modoEstudo: 'ciclo', metaLivre: { base: 28, estendida: 32 }, diaLivre: null })
  })
})
