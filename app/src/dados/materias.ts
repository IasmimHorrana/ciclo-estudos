import type { BancoCiclo } from '@/dados/db'
import type { ConfigCiclo, Semana } from '@/dados/esquemas'
import { MATERIAS_PADRAO } from '@/dominio/ciclo'

const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const trocaMats = <T extends { nome: string }>(mats: T[], de: string, para: string): T[] => mats.map((m) => (m.nome === de ? { ...m, nome: para } : m))

/**
 * Troca o nome de uma matéria em tudo que a usa: lista de matérias, ciclo em montagem, semana, histórico,
 * modelos, notas, assuntos, questões, sessões e edital. Devolve `duplicada` se o novo nome é de OUTRA matéria
 * (só mudar maiúsculas/minúsculas do próprio nome é permitido) e `vazia` se o nome ficou em branco.
 */
export async function renomearMateria(db: BancoCiclo, antigo: string, novo: string, agora = Date.now()): Promise<'ok' | 'duplicada' | 'vazia'> {
  const nome = novo.trim().replace(/\s+/g, ' ')
  if (!nome) return 'vazia'
  if (nome === antigo) return 'ok'
  const marca = { atualizadoEm: agora, sujo: 1 as const }

  return db.transaction('rw', [db.valores, db.semanasFechadas, db.modelos, db.notas, db.assuntos, db.questoes, db.sessoes, db.materiasEdital], async () => {
    const config = (await db.valores.get('config'))?.valor as ConfigCiclo | undefined
    const existentes = [
      ...MATERIAS_PADRAO, ...(config?.custom ?? []), ...(config?.ocultas ?? []), ...(config?.mats.map((m) => m.nome) ?? []),
      ...(await db.materiasEdital.toArray()).filter((m) => m.excluidoEm === null).map((m) => m.nome),
    ]
    if (existentes.some((m) => m !== antigo && igual(m, nome))) return 'duplicada' as const

    if (config) {
      const doPadrao = (MATERIAS_PADRAO as readonly string[]).includes(antigo)
      const custom = config.custom.filter((m) => m !== antigo)
      const ocultas = config.ocultas.map((m) => (m === antigo ? nome : m))
      // uma matéria padrão não some da lista: fica tirada e o nome novo entra como própria
      if (doPadrao) ocultas.push(antigo)
      if (!(MATERIAS_PADRAO as readonly string[]).includes(nome) && !ocultas.includes(nome)) custom.push(nome)
      await db.valores.put({ chave: 'config', valor: { ...config, custom, ocultas: [...new Set(ocultas)], mats: trocaMats(config.mats, antigo, nome) }, ...marca })
    }

    const cores = (await db.valores.get('cores'))?.valor as Record<string, number> | undefined
    if (cores && antigo in cores) {
      const { [antigo]: cor, ...resto } = cores
      await db.valores.put({ chave: 'cores', valor: { ...resto, [nome]: cor }, ...marca })
    }

    const semana = (await db.valores.get('semana'))?.valor as Semana | null | undefined
    if (semana) {
      const modelo = semana.modelo ? { ...semana.modelo, mats: trocaMats(semana.modelo.mats, antigo, nome) } : null
      await db.valores.put({ chave: 'semana', valor: { ...semana, modelo, passos: semana.passos.map((p) => (p.materia === antigo ? { ...p, materia: nome } : p)) }, ...marca })
    }

    for (const f of await db.semanasFechadas.toArray()) {
      if (!(antigo in f.porMateria) && !f.modelo?.mats.some((m) => m.nome === antigo)) continue
      const { [antigo]: h, ...resto } = f.porMateria
      const porMateria = h === undefined ? f.porMateria : { ...resto, [nome]: (resto[nome] ?? 0) + h }
      await db.semanasFechadas.put({ ...f, porMateria, modelo: f.modelo ? { ...f.modelo, mats: trocaMats(f.modelo.mats, antigo, nome) } : null, ...marca })
    }
    for (const m of await db.modelos.toArray()) {
      if (m.config.mats.some((x) => x.nome === antigo)) await db.modelos.put({ ...m, config: { ...m.config, mats: trocaMats(m.config.mats, antigo, nome) }, ...marca })
    }

    for (const tabela of [db.notas, db.assuntos, db.questoes, db.sessoes]) {
      // todas têm `materia`; o tipo da união atrapalha o `where`, então filtramos aqui mesmo
      const linhas = (await tabela.toArray()) as { materia: string }[]
      const alteradas = linhas.filter((l) => l.materia === antigo).map((l) => ({ ...l, materia: nome, ...marca }))
      if (alteradas.length) await (tabela as unknown as { bulkPut: (x: unknown[]) => Promise<unknown> }).bulkPut(alteradas)
    }
    for (const m of await db.materiasEdital.toArray()) {
      if (m.nome === antigo) await db.materiasEdital.put({ ...m, nome, ...marca })
    }
    return 'ok' as const
  })
}
