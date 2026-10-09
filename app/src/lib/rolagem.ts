/** Rola a lista até o dia (usado pela tira da semana e pelo calendário). */
export function irParaDia(iso: string) {
  document.getElementById(`dia-${iso}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}
