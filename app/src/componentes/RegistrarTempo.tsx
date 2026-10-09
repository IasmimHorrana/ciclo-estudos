import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/componentes/ui/button'
import { Selecao } from '@/componentes/ui/entrada'
import { registrarTempo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import type { Semana } from '@/dados/esquemas'
import { hoje } from '@/dominio/datas'

/** "Foco concluído: a qual passo somar esse tempo?" */
export function RegistrarTempo({ semana, minutos, fechar }: { semana: Semana; minutos: number; fechar: () => void }) {
  const h = hoje()
  const pendentes = semana.passos.filter((p) => !p.feito).sort((a, b) => Number(b.dia === h) - Number(a.dia === h))
  const opcoes = [...pendentes, ...semana.passos.filter((p) => p.feito)]
  const [passoId, setPassoId] = useState(opcoes[0]?.id ?? 0)
  const [tipo, setTipo] = useState('Teoria')
  const [assuntoId, setAssuntoId] = useState('')
  const [feito, setFeito] = useState(false)
  const passo = semana.passos.find((p) => p.id === passoId)
  const assuntos = useLiveQuery(
    async () => (passo ? (await db.assuntos.toArray()).filter((a) => a.excluidoEm === null && a.materia === passo.materia) : []),
    [passo?.materia],
  )

  async function somar() {
    if (passoId) await registrarTempo(db, { passoId, minutos, tipo, assuntoId: assuntoId || null, feito })
    fechar()
  }

  return (
    <>
      <p className="mt-0 mb-2 text-sm">A qual passo somar esse tempo ({minutos} min)?</p>
      <Selecao
        autoFocus
        value={passoId}
        onChange={(e) => {
          setPassoId(Number(e.target.value))
          setAssuntoId('')
        }}
      >
        {opcoes.map((p) => (
          <option key={p.id} value={p.id}>{p.id}. {p.materia}{p.feito ? ' (feito)' : ''}</option>
        ))}
        <option value={0}>Não somar a nenhum passo</option>
      </Selecao>
      <div className="mt-3 grid grid-cols-2 gap-3">
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
          <Selecao value={assuntoId} onChange={(e) => setAssuntoId(e.target.value)}>
            <option value="">— sem assunto —</option>
            {(assuntos ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </Selecao>
        </label>
      </div>
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
