import { PedirTexto } from '@/componentes/PedirTexto'
import { Button } from '@/componentes/ui/button'
import { abrirDialogo } from '@/estado/dialogo'

/** Confirmação com dois botões. Resolve `true` se ela confirmou. */
export async function confirmar(mensagem: string, rotulo = 'Sim', perigo = false): Promise<boolean> {
  const r = await abrirDialogo<boolean>('Confirmação', (fechar) => (
    <>
      <p className="mt-0 mb-4 text-sm">{mensagem}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => fechar(false)}>
          Cancelar
        </Button>
        <Button autoFocus variant={perigo ? 'destructive' : 'default'} onClick={() => fechar(true)}>
          {rotulo}
        </Button>
      </div>
    </>
  ))
  return r === true
}

export async function avisar(titulo: string, mensagem: string): Promise<void> {
  await abrirDialogo(titulo, (fechar) => (
    <>
      <p className="mt-0 mb-4 text-sm">{mensagem}</p>
      <div className="flex justify-end">
        <Button autoFocus onClick={() => fechar(true)}>
          OK
        </Button>
      </div>
    </>
  ))
}

/** Pede um texto. Resolve com o texto digitado, ou `null` se cancelou. */
export const pedirTexto = (titulo: string, rotulo: string, inicial = '', opcoes: { ajuda?: string; placeholder?: string; ok?: string } = {}) =>
  abrirDialogo<string>(titulo, (fechar) => <PedirTexto rotulo={rotulo} inicial={inicial} ajuda={opcoes.ajuda} placeholder={opcoes.placeholder} ok={opcoes.ok ?? 'Salvar'} fechar={fechar} />)
