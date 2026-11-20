/**
 * Regras da sincronização com a nuvem (etapa 5), sem rede e sem banco: só decisões, para testar à parte.
 * A parte que fala com o Supabase e com o Dexie fica em `src/dados/sincronizar.ts` (sub-etapa 5.4).
 *
 * Horas: o app grava `atualizadoEm` com o relógio do aparelho. Para comparar edições de dois aparelhos,
 * tudo é levado ao relógio do servidor somando o **desvio** (`servidor − aparelho`), medido a cada sincronização.
 */

/** Versão do formato dos dados que este app grava (igual à versão do banco Dexie; um teste confere). */
export const ESQUEMA_VERSAO = 7

/** Tabelas do Dexie que vão para a nuvem. A tabela `local` (pasta de backup, identidade do aparelho) fica de fora. */
export const COLECOES = [
  'valores',
  'semanasFechadas',
  'modelos',
  'notas',
  'assuntos',
  'materiasEdital',
  'questoes',
  'sessoes',
  'baralhos',
  'gruposOpcoes',
  'tiposNota',
  'notasFc',
  'cartoes',
  'revlog',
] as const
export type Colecao = (typeof COLECOES)[number]

/** Campo que identifica o registro: `valores` usa a chave ("config", "semana"…); as demais, `id`. */
export const campoChave = (c: Colecao): 'chave' | 'id' => (c === 'valores' ? 'chave' : 'id')

/** Registro como está no Dexie (qualquer tabela). */
export interface RegistroLocal {
  atualizadoEm: number
  excluidoEm?: number | null
  sujo: 0 | 1
  [campo: string]: unknown
}

/** Registro como vai e volta da nuvem (tabela `registros`). Horas em ms. */
export interface RegistroNuvem {
  colecao: Colecao
  id: string
  /** O registro inteiro, menos o `sujo` (que é só deste aparelho). */
  dados: Record<string, unknown>
  /** Hora da edição já no relógio do servidor: é o que decide conflitos. */
  editadoEm: number
  /** Hora em que o servidor gravou (preenchida pelo próprio servidor): é o cursor de "puxar". */
  atualizadoEm: number
  /** Hora da exclusão no relógio do servidor, ou `null` se vivo (para o servidor saber o que pode expurgar). */
  excluidoEm: number | null
  esquemaVersao: number
}

export type RegistroParaEnviar = Omit<RegistroNuvem, 'atualizadoEm'>

/**
 * Desvio do relógio do aparelho: `servidor − aparelho`, em ms. `antes` e `depois` são as horas do aparelho
 * em volta da chamada que devolveu a hora do servidor; o meio desconta o tempo de ida e volta.
 */
export function medirDesvio(antes: number, depois: number, servidor: number): number {
  return Math.round(servidor - (antes + depois) / 2)
}

/** Prepara um registro do Dexie para enviar. */
export function paraNuvem(colecao: Colecao, r: RegistroLocal, desvio: number): RegistroParaEnviar {
  const dados: Record<string, unknown> = { ...r }
  delete dados.sujo
  const id = r[campoChave(colecao)]
  if (typeof id !== 'string' || !id) throw new Error(`Registro sem ${campoChave(colecao)} em ${colecao}.`)
  return {
    colecao,
    id,
    dados,
    editadoEm: r.atualizadoEm + desvio,
    excluidoEm: r.excluidoEm ? r.excluidoEm + desvio : null,
    esquemaVersao: ESQUEMA_VERSAO,
  }
}

/** Converte o que veio da nuvem para gravar no Dexie: limpo (`sujo: 0`), com a hora no relógio deste aparelho. */
export function deNuvem(r: RegistroNuvem, desvio: number): RegistroLocal {
  return { ...r.dados, atualizadoEm: r.editadoEm - desvio, sujo: 0 }
}

export type Decisao = 'aplicar' | 'manter'

/**
 * O que fazer com um registro que veio da nuvem, dado o que este aparelho tem.
 * - Não tem, ou tem sem mudança pendente: **aplicar**.
 * - Tem mudança pendente (`sujo`): vence a **edição mais recente** no relógio do servidor; empate fica com a nuvem.
 *   Excluir também é uma edição com hora (então uma exclusão mais nova vence uma edição mais velha, e vice-versa).
 *   Nos cartões isso equivale a "vale o lado da resposta mais recente", porque responder grava a hora no cartão;
 *   o histórico (revlog) dos dois lados é somado, então nenhuma resposta se perde.
 * - Histórico (revlog): as linhas nunca mudam, só podem ser desfeitas. **Desfeita num lado, desfeita para sempre.**
 */
