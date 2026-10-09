import type { BancoCiclo } from '@/dados/db'
import type { Controle, Dados } from '@/dados/esquemas'

const CHAVES = ['tema', 'config', 'semana', 'pomo', 'cores'] as const

const vivos = <T extends { excluidoEm: number | null }>(l: T[]) => l.filter((x) => x.excluidoEm === null)

/** Lê tudo que está vivo no banco. Devolve `null` se o banco ainda está vazio (nada foi gravado/importado). */
export async function carregarDados(db: BancoCiclo): Promise<Dados | null> {
  const valores = new Map((await db.valores.toArray()).map((v) => [v.chave, v.valor]))
  if (!valores.has('config')) return null
  const [fechadas, modelos, notas, assuntos, questoes, sessoes] = await Promise.all([
    db.semanasFechadas.toArray(),
    db.modelos.toArray(),
    db.notas.toArray(),
    db.assuntos.toArray(),
    db.questoes.toArray(),
    db.sessoes.toArray(),
  ])
  return {
    tema: (valores.get('tema') ?? 'auto') as Dados['tema'],
    config: valores.get('config') as Dados['config'],
    semana: (valores.get('semana') ?? null) as Dados['semana'],
    pomo: (valores.get('pomo') ?? { foco: 25, pausa: 5, longa: 15, ate: 4 }) as Dados['pomo'],
    cores: (valores.get('cores') ?? {}) as Dados['cores'],
    fechadas: vivos(fechadas),
    modelos: vivos(modelos),
    notas: vivos(notas),
    assuntos: vivos(assuntos),
    questoes: vivos(questoes),
    sessoes: vivos(sessoes),
  }
}

export interface ResumoImportacao {
  fechadas: number
  modelos: number
  notas: number
  assuntos: number
  questoes: number
  sessoes: number
  temSemana: boolean
}

/**
 * Grava os dados no banco, **substituindo** o que havia. Nada é apagado de verdade:
 * o que existia e não está nos dados novos ganha `excluidoEm` (e continua "sujo" para a nuvem saber).
 * Tudo numa transação só: ou grava tudo ou não grava nada.
 */
export async function substituirDados(db: BancoCiclo, d: Dados, agora = Date.now()): Promise<ResumoImportacao> {
  const tabelas = [db.semanasFechadas, db.modelos, db.notas, db.assuntos, db.questoes, db.sessoes] as const
  const novos = [d.fechadas, d.modelos, d.notas, d.assuntos, d.questoes, d.sessoes] as const

  await db.transaction('rw', [db.valores, ...tabelas], async () => {
    for (const chave of CHAVES) {
      await db.valores.put({ chave, valor: d[chave], atualizadoEm: agora, sujo: 1 })
    }
    for (let i = 0; i < tabelas.length; i++) {
      const tabela = tabelas[i] as unknown as {
        toArray(): Promise<({ id: string } & Controle)[]>
        bulkPut(l: unknown[]): Promise<unknown>
      }
      const entrantes = novos[i] as ({ id: string } & Controle)[]
      const ids = new Set(entrantes.map((x) => x.id))
      const sobras = (await tabela.toArray())
        .filter((x) => x.excluidoEm === null && !ids.has(x.id))
        .map((x) => ({ ...x, excluidoEm: agora, atualizadoEm: agora, sujo: 1 as const }))
      await tabela.bulkPut([...entrantes, ...sobras])
    }
  })

  return {
    fechadas: d.fechadas.length,
    modelos: d.modelos.length,
    notas: d.notas.length,
    assuntos: d.assuntos.length,
    questoes: d.questoes.length,
    sessoes: d.sessoes.length,
    temSemana: d.semana !== null,
  }
}
