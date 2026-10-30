import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CamposQuestoes } from '@/componentes/CamposQuestoes'
import { EscolherAssunto } from '@/componentes/EscolherAssunto'
import { Button } from '@/componentes/ui/button'
import { Selecao } from '@/componentes/ui/entrada'
import { registrarTempo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { registrarQuestoes } from '@/dados/desempenho'
import type { Semana } from '@/dados/esquemas'
import { agruparPassosParaEstudo, rotuloDoPasso } from '@/dominio/ciclo'
import { fmtData, hoje, type DataISO } from '@/dominio/datas'
import { validarQuestoes } from '@/dominio/desempenho'

/** "Foco concluído: a qual passo somar esse tempo?" */
export function RegistrarTempo({ semana, minutos, data, fechar }: { semana: Semana; minutos: number; data?: DataISO; fechar: () => void }) {
  const h = hoje()
  const grupos = agruparPassosParaEstudo(semana.passos, h)
  const opcoes = grupos.flatMap((g) => g.passos)
  const [passoId, setPassoId] = useState(opcoes[0]?.id ?? 0)
  const [tipo, setTipo] = useState('Teoria')
  const [assuntoId, setAssuntoId] = useState('')
  const [feito, setFeito] = useState(false)
  const [feitas, setFeitas] = useState('')
  const [acertos, setAcertos] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const passo = semana.passos.find((p) => p.id === passoId)
  const assuntos = useLiveQuery(
    async () => (passo ? (await db.assuntos.toArray()).filter((a) => a.excluidoEm === null && a.materia === passo.materia) : []),
    [passo?.materia],
  )

  async function somar() {
    // questões (opcionais): vão para a matéria do passo, no mesmo dia do foco
    const q = passo && Number(feitas) > 0 ? { data: data ?? h, materia: passo.materia, assuntoId, novo: '', feitas: Number(feitas), acertos: Number(acertos) || 0 } : null
    const e = q && validarQuestoes(q, h)
    if (e) return setErro(e)
    if (passoId) await registrarTempo(db, { passoId, minutos, tipo, assuntoId: assuntoId || null, feito, data })
    if (q) await registrarQuestoes(db, q)
    fechar()
  }

  return (
    <>
      <p className="mt-0 mb-2 text-sm">A qual passo somar esse tempo ({minutos} min{data && data !== h ? <>, estudados em <b>{fmtData(data)}</b></> : null})?</p>
      <Selecao
        autoFocus
        value={passoId}
        onChange={(e) => {
          setPassoId(Number(e.target.value))
          setAssuntoId('')
        }}
      >
        {grupos.map((g) => (
          <optgroup key={g.rotulo} label={g.rotulo}>
            {g.passos.map((p) => (
              <option key={p.id} value={p.id}>{rotuloDoPasso(p)}</option>
            ))}
          </optgroup>
        ))}
        <option value={0}>Não somar a nenhum passo</option>
      </Selecao>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Tipo de estudo
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option>Teoria</option>
            <option>Questões</option>
            <option>Revisão</option>
          </Selecao>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Assunto (opcional)
          <EscolherAssunto assuntos={assuntos ?? []} valor={assuntoId} aoMudar={setAssuntoId} />
        </label>
      </div>
      {passo && (
        <div className="mt-3">
          <CamposQuestoes feitas={feitas} acertos={acertos} aoMudar={(f, a) => { setFeitas(f); setAcertos(a) }} />
        </div>
      )}
      {erro && <p className="mt-2 mb-0 text-xs text-erro" role="alert">{erro}</p>}
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={feito} onChange={(e) => setFeito(e.target.checked)} /> Marcar o passo como concluído
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={fechar}>Pular</Button>
        <Button onClick={() => void somar()}>Somar</Button>
      </div>
    </>
  )
}
