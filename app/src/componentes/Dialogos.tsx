import { useEffect } from 'react'
import { useDialogo } from '@/estado/dialogo'

/** Onde os diálogos aparecem. Fica uma vez só, no App. */
export function Dialogos() {
  const atual = useDialogo((s) => s.atual)
  const fechar = useDialogo((s) => s.fechar)

  useEffect(() => {
    if (!atual) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar(null)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [atual, fechar])

  if (!atual) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && fechar(null)}
    >
      <div role="dialog" aria-modal="true" aria-label={atual.titulo} className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-xl border bg-card p-5 shadow-xl">
        <h2 className="m-0 mb-3 text-base font-bold">{atual.titulo}</h2>
        {atual.render((v) => fechar(v))}
      </div>
    </div>
  )
}
