import { garantirCores, mudarConfig } from '@/dados/ciclo'
import { carregarEstudo, type Estudo } from '@/dados/desempenho'
import type { BancoCiclo } from '@/dados/db'
import type { Assunto, MateriaEdital } from '@/dados/esquemas'
import { novoIdFc } from '@/dados/ids'
import { MATERIAS_PADRAO, passosDe } from '@/dominio/ciclo'
import { normalizar, repartirHoras, sugerirRepeticoes, type MateriaLida } from '@/dominio/edital'

const vivos = <T extends { excluidoEm: number | null }>(l: T[]) => l.filter((x) => x.excluidoEm === null)

export interface DadosEdital extends Estudo {
  materias: MateriaEdital[]
}

export async function carregarEdital(db: BancoCiclo): Promise<DadosEdital> {
  const [estudo, materias] = await Promise.all([carregarEstudo(db), db.materiasEdital.toArray()])
  return { ...estudo, materias: vivos(materias).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')) }
}

const novaMateria = (nome: string, ordem: number, agora: number): MateriaEdital => ({
  id: novoIdFc('e', agora + ordem), nome, peso: 3, ordem, atualizadoEm: agora, excluidoEm: null, sujo: 1,
})
const novoAssunto = (materia: string, nome: string, ordem: number, agora: number, noEdital: boolean, paiId: string | null): Assunto => ({
  id: novoIdFc('a', agora + ordem), materia, nome, ordem, importancia: 0, horasIdeais: 0, estudado: false, noCiclo: false, noEdital, paiId,
  atualizadoEm: agora, excluidoEm: null, sujo: 1,
})

export interface ResultadoImportacao {
  materiasNovas: number
  assuntosNovos: number
  assuntosQueJaExistiam: number
}

/**
 * Grava o edital já conferido na pré-visualização. Não duplica: casa matéria e assunto pelo nome sem acento/caixa.
 * Se a matéria do edital for a mesma de uma que o app já conhece (ciclo, questões), usa o nome do app.
 * Um assunto que já existia (criado em Desempenho, por exemplo) é ligado ao edital em vez de duplicado.
 * Com `noEdital` falso só cria assuntos (sem aparecerem na aba Edital), como no Pomodoro.
 */
export async function importarEdital(
  db: BancoCiclo, lidas: MateriaLida[], conhecidas: string[], agora = Date.now(), noEdital = true,
): Promise<ResultadoImportacao> {
  const r: ResultadoImportacao = { materiasNovas: 0, assuntosNovos: 0, assuntosQueJaExistiam: 0 }
  const nomesNovos: string[] = []
  await db.transaction('rw', [db.assuntos, db.materiasEdital], async () => {
    const materias = vivos(await db.materiasEdital.toArray())
    const assuntos = vivos(await db.assuntos.toArray())
    let ordemMat = materias.reduce((mx, m) => Math.max(mx, m.ordem), -1) + 1
    for (const l of lidas) {
      const nome = conhecidas.find((c) => normalizar(c) === normalizar(l.materia)) ?? l.materia.trim()
      if (!nome) continue
      if (noEdital && !materias.some((m) => normalizar(m.nome) === normalizar(nome))) {
        const m = novaMateria(nome, ordemMat++, agora)
        await db.materiasEdital.put(m)
        materias.push(m)
        nomesNovos.push(nome)
        r.materiasNovas++
      }
      const daMateria = assuntos.filter((a) => normalizar(a.materia) === normalizar(nome))
      let ordem = daMateria.reduce((mx, a) => Math.max(mx, a.ordem), -1) + 1
      // acha ou cria o assunto; num edital, também o liga ao edital e ao tópico dele (reimportar reorganiza sem duplicar)
      const garantir = async (nomeAssunto: string, paiId: string | null): Promise<Assunto> => {
        const ja = daMateria.find((a) => normalizar(a.nome) === normalizar(nomeAssunto))
        if (ja) {
          r.assuntosQueJaExistiam++
          // se o nome só difere pela primeira letra (minúscula antes, maiúscula agora), passa a usar a maiúscula
          const nomeNovo = ja.nome !== nomeAssunto && ja.nome.charAt(0) === ja.nome.charAt(0).toLocaleLowerCase('pt-BR') && ja.nome.slice(1) === nomeAssunto.slice(1) ? nomeAssunto : ja.nome
          if (noEdital && (!ja.noEdital || (ja.paiId ?? null) !== paiId || nomeNovo !== ja.nome)) {
            const lig = { ...ja, nome: nomeNovo, noEdital: true, paiId, atualizadoEm: agora, sujo: 1 as const }
            await db.assuntos.put(lig)
            daMateria[daMateria.indexOf(ja)] = lig
            assuntos[assuntos.indexOf(ja)] = lig
            return lig
          }
          return ja
        }
        const a = novoAssunto(daMateria[0]?.materia ?? nome, nomeAssunto, ordem++, agora, noEdital, paiId)
        await db.assuntos.put(a)
        daMateria.push(a)
        assuntos.push(a)
        r.assuntosNovos++
        return a
      }
      for (const item of l.assuntos) {
        const topico = await garantir(item.nome, null)
        for (const filho of item.filhos) {
          if (normalizar(filho) !== normalizar(item.nome)) await garantir(filho, topico.id)
        }
      }
    }
  })
  if (noEdital) await registrarMaterias(db, nomesNovos, agora)
  return r
}

/** Faz as matérias novas aparecerem nas listas do app (Montar, Questões) e ganharem cor. */
async function registrarMaterias(db: BancoCiclo, nomes: string[], agora: number): Promise<void> {
  if (!nomes.length) return
  await mudarConfig(db, (c) => {
    const conhecidas = new Set([...MATERIAS_PADRAO, ...c.custom].map(normalizar))
    return { ...c, custom: [...c.custom, ...nomes.filter((n) => !conhecidas.has(normalizar(n)))] }
  }, agora)
  await garantirCores(db, nomes, agora)
}

export async function adicionarMateriaEdital(db: BancoCiclo, nome: string, agora = Date.now()): Promise<'ok' | 'duplicada' | 'vazia'> {
  const n = nome.trim()
  if (!n) return 'vazia'
  const r = await db.transaction('rw', db.materiasEdital, async () => {
    const materias = vivos(await db.materiasEdital.toArray())
    if (materias.some((m) => normalizar(m.nome) === normalizar(n))) return 'duplicada' as const
    await db.materiasEdital.put(novaMateria(n, materias.reduce((mx, m) => Math.max(mx, m.ordem), -1) + 1, agora))
    return 'ok' as const
  })
  if (r === 'ok') await registrarMaterias(db, [n], agora)
  return r
}

export async function incluirAssuntos(db: BancoCiclo, materia: string, nomes: string[], agora = Date.now()): Promise<number> {
  const r = await importarEdital(db, [{ materia, assuntos: nomes.map((n) => n.trim()).filter(Boolean).map((n) => ({ nome: n, filhos: [] })) }], [materia], agora)
  return r.assuntosNovos
}

export async function mudarMateriaEdital(db: BancoCiclo, id: string, patch: Partial<Pick<MateriaEdital, 'peso'>>, agora = Date.now()): Promise<void> {
  const m = await db.materiasEdital.get(id)
  if (m) await db.materiasEdital.put({ ...m, ...patch, atualizadoEm: agora, sujo: 1 })
}

export type AlteracaoAssunto = Partial<Pick<Assunto, 'importancia' | 'horasIdeais' | 'estudado' | 'noCiclo' | 'noEdital' | 'paiId'>>

export async function mudarAssunto(db: BancoCiclo, id: string, patch: AlteracaoAssunto, agora = Date.now()): Promise<void> {
  const a = await db.assuntos.get(id)
  if (a) await db.assuntos.put({ ...a, ...patch, atualizadoEm: agora, sujo: 1 })
}

/** Os ids dos subtópicos de um tópico, em qualquer nível. */
export function idsDosDescendentes(todos: readonly { id: string; paiId: string | null }[], id: string): string[] {
  const filhos = todos.filter((a) => a.paiId === id).map((a) => a.id)
  return [...filhos, ...filhos.flatMap((f) => idsDosDescendentes(todos, f))]
}

/** Muda o assunto e, se ele for um tópico, todos os subtópicos dele (marcar estudado, importância, horas…). */
export async function mudarComSubtopicos(db: BancoCiclo, id: string, patch: AlteracaoAssunto, agora = Date.now()): Promise<void> {
  await db.transaction('rw', db.assuntos, async () => {
    const todos = vivos(await db.assuntos.toArray())
    for (const alvo of [id, ...idsDosDescendentes(todos, id)]) await mudarAssunto(db, alvo, patch, agora)
  })
}

/**
 * Define as horas ideais de um tópico: o total é dividido em partes iguais entre os subtópicos (os assuntos de verdade),
 * que depois podem ser ajustados um a um. Num assunto sem subtópicos, é só o valor dele.
 */
export async function definirHorasDoTopico(db: BancoCiclo, id: string, total: number, agora = Date.now()): Promise<void> {
  await db.transaction('rw', db.assuntos, async () => {
    const todos = vivos(await db.assuntos.toArray()).filter((a) => a.noEdital)
    const folhas = idsDosDescendentes(todos, id)
      .filter((d) => !todos.some((a) => a.paiId === d))
      .map((d) => todos.find((a) => a.id === d))
      .filter((a): a is Assunto => !!a)
      .sort((a, b) => a.ordem - b.ordem)
    if (!folhas.length) return void (await mudarAssunto(db, id, { horasIdeais: Math.max(0, total) }, agora))
    const partes = repartirHoras(total, folhas.length)
    for (let i = 0; i < folhas.length; i++) await mudarAssunto(db, (folhas[i] as Assunto).id, { horasIdeais: partes[i] as number }, agora)
  })
}

/** Tira o assunto do edital (e os subtópicos dele). Continuam no app (Desempenho, Pomodoro, flashcards) com as questões e os tempos. */
export async function tirarAssuntoDoEdital(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  await db.transaction('rw', db.assuntos, async () => {
    const todos = vivos(await db.assuntos.toArray())
    for (const alvo of [id, ...idsDosDescendentes(todos, id)]) await mudarAssunto(db, alvo, { noEdital: false, noCiclo: false, paiId: null }, agora)
  })
}

/** Tira a matéria do edital e solta os assuntos dela do edital. Nada é apagado: os assuntos seguem no resto do app. */
export async function tirarMateriaDoEdital(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const m = await db.materiasEdital.get(id)
  if (!m) return
  await db.transaction('rw', [db.materiasEdital, db.assuntos], async () => {
    await db.materiasEdital.put({ ...m, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
    for (const a of vivos(await db.assuntos.toArray()).filter((x) => x.noEdital && normalizar(x.materia) === normalizar(m.nome))) {
      await db.assuntos.put({ ...a, noEdital: false, noCiclo: false, paiId: null, atualizadoEm: agora, sujo: 1 })
    }
  })
}

export interface PedidoCiclo {
  materia: string
  pesoMateria: number
  horasQueFaltam: number
  /** Assuntos escolhidos para virar a anotação do passo (vazio = só a matéria). */
  assuntoIds: string[]
}

export interface ResultadoCiclo {
  jaEstava: boolean
  repeticoes: number
}

/**
 * Manda a matéria para a montagem do ciclo (aba Montar) com repetições/peso sugeridos e marca os assuntos escolhidos,
 * que viram a anotação do passo quando o ciclo é gerado. Se a matéria já está no ciclo, não mexe nas repetições dela.
 */
export async function enviarAoCiclo(db: BancoCiclo, p: PedidoCiclo, agora = Date.now()): Promise<ResultadoCiclo> {
  let r: ResultadoCiclo = { jaEstava: false, repeticoes: 0 }
  await mudarConfig(db, (c) => {
    const ex = c.mats.find((m) => m.nome === p.materia)
    if (ex) {
      r = { jaEstava: true, repeticoes: ex.rep }
      return c
    }
    const rep = sugerirRepeticoes(p.horasQueFaltam, c.duracao, passosDe(c))
    r = { jaEstava: false, repeticoes: rep }
    const conhecidas = new Set([...MATERIAS_PADRAO, ...c.custom].map(normalizar))
    return {
      ...c,
      custom: conhecidas.has(normalizar(p.materia)) ? c.custom : [...c.custom, p.materia],
      mats: [...c.mats, { nome: p.materia, rep, peso: Math.min(5, Math.max(1, Math.round(p.pesoMateria))) }],
    }
  }, agora)
  await garantirCores(db, [p.materia], agora)
  if (p.assuntoIds.length) {
    await db.transaction('rw', db.assuntos, async () => {
      for (const id of p.assuntoIds) await mudarAssunto(db, id, { noCiclo: true }, agora)
    })
  }
  return r
}

/** Cria o assunto (ou reaproveita o que já existe com o mesmo nome) e devolve o id. Usado ao iniciar o foco. */
export async function criarAssunto(db: BancoCiclo, materia: string, nome: string, agora = Date.now()): Promise<string | null> {
  const n = nome.trim()
  if (!n) return null
  await importarEdital(db, [{ materia, assuntos: [{ nome: n, filhos: [] }] }], [materia], agora, false)
  const a = vivos(await db.assuntos.toArray()).find((x) => normalizar(x.materia) === normalizar(materia) && normalizar(x.nome) === normalizar(n))
  return a?.id ?? null
}
