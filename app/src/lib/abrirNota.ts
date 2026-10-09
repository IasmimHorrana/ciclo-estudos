import { db } from '@/dados/db'
import { CHAVE_SEM_MATERIA, useResumosUi } from '@/estado/resumos'
import { useUi } from '@/estado/ui'

/** Abre uma nota na aba Resumos (usado também pelo botão "Resumo" da Semana). */
export function abrirNota(id: string) {
  const ui = useResumosUi.getState()
  ui.selecionar(id)
  void db.notas.get(id).then((n) => n && ui.abrirGrupo(n.materia || CHAVE_SEM_MATERIA))
  useUi.getState().irParaAba('resumos')
}
