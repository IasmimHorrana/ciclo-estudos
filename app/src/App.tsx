import { useEffect, type ReactNode } from 'react'
import { AvisoSemana } from '@/componentes/AvisoSemana'
import { Dialogos } from '@/componentes/Dialogos'
import { BarraLateral } from '@/componentes/barra-lateral/BarraLateral'
import { Dados } from '@/telas/Dados'
import { Desempenho } from '@/telas/Desempenho'
import { Edital } from '@/telas/Edital'
import { Montar } from '@/telas/Montar'
import { Resumos } from '@/telas/Resumos'
import { Semana } from '@/telas/Semana'
import { Flashcards } from '@/telas/flashcards/Flashcards'
import { aoConcluirFoco } from '@/componentes/aoConcluirFoco'
import { useCiclo } from '@/dados/useCiclo'
import { carregarPasta, iniciarBackupAutomatico } from '@/dados/pasta'
import { fmtMMSS, NOMES_FASE } from '@/dominio/pomodoro'
import { usePomodoro } from '@/estado/pomodoro'
import { temaEscuro, useUi, type AbaId } from '@/estado/ui'

const TELAS: Record<AbaId, ReactNode> = {
  montar: <Montar />,
  semana: <Semana />,
  desempenho: <Desempenho />,
  resumos: <Resumos />,
  edital: <Edital />,
  flashcards: <Flashcards />,
  dados: <Dados />,
}

export default function App() {
  const { aba, tema } = useUi()
  const ciclo = useCiclo()
  const pomoSalvo = ciclo?.pomo

  // tempos do Pomodoro guardados no banco (valem em qualquer aparelho depois da sincronização)
  useEffect(() => {
    if (pomoSalvo) usePomodoro.getState().definirConfig(pomoSalvo)
  }, [pomoSalvo?.foco, pomoSalvo?.pausa, pomoSalvo?.longa, pomoSalvo?.ate]) // eslint-disable-line react-hooks/exhaustive-deps

  // foco concluído: soma o tempo a um passo
  useEffect(() => usePomodoro.subscribe((s, ant) => { if (s.foco && !ant.foco) void aoConcluirFoco(s.foco) }), [])

  // backup automático em pasta (se ela já escolheu uma)
  useEffect(() => {
    void carregarPasta()
    return iniciarBackupAutomatico()
  }, [])

  // tema claro/escuro (e acompanha o sistema no modo automático)
  useEffect(() => {
    const aplicar = () => document.documentElement.classList.toggle('dark', temaEscuro(tema))
    aplicar()
    if (tema !== 'auto') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [tema])

  // relógio único do Pomodoro + tempo restante no título da aba do navegador
  useEffect(() => {
    const id = setInterval(() => usePomodoro.getState().tic(), 250)
    const cancelar = usePomodoro.subscribe((s) => {
      document.title = s.rodando ? `(${fmtMMSS(s.restaSeg)}) ${NOMES_FASE[s.fase]}` : 'Ciclo de Estudos'
    })
    return () => {
      clearInterval(id)
      cancelar()
    }
  }, [])

  return (
    <div className="grid h-dvh grid-cols-[276px_minmax(0,1fr)] overflow-hidden max-[900px]:h-auto max-[900px]:min-h-dvh max-[900px]:grid-cols-1 max-[900px]:overflow-visible">
      <BarraLateral />
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden px-5 py-3.5 max-[900px]:overflow-visible max-[900px]:p-4">
        <AvisoSemana />
        {TELAS[aba]}
      </main>
      <Dialogos />
    </div>
  )
}
