import Dexie, { type EntityTable } from 'dexie'
import type { Assunto, ModeloSalvo, NotaResumo, RegistroQuestoes, SemanaFechada, SessaoPomodoro, Valor } from '@/dados/esquemas'

/**
 * Banco local (IndexedDB, via Dexie). O app lê e grava sempre aqui; a nuvem (etapa 5) é só cópia.
 *
 * Mudar o formato: NUNCA edite `version(1)`. Acrescente `version(2).stores({...}).upgrade(...)`
 * (o Dexie só roda o `upgrade` em quem ainda está na versão anterior e não apaga o que já existe).
 */
export class BancoCiclo extends Dexie {
  valores!: EntityTable<Valor, 'chave'>
  semanasFechadas!: EntityTable<SemanaFechada, 'id'>
  modelos!: EntityTable<ModeloSalvo, 'id'>
  notas!: EntityTable<NotaResumo, 'id'>
  assuntos!: EntityTable<Assunto, 'id'>
  questoes!: EntityTable<RegistroQuestoes, 'id'>
  sessoes!: EntityTable<SessaoPomodoro, 'id'>

  constructor(nome = 'ciclo-estudos') {
    super(nome)
    this.version(1).stores({
      valores: 'chave, sujo',
      semanasFechadas: 'id, inicio, sujo, excluidoEm',
      modelos: 'id, sujo, excluidoEm',
      notas: 'id, materia, atualizado, sujo, excluidoEm',
      assuntos: 'id, materia, sujo, excluidoEm',
      questoes: 'id, data, materia, sujo, excluidoEm',
      sessoes: 'id, data, materia, sujo, excluidoEm',
    })
  }
}

export const db = new BancoCiclo()

// Outra aba com versão mais nova do banco pede para fechar a conexão: o Dexie já fecha sozinho;
// avisamos a tela para recarregar em vez de deixá-la com um banco fechado.
export const AVISO_BANCO = 'ciclo-estudos:banco-fechado'
db.on('versionchange', () => {
  window.dispatchEvent(new Event(AVISO_BANCO))
})
