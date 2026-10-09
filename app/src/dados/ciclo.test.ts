import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  atualizarModelo, carregarCiclo, contarPomodoro, definirMeta, editarPasso, excluirModelo, fecharSemana, gerarSemana, limparSemana,
  marcarPasso, mudarConfig, nomeModeloExiste, registrarTempo, reagendar, renomearModelo, repetirSemanaFechada, salvarModelo, usarModelo, voltarAoPadrao,
} from '@/dados/ciclo'
import { BancoCiclo } from '@/dados/db'
import { carregarDados } from '@/dados/repositorio'

const T0 = new Date(2026, 9, 9, 10, 0).getTime() // sexta 09/10/2026
let n = 0
const banco = () => new BancoCiclo(`ciclo-${++n}`)

async function montado() {
  const db = banco()
  await mudarConfig(db, (c) => ({
    ...c, horas: 6, duracao: 1, modo: 'Livre', dias: [false, false, false, false, true, true, true],
    mats: [{ nome: 'RL', rep: 3, peso: 3 }, { nome: 'INF', rep: 3, peso: 3 }],
  }), T0)
  return db
}

describe('banco vazio', () => {
  it('devolve a configuração padrão, sem semana', async () => {
    const c = await carregarCiclo(banco())
    expect(c).toMatchObject({ semana: null, fechadas: [], modelos: [] })
    expect(c.config.mats).toEqual([])
    expect(c.pomo.foco).toBe(25)
  })
})

describe('gerar a semana', () => {
  it('recusa montagem incompleta com a mensagem certa', async () => {
    const db = banco()
    expect(await gerarSemana(db, T0)).toEqual({ ok: false, erro: 'Adicione ao menos uma matéria ao ciclo.' })
    await mudarConfig(db, (c) => ({ ...c, horas: 6, mats: [{ nome: 'A', rep: 2, peso: 3 }] }), T0)
    expect(await gerarSemana(db, T0)).toMatchObject({ ok: false, erro: expect.stringContaining('deve ser igual a 6') })
  })

  it('gera 6 passos em sex/sáb/dom, atribui cores e deixa os dados prontos para exportar', async () => {
    const db = await montado()
    expect(await gerarSemana(db, T0)).toEqual({ ok: true, passosSemDia: 0 })
    const c = await carregarCiclo(db)
    expect(c.semana?.passos).toHaveLength(6)
    expect(c.semana?.passos.map((p) => p.dia)).toEqual(['2026-10-09', '2026-10-09', '2026-10-10', '2026-10-10', '2026-10-11', '2026-10-11'])
    expect(Object.keys(c.cores).sort()).toEqual(['INF', 'RL'])
    expect((await carregarDados(db))?.semana?.passos).toHaveLength(6) // o exportar/backup enxerga a semana
  })
})

describe('a semana em andamento', () => {
  it('marcar passo, editar horas/dia/nota, meta e pomodoros ficam gravados', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    await marcarPasso(db, 1, true)
    await editarPasso(db, 2, { horasFeitas: 0.5, nota: 'redes', dia: '2026-10-11' })
    await definirMeta(db, 8)
    await contarPomodoro(db)
    const s = (await carregarCiclo(db)).semana!
    expect(s.passos[0]).toMatchObject({ feito: true, horasFeitas: 1 })
    expect(s.passos[1]).toMatchObject({ horasFeitas: 0.5, nota: 'redes', dia: '2026-10-11' })
    expect(s.meta).toBe(8)
    expect(s.pomodoros).toBe(1)
  })

  it('reagendar leva os pendentes para os dias que restam', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    const sab = new Date(2026, 9, 10, 9, 0).getTime()
    expect(await reagendar(db, sab)).toBe(0)
    const dias = (await carregarCiclo(db)).semana!.passos.map((p) => p.dia)
    expect(dias.every((d) => d === '2026-10-10' || d === '2026-10-11')).toBe(true)
  })

  it('limpar semana zera sem guardar histórico', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    await marcarPasso(db, 1, true)
    await limparSemana(db, T0 + 1000)
    const c = await carregarCiclo(db)
    expect(c.semana!.passos.every((p) => !p.feito && p.horasFeitas === 0)).toBe(true)
    expect(c.fechadas).toEqual([])
  })

  it('registrar tempo do Pomodoro soma horas, pode concluir o passo e grava a sessão', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    await registrarTempo(db, { passoId: 1, minutos: 30, tipo: 'Teoria', assuntoId: null, feito: false }, T0)
    await registrarTempo(db, { passoId: 1, minutos: 30, tipo: 'Teoria', assuntoId: null, feito: true }, T0)
    const p = (await carregarCiclo(db)).semana!.passos[0]!
    expect(p).toMatchObject({ horasFeitas: 1, feito: true })
    const sessoes = await db.sessoes.toArray()
    expect(sessoes).toHaveLength(2)
    expect(sessoes[0]).toMatchObject({ data: '2026-10-09', minutos: 30, tipo: 'Teoria', materia: p.materia })
  })
})

