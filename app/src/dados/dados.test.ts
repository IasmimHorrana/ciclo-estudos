import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lerArquivo, paraArquivo } from '@/dados/converter'
import { BancoCiclo } from '@/dados/db'
import { carregarDados, substituirDados } from '@/dados/repositorio'

const AGORA = 1_800_000_000_000

/** Backup no formato do app em HTML (reduzido). */
const legado = {
  tema: 'light',
  config: {
    passos: 6, modo: 'Livre', custom: ['Minha Matéria'], ocultas: [], duracao: 1, dias: [false, false, false, false, true, true, true],
    porDia: null, horas: 6, mats: [{ nome: 'Informática', rep: 2, peso: 3 }, { nome: 'Língua Portuguesa', rep: '1', peso: '4' }],
  },
  semana: {
    id: 1, inicio: '2026-10-09', seg: '2026-10-05', dom: '2026-10-11', meta: null, pomodoros: 0, modelo: null,
    passos: [{ id: 1, materia: 'Informática', dia: '2026-10-09', horasPlanejadas: 1, horasFeitas: 0.5, feito: false, nota: '' }],
  },
  fechadas: [{
    id: 1791000000000, inicio: '2026-09-28', fim: '2026-10-04', cicloFechado: true, passosFeitos: 6, passosTotal: 6, pctConcluido: 100,
    horasEstudadas: 6, metaHoras: 6, horasFaltando: 0, porMateria: { Informática: 6 }, pomodoros: 3, modelo: null,
  }],
  pomo: { foco: 25, pausa: 5, longa: 15, ate: 4 },
  cores: { Informática: 4 },
  notas: [{ id: 'n1', titulo: 'T', materia: 'Informática', texto: '# oi', criado: 10, atualizado: 20 }],
  modelos: [{ id: 'm1', nome: 'teste', criado: 5, config: { modo: 'Livre', horas: 6, duracao: 1, mats: [], dias: [], porDia: null } }],
  assuntos: [{ id: 'a1', materia: 'Informática', nome: 'Redes' }],
  questoes: [{ id: 'q1', data: '2026-10-09', materia: 'Informática', assuntoId: 'a1', feitas: 10, acertos: 7 }],
  sessoes: [{ id: 's1', data: '2026-10-09', materia: 'Informática', assuntoId: null, minutos: 25, tipo: 'foco' }],
  backup: { nomePasta: 'x', ultimoBackup: 0, arquivos: {}, hashes: {} },
  cartoes: {},
}

let n = 0
const novoBanco = () => new BancoCiclo(`teste-${++n}`)

describe('lerArquivo (backup do app em HTML)', () => {
  it('converte tudo e acrescenta os controles de sincronização', () => {
    const d = lerArquivo(JSON.stringify(legado), AGORA)
    expect(d.config.mats).toEqual([
      { nome: 'Informática', rep: 2, peso: 3 },
      { nome: 'Língua Portuguesa', rep: 1, peso: 4 }, // texto virou número
    ])
    expect(d.semana?.passos[0]?.horasFeitas).toBe(0.5)
    expect(d.fechadas[0]).toMatchObject({ id: '1791000000000', sujo: 1, excluidoEm: null, atualizadoEm: AGORA })
    expect(d.notas[0]?.atualizadoEm).toBe(20) // usa a data de edição da nota
    expect(d.assuntos).toHaveLength(1)
    expect(d.questoes[0]).toMatchObject({ feitas: 10, acertos: 7, assuntoId: 'a1' })
    expect(d).not.toHaveProperty('backup') // o estado da pasta de backup do HTML não é dado de estudo
  })

  it('preserva "passos por dia" (número) na configuração e no modelo da semana', () => {
    const b = { ...legado, config: { ...legado.config, porDia: 2 }, modelos: [{ id: 'm1', nome: 'x', criado: 1, config: { modo: 'Livre', horas: 6, duracao: 1, mats: [], dias: [], porDia: 3 } }] }
    const d = lerArquivo(JSON.stringify(b), AGORA)
    expect(d.config.porDia).toBe(2)
    expect(d.modelos[0]?.config.porDia).toBe(3)
  })

  it('aceita backup vazio, sem semana e com campos ausentes', () => {
    const d = lerArquivo(JSON.stringify({ config: {}, fechadas: [] }), AGORA)
    expect(d.semana).toBeNull()
    expect(d.config.mats).toEqual([])
    expect(d.pomo.foco).toBe(25)
    expect(d.tema).toBe('auto')
  })

  it('recusa arquivos que não são backup, com mensagem clara', () => {
    expect(() => lerArquivo('não é json')).toThrow('JSON válido')
    expect(() => lerArquivo('[1,2]')).toThrow('não parece um backup')
    expect(() => lerArquivo('{"foo":1}')).toThrow('não parece um backup')
  })

  it('recusa backup de versão mais nova do app', () => {
    expect(() => lerArquivo(JSON.stringify({ ...legado, versao: 99 }))).toThrow('versão mais nova')
  })
})

