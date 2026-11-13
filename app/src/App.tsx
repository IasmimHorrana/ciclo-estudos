import { useEffect, useState, type ReactNode } from 'react'
import { AvisoSemana } from '@/componentes/AvisoSemana'
import { Dialogos } from '@/componentes/Dialogos'
import { FaixasContexto } from '@/componentes/faixas-contexto'
import { BarraLateral } from '@/componentes/barra-lateral/BarraLateral'
import { TopoCelular } from '@/componentes/TopoCelular'
import { Dados } from '@/telas/Dados'
import { Desempenho } from '@/telas/Desempenho'
import { Edital } from '@/telas/Edital'
import { Montar } from '@/telas/Montar'
import { Resumos } from '@/telas/Resumos'
import { Semana } from '@/telas/Semana'
import { Flashcards } from '@/telas/flashcards/Flashcards'
import { aoConcluirFoco } from '@/componentes/aoConcluirFoco'
import { iniciarPersistenciaCronometro } from '@/componentes/cronometro-api'
import { iniciarPersistenciaPomodoro } from '@/componentes/restaurar-pomodoro-api'
import { useCiclo } from '@/dados/useCiclo'
import { carregarPasta, iniciarBackupAutomatico } from '@/dados/pasta'
import { fmtHHMMSS } from '@/dominio/cronometro'
import { FAIXAS_PADRAO } from '@/dominio/desempenho'
import { fmtMMSS, NOMES_FASE } from '@/dominio/pomodoro'
import { useCronometro } from '@/estado/cronometro'
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

/** Tempo do relógio que está rodando no título da aba do navegador. */
function atualizarTitulo() {
  const p = usePomodoro.getState()
  const c = useCronometro.getState()
  document.title = p.rodando ? `(${fmtMMSS(p.restaSeg)}) ${NOMES_FASE[p.fase]}` : c.rodando ? `(${fmtHHMMSS(c.seg)}) Livre` : 'Ciclo de Estudos'
}

/** Gaveta do menu no celular: Esc e o botão "voltar" do aparelho fecham; a página de trás não rola. */
function useGaveta() {
  const [aberta, setAberta] = useState(false)
  const comEntrada = () => (history.state as { gaveta?: boolean } | null)?.gaveta === true
  const abrir = () => {
    if (!comEntrada()) history.pushState({ gaveta: true }, '') // o "voltar" do aparelho fecha a gaveta em vez de sair do app
    setAberta(true)
  }
  // fechar pelo app também consome a entrada do histórico (o popstate então fecha)
  const fechar = () => (comEntrada() ? history.back() : setAberta(false))

  useEffect(() => {
    const voltar = () => setAberta(comEntrada())
    addEventListener('popstate', voltar)
    return () => removeEventListener('popstate', voltar)
  }, [])

  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') if (comEntrada()) history.back(); else setAberta(false)
    }
    addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [aberta])
  return { aberta, abrir, fechar }
}

export default function App() {
  const { aba, tema, paleta } = useUi()
  const ciclo = useCiclo()
  const pomoSalvo = ciclo?.pomo
  const gaveta = useGaveta()

  // no celular a página rola inteira: trocar de aba volta ao topo
  useEffect(() => {
    if (matchMedia('(max-width: 900px)').matches) scrollTo(0, 0)
  }, [aba])

  // tempos do Pomodoro guardados no banco (valem em qualquer aparelho depois da sincronização)
  useEffect(() => {
    if (!pomoSalvo) return
    usePomodoro.getState().definirConfig(pomoSalvo)
    // com os tempos já carregados: devolve o Pomodoro ao ponto em que estava; depois, o cronômetro livre (um diálogo de cada vez)
    void iniciarPersistenciaPomodoro().then(iniciarPersistenciaCronometro)
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

  // paleta de cores (a padrão, verde-menta, não precisa do atributo)
  useEffect(() => {
    if (paleta === 'menta') delete document.documentElement.dataset.paleta
    else document.documentElement.dataset.paleta = paleta
  }, [paleta])

  // relógio único do Pomodoro e do cronômetro livre + tempo no título da aba do navegador
  useEffect(() => {
    const id = setInterval(() => {
      const agora = Date.now()
      usePomodoro.getState().tic(agora)
      useCronometro.getState().tic(agora)
    }, 250)
    const cancelarP = usePomodoro.subscribe(atualizarTitulo)
    const cancelarC = useCronometro.subscribe(atualizarTitulo)
    return () => {
      clearInterval(id)
      cancelarP()
      cancelarC()
    }
  }, [])

  return (
    <FaixasContexto.Provider value={ciclo?.preferencias.faixas ?? FAIXAS_PADRAO}>
      <div className="grid h-dvh grid-cols-[276px_minmax(0,1fr)] overflow-hidden max-[900px]:flex max-[900px]:h-auto max-[900px]:min-h-dvh max-[900px]:flex-col max-[900px]:overflow-visible">
        <TopoCelular aoAbrirMenu={gaveta.abrir} />
        <BarraLateral aberta={gaveta.aberta} aoNavegar={() => gaveta.aberta && gaveta.fechar()} />
        {gaveta.aberta && <div className="fixed inset-0 z-40 bg-black/50 min-[901px]:hidden" aria-hidden onClick={gaveta.fechar} />}
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden px-5 py-3.5 max-[900px]:flex-1 max-[900px]:overflow-visible max-[900px]:p-3">
          <AvisoSemana />
          {TELAS[aba]}
        </main>
        <Dialogos />
      </div>
    </FaixasContexto.Provider>
  )
}
