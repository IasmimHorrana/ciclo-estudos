import { useState } from 'react'
import { ArrowLeftToLine, ArrowRightToLine, X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { AreaTexto, Entrada } from '@/componentes/ui/entrada'
import { importarEdital } from '@/dados/edital'
import { db } from '@/dados/db'
import { achatarItens, agruparLinhas, lerEdital, type LinhaLida } from '@/dominio/edital'

const apoio = 'm-0 text-xs text-muted-foreground'

const EXEMPLO = `DIREITO CIVIL
1. Teoria das obrigações
2. Posse; propriedade
INFORMÁTICA
1. Redes de computadores: conceitos; arquiteturas; NAT; VLAN
2. Segurança da informação`

interface MateriaEmEdicao {
  materia: string
  linhas: LinhaLida[]
}

/**
 * Diálogo de importar o edital: cola o texto, o app separa matérias, tópicos e subtópicos, ela confere e corrige
 * (renomear, tirar, recuar uma linha para virar subtópico ou subir de nível) e só então grava.
 * `conhecidas`: nomes de matérias que o app já usa (ciclo, questões), para casar "DIREITO CIVIL" com "Direito Civil".
 */
export function ImportarEdital({ conhecidas, fechar }: { conhecidas: string[]; fechar: (resultado?: string) => void }) {
  const [texto, setTexto] = useState('')
  const [lidas, setLidas] = useState<MateriaEmEdicao[] | null>(null)
  const [gravando, setGravando] = useState(false)

  if (!lidas) {
    return (
      <>
        <p className={apoio}>
          Cole o conteúdo programático. O app separa as matérias (linha em MAIÚSCULAS, "Disciplina: …" ou terminada em ":") dos tópicos (itens numerados, com hífen ou separados por ";").
          Um item como <b>"Redes: conceitos; arquiteturas; NAT"</b> vira um tópico com subtópicos, e "1." seguido de "1.1", "1.2" também. Você confere tudo antes de salvar.
        </p>
        <AreaTexto autoFocus className="mt-2 h-56 font-mono text-xs" placeholder={EXEMPLO} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => fechar()}>Cancelar</Button>
          <Button disabled={!texto.trim()} onClick={() => setLidas(lerEdital(texto).map((m) => ({ materia: m.materia, linhas: achatarItens(m.assuntos) })))}>Entender o texto</Button>
        </div>
      </>
    )
  }

  const topicos = lidas.reduce((s, m) => s + m.linhas.filter((l) => l.nivel === 0).length, 0)
  const subtopicos = lidas.reduce((s, m) => s + m.linhas.filter((l) => l.nivel === 1).length, 0)
  const mudarMateria = (i: number, fn: (m: MateriaEmEdicao) => MateriaEmEdicao | null) =>
    setLidas((l) => (l ?? []).flatMap((m, k) => (k === i ? (fn(m) ? [fn(m) as MateriaEmEdicao] : []) : [m])))
  const mudarLinha = (i: number, k: number, fn: (l: LinhaLida) => LinhaLida | null) =>
    mudarMateria(i, (m) => ({ ...m, linhas: m.linhas.flatMap((l, j) => (j === k ? (fn(l) ? [fn(l) as LinhaLida] : []) : [l])) }))

  async function salvar() {
    if (!lidas) return
    setGravando(true)
    const r = await importarEdital(
      db,
      lidas.filter((m) => m.materia.trim()).map((m) => ({ materia: m.materia, assuntos: agruparLinhas(m.linhas.filter((l) => l.nome.trim())) })),
      conhecidas,
    )
    fechar(`${r.materiasNovas} matéria(s) e ${r.assuntosNovos} assunto(s) novos.${r.assuntosQueJaExistiam ? ` ${r.assuntosQueJaExistiam} já existiam no app e foram ligados ao edital (sem duplicar), já reorganizados em tópicos e subtópicos.` : ''}`)
  }

  return (
    <>
      <p className={apoio}>
        Confira como o app entendeu: <b>{lidas.length} matéria(s)</b>, <b>{topicos} tópico(s)</b> e <b>{subtopicos} subtópico(s)</b>.
        Corrija nomes, tire o que sobrou (✕) e use <b>→</b> para transformar uma linha em subtópico do tópico de cima (ou <b>←</b> para subir). O que já existe no app não é duplicado.
      </p>
      <div className="mt-2 flex max-h-[50dvh] flex-col gap-3 overflow-auto pr-1">
        {lidas.length === 0 && <p className="text-sm text-erro">Não encontrei nenhuma matéria. Coloque o nome de cada matéria em uma linha própria (em MAIÚSCULAS ou terminando com ":").</p>}
        {lidas.map((m, i) => (
          <div key={i} className="rounded-lg border p-2">
            <div className="flex items-center gap-1.5">
              <Entrada className="font-bold" value={m.materia} onChange={(e) => mudarMateria(i, (x) => ({ ...x, materia: e.target.value }))} aria-label="Nome da matéria" />
              <Button size="icon" variant="outline" title="Tirar esta matéria" aria-label={`Tirar ${m.materia}`} onClick={() => mudarMateria(i, () => null)}>
                <X className="size-4" />
              </Button>
            </div>
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
              {m.linhas.map((l, k) => (
                <li key={k} className="flex items-center gap-1" style={{ paddingLeft: `${0.75 + l.nivel * 1.5}rem` }}>
                  <Entrada className={l.nivel === 0 ? 'py-1 text-xs font-semibold' : 'py-1 text-xs'} value={l.nome} onChange={(e) => mudarLinha(i, k, (x) => ({ ...x, nome: e.target.value }))} aria-label={l.nivel === 0 ? 'Tópico' : 'Subtópico'} />
                  <button
                    className="cursor-pointer text-muted-foreground enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    title="Tornar subtópico do tópico de cima"
                    aria-label={`Tornar ${l.nome} subtópico`}
                    disabled={l.nivel === 1 || k === 0}
                    onClick={() => mudarLinha(i, k, (x) => ({ ...x, nivel: 1 }))}
                  >
                    <ArrowRightToLine className="size-4" />
                  </button>
                  <button
                    className="cursor-pointer text-muted-foreground enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    title="Subir de nível (virar tópico)"
                    aria-label={`Tornar ${l.nome} tópico`}
                    disabled={l.nivel === 0}
                    onClick={() => mudarLinha(i, k, (x) => ({ ...x, nivel: 0 }))}
                  >
                    <ArrowLeftToLine className="size-4" />
                  </button>
                  <button className="cursor-pointer text-muted-foreground hover:text-erro" title="Tirar" aria-label={`Tirar ${l.nome}`} onClick={() => mudarLinha(i, k, () => null)}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              {m.linhas.length === 0 && <li className={apoio}>Sem assuntos (você pode adicionar depois).</li>}
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
