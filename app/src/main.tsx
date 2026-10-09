import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { recarregarAoAtualizar } from '@/lib/atualizacao'
import { usePomodoro } from '@/estado/pomodoro'

recarregarAoAtualizar(
  'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  () => usePomodoro.getState().rodando,
  (fn) => usePomodoro.subscribe(fn),
  () => location.reload(),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
