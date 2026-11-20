import { liveQuery } from 'dexie'
import { perguntarPrimeiraSincronia } from '@/componentes/perguntar-primeira-sincronia'
import { aparelhoAtual } from '@/dados/aparelho'
import { carregarFlashcards } from '@/dados/backup-flashcards'
import { clienteNuvem } from '@/dados/conta'
import { lerArquivo, paraArquivo } from '@/dados/converter'
import { db } from '@/dados/db'
import { carregarDados } from '@/dados/repositorio'
import { ErroNuvem, servidorSupabase } from '@/dados/servidor-supabase'
import { contarPendentes, sincronizarAgora } from '@/dados/sincronizar'
import { hoje } from '@/dominio/datas'
import { useConta } from '@/estado/conta'
import { useSincronia } from '@/estado/sincronia'
import { baixar } from '@/lib/baixar'

/**
 * Quando sincronizar (com a conta conectada): ao abrir, quando a internet volta, 5 s depois de uma mudança,
 * a cada 2 min com o app aberto e ao minimizar/voltar ao app. Nada disso trava a tela.
 */
const ESPERA_MUDANCA_MS = 5_000
const INTERVALO_MS = 120_000

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

/** Antes da primeira sincronização de um aparelho com dados: baixa um backup .json completo. */
async function baixarBackupAntes(): Promise<void> {
  const f = await carregarFlashcards(db)
  const dados = (await carregarDados(db)) ?? lerArquivo(JSON.stringify({ config: {}, fechadas: [] })) // só flashcards: ciclo vazio
  baixar(`ciclo-estudos-antes-da-sincronizacao-${hoje()}.json`, JSON.stringify(paraArquivo(dados, Date.now(), f), null, 2))
}

/** Uma rodada. `manual` = ela clicou em "Sincronizar agora" (tenta mesmo se estava esperando a escolha da primeira vez). */
async function executar(manual = false): Promise<void> {
  const { estado, usuarioId } = useConta.getState()
  if (estado !== 'dentro' || !usuarioId) return
  const atual = useSincronia.getState().estado
  if (atual === 'aguardando' && !manual) return
  if (!online()) {
    useSincronia.setState({ estado: 'offline', erro: '' })
    return
  }
  useSincronia.setState({ estado: 'sincronizando', erro: '' })
  try {
    const sb = await clienteNuvem()
    const aparelho = await aparelhoAtual(db)
    const r = await sincronizarAgora(db, servidorSupabase(sb, usuarioId), {
      usuarioId,
      aparelho,
      antesDaPrimeira: baixarBackupAntes,
      perguntar: perguntarPrimeiraSincronia,
    })
    if (useConta.getState().usuarioId !== usuarioId) return // saiu da conta no meio
    if (r.tipo === 'ok') useSincronia.setState({ estado: 'ok', ultima: Date.now(), erro: '' })
    else if (r.tipo === 'cancelado') useSincronia.setState({ estado: 'aguardando', erro: '' })
    else useSincronia.setState({ estado: 'atualize', erro: 'A nuvem pede uma versão mais nova do app. Feche e abra o app para atualizar.' })
  } catch (e) {
    useSincronia.setState({
      estado: online() ? 'erro' : 'offline',
      erro: e instanceof ErroNuvem ? e.message : 'Não foi possível sincronizar agora. O app tenta de novo sozinho.',
    })
    if (!(e instanceof ErroNuvem)) console.error('[sincronia]', e)
  }
}

/** Botão "Sincronizar agora". */
export const sincronizarManual = () => executar(true)

/** Liga a sincronização automática enquanto a conta estiver conectada. Devolve a função que desliga tudo. */
export function iniciarSincroniaAutomatica(): () => void {
  let ligado = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let intervalo: ReturnType<typeof setInterval> | undefined
  let subPendentes: { unsubscribe(): void } | undefined
  const rodar = () => void executar()
  const aoVoltar = () => rodar()

  function ligar() {
    if (ligado) return
    ligado = true
    rodar()
    window.addEventListener('online', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    intervalo = setInterval(rodar, INTERVALO_MS)
    subPendentes = liveQuery(() => contarPendentes(db)).subscribe({
      next: (n) => {
        useSincronia.setState({ pendentes: n })
        if (n > 0) {
          clearTimeout(timer)
          timer = setTimeout(rodar, ESPERA_MUDANCA_MS)
        }
      },
      error: () => undefined,
    })
  }

  function desligar() {
    if (!ligado) return
    ligado = false
    clearTimeout(timer)
    clearInterval(intervalo)
    subPendentes?.unsubscribe()
    window.removeEventListener('online', aoVoltar)
    document.removeEventListener('visibilitychange', aoVoltar)
    useSincronia.setState({ estado: 'desligado', erro: '' })
  }

  const aplicar = (s: { estado: string; usuarioId: string }) => (s.estado === 'dentro' && s.usuarioId ? ligar() : desligar())
  aplicar(useConta.getState())
  const pararConta = useConta.subscribe(aplicar)
  return () => {
    pararConta()
    desligar()
  }
}
