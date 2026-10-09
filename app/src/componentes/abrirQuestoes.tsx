import { FormularioQuestoes, type PreenchimentoQuestoes } from '@/componentes/FormularioQuestoes'
import { abrirDialogo } from '@/estado/dialogo'

/** Abre o diálogo "Registrar questões", opcionalmente já com matéria e assunto escolhidos. */
export const abrirQuestoes = (inicial: PreenchimentoQuestoes = {}) =>
  abrirDialogo('Registrar questões', (fechar) => <FormularioQuestoes inicial={inicial} fechar={() => fechar()} />)
