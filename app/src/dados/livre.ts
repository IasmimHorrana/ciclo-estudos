import type { BancoCiclo } from '@/dados/db'
import { Preferencias } from '@/dados/esquemas'
import { segundaDe, type DataISO } from '@/dominio/datas'
import { ajustarSemana, validarMeta, type DiaLivre, type MetaLivre, type ModoEstudo } from '@/dominio/livre'

/** Lê as preferências, aplica a mudança e grava, numa transação (para não perder o que outra aba mudou ao mesmo tempo). */
async function mudar(db: BancoCiclo, f: (p: Preferencias) => Partial<Preferencias>, agora: number): Promise<void> {
  await db.transaction('rw', db.valores, async () => {
    const atual = Preferencias.parse((await db.valores.get('preferencias'))?.valor ?? {})
    await db.valores.put({ chave: 'preferencias', valor: Preferencias.parse({ ...atual, ...f(atual) }), atualizadoEm: agora, sujo: 1 })
  })
}

/** Ciclo de passos ou modo Livre. Trocar não apaga nada: a semana do ciclo continua guardada. */
export const definirModo = (db: BancoCiclo, modoEstudo: ModoEstudo, agora = Date.now()) => mudar(db, () => ({ modoEstudo }), agora)

/** Muda a meta-base e a estendida (mantém os ajustes de semanas). Devolve a mensagem de erro, se houver. */
export async function definirMetaLivre(db: BancoCiclo, base: number, estendida: number, agora = Date.now()): Promise<string | null> {
  const erro = validarMeta(base, estendida)
  if (erro) return erro
  await mudar(db, (p) => ({ metaLivre: { ...p.metaLivre, base, estendida } }), agora)
  return null
}

/** Meta só da semana de `dia` (`null` volta à base). A semana seguinte não herda nada. */
export const ajustarMetaDaSemana = (db: BancoCiclo, dia: DataISO, horas: number | null, agora = Date.now()) =>
  mudar(db, (p): { metaLivre: MetaLivre } => ({ metaLivre: ajustarSemana(p.metaLivre, segundaDe(dia), horas) }), agora)

/** Guarda as matérias escolhidas para o dia. */
export const escolherDia = (db: BancoCiclo, diaLivre: DiaLivre, agora = Date.now()) => mudar(db, () => ({ diaLivre }), agora)
