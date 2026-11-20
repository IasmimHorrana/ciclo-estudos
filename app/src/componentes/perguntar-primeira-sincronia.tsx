import { Button } from '@/componentes/ui/button'
import type { EscolhaPrimeira } from '@/dados/sincronizar'
import { abrirDialogo } from '@/estado/dialogo'

/**
 * Primeira sincronização com dados neste aparelho **e** na nuvem. O backup .json deste aparelho já foi baixado
 * antes desta pergunta. Resolve com a escolha, ou `null` se ela fechou sem escolher (nada é feito).
 */
export function perguntarPrimeiraSincronia(): Promise<EscolhaPrimeira | null> {
  return abrirDialogo<EscolhaPrimeira>('Primeira sincronização', (fechar) => (
    <>
      <p className="mt-0 mb-2 text-sm">
        Este aparelho e a nuvem já têm dados. Antes de qualquer coisa, um <strong>backup .json deste aparelho</strong> foi baixado (veja os
        downloads).
      </p>
      <p className="mt-0 mb-4 text-sm">O que fazer com os dados deste aparelho?</p>
      <div className="flex flex-col gap-2">
        <Button autoFocus onClick={() => fechar('nuvem')} className="h-auto flex-col items-start py-2 text-left whitespace-normal">
          <span>Usar os dados da nuvem</span>
          <span className="text-xs font-normal opacity-90">
            Recomendado num aparelho novo (como o celular): fica igual ao que já está sincronizado. O que existia só aqui sai deste aparelho (está no
            backup).
          </span>
        </Button>
        <Button variant="outline" onClick={() => fechar('juntar')} className="h-auto flex-col items-start py-2 text-left whitespace-normal">
          <span>Juntar os dois</span>
          <span className="text-xs font-normal text-muted-foreground">
            O que só existe aqui vai para a nuvem; o que existe nos dois fica com a edição mais recente.
          </span>
        </Button>
        <Button variant="ghost" onClick={() => fechar(null)}>
          Agora não
        </Button>
      </div>
    </>
  ))
}
