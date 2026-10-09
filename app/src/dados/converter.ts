import { BackupLegado, type Controle, type Dados } from '@/dados/esquemas'

/** Marca de um arquivo exportado pela base nova (o app em HTML não grava isto, então dá para distinguir). */
export const FORMATO = 'ciclo-estudos'
export const VERSAO_ARQUIVO = 1

const ctl = (agora: number, atualizado?: number): Controle => ({ atualizadoEm: atualizado ?? agora, excluidoEm: null, sujo: 1 })

/** Lê o texto de um backup (do app em HTML ou da base nova) e valida. Lança `Error` com mensagem em português. */
export function lerArquivo(texto: string, agora = Date.now()): Dados {
  let cru: unknown
  try {
    cru = JSON.parse(texto)
  } catch {
    throw new Error('O arquivo não é um JSON válido.')
  }
  if (!cru || typeof cru !== 'object' || Array.isArray(cru)) throw new Error('O arquivo não parece um backup do Ciclo de Estudos.')
  const o = cru as Record<string, unknown>
  if (typeof o.versao === 'number' && o.versao > VERSAO_ARQUIVO) {
    throw new Error('Este backup foi gerado por uma versão mais nova do app. Atualize o app antes de importar.')
  }
  if (!o.config || typeof o.config !== 'object' || !Array.isArray(o.fechadas)) {
    throw new Error('O arquivo não parece um backup do Ciclo de Estudos.')
  }
  return paraDados(BackupLegado.parse(o), agora)
}

/** Converte o backup (já validado) para o formato guardado no Dexie, com os controles de sincronização. */
export function paraDados(b: BackupLegado, agora: number): Dados {
  return {
    tema: b.tema,
    config: b.config,
    semana: b.semana,
    pomo: b.pomo,
    cores: b.cores,
    fechadas: b.fechadas.map((f) => ({ ...f, id: String(f.id), ...ctl(agora) })),
    modelos: b.modelos.map((m) => ({ ...m, ...ctl(agora, m.criado) })),
    notas: b.notas.map((n) => ({ ...n, ...ctl(agora, n.atualizado) })),
    assuntos: b.assuntos.map((a) => ({ ...a, ...ctl(agora) })),
    questoes: b.questoes.map((q) => ({ ...q, ...ctl(agora) })),
    sessoes: b.sessoes.map((s) => ({ ...s, ...ctl(agora) })),
  }
}

type SemControle<T> = Omit<T, keyof Controle>
const semControle = <T extends Controle>({ atualizadoEm: _a, excluidoEm: _e, sujo: _s, ...resto }: T): SemControle<T> => resto

/**
 * Objeto do arquivo de backup. Mantém o mesmo formato do app em HTML (assim os dois se leem),
 * acrescentando `formato` e `versao`. Os controles de sincronização não vão para o arquivo.
 */
export function paraArquivo(d: Dados, agora = Date.now()) {
  return {
    formato: FORMATO,
    versao: VERSAO_ARQUIVO,
    exportadoEm: agora,
    tema: d.tema,
    config: d.config,
    semana: d.semana,
    fechadas: d.fechadas.map((f) => ({ ...semControle(f), id: Number(f.id) || f.id })),
    pomo: d.pomo,
    cores: d.cores,
    notas: d.notas.map(semControle),
    modelos: d.modelos.map(semControle),
    assuntos: d.assuntos.map(semControle),
    questoes: d.questoes.map(semControle),
    sessoes: d.sessoes.map(semControle),
  }
}
