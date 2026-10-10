import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import type { Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { criarAssunto } from '@/dados/edital'
import { registrarEstudoManual } from '@/dados/manual'
import { fmtH, todasMaterias } from '@/dominio/ciclo'
import { fmtData } from '@/dominio/datas'
import { TIPOS_ESTUDO } from '@/dominio/desempenho'
import { cn } from '@/lib/utils'

type SemanaAtual = NonNullable<Ciclo['semana']>

const NOVO = '__novo'
const rotulo = 'flex flex-col gap-1 text-[0.7rem] font-bold tracking-wide text-muted-foreground uppercase'

/** Registro manual: estudo feito fora do app (outro lugar, sem o Pomodoro). Tempo, matéria, assunto e, se for o caso, questões × acertos. */
export function RegistroManual({ s, config, hojeISO }: { s: SemanaAtual; config: Ciclo['config']; hojeISO: string }) {
  const materias = [...new Set([...s.passos.map((p) => p.materia), ...todasMaterias(config)])]
  const [data, setData] = useState(hojeISO)
  const [materiaEscolhida, setMateria] = useState('')
  const [tipo, setTipo] = useState<string>('Teoria')
  const [horas, setHoras] = useState('')
  const [minutos, setMinutos] = useState('')
  const [feitas, setFeitas] = useState('')
  const [acertos, setAcertos] = useState('')
  const [assuntoSel, setAssuntoSel] = useState('')
  const [nomeNovo, setNomeNovo] = useState('')
  const [passoEscolhido, setPasso] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [gravando, setGravando] = useState(false)

  const materia = materias.includes(materiaEscolhida) ? materiaEscolhida : (materias[0] ?? '')
  const assuntos = useLiveQuery(
    async () => (await db.assuntos.toArray()).filter((a) => a.excluidoEm === null && a.materia === materia).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')),
    [materia],
  )
  const passos = [...s.passos.filter((p) => p.materia === materia)].sort((a, b) => Number(a.feito) - Number(b.feito))
  const passoId = passoEscolhido ?? passos.find((p) => !p.feito)?.id ?? 0
  const totalMin = (Number(horas) || 0) * 60 + (Number(minutos) || 0)
  const questoes = tipo === 'Questões'

  async function registrar() {
    setGravando(true)
    try {
      let assuntoId: string | null = assuntoSel && assuntoSel !== NOVO ? assuntoSel : null
      if (assuntoSel === NOVO && nomeNovo.trim()) assuntoId = await criarAssunto(db, materia, nomeNovo)
      const erro = await registrarEstudoManual(db, {
        data, materia, tipo, minutos: Math.round(totalMin), feitas: questoes ? Number(feitas) || 0 : 0, acertos: questoes ? Number(acertos) || 0 : 0,
        assuntoId, passoId: totalMin >= 1 && passoId ? passoId : null,
      })
      if (erro) return setMsg({ ok: false, texto: erro })
      const partes = [totalMin >= 1 ? fmtH(Math.round(totalMin) / 60) : '', questoes && Number(feitas) ? `${acertos || 0}/${feitas} questões` : ''].filter(Boolean)
      setMsg({ ok: true, texto: `Registrado em ${materia} (${fmtData(data)}): ${partes.join(' · ')}.` })
      setHoras('')
      setMinutos('')
      setFeitas('')
      setAcertos('')
      setNomeNovo('')
      setAssuntoSel('')
      setPasso(null)
    } finally {
      setGravando(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-3.5 shadow-sm">
      <h2 className="m-0 mb-0.5 text-sm font-bold">Registrar estudo manual</h2>
      <p className="m-0 mb-2 text-xs text-muted-foreground">Para o que você estudou fora do app (outro lugar, sem o Pomodoro).</p>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>
            Dia
            <Entrada type="date" value={data} max={hojeISO} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className={rotulo}>
            Tipo
            <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_ESTUDO.map((t) => <option key={t}>{t}</option>)}
            </Selecao>
          </label>
        </div>
        <label className={rotulo}>
          Matéria
          <Selecao value={materia} onChange={(e) => { setMateria(e.target.value); setAssuntoSel(''); setPasso(null) }}>
            {materias.map((m) => <option key={m}>{m}</option>)}
          </Selecao>
        </label>
        <label className={rotulo}>
          Assunto (opcional)
          <Selecao value={assuntoSel} onChange={(e) => setAssuntoSel(e.target.value)}>
            <option value="">— sem assunto —</option>
            {(assuntos ?? []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            <option value={NOVO}>＋ Novo assunto…</option>
          </Selecao>
        </label>
        {assuntoSel === NOVO && <Entrada placeholder={`Nome do assunto de ${materia}`} value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />}
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>
            Tempo estudado
            <span className="flex items-center gap-1 text-sm font-normal tracking-normal normal-case">
              <Entrada type="number" min={0} max={24} inputMode="numeric" className="w-14 px-1.5 text-center" value={horas} onChange={(e) => setHoras(e.target.value)} aria-label="Horas" /> h
              <Entrada type="number" min={0} max={59} inputMode="numeric" className="w-14 px-1.5 text-center" value={minutos} onChange={(e) => setMinutos(e.target.value)} aria-label="Minutos" /> min
            </span>
          </label>
          {questoes && (
            <div className="grid grid-cols-2 gap-1.5">
              <label className={rotulo}>
                Feitas
                <Entrada type="number" min={0} inputMode="numeric" className="px-1.5 text-center" value={feitas} onChange={(e) => setFeitas(e.target.value)} />
              </label>
              <label className={rotulo}>
                Acertos
                <Entrada type="number" min={0} inputMode="numeric" className="px-1.5 text-center" value={acertos} onChange={(e) => setAcertos(e.target.value)} />
              </label>
            </div>
          )}
        </div>
        {totalMin >= 1 && (
          <label className={rotulo}>
            Somar ao passo
            <Selecao value={passoId} onChange={(e) => setPasso(Number(e.target.value))}>
              {passos.map((p) => <option key={p.id} value={p.id}>{p.id}. {p.materia}{p.dia ? ` · ${fmtData(p.dia)}` : ''}{p.feito ? ' (feito)' : ''}</option>)}
              <option value={0}>Não somar a nenhum passo</option>
            </Selecao>
          </label>
        )}
        <Button disabled={gravando || !materia} onClick={() => void registrar()}>Registrar</Button>
        {msg && <p className={cn('m-0 text-xs', msg.ok ? 'text-ok' : 'text-erro')} role="status">{msg.texto}</p>}
      </div>
    </section>
  )
}
