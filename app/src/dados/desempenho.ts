import type { BancoCiclo } from '@/dados/db'
import type { Assunto, RegistroQuestoes, SessaoPomodoro } from '@/dados/esquemas'
import { novoIdFc } from '@/dados/ids'
import { hoje } from '@/dominio/datas'
import { validarQuestoes, type DadosQuestoes } from '@/dominio/desempenho'

export interface Estudo {
  assuntos: Assunto[]
  questoes: RegistroQuestoes[]
  sessoes: SessaoPomodoro[]
}

const vivos = <T extends { excluidoEm: number | null }>(l: T[]) => l.filter((x) => x.excluidoEm === null)
const norm = (s: string) => s.trim().toLowerCase()

export async function carregarEstudo(db: BancoCiclo): Promise<Estudo> {
  const [a, q, s] = await Promise.all([db.assuntos.toArray(), db.questoes.toArray(), db.sessoes.toArray()])
  return { assuntos: vivos(a), questoes: vivos(q), sessoes: vivos(s) }
}

/** Cria os assuntos de uma matéria (os que já existem são ignorados). Devolve quantos eram novos. */
export async function adicionarAssuntos(db: BancoCiclo, materia: string, nomes: string[], agora = Date.now()): Promise<number> {
  return db.transaction('rw', db.assuntos, async () => {
    const atuais = vivos(await db.assuntos.toArray()).filter((a) => a.materia === materia)
    let novos = 0
    for (const n of nomes.map((x) => x.trim()).filter(Boolean)) {
      if (atuais.some((a) => norm(a.nome) === norm(n))) continue
      const a: Assunto = { id: novoIdFc('a', agora), materia, nome: n, ordem: 0, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: false, atualizadoEm: agora, excluidoEm: null, sujo: 1 }
      await db.assuntos.put(a)
      atuais.push(a)
      novos++
    }
    return novos
  })
}

export async function renomearAssunto(db: BancoCiclo, id: string, nome: string, agora = Date.now()): Promise<'ok' | 'duplicado' | 'vazio'> {
  const n = nome.trim()
  if (!n) return 'vazio'
  return db.transaction('rw', db.assuntos, async () => {
    const a = await db.assuntos.get(id)
    if (!a) return 'ok' as const
    if (vivos(await db.assuntos.toArray()).some((x) => x.id !== id && x.materia === a.materia && norm(x.nome) === norm(n))) return 'duplicado' as const
    await db.assuntos.put({ ...a, nome: n, atualizadoEm: agora, sujo: 1 })
    return 'ok' as const
  })
}

/** Exclui o assunto; os registros dele continuam e passam a contar como "sem assunto". */
export async function excluirAssunto(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  await db.transaction('rw', [db.assuntos, db.questoes, db.sessoes], async () => {
    const a = await db.assuntos.get(id)
    if (a) await db.assuntos.put({ ...a, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
    for (const q of await db.questoes.filter((x) => x.assuntoId === id).toArray()) await db.questoes.put({ ...q, assuntoId: null, atualizadoEm: agora, sujo: 1 })
    for (const s of await db.sessoes.filter((x) => x.assuntoId === id).toArray()) await db.sessoes.put({ ...s, assuntoId: null, atualizadoEm: agora, sujo: 1 })
  })
}

export async function excluirRegistroQuestoes(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const q = await db.questoes.get(id)
  if (q) await db.questoes.put({ ...q, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
}

/** Salva um registro de questões. Se `novo` vier preenchido, cria (ou reaproveita) o assunto. Devolve a mensagem de erro, se houver. */
export async function registrarQuestoes(db: BancoCiclo, d: DadosQuestoes, agora = Date.now()): Promise<string | null> {
  const erro = validarQuestoes(d, hoje(new Date(agora)))
  if (erro) return erro
  await db.transaction('rw', [db.assuntos, db.questoes], async () => {
    let assuntoId: string | null = d.assuntoId || null
    if (d.novo.trim()) {
      const ex = vivos(await db.assuntos.toArray()).find((a) => a.materia === d.materia && norm(a.nome) === norm(d.novo))
      if (ex) assuntoId = ex.id
      else {
        const a: Assunto = { id: novoIdFc('a', agora), materia: d.materia, nome: d.novo.trim(), ordem: 0, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: false, atualizadoEm: agora, excluidoEm: null, sujo: 1 }
        await db.assuntos.put(a)
        assuntoId = a.id
      }
    }
    await db.questoes.put({ id: novoIdFc('q', agora), data: d.data, materia: d.materia, assuntoId, feitas: d.feitas, acertos: d.acertos, atualizadoEm: agora, excluidoEm: null, sujo: 1 })
  })
  return null
}
