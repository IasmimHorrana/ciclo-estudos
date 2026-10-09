import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import type { Baralho, GrupoOpcoes } from '@/dados/flashcards-tipos'
import { opcoesDoGrupo, renomearBaralho, salvarOpcoes } from '@/dados/flashcards'
import { OPCOES_BARALHO_PADRAO, type OpcoesBaralho } from '@/dominio/fila'
import { lerPassos } from '@/dominio/passos'
import { useFc } from '@/estado/flashcards'

const num = (v: string) => Number(v.replace(',', '.'))

export function OpcoesDoBaralho() {
  const baralhoId = useFc((s) => s.baralhoId)
  const dados = useLiveQuery(async () => {
    const b = baralhoId ? await db.baralhos.get(baralhoId) : undefined
    const g = b ? await db.gruposOpcoes.get(b.grupoId) : undefined
    return b && g ? { b, g } : null
  }, [baralhoId])
  if (!dados) return <p className="text-sm text-muted-foreground">Carregando…</p>
  return <Formulario key={dados.b.id} b={dados.b} g={dados.g} />
}

function valoresIniciais(g: GrupoOpcoes): Record<string, string> {
  const o = opcoesDoGrupo(g)
  return {
      novosPorDia: String(o.novosPorDia),
      revisoesPorDia: String(o.revisoesPorDia),
      passos: o.passos.join(' '),
      passosReaprender: o.passosReaprender.join(' '),
      intervaloGraduacao: String(o.intervaloGraduacao),
      intervaloFacil: String(o.intervaloFacil),
      facilidadeInicial: String(Math.round(o.facilidadeInicial * 100)),
      bonusFacil: String(Math.round(o.bonusFacil * 100)),
      intervaloDificil: String(Math.round(o.intervaloDificil * 100)),
      modificadorIntervalo: String(Math.round(o.modificadorIntervalo * 100)),
      novoIntervalo: String(Math.round(o.novoIntervalo * 100)),
      intervaloMinimo: String(o.intervaloMinimo),
      intervaloMaximo: String(o.intervaloMaximo),
      limiteSanguessuga: String(o.limiteSanguessuga),
      antecipacaoMin: String(o.antecipacaoMin),
      enterrarIrmaos: o.enterrarIrmaos ? '1' : '0',
  }
}

