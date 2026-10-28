import { useFaixas } from '@/componentes/faixas-contexto'
import { COR_NIVEL } from '@/componentes/nivel-cores'
import { NOMES_NIVEL, nivelDe, pctDe, type Nivel } from '@/dominio/desempenho'

const fundo = (nivel: Nivel) => ({ color: COR_NIVEL[nivel], background: `color-mix(in srgb, ${COR_NIVEL[nivel]} 14%, transparent)` })

/** Nome do nível (Fraco, Médio…) numa pílula colorida. */
export function Etiqueta({ nivel }: { nivel: Nivel }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold whitespace-nowrap" style={fundo(nivel)}>
      {NOMES_NIVEL[nivel]}
    </span>
  )
}

/** % de acerto numa pílula com a cor do nível; nada quando ainda não há questões. */
export function SeloAcerto({ feitas, acertos }: { feitas: number; acertos: number }) {
  const faixas = useFaixas()
  if (!feitas) return null
  const nivel = nivelDe(feitas, acertos, faixas)
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold whitespace-nowrap tabular-nums"
      style={fundo(nivel)}
      title={`${NOMES_NIVEL[nivel]}: ${acertos} de ${feitas} questões certas`}
    >
      {pctDe(acertos, feitas)}%
    </span>
  )
}
