import type { BancoCiclo } from '@/dados/db'
import { carregarEdital } from '@/dados/edital'
import { carregarContexto, filaDe } from '@/dados/flashcards'
import type { DataISO } from '@/dominio/datas'
import { montarEdital, revisaoDevida } from '@/dominio/edital'

export interface Pendencias {
  /** Assuntos do edital com revisão para hoje ou atrasada. */
  edital: number
  /** Cartões em aprendizado e revisões vencidas (os novos não contam: são opcionais). */
  flashcards: number
}

/** Os números ao lado de Edital e Flashcards no menu. */
export async function contarPendencias(db: BancoCiclo, hoje: DataISO, agora = Date.now()): Promise<Pendencias> {
  const [dados, ctx] = await Promise.all([carregarEdital(db), carregarContexto(db, agora)])
  const { blocos } = montarEdital({ ...dados, ordem: 'edital', ocultarEstudados: false, filtroMateria: null, hoje })
  const edital = blocos.flatMap((b) => b.linhas).filter((l) => !l.temFilhos && revisaoDevida(l)).length
  const c = filaDe(ctx, null).contagem
  return { edital, flashcards: c.aprendendo + c.revisao }
}
