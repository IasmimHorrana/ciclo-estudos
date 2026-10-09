import { useEffect } from 'react'
import { BarraLateral } from '@/componentes/barra-lateral/BarraLateral'
import { EmBreve } from '@/telas/EmBreve'
import { fmtMMSS, NOMES_FASE } from '@/dominio/pomodoro'
import { usePomodoro } from '@/estado/pomodoro'
import { temaEscuro, useUi, type AbaId } from '@/estado/ui'

const TELAS: Record<AbaId, { titulo: string; etapa: string; descricao: string }> = {
  montar: { titulo: 'Montar ciclo', etapa: 'Etapa 4: será portada do app em HTML', descricao: 'Meta em horas, matérias, modelos e dias de estudo.' },
  semana: { titulo: 'Semana', etapa: 'Etapa 4: será portada do app em HTML', descricao: 'Checklist do ciclo, por dia, com rosca e progresso.' },
  desempenho: { titulo: 'Desempenho', etapa: 'Etapa 4: será portado do app em HTML', descricao: 'Assuntos, questões, horas e semanas fechadas.' },
  resumos: { titulo: 'Resumos', etapa: 'Etapa 4: serão portados do app em HTML', descricao: 'Notas em Markdown por matéria.' },
  flashcards: { titulo: 'Flashcards', etapa: 'Etapa 3: é a próxima a ser construída', descricao: 'Sistema no estilo Anki, com repetição espaçada SM-2.' },
}

export default function App() {
  const { aba, tema } = useUi()

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

  const t = TELAS[aba]
  return (
    <div className="grid h-dvh grid-cols-[276px_minmax(0,1fr)] overflow-hidden max-[900px]:h-auto max-[900px]:min-h-dvh max-[900px]:grid-cols-1 max-[900px]:overflow-visible">
      <BarraLateral />
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden px-5 py-3.5 max-[900px]:overflow-visible max-[900px]:p-4">
        <EmBreve {...t} />
      </main>
    </div>
  )
}
