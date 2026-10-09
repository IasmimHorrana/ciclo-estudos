import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/componentes/ui/button'
import { Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import type { Semana } from '@/dados/esquemas'
import { hoje } from '@/dominio/datas'
import { sugerirAssunto } from '@/dominio/edital'
import type { AlvoFoco } from '@/estado/pomodoro'

const TIPOS = ['Teoria', 'Questões', 'Revisão']

/** "O que você vai estudar?": escolhe passo, tipo e assunto antes de começar o foco. */
export function IniciarFoco({ semana, inicial, fechar }: { semana: Semana; inicial: AlvoFoco | null; fechar: (a: AlvoFoco | null) => void }) {
  const h = hoje()
  const pendentes = semana.passos.filter((p) => !p.feito).sort((a, b) => Number(b.dia === h) - Number(a.dia === h))
  const opcoes = [...pendentes, ...semana.passos.filter((p) => p.feito)]
  const anterior = inicial && opcoes.some((p) => p.id === inicial.passoId) ? inicial : null
  const [passoId, setPassoId] = useState(anterior?.passoId ?? opcoes[0]?.id ?? 0)
  const [tipo, setTipo] = useState(anterior?.tipo ?? 'Teoria')
  // null = ainda não mexeu: vale a sugestão (assunto citado na anotação do passo, ou o da última vez)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const passo = semana.passos.find((p) => p.id === passoId)
  const assuntos = useLiveQuery(
    async () => (passo ? (await db.assuntos.toArray()).filter((a) => a.excluidoEm === null && a.materia === passo.materia).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')) : []),
    [passo?.materia],
  )
  const doAnterior = anterior && anterior.passoId === passoId ? anterior.assuntoId : null
  const sugerido = passo && assuntos ? (sugerirAssunto(passo.nota, assuntos) ?? (doAnterior && assuntos.some((a) => a.id === doAnterior) ? doAnterior : null)) : null
  const assuntoId = escolhido ?? sugerido ?? ''

  function comecar() {
    if (!passo) return fechar({ passoId: 0, tipo, assuntoId: null, rotulo: 'Sem registro' })
    const nome = assuntos?.find((a) => a.id === assuntoId)?.nome
    fechar({ passoId, tipo, assuntoId: assuntoId || null, rotulo: `${passo.id}. ${passo.materia}${nome ? ` · ${nome}` : ''} · ${tipo}` })
  }

  return (
    <>
      <p className="mt-0 mb-2 text-sm">O tempo deste foco será somado ao passo escolhido quando terminar.</p>
      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Passo
        <Selecao
          autoFocus
          value={passoId}
          onChange={(e) => {
            setPassoId(Number(e.target.value))
            setEscolhido(null)
          }}
        >
          {opcoes.map((p) => (
            <option key={p.id} value={p.id}>{p.id}. {p.materia}{p.nota ? ` — ${p.nota}` : ''}{p.feito ? ' (feito)' : ''}</option>
          ))}
          <option value={0}>Estudar sem registrar</option>
        </Selecao>
      </label>
      {passo && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
            Tipo de estudo
            <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </Selecao>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
            Assunto (opcional)
            <Selecao value={assuntoId} onChange={(e) => setEscolhido(e.target.value)}>
              <option value="">— sem assunto —</option>
              {(assuntos ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </Selecao>
          </label>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => fechar(null)}>Cancelar</Button>
        <Button onClick={comecar}>Começar</Button>
      </div>
    </>
  )
}
