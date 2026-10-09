import { garantirCores, mudarConfig } from '@/dados/ciclo'
import { carregarEstudo, type Estudo } from '@/dados/desempenho'
import type { BancoCiclo } from '@/dados/db'
import type { Assunto, MateriaEdital } from '@/dados/esquemas'
import { novoIdFc } from '@/dados/ids'
import { MATERIAS_PADRAO, passosDe } from '@/dominio/ciclo'
import { normalizar, sugerirRepeticoes, type MateriaLida } from '@/dominio/edital'

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
const novoAssunto = (materia: string, nome: string, ordem: number, agora: number, noEdital: boolean): Assunto => ({
  id: novoIdFc('a', agora + ordem), materia, nome, ordem, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital,
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
      for (const nomeAssunto of l.assuntos) {
        const ja = daMateria.find((a) => normalizar(a.nome) === normalizar(nomeAssunto))
        if (ja) {
          r.assuntosQueJaExistiam++
          if (noEdital && !ja.noEdital) {
            const lig = { ...ja, noEdital: true, atualizadoEm: agora, sujo: 1 as const }
            await db.assuntos.put(lig)
            daMateria[daMateria.indexOf(ja)] = lig
            assuntos[assuntos.indexOf(ja)] = lig
          }
          continue
        }
        const a = novoAssunto(daMateria[0]?.materia ?? nome, nomeAssunto, ordem++, agora, noEdital)
        await db.assuntos.put(a)
        daMateria.push(a)
        assuntos.push(a)
        r.assuntosNovos++
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
  const r = await importarEdital(db, [{ materia, assuntos: nomes.map((n) => n.trim()).filter(Boolean) }], [materia], agora)
  return r.assuntosNovos
}

export async function mudarMateriaEdital(db: BancoCiclo, id: string, patch: Partial<Pick<MateriaEdital, 'peso'>>, agora = Date.now()): Promise<void> {
  const m = await db.materiasEdital.get(id)
  if (m) await db.materiasEdital.put({ ...m, ...patch, atualizadoEm: agora, sujo: 1 })
}

export type AlteracaoAssunto = Partial<Pick<Assunto, 'importancia' | 'horasIdeais' | 'estudado' | 'noCiclo' | 'noEdital'>>

export async function mudarAssunto(db: BancoCiclo, id: string, patch: AlteracaoAssunto, agora = Date.now()): Promise<void> {
  const a = await db.assuntos.get(id)
  if (a) await db.assuntos.put({ ...a, ...patch, atualizadoEm: agora, sujo: 1 })
}

/** Tira o assunto do edital. Ele continua no app (Desempenho, Pomodoro, flashcards) com as questões e os tempos. */
export const tirarAssuntoDoEdital = (db: BancoCiclo, id: string, agora = Date.now()) => mudarAssunto(db, id, { noEdital: false, noCiclo: false }, agora)

/** Tira a matéria do edital e solta os assuntos dela do edital. Nada é apagado: os assuntos seguem no resto do app. */
export async function tirarMateriaDoEdital(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const m = await db.materiasEdital.get(id)
  if (!m) return
  await db.transaction('rw', [db.materiasEdital, db.assuntos], async () => {
    await db.materiasEdital.put({ ...m, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
    for (const a of vivos(await db.assuntos.toArray()).filter((x) => x.noEdital && normalizar(x.materia) === normalizar(m.nome))) {
      await db.assuntos.put({ ...a, noEdital: false, noCiclo: false, atualizadoEm: agora, sujo: 1 })
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
  await importarEdital(db, [{ materia, assuntos: [n] }], [materia], agora, false)
  const a = vivos(await db.assuntos.toArray()).find((x) => normalizar(x.materia) === normalizar(materia) && normalizar(x.nome) === normalizar(n))
  return a?.id ?? null
}
