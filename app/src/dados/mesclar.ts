import type { MdLido } from '@/dados/arquivos'
import type { Dados, NotaResumo } from '@/dados/esquemas'
import { novoId } from '@/dados/ids'

export interface MdDaPasta {
  md: MdLido
  /** Data de modificação do arquivo (ms). */
  modificado: number
  /** Primeira pasta do caminho (a matéria, quando o `.md` não traz o cabeçalho). */
  pasta: string
}

const norm = (s: string) => s.trim().toLowerCase()

function tituloUnico(base: string, notas: NotaResumo[]): string {
  const t = base.trim() || 'Sem título'
  let k = 2
  let cand = t
  while (notas.some((n) => norm(n.titulo) === norm(cand))) cand = `${t} (${k++})`
  return cand
}

/**
 * Junta ao backup os `.md` da pasta: edições feitas direto no arquivo (mais novas que a nota) atualizam a nota,
 * e arquivos que o app não conhece viram notas novas. Não altera o objeto recebido.
 */
export function mesclarMd(d: Dados, mds: MdDaPasta[], agora = Date.now()): { dados: Dados; novas: number; atualizadas: number } {
  const notas = d.notas.map((n) => ({ ...n }))
  let novas = 0
  let atualizadas = 0
  for (const { md, modificado, pasta } of mds) {
    const existente = md.id ? notas.find((n) => n.id === md.id) : undefined
    if (existente) {
      if (modificado > existente.atualizado + 2000 && md.texto !== existente.texto) {
        existente.texto = md.texto
        existente.atualizado = modificado
        existente.atualizadoEm = agora
        existente.sujo = 1
        atualizadas++
      }
    } else {
      notas.push({
        id: md.id || novoId(agora),
        titulo: tituloUnico(md.titulo, notas),
        materia: md.materia || (pasta && pasta !== 'Sem matéria' ? pasta : ''),
        texto: md.texto,
        criado: modificado,
        atualizado: modificado,
        atualizadoEm: agora,
        excluidoEm: null,
        sujo: 1,
      })
      novas++
    }
  }
  return { dados: { ...d, notas }, novas, atualizadas }
}
