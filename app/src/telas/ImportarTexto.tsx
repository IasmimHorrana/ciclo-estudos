import { useState } from 'react'
import { avisar } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { AreaTexto, Entrada, Selecao } from '@/componentes/ui/entrada'
import { lerMd } from '@/dados/arquivos'
import { db } from '@/dados/db'
import { importarNotas, type ItemImportar } from '@/dados/notas'
import { useCiclo } from '@/dados/useCiclo'
import { todasMaterias } from '@/dominio/ciclo'
import { fmtData, hoje } from '@/dominio/datas'

/** "Importar / colar texto": adapta textos do NotebookLM, ChatGPT, Google Docs ou arquivos .md/.txt. */
export function ImportarTexto({ aoImportar, fechar }: { aoImportar: (idDaUltima: string) => void; fechar: () => void }) {
  const ciclo = useCiclo()
  const [titulo, setTitulo] = useState('')
  const [materia, setMateria] = useState('')
  const [texto, setTexto] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [citacoes, setCitacoes] = useState(true)
  const [marcadores, setMarcadores] = useState(true)
  const [dividir, setDividir] = useState(false)
  if (!ciclo) return null

  async function importar() {
    const itens: ItemImportar[] = []
    if (texto.trim()) {
      itens.push({ titulo: titulo.trim() || /^#\s+(.+)$/m.exec(texto)?.[1] || `Importado em ${fmtData(hoje())}`, materia, texto })
    }
    for (const f of arquivos) {
      try {
        const p = lerMd(await f.text(), f.name)
        itens.push({ titulo: arquivos.length === 1 && titulo.trim() ? titulo.trim() : p.titulo, materia: p.materia || materia, texto: p.texto })
      } catch {
        /* arquivo ilegível: pula */
      }
    }
    if (!itens.length) return void avisar('Importar', 'Cole um texto ou escolha ao menos um arquivo.')
    const criadas = await importarNotas(db, itens, { citacoes, marcadores, dividir })
    const ultima = criadas[criadas.length - 1]
    await avisar('Importação concluída', `${criadas.length} nota(s) criada(s).`)
    if (ultima) aoImportar(ultima.id)
    else fechar()
  }

  const opcao = (marcado: boolean, aoMudar: (v: boolean) => void, rotulo: string, dica: string) => (
    <label className="mt-1.5 flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} />
      <span><b>{rotulo}</b><br /><span className="text-xs text-muted-foreground">{dica}</span></span>
    </label>
  )

  return (
    <>
      <p className="mt-0 mb-2 text-xs text-muted-foreground">Cole o texto gerado no NotebookLM (ou ChatGPT, ou um .md do Google Docs) e/ou escolha arquivos <b>.md</b> ou <b>.txt</b>.</p>
      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Título (opcional)
        <Entrada placeholder="Ex.: Contratos — resumo do NotebookLM" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label className="mt-2 flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Matéria
        <Selecao value={materia} onChange={(e) => setMateria(e.target.value)}>
          <option value="">Sem matéria</option>
          {todasMaterias(ciclo.config).map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Selecao>
      </label>
      <label className="mt-2 flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Texto colado
        <AreaTexto rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <label className="mt-2 flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Arquivos
        <input type="file" multiple accept=".md,.markdown,.txt" onChange={(e) => setArquivos([...(e.target.files ?? [])])} />
      </label>
      <div className="mt-3">
        <b className="text-sm">Adaptar ao app</b>
        {opcao(citacoes, setCitacoes, 'Remover citações [1], [2, 3]', 'O NotebookLM marca as fontes com números entre colchetes.')}
        {opcao(marcadores, setMarcadores, 'Normalizar marcadores e recuos', 'Troca •, ◦, – e tabs por "- " e espaços, para os tópicos funcionarem.')}
        {opcao(dividir, setDividir, 'Dividir em várias notas por "## Seção"', 'Cada seção de nível 2 vira uma nota.')}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={fechar}>Cancelar</Button>
        <Button onClick={() => void importar()}>Importar</Button>
      </div>
    </>
  )
}
