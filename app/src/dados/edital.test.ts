import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { lerArquivo } from '@/dados/converter'
import { gerarSemana, carregarCiclo } from '@/dados/ciclo'
import { BancoCiclo } from '@/dados/db'
import { adicionarMateriaEdital, carregarEdital, criarAssunto, enviarAoCiclo, importarEdital, mudarAssunto, tirarAssuntoDoEdital, tirarMateriaDoEdital } from '@/dados/edital'
import { substituirDados } from '@/dados/repositorio'

const AGORA = new Date(2026, 9, 7, 10).getTime() // quarta
let n = 0

async function novoBanco() {
  const db = new BancoCiclo(`edital-${++n}`)
  const d = lerArquivo(JSON.stringify({ config: { horas: 4, duracao: 1, modo: 'Livre', mats: [], custom: [], ocultas: [] }, fechadas: [] }), AGORA)
  await substituirDados(db, d, AGORA)
  return db
}

const edital = [{ materia: 'DIREITO CIVIL', assuntos: ['Posse', 'Contratos'] }]

describe('importarEdital', () => {
  it('cria matéria e assuntos; reimportar não duplica (acento e caixa não importam)', async () => {
    const db = await novoBanco()
    expect(await importarEdital(db, edital, [], AGORA)).toEqual({ materiasNovas: 1, assuntosNovos: 2, assuntosQueJaExistiam: 0 })
    const r = await importarEdital(db, [{ materia: 'Direito Cívil', assuntos: ['POSSE', 'Obrigações'] }], [], AGORA + 1)
    expect(r).toEqual({ materiasNovas: 0, assuntosNovos: 1, assuntosQueJaExistiam: 1 }) // mesma matéria
    const e = await carregarEdital(db)
    expect(e.materias.map((m) => m.nome)).toEqual(['DIREITO CIVIL'])
    expect(e.assuntos.map((a) => a.nome).sort()).toEqual(['Contratos', 'Obrigações', 'Posse'].sort())
  })

  it('usa o nome que o app já conhece e deixa a matéria disponível nas listas', async () => {
    const db = await novoBanco()
    await importarEdital(db, [{ materia: 'informatica', assuntos: ['Redes'] }], ['Informática'], AGORA)
    expect((await carregarEdital(db)).materias[0]?.nome).toBe('Informática')
    await importarEdital(db, [{ materia: 'Matéria Nova', assuntos: [] }], [], AGORA + 1)
    expect((await carregarCiclo(db)).config.custom).toContain('Matéria Nova')
  })
})

describe('o edital só mostra o que veio dele', () => {
  const semEdital = (id: string, materia: string, nome: string) => ({
    id, materia, nome, ordem: 0, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: false, atualizadoEm: 1, excluidoEm: null, sujo: 1 as const,
  })

  it('importar liga o assunto que já existia (sem duplicar) e os de fora continuam de fora', async () => {
    const db = await novoBanco()
    await db.assuntos.put(semEdital('a1', 'Informática', 'Redes'))
    await db.assuntos.put(semEdital('a2', 'Informática', 'Segurança'))
    const r = await importarEdital(db, [{ materia: 'informatica', assuntos: ['REDES', 'Hardware'] }], ['Informática'], AGORA)
    expect(r).toMatchObject({ assuntosNovos: 1, assuntosQueJaExistiam: 1 })
    const todos = (await carregarEdital(db)).assuntos
    expect(todos).toHaveLength(3)
    expect(todos.filter((a) => a.noEdital).map((a) => a.nome).sort()).toEqual(['Hardware', 'Redes'])
    expect(todos.find((a) => a.nome === 'Segurança')?.noEdital).toBe(false)
  })

  it('assunto criado no Pomodoro não vira matéria nem assunto do edital', async () => {
    const db = await novoBanco()
    const id = await criarAssunto(db, 'Informática', 'Redes', AGORA)
    const e = await carregarEdital(db)
    expect(e.assuntos.find((a) => a.id === id)?.noEdital).toBe(false)
    expect(e.materias).toEqual([])
  })

  it('recusa matéria repetida e vazia', async () => {
    const db = await novoBanco()
    expect(await adicionarMateriaEdital(db, 'Penal', AGORA)).toBe('ok')
    expect(await adicionarMateriaEdital(db, ' penal ', AGORA)).toBe('duplicada')
    expect(await adicionarMateriaEdital(db, '  ', AGORA)).toBe('vazia')
  })

  it('tirar do edital não apaga nada: o assunto, as questões e os tempos seguem no app', async () => {
    const db = await novoBanco()
    await importarEdital(db, [{ materia: 'Penal', assuntos: ['Penas', 'Crimes'] }], [], AGORA)
    const e = await carregarEdital(db)
    const penas = e.assuntos.find((a) => a.nome === 'Penas')
    await db.questoes.put({ id: 'q1', data: '2026-10-07', materia: 'Penal', assuntoId: penas?.id ?? null, feitas: 5, acertos: 3, atualizadoEm: 1, excluidoEm: null, sujo: 1 })

    await tirarAssuntoDoEdital(db, penas?.id ?? '', AGORA)
    expect((await carregarEdital(db)).assuntos.find((a) => a.nome === 'Penas')).toMatchObject({ noEdital: false, excluidoEm: null })

    await tirarMateriaDoEdital(db, e.materias[0]?.id ?? '', AGORA)
    const depois = await carregarEdital(db)
    expect(depois.materias).toEqual([])
    expect(depois.assuntos).toHaveLength(2)
    expect(depois.assuntos.every((a) => !a.noEdital)).toBe(true)
    expect(depois.questoes[0]?.assuntoId).toBe(penas?.id) // continua ligada ao assunto
    expect(await db.materiasEdital.count()).toBe(1) // guardada, marcada como excluída
  })
})

