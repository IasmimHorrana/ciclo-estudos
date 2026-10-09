import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { AreaTexto, Entrada } from '@/componentes/ui/entrada'
import { importarEdital } from '@/dados/edital'
import { db } from '@/dados/db'
import { lerEdital, type MateriaLida } from '@/dominio/edital'

const apoio = 'm-0 text-xs text-muted-foreground'

const EXEMPLO = `DIREITO CIVIL
1. Teoria das obrigações
2. Posse; propriedade
DIREITO PENAL:
- Teoria do crime
- Penas`

/**
 * Diálogo de importar o edital: cola o texto, o app separa matérias e assuntos, ela confere e corrige, e só então grava.
 * `conhecidas`: nomes de matérias que o app já usa (ciclo, questões), para casar "DIREITO CIVIL" com "Direito Civil".
 */
export function ImportarEdital({ conhecidas, fechar }: { conhecidas: string[]; fechar: (resultado?: string) => void }) {
  const [texto, setTexto] = useState('')
  const [lidas, setLidas] = useState<MateriaLida[] | null>(null)
  const [gravando, setGravando] = useState(false)

  if (!lidas) {
    return (
      <>
        <p className={apoio}>
          Cole o conteúdo programático. O app separa as matérias (linha em MAIÚSCULAS, "Disciplina: …" ou terminada em ":") dos assuntos (itens numerados, com hífen ou separados por ";"). Você confere tudo antes de salvar.
        </p>
        <AreaTexto autoFocus className="mt-2 h-56 font-mono text-xs" placeholder={EXEMPLO} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => fechar()}>Cancelar</Button>
          <Button disabled={!texto.trim()} onClick={() => setLidas(lerEdital(texto))}>Entender o texto</Button>
        </div>
      </>
    )
  }

  const total = lidas.reduce((s, m) => s + m.assuntos.length, 0)
  const mudar = (i: number, fn: (m: MateriaLida) => MateriaLida | null) =>
    setLidas((l) => (l ?? []).flatMap((m, k) => (k === i ? (fn(m) ? [fn(m) as MateriaLida] : []) : [m])))

  async function salvar() {
    if (!lidas) return
    setGravando(true)
    const r = await importarEdital(db, lidas.filter((m) => m.materia.trim()), conhecidas)
    fechar(`${r.materiasNovas} matéria(s) e ${r.assuntosNovos} assunto(s) novos.${r.assuntosQueJaExistiam ? ` ${r.assuntosQueJaExistiam} já existiam no app e foram ligados ao edital (sem duplicar).` : ''}`)
  }

  return (
    <>
      <p className={apoio}>
        Confira como o app entendeu: <b>{lidas.length} matéria(s)</b> e <b>{total} assunto(s)</b>. Corrija nomes, tire o que sobrou (✕) e salve. O que já existe no app não é duplicado.
      </p>
      <div className="mt-2 flex max-h-[50dvh] flex-col gap-3 overflow-auto pr-1">
        {lidas.length === 0 && <p className="text-sm text-erro">Não encontrei nenhuma matéria. Coloque o nome de cada matéria em uma linha própria (em MAIÚSCULAS ou terminando com ":").</p>}
        {lidas.map((m, i) => (
          <div key={i} className="rounded-lg border p-2">
            <div className="flex items-center gap-1.5">
              <Entrada className="font-bold" value={m.materia} onChange={(e) => mudar(i, (x) => ({ ...x, materia: e.target.value }))} aria-label="Nome da matéria" />
              <Button size="icon" variant="outline" title="Tirar esta matéria" aria-label={`Tirar ${m.materia}`} onClick={() => mudar(i, () => null)}>
                <X className="size-4" />
              </Button>
            </div>
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 pl-3">
              {m.assuntos.map((a, k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <Entrada className="py-1 text-xs" value={a} onChange={(e) => mudar(i, (x) => ({ ...x, assuntos: x.assuntos.map((y, j) => (j === k ? e.target.value : y)) }))} aria-label="Assunto" />
                  <button className="cursor-pointer text-muted-foreground hover:text-erro" title="Tirar assunto" aria-label={`Tirar ${a}`} onClick={() => mudar(i, (x) => ({ ...x, assuntos: x.assuntos.filter((_, j) => j !== k) }))}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              {m.assuntos.length === 0 && <li className={apoio}>Sem assuntos (você pode adicionar depois).</li>}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between gap-2">
        <Button variant="outline" onClick={() => setLidas(null)}>← Voltar ao texto</Button>
        <span className="flex gap-2">
          <Button variant="outline" onClick={() => fechar()}>Cancelar</Button>
          <Button disabled={!lidas.length || gravando} onClick={() => void salvar()}>Salvar edital</Button>
        </span>
      </div>
    </>
  )
}
