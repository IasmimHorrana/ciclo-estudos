import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { lerArquivo } from '@/dados/converter'
import { gerarSemana, carregarCiclo } from '@/dados/ciclo'
import { BancoCiclo } from '@/dados/db'
import { adicionarMateriaEdital, carregarEdital, criarAssunto, enviarAoCiclo, importarEdital, mudarAssunto, definirHorasDoTopico, mudarComSubtopicos, responderRevisaoAssunto, tirarAssuntoDoEdital, tirarMateriaDoEdital } from '@/dados/edital'
import { mudarPreferencias } from '@/dados/ciclo'
import { substituirDados } from '@/dados/repositorio'

const AGORA = new Date(2026, 9, 7, 10).getTime() // quarta
let n = 0

async function novoBanco() {
  const db = new BancoCiclo(`edital-${++n}`)
  const d = lerArquivo(JSON.stringify({ config: { horas: 4, duracao: 1, modo: 'Livre', mats: [], custom: [], ocultas: [] }, fechadas: [] }), AGORA)
  await substituirDados(db, d, AGORA)
  return db
}

const i = (...nomes: string[]) => nomes.map((nome) => ({ nome, filhos: [] as string[] }))
const edital = [{ materia: 'DIREITO CIVIL', assuntos: i('Posse', 'Contratos') }]

describe('importarEdital', () => {
  it('cria matéria e assuntos; reimportar não duplica (acento e caixa não importam)', async () => {
    const db = await novoBanco()
    expect(await importarEdital(db, edital, [], AGORA)).toEqual({ materiasNovas: 1, assuntosNovos: 2, assuntosQueJaExistiam: 0 })
    const r = await importarEdital(db, [{ materia: 'Direito Cívil', assuntos: i('POSSE', 'Obrigações') }], [], AGORA + 1)
    expect(r).toEqual({ materiasNovas: 0, assuntosNovos: 1, assuntosQueJaExistiam: 1 }) // mesma matéria
    const e = await carregarEdital(db)
    expect(e.materias.map((m) => m.nome)).toEqual(['DIREITO CIVIL'])
    expect(e.assuntos.map((a) => a.nome).sort()).toEqual(['Contratos', 'Obrigações', 'Posse'].sort())
  })

  it('usa o nome que o app já conhece e deixa a matéria disponível nas listas', async () => {
    const db = await novoBanco()
    await importarEdital(db, [{ materia: 'informatica', assuntos: i('Redes') }], ['Informática'], AGORA)
    expect((await carregarEdital(db)).materias[0]?.nome).toBe('Informática')
    await importarEdital(db, [{ materia: 'Matéria Nova', assuntos: [] }], [], AGORA + 1)
    expect((await carregarCiclo(db)).config.custom).toContain('Matéria Nova')
  })
})

