export function EmBreve({ titulo, etapa, descricao }: { titulo: string; etapa: string; descricao: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-bold">{titulo}</h1>
        <p className="mb-3 text-sm text-muted-foreground">{descricao}</p>
        <span className="inline-block rounded-full bg-secondary px-3 py-0.5 text-xs font-bold text-secondary-foreground">{etapa}</span>
      </div>
    </div>
  )
}