export function decidir(colecao: Colecao, local: RegistroLocal | undefined, remoto: RegistroNuvem, desvio: number): Decisao {
  if (!local) return 'aplicar'
  if (colecao === 'revlog') {
    const localDesfeita = !!local.excluidoEm
    const remotaDesfeita = !!remoto.dados.excluidoEm
    if (localDesfeita !== remotaDesfeita) return localDesfeita ? 'manter' : 'aplicar'
    return local.sujo ? 'manter' : 'aplicar'
  }
  if (!local.sujo) return 'aplicar'
  return remoto.editadoEm >= local.atualizadoEm + desvio ? 'aplicar' : 'manter'
}

/**
 * Regra do **servidor** ao receber um envio (vira gatilho no Postgres na 5.2): sem isto, o último aparelho a
 * sincronizar venceria sempre, mesmo trazendo uma edição mais velha que a que já está na nuvem.
 * Aceita se for edição igual ou mais nova; no histórico, só recusa "desfazer o desfazer" (linha viva sobre desfeita).
 */
export function servidorAceita(atual: Pick<RegistroNuvem, 'dados' | 'editadoEm'> | undefined, novo: RegistroParaEnviar): boolean {
  if (!atual) return true
  if (novo.colecao === 'revlog') return !(atual.dados.excluidoEm && !novo.dados.excluidoEm)
  return novo.editadoEm >= atual.editadoEm
}

/**
 * Depois de enviar: só limpa o `sujo` se o registro não mudou durante o envio
 * (senão a edição feita no meio ficaria marcada como enviada sem ter ido).
 */
export function podeLimparSujo(enviadoComAtualizadoEm: number, atual: RegistroLocal | undefined): boolean {
  return !!atual && atual.sujo === 1 && atual.atualizadoEm === enviadoComAtualizadoEm
}

/** Divide uma lista em lotes (o Supabase limita o tamanho de cada consulta). */
export function emLotes<T>(lista: readonly T[], tamanho: number): T[][] {
  if (tamanho < 1) throw new Error('Tamanho do lote precisa ser pelo menos 1.')
  const saida: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho))
  return saida
}

/** Folga ao puxar: gravações que terminaram fora de ordem no servidor não ficam para trás. Puxar duas vezes não faz mal. */
export const FOLGA_CURSOR_MS = 60_000

/** De onde puxar desta vez: o último cursor menos a folga. */
export const inicioDaBusca = (cursor: number, folga = FOLGA_CURSOR_MS) => Math.max(0, cursor - folga)

/** Cursor depois de receber uma página: a maior hora de gravação do servidor vista até agora. */
export function avancarCursor(cursor: number, recebidos: readonly Pick<RegistroNuvem, 'atualizadoEm'>[]): number {
  return recebidos.reduce((m, r) => Math.max(m, r.atualizadoEm), cursor)
}

/** Se a nuvem pede uma versão mínima maior que a deste app, o app para de enviar e pede para atualizar. */
export const precisaAtualizar = (versaoMinimaDaNuvem: number) => versaoMinimaDaNuvem > ESQUEMA_VERSAO

/**
 * Primeira sincronização de um aparelho com a conta.
 * - Só a nuvem tem dados: **receber**. Só o aparelho tem: **enviar**. Nenhum tem: nada a fazer.
 * - Os dois têm: **perguntar** (o app baixa um backup .json do aparelho antes de qualquer escolha).
 */
export type PrimeiraVez = 'nada' | 'enviar' | 'receber' | 'perguntar'
export function primeiraSincronizacao(temDadosAqui: boolean, temDadosNaNuvem: boolean): PrimeiraVez {
  if (temDadosAqui && temDadosNaNuvem) return 'perguntar'
  if (temDadosAqui) return 'enviar'
  if (temDadosNaNuvem) return 'receber'
  return 'nada'
}

export const RETENCAO_EXCLUIDOS_MS = 90 * 86_400_000

/**
 * Uma marca de exclusão só pode ser apagada de verdade depois de 90 dias **e** depois de todos os aparelhos
 * terem sincronizado após a exclusão; senão um aparelho atrasado reenviaria o registro e ele "ressuscitaria".
 */
export function podeExpurgar(excluidoEm: number, agora: number, ultimasSincronizacoes: readonly number[], retencao = RETENCAO_EXCLUIDOS_MS): boolean {
  if (agora - excluidoEm < retencao) return false
  return ultimasSincronizacoes.every((t) => t > excluidoEm)
}