describe('edital verticalizado no backup', () => {
  it('backup antigo (sem campos de edital) ganha padrões nos assuntos e nenhuma matéria de edital', () => {
    const d = lerArquivo(JSON.stringify(legado), AGORA)
    expect(d.assuntos[0]).toMatchObject({ nome: 'Redes', ordem: 0, importancia: 3, horasIdeais: 0, estudado: false, noCiclo: false })
    expect(d.materiasEdital).toEqual([])
  })

  it('peso, ordem e campos do edital fazem a ida e volta (exportar → importar)', () => {
    const b = {
      ...legado,
      assuntos: [{ id: 'a1', materia: 'Informática', nome: 'Redes', ordem: 2, importancia: 5, horasIdeais: 4, estudado: true, noCiclo: true }],
      materiasEdital: [{ id: 'e1', nome: 'Informática', peso: 5, ordem: 1 }],
    }
    const d = lerArquivo(JSON.stringify(b), AGORA)
    expect(d.materiasEdital[0]).toMatchObject({ nome: 'Informática', peso: 5, ordem: 1, sujo: 1 })
    expect(lerArquivo(JSON.stringify(paraArquivo(d, AGORA)), AGORA)).toEqual(d)
  })

  it('o banco guarda e devolve as matérias do edital', async () => {
    const db = novoBanco()
    const d = lerArquivo(JSON.stringify({ ...legado, materiasEdital: [{ id: 'e1', nome: 'Informática', peso: 4, ordem: 0 }] }), AGORA)
    await substituirDados(db, d, AGORA)
    expect((await carregarDados(db))?.materiasEdital).toHaveLength(1)
  })
})

describe('banco (Dexie)', () => {
  it('banco vazio devolve null', async () => {
    expect(await carregarDados(novoBanco())).toBeNull()
  })

  it('importar → carregar devolve os mesmos dados', async () => {
    const db = novoBanco()
    const d = lerArquivo(JSON.stringify(legado), AGORA)
    const r = await substituirDados(db, d, AGORA)
    expect(r).toMatchObject({ fechadas: 1, notas: 1, assuntos: 1, questoes: 1, sessoes: 1, modelos: 1, temSemana: true })
    expect(await carregarDados(db)).toEqual(d)
  })

  it('exportar → importar de novo não perde nada (ida e volta)', async () => {
    const d = lerArquivo(JSON.stringify(legado), AGORA)
    const arquivo = JSON.stringify(paraArquivo(d, AGORA))
    expect(JSON.parse(arquivo)).toMatchObject({ formato: 'ciclo-estudos', versao: 1 })
    expect(lerArquivo(arquivo, AGORA)).toEqual(d)
  })

  it('substituir não apaga de verdade: o que sumiu ganha excluidoEm e fica fora das consultas', async () => {
    const db = novoBanco()
    await substituirDados(db, lerArquivo(JSON.stringify(legado), AGORA), AGORA)
    const semNotas = lerArquivo(JSON.stringify({ ...legado, notas: [] }), AGORA + 1000)
    await substituirDados(db, semNotas, AGORA + 1000)

    expect((await carregarDados(db))?.notas).toEqual([])
    const guardada = await db.notas.get('n1') // continua no banco, só marcada
    expect(guardada).toMatchObject({ excluidoEm: AGORA + 1000, sujo: 1 })
  })

  it('importar de novo a mesma nota a "ressuscita" (volta a valer)', async () => {
    const db = novoBanco()
    await substituirDados(db, lerArquivo(JSON.stringify({ ...legado, notas: [] }), AGORA), AGORA)
    await substituirDados(db, lerArquivo(JSON.stringify(legado), AGORA), AGORA + 5)
    expect((await carregarDados(db))?.notas).toHaveLength(1)
  })
})

// Teste opcional com o seu backup real: BACKUP_REAL="D:\\caminho\\_backup-app.json" npm test
describe.skipIf(!process.env.BACKUP_REAL)('backup real', () => {
  it('importa sem erro e faz a ida e volta', async () => {
    const texto = readFileSync(process.env.BACKUP_REAL as string, 'utf-8')
    const d = lerArquivo(texto, AGORA)
    const db = novoBanco()
    await substituirDados(db, d, AGORA)
    expect(await carregarDados(db)).toEqual(d)
    expect(lerArquivo(JSON.stringify(paraArquivo(d, AGORA)), AGORA)).toEqual(d)
  })
})
