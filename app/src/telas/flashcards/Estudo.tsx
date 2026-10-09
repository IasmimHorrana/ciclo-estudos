import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Undo2 } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import {
  alternarMarca, carregarContexto, definirBandeira, desfazerResposta, enterrar, filaDe, responderCartao, suspender, type ContextoEstudo, type Desfazer,
} from '@/dados/flashcards'
import { proximoCartao } from '@/dominio/fila'
import { renderizarCartao, textoPuro } from '@/dominio/modelo'
import { previsaoDeBotoes, type Botao } from '@/dominio/sm2'
import { useFc } from '@/estado/flashcards'
import { sanitizarHtml } from '@/lib/sanitizar'
import { cn } from '@/lib/utils'

const BOTOES: { botao: Botao; nome: string; cor: string }[] = [
  { botao: 1, nome: 'Errei', cor: 'bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400' },
  { botao: 2, nome: 'Difícil', cor: 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400' },
  { botao: 3, nome: 'Bom', cor: 'bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:text-green-400' },
  { botao: 4, nome: 'Fácil', cor: 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-400' },
]

/** Tela de estudo: lê a fila, mostra o próximo cartão e guarda a pilha de "desfazer". */
export function Estudo() {
  const { baralhoId, ir } = useFc()
  const [tick, setTick] = useState(0)
  const [pilha, setPilha] = useState<Desfazer[]>([])
  const [rodada, setRodada] = useState(0) // sobe a cada resposta/desfazer: força o cartão a recomeçar na frente

  // revê a fila de vez em quando: um cartão em aprendizado pode vencer enquanto você olha a tela
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  const ctx = useLiveQuery(() => carregarContexto(db), [tick])
  const fila = ctx ? filaDe(ctx, baralhoId) : null
  const prox = fila && ctx ? proximoCartao(fila, ctx.agora) : null
  const c = fila?.contagem
  const origem = prox?.origem
  const nomeBaralho = ctx?.baralhos.find((b) => b.id === baralhoId)?.nome ?? 'Todos os baralhos'

  async function desfazer() {
    const d = pilha[pilha.length - 1]
    if (!d) return
    setPilha((p) => p.slice(0, -1))
    await desfazerResposta(db, d)
    setRodada((r) => r + 1)
  }

  const contador = (rotulo: string, n: number | undefined, cor: string, ativo: boolean) => (
    <span className={cn('font-bold tabular-nums', cor, ativo && 'underline underline-offset-4')}>
      {n ?? 0} <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
    </span>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => ir('baralhos')}>
          <ArrowLeft className="size-4" /> Baralhos
        </Button>
        <h1 className="m-0 text-base font-bold">{nomeBaralho}</h1>
        <div className="flex items-center gap-3 text-sm">
          {contador('novos', c?.novos, 'text-blue-500', origem === 'novo')}
          {contador('aprender', c?.aprendendo, 'text-red-500', origem === 'aprendendo' || origem === 'antecipado')}
          {contador('revisar', c?.revisao, 'text-green-600', origem === 'revisao')}
          <Button variant="ghost" size="icon" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled={!pilha.length} onClick={() => void desfazer()}>
            <Undo2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card shadow-sm">
        {!ctx ? (
          <p className="m-auto text-sm text-muted-foreground">Carregando…</p>
        ) : !prox ? (
          <div className="m-auto max-w-md p-6 text-center">
            <h2 className="mb-2 text-lg font-bold">Parabéns! 🎉</h2>
            <p className="mb-4 text-sm text-muted-foreground">Você terminou os cartões de hoje neste baralho. Volte amanhã (ou aumente o limite diário nas opções).</p>
            <Button onClick={() => ir('baralhos')}>Voltar aos baralhos</Button>
          </div>
        ) : (
          <CartaoEmEstudo
            key={`${prox.cartao.id}:${rodada}`}
            cartaoId={prox.cartao.id}
            ctx={ctx}
            onResponder={(d) => {
              setPilha((p) => [...p, d])
              setRodada((r) => r + 1)
            }}
            onDesfazer={() => void desfazer()}
          />
        )}
      </div>
    </div>
  )
}

/** Um cartão na tela. É recriado (key) a cada novo cartão ou resposta, então o estado volta ao começo sozinho. */
function CartaoEmEstudo({
  cartaoId, ctx, onResponder, onDesfazer,
}: { cartaoId: string; ctx: ContextoEstudo; onResponder: (d: Desfazer) => void; onDesfazer: () => void }) {
  const [mostrando, setMostrando] = useState(false)
  const [digitado, setDigitado] = useState('')
  const [aviso, setAviso] = useState('')
  const inicio = useRef(0)
  const ocupado = useRef(false)

  useEffect(() => {
    inicio.current = Date.now()
  }, [])

  const dados = useLiveQuery(async () => {
    const c = await db.cartoes.get(cartaoId)
    const nota = c && (await db.notasFc.get(c.notaId))
    const tipo = nota && (await db.tiposNota.get(nota.tipoId))
    return c && nota && tipo ? { c, nota, tipo } : null
  }, [cartaoId])

  const renderizado = dados ? renderizarCartao(dados.tipo, dados.nota.campos, dados.c.indice) : null
  const opcoes = dados ? ctx.baralhosFila.find((b) => b.id === dados.c.baralhoId)?.opcoes : undefined
  const previsao = dados && opcoes ? previsaoDeBotoes(dados.c, opcoes, ctx.agora, ctx.hoje) : []

  async function responder(botao: Botao) {
    if (!mostrando || ocupado.current) return
    ocupado.current = true
    const tempo = Math.min(Date.now() - inicio.current, 60_000) // como no Anki: no máximo 60 s por cartão
    onResponder(await responderCartao(db, cartaoId, botao, tempo))
  }

  async function acao(f: () => Promise<unknown>, msg: string) {
    const r = await f()
    setAviso(typeof r === 'string' ? r : msg)
  }

  // atalhos de teclado (os mesmos do Anki). O efeito é refeito a cada render para sempre ver o estado atual.
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      const digitando = alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA'
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return onDesfazer()
      }
      if (!dados) return
      if ((e.ctrlKey || e.metaKey) && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        return void acao(() => definirBandeira(db, cartaoId, Number(e.key)), 'Bandeira alterada.')
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Enter' || (e.key === ' ' && !digitando)) {
        e.preventDefault()
        if (!mostrando) setMostrando(true)
        else void responder(3)
        return
      }
      if (digitando) return
      if (mostrando && /^[1-4]$/.test(e.key)) return void responder(Number(e.key) as Botao)
      if (e.key === '*') void acao(async () => ((await alternarMarca(db, dados.nota.id)) ? 'Nota marcada.' : 'Marca removida.'), '')
      else if (e.key === '-') void acao(() => enterrar(db, cartaoId, 'cartao'), 'Cartão escondido até amanhã.')
      else if (e.key === '=') void acao(() => enterrar(db, cartaoId, 'nota'), 'Nota escondida até amanhã.')
      else if (e.key === '@') void acao(() => suspender(db, cartaoId, 'cartao'), 'Cartão suspenso.')
      else if (e.key === '!') void acao(() => suspender(db, cartaoId, 'nota'), 'Nota suspensa.')
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  })

  if (!renderizado || !dados) return <p className="m-auto text-sm text-muted-foreground">Carregando…</p>

  const digitar = renderizado.frente.digitar
  const acertou = digitar ? textoPuro(digitado) === textoPuro(dados.nota.campos[digitar] ?? '') : false

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-auto p-6">
        <div
          className="cartao-conteudo w-full max-w-3xl"
          dangerouslySetInnerHTML={{ __html: sanitizarHtml(mostrando ? renderizado.verso.html : renderizado.frente.html) }}
        />
        {digitar && (
          <Entrada
            autoFocus
            className="max-w-md text-center"
            placeholder="Digite a resposta"
            value={digitado}
            disabled={mostrando}
            onChange={(e) => setDigitado(e.target.value)}
          />
        )}
        {mostrando && digitar && (
          <p className="m-0 text-sm text-muted-foreground">{acertou ? '✅ Você acertou a digitação.' : `✗ Você digitou: ${digitado || '(nada)'}`}</p>
        )}
      </div>
      {aviso && <p className="m-0 px-4 pb-1 text-center text-xs text-muted-foreground">{aviso}</p>}
      <div className="border-t p-3">
        {!mostrando ? (
          <Button className="w-full" size="lg" onClick={() => setMostrando(true)}>
            Mostrar resposta <span className="ml-2 text-xs opacity-70">(espaço)</span>
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-[600px]:grid-cols-2">
            {BOTOES.map(({ botao, nome, cor }) => (
              <button
                key={botao}
                onClick={() => void responder(botao)}
                className={cn('flex cursor-pointer flex-col items-center rounded-lg px-2 py-2 text-sm font-bold transition-colors', cor)}
              >
                <span className="text-xs font-semibold opacity-80">{previsao.find((p) => p.botao === botao)?.texto}</span>
                {nome} <span className="text-[0.65rem] font-normal opacity-60">({botao})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
