import { z } from 'zod'

/**
 * Esquemas do backup do app em HTML ("Exportar backup completo").
 * São tolerantes de propósito: o arquivo pode vir de versões antigas, então tudo que faltar ganha um padrão.
 */
const num = z.coerce.number().catch(0)
const txt = z.string().catch('')

const MateriaCfg = z.object({ nome: z.string(), rep: num, peso: z.coerce.number().catch(3) })

export const ConfigLegado = z.object({
  horas: z.coerce.number().catch(0),
  duracao: z.coerce.number().catch(1),
  passos: z.coerce.number().optional(),
  modo: txt.catch('Livre'),
  mats: z.array(MateriaCfg).catch([]),
  custom: z.array(z.string()).catch([]),
  ocultas: z.array(z.string()).catch([]),
  dias: z.array(z.boolean()).catch([true, true, true, true, true, true, false]),
  porDia: z.array(z.coerce.number()).nullable().catch(null),
})

const Passo = z.object({
  id: num,
  materia: txt,
  dia: z.string().nullable().catch(null),
  horasPlanejadas: num,
  horasFeitas: num,
  feito: z.boolean().catch(false),
  nota: txt,
})

const Modelo = z.object({
  modo: txt,
  horas: num,
  duracao: z.coerce.number().catch(1),
  mats: z.array(MateriaCfg).catch([]),
  dias: z.array(z.boolean()).catch([]),
  porDia: z.array(z.coerce.number()).nullable().catch(null),
})

export const SemanaLegado = z.object({
  id: num,
  inicio: txt,
  seg: txt,
  dom: txt,
  meta: z.coerce.number().nullable().catch(null),
  pomodoros: num,
  modelo: Modelo.nullable().catch(null),
  passos: z.array(Passo).catch([]),
})

const Fechada = z.object({
  id: num,
  inicio: txt,
  fim: txt,
  cicloFechado: z.boolean().catch(false),
  passosFeitos: num,
  passosTotal: num,
  pctConcluido: num,
  horasEstudadas: num,
  metaHoras: num,
  horasFaltando: num,
  porMateria: z.record(z.string(), z.coerce.number()).catch({}),
  pomodoros: num,
  modelo: Modelo.nullable().catch(null),
})

const Nota = z.object({ id: z.coerce.string(), titulo: txt, materia: txt, texto: txt, criado: num, atualizado: num })
const ModeloSalvo = z.object({ id: z.coerce.string(), nome: txt, criado: num, config: Modelo })
const Assunto = z.object({ id: z.coerce.string(), materia: txt, nome: txt })
const Questao = z.object({
  id: z.coerce.string(),
  data: txt,
  materia: txt,
  assuntoId: z.coerce.string().nullable().catch(null),
  feitas: num,
  acertos: num,
})
const Sessao = z.object({
  id: z.coerce.string(),
  data: txt,
  materia: txt,
  assuntoId: z.coerce.string().nullable().catch(null),
  minutos: num,
  tipo: txt,
})

export const BackupLegado = z.object({
  tema: z.enum(['auto', 'light', 'dark']).catch('auto'),
  config: ConfigLegado,
  semana: SemanaLegado.nullable().catch(null),
  fechadas: z.array(Fechada).catch([]),
  pomo: z
    .object({ foco: z.coerce.number().catch(25), pausa: z.coerce.number().catch(5), longa: z.coerce.number().catch(15), ate: z.coerce.number().catch(4) })
    .catch({ foco: 25, pausa: 5, longa: 15, ate: 4 }),
  cores: z.record(z.string(), z.coerce.number()).catch({}),
  notas: z.array(Nota).catch([]),
  modelos: z.array(ModeloSalvo).catch([]),
  assuntos: z.array(Assunto).catch([]),
  questoes: z.array(Questao).catch([]),
  sessoes: z.array(Sessao).catch([]),
})
export type BackupLegado = z.infer<typeof BackupLegado>

/** Dados no formato da base nova (o que o Dexie guarda). */
export type ConfigCiclo = z.infer<typeof ConfigLegado>
export type Semana = z.infer<typeof SemanaLegado>
export type ModeloConfig = z.infer<typeof Modelo>

/** Controle de sincronização que todo registro carrega (usado de verdade na etapa 5). */
export interface Controle {
  atualizadoEm: number
  /** `null` = vivo. Nada é apagado de verdade: a exclusão vira esta marca. */
  excluidoEm: number | null
  /** 1 = tem mudança ainda não enviada à nuvem (número porque o IndexedDB não indexa booleanos). */
  sujo: 0 | 1
}

export type SemanaFechada = Omit<z.infer<typeof Fechada>, 'id'> & Controle & { id: string }
export type ModeloSalvo = Omit<z.infer<typeof ModeloSalvo>, 'id'> & Controle & { id: string }
export type NotaResumo = z.infer<typeof Nota> & Controle
export type Assunto = z.infer<typeof Assunto> & Controle
export type RegistroQuestoes = z.infer<typeof Questao> & Controle
export type SessaoPomodoro = z.infer<typeof Sessao> & Controle

/** Valores avulsos (configuração do ciclo, semana em andamento, cores, Pomodoro, tema). */
export interface Valor extends Omit<Controle, 'excluidoEm'> {
  chave: string
  valor: unknown
}

/** Todos os dados do app, num formato só (é o que o exportar grava e o importar lê). */
export interface Dados {
  tema: 'auto' | 'light' | 'dark'
  config: ConfigCiclo
  semana: Semana | null
  pomo: { foco: number; pausa: number; longa: number; ate: number }
  cores: Record<string, number>
  fechadas: SemanaFechada[]
  modelos: ModeloSalvo[]
  notas: NotaResumo[]
  assuntos: Assunto[]
  questoes: RegistroQuestoes[]
  sessoes: SessaoPomodoro[]
}