describe('enviarAoCiclo + gerarSemana', () => {
  it('sugere repetições, não repete a matéria e leva os assuntos para a anotação dos passos', async () => {
    const db = await novoBanco()
    await importarEdital(db, edital, [], AGORA)
    const ids = (await carregarEdital(db)).assuntos.map((a) => a.id)
    const r = await enviarAoCiclo(db, { materia: 'DIREITO CIVIL', pesoMateria: 4, horasQueFaltam: 10, assuntoIds: ids }, AGORA)
    expect(r).toEqual({ jaEstava: false, repeticoes: 4 }) // limitado aos 4 passos do ciclo
    expect(await enviarAoCiclo(db, { materia: 'DIREITO CIVIL', pesoMateria: 4, horasQueFaltam: 1, assuntoIds: [] }, AGORA)).toMatchObject({ jaEstava: true, repeticoes: 4 })

    const ciclo = await carregarCiclo(db)
    expect(ciclo.config.mats).toEqual([{ nome: 'DIREITO CIVIL', rep: 4, peso: 4 }])

    expect(await gerarSemana(db, AGORA)).toMatchObject({ ok: true })
    const passos = (await carregarCiclo(db)).semana?.passos ?? []
    expect(passos.map((p) => p.nota)).toEqual(['Posse', 'Contratos', '', ''])
    // a marcação "no ciclo" foi consumida
    expect((await carregarEdital(db)).assuntos.every((a) => !a.noCiclo)).toBe(true)
  })

  it('mudarAssunto grava importância, horas ideais e estudado', async () => {
    const db = await novoBanco()
    await importarEdital(db, edital, [], AGORA)
    const a = (await carregarEdital(db)).assuntos[0]
    await mudarAssunto(db, a?.id ?? '', { importancia: 5, horasIdeais: 6, estudado: true }, AGORA)
    expect((await carregarEdital(db)).assuntos.find((x) => x.id === a?.id)).toMatchObject({ importancia: 5, horasIdeais: 6, estudado: true, sujo: 1 })
  })
})

describe('criarAssunto', () => {
  it('cria o assunto, devolve o id e reaproveita se já existe', async () => {
    const db = await novoBanco()
    const id = await criarAssunto(db, 'Informática', '  Redes ', AGORA)
    expect(id).toBeTruthy()
    expect(await criarAssunto(db, 'Informática', 'redes', AGORA + 1)).toBe(id)
    expect(await criarAssunto(db, 'Informática', '   ', AGORA)).toBeNull()
    expect((await carregarEdital(db)).assuntos).toHaveLength(1)
  })
})
