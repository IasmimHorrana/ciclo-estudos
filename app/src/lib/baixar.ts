/** Faz o navegador baixar um arquivo (texto vira JSON; ou um Blob pronto). */
export function baixar(nome: string, conteudo: string | Blob) {
  const url = URL.createObjectURL(typeof conteudo === 'string' ? new Blob([conteudo], { type: 'application/json' }) : conteudo)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
