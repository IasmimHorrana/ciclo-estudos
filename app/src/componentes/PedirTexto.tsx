import { useState } from 'react'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'

export function PedirTexto({ rotulo, inicial, ajuda, placeholder, ok, fechar }: {
  rotulo: string; inicial: string; ajuda?: string; placeholder?: string; ok: string; fechar: (v?: unknown) => void
}) {
  const [v, setV] = useState(inicial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        fechar(v)
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        {rotulo}
        <Entrada autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} />
      </label>
      {ajuda && <p className="mt-2 mb-0 text-xs text-muted-foreground">{ajuda}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => fechar(null)}>
          Cancelar
        </Button>
        <Button type="submit">{ok}</Button>
      </div>
    </form>
  )
}
