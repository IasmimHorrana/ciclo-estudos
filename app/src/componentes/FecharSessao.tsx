import { useState } from 'react'
import { CamposQuestoes } from '@/componentes/CamposQuestoes'
import { EscolherAssunto } from '@/componentes/EscolherAssunto'
import { SelecaoMateria } from '@/componentes/IniciarLivre'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { criarAssunto } from '@/dados/edital'
import type { Semana } from '@/dados/esquemas'
import { registrarEstudoManual } from '@/dados/manual'
import { useAssuntosDe } from '@/dados/useAssuntosDe'
import { passoAutomatico } from '@/dominio/ciclo'
import { fmtData, hoje, type DataISO } from '@/dominio/datas'
import { TIPOS_ESTUDO } from '@/dominio/desempenho'

const NOVO = '__novo'
const rotulo = 'flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase'

export type FimDaSessao = 'salvo' | 'descartado'

export interface SessaoAberta {
  materia: string
  tipo: string
  assuntoId: string | null
  minutos: number
  data: DataISO
}

/**
 * "Fechar sessão" do cronômetro livre: confere o tempo, a matéria e o assunto, e lança as questões feitas e os acertos.
 * `passos` só vem no modo ciclo, para somar o tempo também a um passo da semana.
 */
export function FecharSessao({ inicial, doDia, outras, passos, fechar }: {
  inicial: SessaoAberta
  doDia: string[]
  outras: string[]
  passos: Semana['passos']
  fechar: (r: FimDaSessao | null) => void
}) {
  const [materia, setMateria] = useState(inicial.materia)
  const [tipo, setTipo] = useState(inicial.tipo)
  const [assuntoId, setAssuntoId] = useState(inicial.assuntoId ?? '')
  const [nomeNovo, setNomeNovo] = useState('')
  const [minutos, setMinutos] = useState(String(inicial.minutos))
  const [feitas, setFeitas] = useState('')
  const [acertos, setAcertos] = useState('')
  const [passoEscolhido, setPasso] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const assuntos = useAssuntosDe(materia)
  const h = hoje()

  const passosDaMateria = passos.filter((p) => p.materia === materia)
  const passoId = passoEscolhido ?? passoAutomatico(passos, materia, h)?.id ?? 0

  async function salvar() {
    setGravando(true)
    try {
      let id = assuntoId && assuntoId !== NOVO ? assuntoId : null
      if (assuntoId === NOVO && nomeNovo.trim()) id = await criarAssunto(db, materia, nomeNovo)
      const e = await registrarEstudoManual(db, {
        data: inicial.data, materia, tipo, minutos: Math.round(Number(minutos) || 0), feitas: Number(feitas) || 0, acertos: Number(acertos) || 0,
        assuntoId: id, passoId: passoId || null,
      })
      if (e) return setErro(e)
      fechar('salvo')
    } finally {
      setGravando(false)
    }
  }

  return (
    <>
      {inicial.data !== h && <p className="mt-0 mb-2 text-sm">Estudo do dia <b>{fmtData(inicial.data)}</b>.</p>}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className={rotulo}>
            Matéria
            <SelecaoMateria doDia={doDia} outras={outras} valor={materia} aoMudar={(m) => { setMateria(m); setAssuntoId(''); setPasso(null) }} />
          </label>
          <label className={rotulo}>
            Minutos
            <Entrada type="number" min={0} max={24 * 60} inputMode="numeric" className="w-20 px-1.5 text-center" value={minutos} onChange={(e) => setMinutos(e.target.value)} />
          </label>
        </div>
        <label className={rotulo}>
          Tipo de estudo
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_ESTUDO.map((t) => <option key={t}>{t}</option>)}
          </Selecao>
        </label>
        <label className={rotulo}>
          Assunto (opcional)
          <EscolherAssunto assuntos={assuntos ?? []} valor={assuntoId} aoMudar={setAssuntoId} valorNovo={NOVO} />
        </label>
        {assuntoId === NOVO && <Entrada placeholder={`Nome do assunto de ${materia}`} value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />}
        <CamposQuestoes feitas={feitas} acertos={acertos} aoMudar={(f, a) => { setFeitas(f); setAcertos(a) }} />
        {passosDaMateria.length > 0 && (
          <label className={rotulo}>
            Somar ao passo
            <Selecao value={passoId} onChange={(e) => setPasso(Number(e.target.value))}>
              {passosDaMateria.map((p) => <option key={p.id} value={p.id}>{p.id}. {p.materia}{p.dia ? ` · ${fmtData(p.dia)}` : ''}{p.feito ? ' (feito)' : ''}</option>)}
              <option value={0}>Não somar a nenhum passo</option>
            </Selecao>
          </label>
        )}
      </div>
      {erro && <p className="mt-2 mb-0 text-xs text-erro" role="alert">{erro}</p>}
      {descartando ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm">Descartar {minutos || 0} min sem registrar?</span>
          <Button variant="outline" onClick={() => setDescartando(false)}>Não</Button>
          <Button variant="destructive" autoFocus onClick={() => fechar('descartado')}>Descartar</Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" className="mr-auto text-erro" onClick={() => setDescartando(true)}>Descartar</Button>
          <Button variant="outline" onClick={() => fechar(null)} title="Volta ao cronômetro, parado, sem registrar">Voltar</Button>
          <Button disabled={gravando} onClick={() => void salvar()}>Salvar</Button>
        </div>
      )}
    </>
  )
}
