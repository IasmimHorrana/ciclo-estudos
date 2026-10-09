import { useState, type ComponentProps } from 'react'
import { Entrada } from '@/componentes/ui/entrada'

/**
 * Campo numérico que só confirma ao sair do campo ou apertar Enter (digitar "1,5" não é interrompido no meio).
 * Para atualizar o valor de fora, mude a `key` do componente.
 */
export function CampoNumero({ valor, aoConfirmar, vazioOk = false, ...resto }: {
  valor: number | null
  aoConfirmar: (n: number | null) => void
  /** Campo vazio vale `null` (ex.: "automático"). */
  vazioOk?: boolean
} & Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'>) {
  const [t, setT] = useState(valor === null ? '' : String(valor).replace('.', ','))
  const confirmar = () => {
    if (t.trim() === '') return vazioOk ? aoConfirmar(null) : undefined
    const n = Number(t.replace(',', '.'))
    if (Number.isFinite(n)) aoConfirmar(n)
  }
  return (
    <Entrada
      {...resto}
      type="text"
      inputMode="decimal"
      value={t}
      onChange={(e) => setT(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