function Formulario({ b, g }: { b: Baralho; g: GrupoOpcoes }) {
  const ir = useFc((s) => s.ir)
  const [f, setF] = useState(() => valoresIniciais(g))
  const [nome, setNome] = useState(b.nome)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const dados = { b, g }

  async function salvar() {
    const passos = lerPassos(f.passos ?? '') ?? (f.passos?.trim() === '' ? [] : null)
    const reaprender = lerPassos(f.passosReaprender ?? '') ?? (f.passosReaprender?.trim() === '' ? [] : null)
    if (!passos || !reaprender) return setAviso({ tipo: 'erro', texto: 'Os passos precisam ser números positivos separados por espaço (ex.: 1 10).' })
    const o: OpcoesBaralho = {
      ...OPCOES_BARALHO_PADRAO,
      novosPorDia: Math.max(0, Math.floor(num(f.novosPorDia ?? ''))),
      revisoesPorDia: Math.max(0, Math.floor(num(f.revisoesPorDia ?? ''))),
      passos,
      passosReaprender: reaprender,
      intervaloGraduacao: Math.max(1, Math.floor(num(f.intervaloGraduacao ?? ''))),
      intervaloFacil: Math.max(1, Math.floor(num(f.intervaloFacil ?? ''))),
      facilidadeInicial: Math.max(1.3, num(f.facilidadeInicial ?? '') / 100),
      bonusFacil: Math.max(1, num(f.bonusFacil ?? '') / 100),
      intervaloDificil: Math.max(0.5, num(f.intervaloDificil ?? '') / 100),
      modificadorIntervalo: Math.max(0.1, num(f.modificadorIntervalo ?? '') / 100),
      novoIntervalo: Math.min(1, Math.max(0, num(f.novoIntervalo ?? '') / 100)),
      intervaloMinimo: Math.max(1, Math.floor(num(f.intervaloMinimo ?? ''))),
      intervaloMaximo: Math.max(1, Math.floor(num(f.intervaloMaximo ?? ''))),
      limiteSanguessuga: Math.max(0, Math.floor(num(f.limiteSanguessuga ?? ''))),
      antecipacaoMin: Math.max(0, num(f.antecipacaoMin ?? '')),
      enterrarIrmaos: f.enterrarIrmaos === '1',
    }
    if (Object.values(o).some((v) => typeof v === 'number' && !Number.isFinite(v))) {
      return setAviso({ tipo: 'erro', texto: 'Há um campo com valor inválido. Confira os números.' })
    }
    try {
      await salvarOpcoes(db, dados.g.id, o)
      if (nome.trim() && nome.trim() !== dados.b.nome) await renomearBaralho(db, dados.b.id, nome)
      setAviso({ tipo: 'ok', texto: 'Salvo.' })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível salvar.' })
    }
  }

  const campo = (chave: string, rotulo: string, dica?: string) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
      {rotulo}
      <Entrada value={f[chave] ?? ''} onChange={(e) => setF({ ...f, [chave]: e.target.value })} />
      {dica && <span className="text-[0.7rem] font-normal normal-case">{dica}</span>}
    </label>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => ir('baralhos')}>
          <ArrowLeft className="size-4" /> Baralhos
        </Button>
        <h1 className="m-0 text-xl font-bold">Opções: {dados.b.nome}</h1>
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Estas opções valem para todos os baralhos que usam o grupo "{dados.g.nome}" (por enquanto, todos). Mudanças valem na próxima resposta.
      </p>

      <div className="grid max-w-4xl grid-cols-3 gap-3 rounded-xl border bg-card p-4 shadow-sm max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
        <label className="col-span-full flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Nome do baralho
          <Entrada value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        {campo('novosPorDia', 'Novos por dia')}
        {campo('revisoesPorDia', 'Revisões por dia')}
        {campo('antecipacaoMin', 'Antecipação (min)', 'Cartões em aprendizado que vencem em até isso já aparecem.')}
        {campo('passos', 'Passos de aprendizado (min)', 'Ex.: 1 10')}
        {campo('intervaloGraduacao', 'Intervalo ao graduar (dias)')}
        {campo('intervaloFacil', 'Intervalo "Fácil" (dias)')}
        {campo('passosReaprender', 'Passos de reaprendizado (min)', 'Ex.: 10')}
        {campo('novoIntervalo', 'Novo intervalo após errar (%)', '0 = recomeça em 1 dia.')}
        {campo('intervaloMinimo', 'Intervalo mínimo (dias)')}
        {campo('facilidadeInicial', 'Facilidade inicial (%)')}
        {campo('bonusFacil', 'Bônus do "Fácil" (%)')}
        {campo('intervaloDificil', 'Intervalo do "Difícil" (%)')}
        {campo('modificadorIntervalo', 'Modificador de intervalo (%)')}
        {campo('intervaloMaximo', 'Intervalo máximo (dias)')}
        {campo('limiteSanguessuga', 'Limite de sanguessuga (erros)', 'Ao atingir, o cartão é suspenso e a nota ganha a tag "leech". 0 desliga.')}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.enterrarIrmaos === '1'} onChange={(e) => setF({ ...f, enterrarIrmaos: e.target.checked ? '1' : '0' })} />
          Esconder irmãos até amanhã
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => void salvar()}>Salvar</Button>
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm('Voltar todas as opções ao padrão do Anki?')) void salvarOpcoes(db, dados.g.id, OPCOES_BARALHO_PADRAO).then(() => {
              setF(valoresIniciais({ ...g, opcoes: OPCOES_BARALHO_PADRAO }))
              setAviso({ tipo: 'ok', texto: 'Opções restauradas.' })
            })
          }}
        >
          Restaurar padrão
        </Button>
        {aviso && <span className={`text-sm font-semibold ${aviso.tipo === 'ok' ? 'text-ok' : 'text-erro'}`}>{aviso.texto}</span>}
      </div>
    </div>
  )
}
