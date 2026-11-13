import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { EscolherAssunto } from '@/componentes/EscolherAssunto'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'
import { db } from '@/dados/db'
import { atualizarNota } from '@/dados/flashcards'
import { BotaoOmissao } from '@/telas/flashcards/Adicionar'
import { CamposNota } from '@/telas/flashcards/CamposNota'
import { useCamposNota } from '@/telas/flashcards/useCamposNota'

/**
 * Edita a nota do cartão em estudo (atalho E, como no Anki): campos com imagens, tags e baralho.
 * Mudar os campos vale para todos os cartões da nota; uma omissão nova cria o cartão dela.
 */
export function EditarNota({ notaId, aoFechar }: { notaId: string; aoFechar: () => void }) {
  const dados = useLiveQuery(async () => {
    const nota = await db.notasFc.get(notaId)
    const tipo = nota && (await db.tiposNota.get(nota.tipoId))
    const baralhos = (await db.baralhos.toArray()).filter((b) => b.excluidoEm === null).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return nota && tipo ? { nota, tipo, baralhos } : null
  }, [notaId])
  const [erro, setErro] = useState('')
  const [tags, setTags] = useState('')
  const [baralhoId, setBaralhoId] = useState('')
  const ed = useCamposNota(setErro)
  const carregado = useRef(false)

  // abre a nota uma vez só (depois, o que vale é o que a pessoa está digitando)
  useEffect(() => {
    if (!dados || carregado.current) return
    carregado.current = true
    ed.carregar(dados.nota.campos)
    setTags(dados.nota.tags.join(' '))
    setBaralhoId(dados.nota.baralhoId)
    requestAnimationFrame(() => ed.caixas.current[dados.tipo.campos[0] ?? '']?.focus())
  }, [dados, ed])

  if (dados === undefined) return <p className="m-auto text-sm text-muted-foreground">Carregando…</p>
  if (dados === null) return <p className="m-auto text-sm text-muted-foreground">Nota não encontrada.</p>
  const { nota, tipo, baralhos } = dados

  async function salvar() {
    try {
      await atualizarNota(db, nota.id, {
        campos: ed.paraHtml(tipo.campos),
        tags: [...new Set(tags.split(/[\s,]+/).filter(Boolean))],
        ...(baralhoId && baralhoId !== nota.baralhoId ? { baralhoId } : {}),
      })
      aoFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-3"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void salvar()
        } else if (e.key === 'Escape' && !(e.target as HTMLElement).closest('[role=listbox], [role=dialog]')) {
          e.preventDefault()
          aoFechar()
        } else if (e.key.toLowerCase() === 'c' && e.shiftKey && (e.ctrlKey || e.metaKey) && tipo.cloze) {
          e.preventDefault()
          ed.omissao(tipo.campos[0] ?? '')
        }
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-lg font-bold">Editar cartão</h2>
        <span className="text-xs text-muted-foreground">Tipo: {tipo.nome}. A mudança vale para todos os cartões desta nota.</span>
      </div>

      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Baralho
        <EscolherAssunto assuntos={baralhos} valor={baralhoId} aoMudar={setBaralhoId} rotulo="Baralho" semVazio />
      </label>

      <CamposNota ed={ed} campos={tipo.campos} cloze={tipo.cloze} />

      {tipo.cloze && <BotaoOmissao onClick={() => ed.omissao(tipo.campos[0] ?? '')} />}

      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
        Tags (separadas por espaço)
        <Entrada value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void salvar()}>
          Salvar <span className="ml-2 text-xs opacity-70">Ctrl+Enter</span>
        </Button>
        <Button variant="outline" onClick={aoFechar}>
          Cancelar <span className="ml-2 text-xs opacity-60">Esc</span>
        </Button>
        {erro && <span className="text-sm font-semibold text-erro">{erro}</span>}
      </div>
    </div>
  )
}
