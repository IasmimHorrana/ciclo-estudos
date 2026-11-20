import type { BancoCiclo } from '@/dados/db'

/**
 * Identidade deste aparelho para a sincronização (etapa 5). Fica na tabela `local`, que nunca vai para a nuvem:
 * cada navegador/celular tem a sua. Limpar os dados do site cria uma identidade nova (é tratado como aparelho novo).
 */
export interface Aparelho {
  id: string
  /** Nome para a tela de status ("Computador", "Celular"); ela pode trocar depois. */
  nome: string
  criadoEm: number
}

const CHAVE = 'aparelho'

/** Palpite do tipo de aparelho pelo navegador (só para o nome inicial). */
export function nomePadrao(userAgent: string): string {
  if (/iPad|Tablet/i.test(userAgent)) return 'Tablet'
  if (/Android|iPhone|Mobile/i.test(userAgent)) return 'Celular'
  return 'Computador'
}

const novoUuid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

/** Devolve a identidade deste aparelho, criando na primeira vez. Chamadas seguidas devolvem sempre a mesma. */
export async function aparelhoAtual(db: BancoCiclo, agora = Date.now(), userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): Promise<Aparelho> {
  return db.transaction('rw', db.local, async () => {
    const atual = (await db.local.get(CHAVE))?.valor as Aparelho | undefined
    if (atual?.id) return atual
    const novo: Aparelho = { id: novoUuid(), nome: nomePadrao(userAgent), criadoEm: agora }
    await db.local.put({ chave: CHAVE, valor: novo })
    return novo
  })
}
