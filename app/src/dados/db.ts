import Dexie, { type EntityTable } from 'dexie'
import type { Baralho, CartaoFc, GrupoOpcoes, NotaFc, RegistroRevisao, TipoNota } from '@/dados/flashcards-tipos'
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
  /** Só deste aparelho (pasta de backup e afins). Nunca vai para a nuvem. */
  baralhos!: EntityTable<Baralho, 'id'>
  gruposOpcoes!: EntityTable<GrupoOpcoes, 'id'>
  tiposNota!: EntityTable<TipoNota, 'id'>
  notasFc!: EntityTable<NotaFc, 'id'>
  cartoes!: EntityTable<CartaoFc, 'id'>
  revlog!: EntityTable<RegistroRevisao, 'id'>
  local!: EntityTable<{ chave: string; valor: unknown }, 'chave'>

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
    // v2: tabela nova só com dados deste aparelho. As demais continuam como estavam (não precisa de upgrade).
    this.version(2).stores({ local: 'chave' })
    // v3: flashcards (tabelas novas; nada do que já existia é tocado)
    this.version(3).stores({
      baralhos: 'id, nome, sujo, excluidoEm',
      gruposOpcoes: 'id, sujo',
      tiposNota: 'id, sujo',
      notasFc: 'id, tipoId, baralhoId, sujo, excluidoEm',
      cartoes: 'id, notaId, baralhoId, tipo, venceDia, venceMs, sujo, excluidoEm',
      revlog: 'id, cartaoId, baralhoId, dia, sujo',
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
