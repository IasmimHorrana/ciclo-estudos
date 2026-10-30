import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, ChevronDown, ChevronRight, FolderPlus, Plus, Settings, Trash2, Upload, X } from 'lucide-react'
import { avisar } from '@/componentes/dialogos-api'
import { useFaixas } from '@/componentes/faixas-contexto'
import { COR_NIVEL } from '@/componentes/nivel-cores'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'
import { importarArquivoApkg } from '@/dados/apkg-navegador'
import { db } from '@/dados/db'
import { acertosPorBaralho, carregarContexto, criarBaralho, excluirBaralho, filaDe } from '@/dados/flashcards'
import { linhasDaArvore, nomesComFilhos } from '@/dominio/arvore'
import { NOMES_NIVEL, pctDe, type Nivel } from '@/dominio/desempenho'
import { acertosNaArvore, nivelFc } from '@/dominio/estatisticasFc'
import { dentroDe } from '@/dominio/fila'
import { useFc, useFcArvore } from '@/estado/flashcards'
import { CalendarioCalor } from '@/telas/flashcards/CalendarioCalor'

export function Baralhos() {
  const ir = useFc((s) => s.ir)
  const [tick, setTick] = useState(0)
  // caixa de criação: `pai` é o baralho onde o novo entra como subbaralho (null = baralho solto)
  const [novo, setNovo] = useState<{ pai: string | null; nome: string } | null>(null)
  const [erro, setErro] = useState('')
  const [criado, setCriado] = useState('')
  const campoNovo = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)
  const entradaApkg = useRef<HTMLInputElement>(null)
  // recalcula de vez em quando: cartões em aprendizado vencem com o passar dos minutos
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const ctx = useLiveQuery(() => carregarContexto(db), [tick])
  // acertos dos últimos 30 dias por baralho (o pai soma os subbaralhos)
  const acertos = useLiveQuery(async () => (ctx ? acertosNaArvore(ctx.baralhos, await acertosPorBaralho(db, ctx.hoje - 29)) : null), [ctx])
  const faixas = useFaixas()
  const recolhidos = useFcArvore((s) => s.recolhidos)
  const alternarRecolhido = useFcArvore((s) => s.alternar)
  const definirRecolhidos = useFcArvore((s) => s.definir)

  if (!ctx) return <p className="text-sm text-muted-foreground">Carregando…</p>
  const linhas = linhasDaArvore(ctx.baralhos, new Set(recolhidos)).map((l) => ({
    b: l.item,
    nivel: l.nivel,
    rotulo: l.rotulo,
    temFilhos: l.temFilhos,
    c: filaDe(ctx, l.item.id).contagem,
    a: acertos?.get(l.item.id) ?? { respostas: 0, acertos: 0 },
  }))
  const comFilhos = nomesComFilhos(ctx.baralhos.map((b) => b.nome))

  function abrirCaixa(pai: string | null) {
    setNovo({ pai, nome: '' })
    setErro('')
    setCriado('')
    campoNovo.current?.focus()
  }

  // cria e deixa a caixa aberta no mesmo lugar, para digitar o próximo assunto em seguida
  async function criar() {
    if (!novo) return
    const { pai, nome } = novo
    setNovo({ pai, nome: '' }) // limpa já, para o que for digitado em seguida não grudar neste nome
    try {
      await criarBaralho(db, pai && nome.trim() ? `${pai}::${nome}` : nome)
      if (pai) definirRecolhidos(recolhidos.filter((r) => !dentroDe(pai, r)))
      setErro('')
      setCriado(nome.trim())
    } catch (e) {
      setNovo((n) => (n && !n.nome ? { ...n, nome } : n)) // devolve o nome para corrigir
      setErro(e instanceof Error ? e.message : 'Não foi possível criar.')
      setCriado('')
    }
    campoNovo.current?.focus()
  }

  async function importarApkg(arquivo: File) {
    setImportando(true)
    try {
      const r = await importarArquivoApkg(db, arquivo)
      setImportando(false)
      const extras = [
        r.puladas ? `${r.puladas} nota(s) sem frente foram puladas.` : '',
        r.imagensFaltando ? `${r.imagensFaltando} imagem(ns) não vieram no pacote.` : '',
        r.sonsIgnorados ? `${r.sonsIgnorados} som(ns) foram ignorados (o app ainda não toca áudio).` : '',
      ].filter(Boolean)
      await avisar(
        'Importar do Anki',
        `${r.cartoes} cartões em ${r.notas} notas (${r.baralhos} baralhos novos, ${r.imagens} imagens). Todos entram como novos, sem o histórico do Anki. ${extras.join(' ')}`.trim(),
      )
    } catch (e) {
      setImportando(false)
      await avisar('Importar do Anki', e instanceof Error ? e.message : 'Não foi possível importar.')
    }
  }

  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir o baralho "${nome}", os subbaralhos e TODOS os cartões dentro dele?`)) return
    await excluirBaralho(db, id)
  }

  const num = (n: number, cor: string) => <span className={n ? cor : 'text-muted-foreground/50'}>{n}</span>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-xl font-bold">Flashcards</h1>
        <div className="flex gap-2">
          {comFilhos.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => definirRecolhidos(recolhidos.length >= comFilhos.length ? [] : comFilhos)} title="Fechar ou abrir todos os baralhos que têm subbaralhos">
              {recolhidos.length >= comFilhos.length ? 'Abrir tudo' : 'Recolher tudo'}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={importando} onClick={() => entradaApkg.current?.click()} title="Importa um baralho pronto do Anki (.apkg)">
            <Upload className="size-4" /> {importando ? 'Importando…' : 'Importar do Anki'}
          </Button>
          <input
            ref={entradaApkg}
            type="file"
            accept=".apkg"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void importarApkg(f)
            }}
          />
          <Button variant="outline" size="sm" onClick={() => (novo !== null && novo.pai === null ? setNovo(null) : abrirCaixa(null))}>
            <Plus className="size-4" /> Baralho
          </Button>
          <Button variant="outline" size="sm" disabled={linhas.length === 0} onClick={() => ir('estatisticas', null)} title="Acertos e evolução de todos os baralhos juntos">
            <BarChart3 className="size-4" /> Estatísticas
          </Button>
          <Button size="sm" onClick={() => ir('adicionar', null)}>
            <Plus className="size-4" /> Adicionar cartões
          </Button>
        </div>
      </div>

      {novo !== null && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          {novo.pai !== null && (
            <span className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-sm">
              Dentro de <strong>{novo.pai.split('::').join(' › ')}</strong>
              <button
                className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-background"
                title="Criar um baralho solto, fora deste"
                aria-label="Criar um baralho solto, fora deste"
                onClick={() => abrirCaixa(null)}
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}
          <Entrada
            ref={campoNovo}
            autoFocus
            className="max-w-sm"
            placeholder={novo.pai !== null ? 'Nome do subbaralho (ex.: Lei 8.112/1990)' : 'Nome do baralho (ex.: Administração Pública)'}
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void criar()
              if (e.key === 'Escape') setNovo(null)
            }}
          />
          <Button size="sm" onClick={() => void criar()}>
            Criar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setNovo(null)}>
            Fechar
          </Button>
          {erro && <span className="text-sm text-erro">{erro}</span>}
          {!erro && criado && <span className="text-sm text-muted-foreground">Criado: {criado}. Digite o próximo ou feche.</span>}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card shadow-sm">
        {linhas.length === 0 ? (
          <p className="m-0 p-6 text-center text-sm text-muted-foreground">
            Nenhum baralho ainda. Crie um no botão "Baralho" (ex.: Administração Pública) e depois use o botão de pasta com + na linha dele para criar os subbaralhos dentro (uma lei ou um assunto em cada). Também dá para importar do Anki.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground uppercase">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-bold">Baralho</th>
                <th className="w-20 px-2 py-2 text-right font-bold">Novos</th>
                <th className="w-20 px-2 py-2 text-right font-bold">Aprender</th>
                <th className="w-20 px-2 py-2 text-right font-bold">Revisar</th>
                <th className="w-24 px-2 py-2 text-right font-bold" title="Acertos nos últimos 30 dias (tudo menos Errei), com os subbaralhos">Acertos</th>
                <th className="w-40 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ b, nivel, rotulo, temFilhos, c, a }) => (
                <tr key={b.id} className="border-b last:border-b-0 hover:bg-accent/40">
                  <td className="px-3 py-1.5" style={{ paddingLeft: `${0.75 + nivel * 1.5}rem` }}>
                    <span className="flex items-center gap-1">
                      {temFilhos ? (
                        <button
                          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent"
                          onClick={() => alternarRecolhido(b.nome)}
                          aria-expanded={!recolhidos.includes(b.nome)}
                          aria-label={recolhidos.includes(b.nome) ? `Abrir ${rotulo}` : `Recolher ${rotulo}`}
                          title={recolhidos.includes(b.nome) ? 'Mostrar os subbaralhos' : 'Esconder os subbaralhos'}
                        >
                          {recolhidos.includes(b.nome) ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      ) : (
                        <span className="inline-block size-5 shrink-0" />
                      )}
                      <button className="cursor-pointer text-left font-semibold hover:underline" onClick={() => ir('estudo', b.id)}>
                        {rotulo}
                      </button>
                    </span>
                  </td>
                  <td className="px-2 text-right font-bold tabular-nums">{num(c.novos, 'text-blue-500')}</td>
                  <td className="px-2 text-right font-bold tabular-nums">{num(c.aprendendo, 'text-red-500')}</td>
                  <td className="px-2 text-right font-bold tabular-nums">{num(c.revisao, 'text-green-600')}</td>
                  <td className="px-2 text-right tabular-nums">
                    <SeloAcertos respostas={a.respostas} acertos={a.acertos} nivel={nivelFc(a, faixas)} />
                  </td>
                  <td className="px-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" title="Novo subbaralho dentro deste" aria-label={`Novo subbaralho dentro de ${b.nome}`} onClick={() => abrirCaixa(b.nome)}>
                      <FolderPlus className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Estatísticas do baralho" aria-label={`Estatísticas de ${b.nome}`} onClick={() => ir('estatisticas', b.id)}>
                      <BarChart3 className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Opções do baralho" aria-label={`Opções de ${b.nome}`} onClick={() => ir('opcoes', b.id)}>
                      <Settings className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Excluir baralho" aria-label={`Excluir ${b.nome}`} onClick={() => void excluir(b.id, b.nome)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <CalendarioCalor />

      <p className="m-0 text-xs text-muted-foreground">
        Clique no nome do baralho para estudar. Azul = novos, vermelho = em aprendizado, verde = revisões de hoje. Acertos = % dos últimos 30 dias (tudo menos "Errei"), com a cor do nível; "—" enquanto há menos de 10 respostas. O gráfico na linha abre as estatísticas. Os números de um baralho incluem os subbaralhos.
      </p>
    </div>
  )
}

/** % de acertos com a bolinha do nível; "—" com poucos dados. */
function SeloAcertos({ respostas, acertos, nivel }: { respostas: number; acertos: number; nivel: Nivel }) {
  if (nivel === 'na') {
    const dica = respostas ? `Poucos dados: ${acertos} de ${respostas} respostas certas nos últimos 30 dias` : 'Sem respostas nos últimos 30 dias'
    return <span className="text-muted-foreground/60" title={dica}>—</span>
  }
  return (
    <span className="inline-flex items-center justify-end gap-1.5 font-bold" title={`${NOMES_NIVEL[nivel]}: ${acertos} de ${respostas} respostas certas nos últimos 30 dias`}>
      <i className="inline-block size-2 rounded-full" style={{ background: COR_NIVEL[nivel] }} />
      {pctDe(acertos, respostas)}%
    </span>
  )
}
