import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// fontes embutidas (funcionam sem internet): Poppins no texto, JetBrains Mono nos números do relógio
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import './index.css'
import App from './App'
import { recarregarAoAtualizar } from '@/lib/atualizacao'
import { useCronometro } from '@/estado/cronometro'
import { usePomodoro } from '@/estado/pomodoro'

// não recarrega para atualizar com um relógio rodando (Pomodoro ou cronômetro livre)
recarregarAoAtualizar(
  'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  () => usePomodoro.getState().rodando || useCronometro.getState().rodando,
  (fn) => {
    const a = usePomodoro.subscribe(fn)
    const b = useCronometro.subscribe(fn)
    return () => { a(); b() }
  },
  () => location.reload(),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
