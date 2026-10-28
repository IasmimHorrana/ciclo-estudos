import { useState } from 'react'
import { Etiqueta } from '@/componentes/nivel'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'
import { mudarPreferencias } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { FAIXAS_PADRAO, MIN_QUESTOES, validarFaixas, type Faixas } from '@/dominio/desempenho'

/** Formulário das faixas de acerto (abre num diálogo). */
export function AjustarFaixas({ atual, fechar }: { atual: Faixas; fechar: () => void }) {
  const [t, setT] = useState({ fraco: String(atual.fraco), medio: String(atual.medio), bom: String(atual.bom) })
  const f: Faixas = { fraco: Number(t.fraco.replace(',', '.')), medio: Number(t.medio.replace(',', '.')), bom: Number(t.bom.replace(',', '.')) }
  const erro = validarFaixas(f)
  const campo = (k: keyof Faixas, rotulo: string) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-36">{rotulo}</span>
      <Entrada className="w-20 text-center" inputMode="decimal" value={t[k]} aria-label={rotulo} onChange={(e) => setT({ ...t, [k]: e.target.value })} />
      %
    </label>
  )

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (erro) return
        void mudarPreferencias(db, { faixas: f }).then(fechar)
      }}
    >
      <p className="m-0 text-sm text-muted-foreground">
        O nível sai da porcentagem de acertos do assunto (com pelo menos {MIN_QUESTOES} questões). É só um indicador para orientar o estudo, não uma garantia de nada.
      </p>
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm"><span className="w-36">Abaixo do Médio</span><Etiqueta nivel="fraco" /></span>
        {campo('fraco', 'Médio a partir de')}
        {campo('medio', 'Bom a partir de')}
        {campo('bom', 'Dominado a partir de')}
      </div>
      {erro ? <p className="m-0 text-sm text-erro">{erro}</p> : (
        <p className="m-0 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Etiqueta nivel="fraco" /> abaixo de {f.fraco}% · <Etiqueta nivel="medio" /> até {f.medio - 1}% · <Etiqueta nivel="bom" /> até {f.bom - 1}% · <Etiqueta nivel="dom" /> {f.bom}% ou mais
        </p>
      )}
      <div className="mt-1 flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => setT({ fraco: String(FAIXAS_PADRAO.fraco), medio: String(FAIXAS_PADRAO.medio), bom: String(FAIXAS_PADRAO.bom) })}>
          Voltar ao padrão
        </Button>
        <span className="flex gap-2">
          <Button type="button" variant="outline" onClick={fechar}>Cancelar</Button>
          <Button type="submit" disabled={!!erro}>Salvar</Button>
        </span>
      </div>
    </form>
  )
}
