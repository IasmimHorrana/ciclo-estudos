import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
