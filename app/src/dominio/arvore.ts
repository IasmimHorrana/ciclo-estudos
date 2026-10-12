// Árvore de baralhos ("Matéria::Assunto"): ordem, nível e quais linhas aparecem quando há pais recolhidos. Puro.

export interface LinhaArvore<T> {
  item: T
  /** 0 = baralho principal, 1 = subbaralho… */
  nivel: number
  /** Só o último pedaço do nome ("Normalização" em "Informática::Normalização"). */
  rotulo: string
  temFilhos: boolean
}

const partes = (nome: string) => nome.split('::')

/** Ordena pelo caminho, pedaço a pedaço, para os subbaralhos ficarem sempre logo abaixo do pai. */
function compararCaminhos(a: string, b: string): number {
  const pa = partes(a)
  const pb = partes(b)
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const c = (pa[i] as string).localeCompare(pb[i] as string, 'pt-BR')
    if (c) return c
  }
  return pa.length - pb.length
}

/**
 * Linhas a mostrar. `recolhidos` guarda o nome completo dos baralhos fechados:
 * os subbaralhos de um baralho fechado (em qualquer nível) não aparecem.
 */
export function linhasDaArvore<T extends { nome: string }>(itens: readonly T[], recolhidos: ReadonlySet<string>): LinhaArvore<T>[] {
  const ordenados = [...itens].sort((a, b) => compararCaminhos(a.nome, b.nome))
  const nomes = ordenados.map((i) => i.nome)
  const linhas: LinhaArvore<T>[] = []
  for (const item of ordenados) {
    const p = partes(item.nome)
    const escondido = p.slice(0, -1).some((_, k) => recolhidos.has(p.slice(0, k + 1).join('::')))
    if (escondido) continue
    linhas.push({
      item,
      nivel: p.length - 1,
      rotulo: p[p.length - 1] ?? item.nome,
      temFilhos: nomes.some((n) => n.startsWith(`${item.nome}::`)),
    })
  }
  return linhas
}

/** Nomes de todos os baralhos que têm subbaralhos (para "recolher tudo"). */
export function nomesComFilhos(nomes: readonly string[]): string[] {
  return nomes.filter((n) => nomes.some((o) => o.startsWith(`${n}::`)))
}