describe('o edital só mostra o que veio dele', () => {
  const semEdital = (id: string, materia: string, nome: string) => ({
    id, materia, nome, ordem: 0, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false, noEdital: false, paiId: null, estudadoEm: null, revisoes: [], atualizadoEm: 1, excluidoEm: null, sujo: 1 as const,
  })

  it('importar liga o assunto que já existia (sem duplicar) e os de fora continuam de fora', async () => {
    const db = await novoBanco()
    await db.assuntos.put(semEdital('a1', 'Informática', 'Redes'))
    await db.assuntos.put(semEdital('a2', 'Informática', 'Segurança'))
    const r = await importarEdital(db, [{ materia: 'informatica', assuntos: i('REDES', 'Hardware') }], ['Informática'], AGORA)
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
    await importarEdital(db, [{ materia: 'Penal', assuntos: i('Penas', 'Crimes') }], [], AGORA)
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

describe('hierarquia no banco', () => {
  const redes = [{ materia: 'Informática', assuntos: [{ nome: 'Redes', filhos: ['NAT', 'VLAN'] }, { nome: 'Segurança', filhos: [] }] }]

  it('importa tópico com subtópicos, ligando cada filho ao pai', async () => {
    const db = await novoBanco()
    expect(await importarEdital(db, redes, [], AGORA)).toMatchObject({ assuntosNovos: 4 })
    const { assuntos } = await carregarEdital(db)
    const pai = assuntos.find((a) => a.nome === 'Redes')
    expect(pai?.paiId).toBeNull()
    expect(assuntos.filter((a) => a.paiId === pai?.id).map((a) => a.nome).sort()).toEqual(['NAT', 'VLAN'])
  })

  it('reimportar com hierarquia reorganiza os assuntos que já existiam (soltos), sem duplicar nem perder as questões', async () => {
    const db = await novoBanco()
    await importarEdital(db, [{ materia: 'Informática', assuntos: i('Redes', 'NAT', 'VLAN', 'Segurança') }], [], AGORA)
    const nat = (await carregarEdital(db)).assuntos.find((a) => a.nome === 'NAT')
    await db.questoes.put({ id: 'q1', data: '2026-10-07', materia: 'Informática', assuntoId: nat?.id ?? null, feitas: 5, acertos: 4, atualizadoEm: 1, excluidoEm: null, sujo: 1 })

    const r = await importarEdital(db, redes, [], AGORA + 1)
    expect(r).toMatchObject({ assuntosNovos: 0, assuntosQueJaExistiam: 4 })
    const { assuntos, questoes } = await carregarEdital(db)
    expect(assuntos).toHaveLength(4)
    const pai = assuntos.find((a) => a.nome === 'Redes')
    expect(assuntos.find((a) => a.nome === 'NAT')?.paiId).toBe(pai?.id)
    expect(assuntos.find((a) => a.nome === 'NAT')?.id).toBe(nat?.id) // mesmo assunto: as questões seguem ligadas
    expect(questoes[0]?.assuntoId).toBe(nat?.id)
  })

  it('marcar o tópico como estudado marca os subtópicos; tirar do edital leva os subtópicos junto', async () => {
    const db = await novoBanco()
    await importarEdital(db, redes, [], AGORA)
    const pai = (await carregarEdital(db)).assuntos.find((a) => a.nome === 'Redes')
    await mudarComSubtopicos(db, pai?.id ?? '', { estudado: true }, AGORA)
    let { assuntos } = await carregarEdital(db)
    expect(assuntos.filter((a) => ['Redes', 'NAT', 'VLAN'].includes(a.nome)).every((a) => a.estudado)).toBe(true)
    expect(assuntos.find((a) => a.nome === 'Segurança')?.estudado).toBe(false)

    await tirarAssuntoDoEdital(db, pai?.id ?? '', AGORA)
    ;({ assuntos } = await carregarEdital(db))
    expect(assuntos.filter((a) => ['Redes', 'NAT', 'VLAN'].includes(a.nome)).every((a) => !a.noEdital && a.paiId === null)).toBe(true)
    expect(assuntos.find((a) => a.nome === 'Segurança')?.noEdital).toBe(true)
  })

  it('subtópico igual ao nome do tópico é ignorado (nunca vira pai de si mesmo)', async () => {
    const db = await novoBanco()
    await importarEdital(db, [{ materia: 'Informática', assuntos: [{ nome: 'Redes', filhos: ['redes', 'NAT'] }] }], [], AGORA)
    const { assuntos } = await carregarEdital(db)
    expect(assuntos.map((a) => a.nome).sort()).toEqual(['NAT', 'Redes'])
    expect(assuntos.find((a) => a.nome === 'Redes')?.paiId).toBeNull()
  })
})

describe('horas no tópico e nomes', () => {
  const redes = [{ materia: 'Informática', assuntos: [{ nome: 'Redes', filhos: ['NAT', 'VLAN', 'VPN'] }, { nome: 'Segurança', filhos: [] }] }]

  it('as horas do tópico são divididas entre os subtópicos e a soma fecha', async () => {
    const db = await novoBanco()
    await importarEdital(db, redes, [], AGORA)
    const pai = (await carregarEdital(db)).assuntos.find((a) => a.nome === 'Redes')
    await definirHorasDoTopico(db, pai?.id ?? '', 10, AGORA)
    const { assuntos } = await carregarEdital(db)
    const horas = assuntos.filter((a) => a.paiId === pai?.id).sort((a, b) => a.ordem - b.ordem).map((a) => a.horasIdeais)
    expect(horas).toEqual([3.34, 3.33, 3.33])
    expect(assuntos.find((a) => a.nome === 'Segurança')?.horasIdeais).toBe(0)
    await definirHorasDoTopico(db, pai?.id ?? '', 0, AGORA)
    expect((await carregarEdital(db)).assuntos.filter((a) => a.paiId === pai?.id).every((a) => a.horasIdeais === 0)).toBe(true)
  })

  it('horas num assunto sem subtópicos valem para ele mesmo', async () => {
    const db = await novoBanco()
    await importarEdital(db, redes, [], AGORA)
    const seg = (await carregarEdital(db)).assuntos.find((a) => a.nome === 'Segurança')
    await definirHorasDoTopico(db, seg?.id ?? '', 4, AGORA)
    expect((await carregarEdital(db)).assuntos.find((a) => a.nome === 'Segurança')?.horasIdeais).toBe(4)
  })

  it('reimportar com a primeira letra em maiúscula corrige o nome, sem duplicar', async () => {
    const db = await novoBanco()
    await importarEdital(db, [{ materia: 'Informática', assuntos: [{ nome: 'hardware e software', filhos: [] }] }], [], AGORA)
    await importarEdital(db, [{ materia: 'Informática', assuntos: [{ nome: 'Hardware e software', filhos: [] }] }], [], AGORA + 1)
    const { assuntos } = await carregarEdital(db)
    expect(assuntos.map((a) => a.nome)).toEqual(['Hardware e software'])
  })
})

describe('revisão dos assuntos no banco', () => {
  const redes = [{ materia: 'Informática', assuntos: [{ nome: 'Redes', filhos: ['NAT', 'VLAN'] }] }]
  const DIA = '2026-10-07' // AGORA

  it('marcar o tópico agenda as revisões dos subtópicos com os intervalos escolhidos; desmarcar tira as pendentes', async () => {
    const db = await novoBanco()
    await mudarPreferencias(db, { intervalosRevisao: [2, 10] }, AGORA)
    await importarEdital(db, redes, [], AGORA)
    const pai = (await carregarEdital(db)).assuntos.find((a) => a.nome === 'Redes')
    await mudarComSubtopicos(db, pai?.id ?? '', { estudado: true }, AGORA)
    const nat = (await carregarEdital(db)).assuntos.find((a) => a.nome === 'NAT')
    expect(nat).toMatchObject({ estudadoEm: DIA })
    expect(nat?.revisoes.map((r) => r.dia)).toEqual(['2026-10-09', '2026-10-17'])

    // marcar de novo (já estava) não reagenda
    await mudarAssunto(db, nat?.id ?? '', { estudado: true }, AGORA + 86_400_000)
    expect((await db.assuntos.get(nat?.id ?? ''))?.revisoes.map((r) => r.dia)).toEqual(['2026-10-09', '2026-10-17'])

    await mudarComSubtopicos(db, pai?.id ?? '', { estudado: false }, AGORA)
    expect(await db.assuntos.get(nat?.id ?? '')).toMatchObject({ estudado: false, estudadoEm: null, revisoes: [] })
  })

  it('"Entendi" conclui a próxima; "Preciso rever" recomeça a partir do dia da resposta', async () => {
    const db = await novoBanco()
    const id = (await criarAssunto(db, 'Informática', 'Firewall', AGORA)) ?? ''
    await mudarAssunto(db, id, { estudado: true }, AGORA)
    const dia2 = new Date(2026, 9, 8, 10).getTime()
    await responderRevisaoAssunto(db, id, 'ok', dia2)
    let a = await db.assuntos.get(id)
    expect(a?.revisoes[0]).toEqual({ dia: '2026-10-08', feitaEm: '2026-10-08', resultado: 'ok' })
    const dia20 = new Date(2026, 9, 20, 10).getTime()
    await responderRevisaoAssunto(db, id, 'rever', dia20)
    a = await db.assuntos.get(id)
    expect(a?.revisoes.filter((r) => r.feitaEm).map((r) => r.resultado)).toEqual(['ok', 'rever'])
    expect(a?.revisoes.filter((r) => !r.feitaEm).map((r) => r.dia)).toEqual(['2026-10-21', '2026-10-27', '2026-11-19'])
  })
})
