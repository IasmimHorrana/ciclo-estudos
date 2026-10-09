import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { carregarCiclo } from '@/dados/ciclo'
import { carregarEstudo, registrarQuestoes } from '@/dados/desempenho'
import { db } from '@/dados/db'
import { todasMaterias } from '@/dominio/ciclo'
import { hoje } from '@/dominio/datas'

export interface PreenchimentoQuestoes {
  materia?: string
  assuntoId?: string
}

/** "Registrar questões" (data, matéria, assunto, feitas e acertos). */
export function FormularioQuestoes({ inicial, fechar }: { inicial: PreenchimentoQuestoes; fechar: () => void }) {
  const h = hoje()
  const dados = useLiveQuery(async () => ({ ciclo: await carregarCiclo(db), estudo: await carregarEstudo(db) }), [])
  const [data, setData] = useState(h)
  const [materia, setMateria] = useState(inicial.materia ?? '')
  const [assuntoId, setAssuntoId] = useState(inicial.assuntoId ?? '')
  const [novo, setNovo] = useState('')
  const [feitas, setFeitas] = useState('')
  const [acertos, setAcertos] = useState('')
  const [erro, setErro] = useState('')
  if (!dados) return null

  const mats = [...new Set([...todasMaterias(dados.ciclo.config), ...dados.estudo.assuntos.map((a) => a.materia)])]
  const hojeDoCiclo = dados.ciclo.semana?.passos.find((p) => p.dia === h)
  const mat = materia || hojeDoCiclo?.materia || mats[0] || ''
  const assuntos = dados.estudo.assuntos.filter((a) => a.materia === mat)

  async function salvar() {
    const e = await registrarQuestoes(db, { data, materia: mat, assuntoId, novo, feitas: feitas.trim() === '' ? Number.NaN : Number(feitas), acertos: acertos.trim() === '' ? Number.NaN : Number(acertos) })
    if (e) return setErro(e)
    fechar()
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Data
          <Entrada type="date" value={data} max={h} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Matéria
          <Selecao value={mat} onChange={(e) => { setMateria(e.target.value); setAssuntoId('') }}>
            {mats.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Selecao>
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Assunto
        <Selecao value={assuntoId} onChange={(e) => setAssuntoId(e.target.value)}>
          <option value="">— sem assunto —</option>
          {assuntos.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </Selecao>
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        …ou criar um assunto novo
        <Entrada placeholder="Ex.: Prescrição" value={novo} onChange={(e) => setNovo(e.target.value)} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Questões feitas
          <Entrada type="number" min={1} step={1} value={feitas} onChange={(e) => setFeitas(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Acertos
          <Entrada type="number" min={0} step={1} value={acertos} onChange={(e) => setAcertos(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void salvar()} />
        </label>
      </div>
      {erro && <p className="mt-3 mb-0 text-sm font-semibold text-erro">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={fechar}>Cancelar</Button>
        <Button onClick={() => void salvar()}>Salvar</Button>
      </div>
    </>
  )
}