describe('fechar a semana', () => {
  it('"limpar": guarda o resumo no histórico e recomeça a mesma semana', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    for (let i = 1; i <= 6; i++) await marcarPasso(db, i, true)
    const r = await fecharSemana(db, 'limpar', T0 + 5000)
    expect(r).toMatchObject({ cicloFechado: true, horasEstudadas: 6 })
    const c = await carregarCiclo(db)
    expect(c.fechadas).toHaveLength(1)
    expect(c.fechadas[0]).toMatchObject({ id: String(T0 + 5000), cicloFechado: true, passosTotal: 6 })
    expect(c.semana!.passos.every((p) => !p.feito)).toBe(true)
  })

  it('"nova": guarda, apaga a semana e deixa a montagem usada pronta para a próxima', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    await mudarConfig(db, (c) => ({ ...c, mats: [] }), T0 + 1) // mexeu na montagem depois de gerar
    await fecharSemana(db, 'nova', T0 + 2)
    const c = await carregarCiclo(db)
    expect(c.semana).toBeNull()
    expect(c.config.mats.map((m) => m.nome)).toEqual(['RL', 'INF']) // voltou ao que gerou a semana
  })

  it('repetir uma semana fechada recarrega a montagem dela', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    await fecharSemana(db, 'nova', T0 + 2)
    await mudarConfig(db, (c) => ({ ...c, mats: [] }), T0 + 3)
    const [f] = (await carregarCiclo(db)).fechadas
    expect(await repetirSemanaFechada(db, f!.id, T0 + 4)).toBe(true)
    expect((await carregarCiclo(db)).config.mats).toHaveLength(2)
  })

  it('sem semana, fechar dá erro claro', async () => {
    await expect(fecharSemana(banco(), 'limpar')).rejects.toThrow('Não há semana')
  })
})

describe('modelos', () => {
  it('salvar, achar nome repetido, substituir, usar, renomear, atualizar e excluir', async () => {
    const db = await montado()
    expect(await salvarModelo(db, 'Padrão 6h', T0)).toBe('criado')
    expect(await nomeModeloExiste(db, 'padrão 6H')).toBe(true)
    expect(await salvarModelo(db, 'padrão 6h', T0 + 1)).toBe('substituido')
    expect((await carregarCiclo(db)).modelos).toHaveLength(1)

    await mudarConfig(db, (c) => ({ ...c, horas: 10, mats: [] }), T0 + 2)
    const id = (await carregarCiclo(db)).modelos[0]!.id
    await usarModelo(db, id, T0 + 3)
    expect((await carregarCiclo(db)).config).toMatchObject({ horas: 6 })
    expect((await carregarCiclo(db)).config.mats).toHaveLength(2)

    await renomearModelo(db, id, 'Semana leve', T0 + 4)
    await mudarConfig(db, (c) => ({ ...c, horas: 4, mats: [{ nome: 'X', rep: 4, peso: 3 }] }), T0 + 5)
    await atualizarModelo(db, id, T0 + 6)
    expect((await carregarCiclo(db)).modelos[0]).toMatchObject({ nome: 'Semana leve', config: { horas: 4 } })

    await excluirModelo(db, id, T0 + 7)
    expect((await carregarCiclo(db)).modelos).toEqual([])
    expect((await db.modelos.get(id))?.excluidoEm).toBe(T0 + 7) // fica marcado, não some
  })

  it('não salva modelo com montagem vazia', async () => {
    await expect(salvarModelo(banco(), 'x')).rejects.toThrow('ao menos uma matéria')
  })

  it('voltar ao padrão limpa a montagem mas não a semana nem o histórico', async () => {
    const db = await montado()
    await gerarSemana(db, T0)
    await voltarAoPadrao(db, T0 + 1)
    const c = await carregarCiclo(db)
    expect(c.config.mats).toEqual([])
    expect(c.semana).not.toBeNull()
  })
})
