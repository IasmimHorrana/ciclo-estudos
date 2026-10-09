import type { Controle } from '@/dados/esquemas'
import type { OpcoesBaralho } from '@/dominio/fila'
import type { Campos, TipoNotaBase } from '@/dominio/modelo'
import type { EstadoCartao, TipoCartao, TipoLog } from '@/dominio/sm2'

/** Baralhos formam uma árvore pelo nome: "Informática::Redes" é filho de "Informática". */
export interface Baralho extends Controle {
  id: string
  nome: string
  grupoId: string
  /** De onde veio: matéria e assunto do ciclo, ou criado à mão. */
  origem: 'materia' | 'assunto' | 'manual'
  criadoEm: number
}

/** Grupo de opções (limites, passos, intervalos). Vários baralhos podem usar o mesmo grupo. */
export interface GrupoOpcoes extends Controle {
  id: string
  nome: string
  opcoes: OpcoesBaralho
}

export interface TipoNota extends Controle, TipoNotaBase {}

export interface NotaFc extends Controle {
  id: string
  tipoId: string
  /** Baralho onde os cartões novos desta nota nascem. */
  baralhoId: string
  /** Valores dos campos (HTML sanitizado). */
  campos: Campos
  tags: string[]
  criadoEm: number
}

export interface CartaoFc extends Controle, EstadoCartao {
  id: string
  notaId: string
  baralhoId: string
  /** Qual modelo (ou número da omissão menos 1) esta nota gerou. */
  indice: number
  /** 0 = sem bandeira; 1 a 7 como no Anki. */
  flag: number
  criadoEm: number
}

/** Histórico de respostas. Só acrescenta: nunca é editado nem apagado (é daqui que o estado se recalcula). */
export interface RegistroRevisao extends Omit<Controle, 'excluidoEm'> {
  id: string
  cartaoId: string
  baralhoId: string
  /** Número do dia de estudo (`numeroDoDia`). */
  dia: number
  /** Momento da resposta, em ms. */
  instante: number
  botao: 1 | 2 | 3 | 4
  tipoLog: TipoLog
  estadoAntes: TipoCartao
  intervaloAntes: number
  intervaloDepois: number
  facilidade: number
  tempoMs: number
}
