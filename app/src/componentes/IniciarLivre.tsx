import { useState } from 'react'
import { EscolherAssunto } from '@/componentes/EscolherAssunto'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { criarAssunto } from '@/dados/edital'
import { useAssuntosDe } from '@/dados/useAssuntosDe'
import type { AlvoLivre } from '@/dominio/cronometro'
import { TIPOS_ESTUDO } from '@/dominio/desempenho'

const NOVO = '__novo'

/** Lista de matérias com as do dia em cima. */
export function SelecaoMateria({ doDia, outras, valor, aoMudar, autoFocus }: { doDia: string[]; outras: string[]; valor: string; aoMudar: (m: string) => void; autoFocus?: boolean }) {
  const resto = outras.filter((m) => !doDia.includes(m))
  return (
    <Selecao autoFocus={autoFocus} value={valor} onChange={(e) => aoMudar(e.target.value)}>
      {doDia.length > 0 && (
        <optgroup label="Hoje">
          {doDia.map((m) => <option key={m} value={m}>{m}</option>)}
        </optgroup>
      )}
      <optgroup label={doDia.length ? 'Outras matérias' : 'Matérias'}>
        {resto.map((m) => <option key={m} value={m}>{m}</option>)}
      </optgroup>
    </Selecao>
  )
}

/** "O que você vai estudar?" no tempo livre: matéria (as do dia primeiro), tipo e assunto. */
export function IniciarLivre({ doDia, outras, inicial, fechar }: { doDia: string[]; outras: string[]; inicial: AlvoLivre | null; fechar: (a: AlvoLivre | null) => void }) {
  const todas = [...doDia, ...outras.filter((m) => !doDia.includes(m))]
  const [materia, setMateria] = useState(inicial && todas.includes(inicial.materia) ? inicial.materia : (todas[0] ?? ''))
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'Teoria')
  const [assuntoId, setAssuntoId] = useState(inicial && inicial.materia === materia ? (inicial.assuntoId ?? '') : '')
  const [nomeNovo, setNomeNovo] = useState('')
  const assuntos = useAssuntosDe(materia)

  async function comecar() {
    if (!materia) return
    let id = assuntoId && assuntoId !== NOVO ? assuntoId : null
    if (assuntoId === NOVO && nomeNovo.trim()) id = await criarAssunto(db, materia, nomeNovo)
    fechar({ materia, tipo, assuntoId: id })
  }

  if (!todas.length) {
    return (
      <>
        <p className="mt-0 text-sm">Ainda não há matérias. Escolha as suas na aba Montar ciclo ou no Edital.</p>
        <div className="flex justify-end"><Button onClick={() => fechar(null)}>Ok</Button></div>
      </>
    )
  }

  return (
    <>
      <p className="mt-0 mb-2 text-sm">O cronômetro conta para cima; ao encerrar, você confere o tempo e lança as questões.</p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Matéria
          <SelecaoMateria autoFocus doDia={doDia} outras={outras} valor={materia} aoMudar={(m) => { setMateria(m); setAssuntoId('') }} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Tipo de estudo
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_ESTUDO.map((t) => <option key={t}>{t}</option>)}
          </Selecao>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
          Assunto (opcional)
          <EscolherAssunto assuntos={assuntos ?? []} valor={assuntoId} aoMudar={setAssuntoId} valorNovo={NOVO} />
        </label>
        {assuntoId === NOVO && (
          <Entrada autoFocus placeholder={`Nome do assunto de ${materia}`} value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void comecar()} />
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => fechar(null)}>Cancelar</Button>
        <Button onClick={() => void comecar()}>Começar</Button>
      </div>
    </>
  )
}
