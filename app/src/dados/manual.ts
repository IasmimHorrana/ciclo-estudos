import { registrarTempo } from '@/dados/ciclo'
import type { BancoCiclo } from '@/dados/db'
import { novoIdFc } from '@/dados/ids'
import { hoje } from '@/dominio/datas'
import { validarEstudoManual, type EstudoManual } from '@/dominio/desempenho'

export interface PedidoManual extends EstudoManual {
  assuntoId: string | null
  /** Passo da semana em que somar o tempo, ou `null` para só guardar no Desempenho. */
  passoId: number | null
}

/**
 * Registra um estudo feito fora do app: o tempo (somado a um passo da semana, se escolhido, e guardado como sessão
 * para o Desempenho e o Edital) e, no tipo Questões, as questões feitas e os acertos. Devolve a mensagem de erro, se houver.
 */
export async function registrarEstudoManual(db: BancoCiclo, d: PedidoManual, agora = Date.now()): Promise<string | null> {
  const erro = validarEstudoManual(d, hoje(new Date(agora)))
  if (erro) return erro
  await db.transaction('rw', [db.valores, db.sessoes, db.questoes], async () => {
    if (d.minutos >= 1) {
      if (d.passoId) {
        await registrarTempo(db, { passoId: d.passoId, minutos: d.minutos, tipo: d.tipo, assuntoId: d.assuntoId, feito: false, data: d.data }, agora)
      } else {
        await db.sessoes.put({
          id: novoIdFc('s', agora), data: d.data, materia: d.materia, assuntoId: d.assuntoId, minutos: d.minutos, tipo: d.tipo,
          atualizadoEm: agora, excluidoEm: null, sujo: 1,
        })
      }
    }
    if (d.tipo === 'Questões' && d.feitas >= 1) {
      await db.questoes.put({
        id: novoIdFc('q', agora + 1), data: d.data, materia: d.materia, assuntoId: d.assuntoId, feitas: d.feitas, acertos: d.acertos,
        atualizadoEm: agora, excluidoEm: null, sujo: 1,
      })
    }
  })
  return null
}
