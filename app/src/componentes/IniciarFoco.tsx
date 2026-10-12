import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import { criarAssunto } from '@/dados/edital'
import { db } from '@/dados/db'
import type { Semana } from '@/dados/esquemas'
import { agruparPassosParaEstudo, materiasParaEstudo, passoAutomatico, rotuloDoPasso } from '@/dominio/ciclo'
import { fmtData, hoje, idxDia, NOMES_DIA } from '@/dominio/datas'
import { sugerirAssunto } from '@/dominio/edital'
import type { AlvoFoco } from '@/estado/pomodoro'

const TIPOS = ['Teoria', 'Questões', 'Revisão']
const NOVO = '__novo'
const SEM_REGISTRO = '__sem'

/** "O que você vai estudar?": escolhe a matéria (o passo vem sozinho), o tipo e o assunto antes de começar o foco. */
export function IniciarFoco({ semana, inicial, fechar }: { semana: Semana; inicial: AlvoFoco | null; fechar: (a: AlvoFoco | null) => void }) {
  const h = hoje()
  const grupos = materiasParaEstudo(semana.passos, h)
  const todas = grupos.flatMap((g) => g.materias)
  // a última escolha só volta sugerida se o passo ainda falta fazer
  const passoAnterior = inicial ? semana.passos.find((p) => p.id === inicial.passoId && !p.feito) : undefined
  const anterior = passoAnterior ? inicial : null
  const [materiaEscolhida, setMateria] = useState(passoAnterior?.materia ?? todas[0] ?? SEM_REGISTRO)
  const [passoManual, setPassoManual] = useState<number | null>(anterior?.passoId ?? null)
  const [tipo, setTipo] = useState(anterior?.tipo ?? 'Teoria')
  // null = ainda não mexeu: vale a sugestão (assunto citado na anotação do passo, ou o da última vez)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [nomeNovo, setNomeNovo] = useState('')

  const materia = materiaEscolhida === SEM_REGISTRO ? null : materiaEscolhida
  const passosDaMateria = semana.passos.filter((p) => p.materia === materia)
  const passo = materia ? (passosDaMateria.find((p) => p.id === passoManual) ?? passoAutomatico(semana.passos, materia, h)) : undefined
  const assuntos = useLiveQuery(
    async () => (passo ? (await db.assuntos.toArray()).filter((a) => a.excluidoEm === null && a.materia === passo.materia).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')) : []),
    [passo?.materia],
  )
  const doAnterior = anterior && passo && anterior.passoId === passo.id ? anterior.assuntoId : null
  const sugerido = passo && assuntos ? (sugerirAssunto(passo.nota, assuntos) ?? (doAnterior && assuntos.some((a) => a.id === doAnterior) ? doAnterior : null)) : null
  const assuntoId = escolhido ?? sugerido ?? ''

  const comDia = (p: { id: number; dia: string | null }) => (p.dia ? ` · ${NOMES_DIA[idxDia(p.dia)]} ${fmtData(p.dia).slice(0, 2)}` : ' · sem dia')

  async function comecar() {
    if (!passo) return fechar({ passoId: 0, tipo, assuntoId: null, rotulo: 'Sem registro' })
    let id = assuntoId === NOVO ? null : assuntoId || null
    let nome = assuntos?.find((a) => a.id === id)?.nome
    if (assuntoId === NOVO && nomeNovo.trim()) {
      id = await criarAssunto(db, passo.materia, nomeNovo)
      nome = nomeNovo.trim()
    }
    fechar({ passoId: passo.id, tipo, assuntoId: id, rotulo: `${passo.materia}${id && nome ? ` · ${nome}` : ''} · ${tipo}` })
  }

  return (
    <>
      <p className="mt-0 mb-2 text-sm">O tempo deste foco será somado a um passo desta matéria quando terminar.</p>
      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Matéria
        <Selecao
          autoFocus
          value={materiaEscolhida}
          onChange={(e) => {
            setMateria(e.target.value)
            setPassoManual(null)
            setEscolhido(null)
          }}
        >
          {grupos.map((g) => (
            <optgroup key={g.rotulo} label={g.rotulo}>
              {g.materias.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </optgroup>
          ))}
          <option value={SEM_REGISTRO}>Estudar sem registrar</option>
        </Selecao>
      </label>
      {passo && passosDaMateria.length > 1 && (
        <details className="mt-1.5 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Vai para o passo {passo.id}. Escolher outro passo</summary>
          <Selecao className="mt-1" aria-label="Passo" value={passo.id} onChange={(e) => { setPassoManual(Number(e.target.value)); setEscolhido(null) }}>
            {agruparPassosParaEstudo(passosDaMateria, h).map((g) => (
              <optgroup key={g.rotulo} label={g.rotulo}>
                {g.passos.map((p) => (
                  <option key={p.id} value={p.id}>{rotuloDoPasso(p)}{comDia(p)}</option>
                ))}
              </optgroup>
            ))}
          </Selecao>
        </details>
      )}
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
              <option value={NOVO}>＋ Novo assunto…</option>
            </Selecao>
          </label>
        </div>
      )}
      {passo && assuntoId === NOVO && (
        <Entrada className="mt-2" autoFocus placeholder={`Nome do assunto de ${passo.materia}`} value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void comecar()} />
      )}
      {passo && assuntos && assuntos.length === 0 && assuntoId !== NOVO && (
        <p className="mt-2 mb-0 text-xs text-muted-foreground">{passo.materia} ainda não tem assuntos. Use "＋ Novo assunto…" ou importe o edital na aba Edital.</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => fechar(null)}>Cancelar</Button>
        <Button onClick={() => void comecar()}>Começar</Button>
      </div>
    </>
  )
}
