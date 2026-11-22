import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, EyeOff, Pause, Pencil, Star, Undo2 } from 'lucide-react'
import { Menu } from '@/componentes/Menu'
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
import { EditarNota } from '@/telas/flashcards/EditarNota'

/** "Bom" vem cheio: é o que Enter/espaço escolhe. */
const BOTOES: { botao: Botao; nome: string; cor: string }[] = [
  { botao: 1, nome: 'Errei', cor: 'border bg-card text-erro hover:bg-erro-bg' },
  { botao: 2, nome: 'Difícil', cor: 'border bg-card text-aviso hover:bg-aviso-bg' },
  { botao: 3, nome: 'Bom', cor: 'border border-ok bg-ok text-white shadow-[0_8px_20px_color-mix(in_oklab,var(--ok)_30%,transparent)] hover:brightness-110' },
  { botao: 4, nome: 'Fácil', cor: 'border bg-card text-primary hover:bg-accent' },
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
  const partesNome = nomeBaralho.split('::')

  async function desfazer() {
    const d = pilha[pilha.length - 1]
    if (!d) return
    setPilha((p) => p.slice(0, -1))
    await desfazerResposta(db, d)
    setRodada((r) => r + 1)
  }

  const contador = (rotulo: string, n: number | undefined, cor: string, ativo: boolean) => (
    <span className={cn('flex items-center gap-1.5 text-[0.8rem] font-semibold tabular-nums', cor, ativo && 'underline underline-offset-4')}>
      <i className="size-2 rounded-full bg-current" />
      {n ?? 0} <span className="max-[900px]:hidden">{rotulo}</span>
    </span>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="-mx-5 -mt-4 flex min-h-14 flex-wrap items-center gap-2 border-b px-5 py-2.5 max-[900px]:-mx-3 max-[900px]:-mt-3 max-[900px]:px-3 justify-between max-[900px]:flex-nowrap">
        <Button variant="outline" size="sm" className="max-[900px]:size-9 max-[900px]:px-0" onClick={() => ir('baralhos')} aria-label="Voltar aos baralhos">
          <ArrowLeft className="size-4" /> <span className="max-[900px]:hidden">Baralhos</span>
        </Button>
        <h1 className="m-0 text-base font-bold max-[900px]:min-w-0 max-[900px]:flex-1 max-[900px]:truncate" title={partesNome.join(' › ')}>
          <span className="max-[900px]:hidden">{partesNome.join(' › ')}</span>
          <span className="min-[901px]:hidden">{partesNome[partesNome.length - 1]}</span>
        </h1>
        <div className="flex shrink-0 items-center gap-3 text-sm max-[900px]:gap-2">
          {contador('novos', c?.novos, 'text-primary', origem === 'novo')}
          {contador('aprender', c?.aprendendo, 'text-erro', origem === 'aprendendo' || origem === 'antecipado')}
          {contador('revisar', c?.revisao, 'text-ok', origem === 'revisao')}
          <Button variant="ghost" size="icon" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled={!pilha.length} onClick={() => void desfazer()}>
            <Undo2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-[radial-gradient(ellipse_at_50%_38%,var(--accent),transparent_68%)]">
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
  const [editando, setEditando] = useState(false)
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
      if (editando) return // no editor, as teclas são do formulário (Enter, Ctrl+Z, espaço…)
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
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        setEditando(true)
      } else if (e.key === '*') void acao(async () => ((await alternarMarca(db, dados.nota.id)) ? 'Nota marcada.' : 'Marca removida.'), '')
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

  if (editando) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
        <EditarNota
          notaId={dados.nota.id}
          aoFechar={() => {
            setEditando(false)
            setAviso('')
          }}
        />
      </div>
    )
  }

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-auto p-6 max-[900px]:justify-start max-[900px]:p-4 max-[900px]:pb-8">
        <div className="absolute top-2 right-2 flex items-center gap-1 text-muted-foreground max-[900px]:static max-[900px]:-mt-3 max-[900px]:-mr-3 max-[900px]:self-end">
          <Button variant="ghost" size="sm" className="pointer-coarse:h-10" title="Editar este cartão (E)" onClick={() => setEditando(true)}>
            <Pencil className="size-4" /> Editar <span className="text-xs opacity-60 pointer-coarse:hidden">(E)</span>
          </Button>
          <Menu
            rotulo="Mais ações do cartão"
            itens={[
              { rotulo: 'Marcar ou desmarcar a nota (*)', icone: <Star className="size-4" />, acao: () => void acao(async () => ((await alternarMarca(db, dados.nota.id)) ? 'Nota marcada.' : 'Marca removida.'), '') },
              { rotulo: 'Esconder o cartão até amanhã (-)', icone: <EyeOff className="size-4" />, acao: () => void acao(() => enterrar(db, cartaoId, 'cartao'), 'Cartão escondido até amanhã.') },
              { rotulo: 'Esconder a nota até amanhã (=)', icone: <EyeOff className="size-4" />, acao: () => void acao(() => enterrar(db, cartaoId, 'nota'), 'Nota escondida até amanhã.') },
              { rotulo: 'Suspender o cartão (@)', icone: <Pause className="size-4" />, acao: () => void acao(() => suspender(db, cartaoId, 'cartao'), 'Cartão suspenso.') },
              { rotulo: 'Suspender a nota (!)', icone: <Pause className="size-4" />, acao: () => void acao(() => suspender(db, cartaoId, 'nota'), 'Nota suspensa.') },
            ]}
          />
        </div>
        <div
          className="cartao-conteudo w-full max-w-3xl rounded-[22px] border bg-card px-10 py-9 shadow-[0_24px_60px_color-mix(in_oklab,var(--primary)_14%,transparent)] max-[900px]:px-4 max-[900px]:py-6"
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
      {/* no celular a página rola: os botões ficam presos embaixo da tela, ao alcance do polegar */}
      {/* no celular fica logo acima da barra do relógio */}
      <div className="mx-auto w-full max-w-xl p-3 pb-5 max-[900px]:sticky max-[900px]:bottom-[calc(3.6rem+env(safe-area-inset-bottom))] max-[900px]:max-w-none max-[900px]:bg-card max-[900px]:pb-3">
        {!mostrando ? (
          <Button className="w-full" size="lg" variant="destaque" onClick={() => setMostrando(true)}>
            Mostrar resposta <span className="ml-2 text-xs opacity-70 pointer-coarse:hidden">(espaço)</span>
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2 max-[900px]:gap-1.5">
            {BOTOES.map(({ botao, nome, cor }) => (
              <button
                key={botao}
                onClick={() => void responder(botao)}
                className={cn('flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-sm font-bold transition-colors', cor)}
              >
                <span>
                  {nome} <span className="text-[0.65rem] font-normal opacity-60 pointer-coarse:hidden">({botao})</span>
                </span>
                <span className="font-mono text-[0.7rem] font-medium opacity-75">{previsao.find((p) => p.botao === botao)?.texto}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
