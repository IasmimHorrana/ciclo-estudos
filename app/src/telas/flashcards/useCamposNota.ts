import { useRef, useState } from 'react'
import { envolverCloze } from '@/dominio/cloze'
import { campoParaEdicao, inserirMarcador, removerMarcador, trocarMarcadores, type Imagens } from '@/dominio/imagens'
import type { Campos } from '@/dominio/modelo'
import { comprimirImagem } from '@/lib/imagem'
import { textoParaHtml } from '@/lib/sanitizar'

/** Campo como estava ao abrir a edição: se o texto não mudar, o HTML original é guardado de volta sem perda. */
interface Original {
  html: string
  texto: string
  temFormatacao: boolean
}

/**
 * Estado dos campos de uma nota em caixas simples, com imagens (`[imagem N]`).
 * Usado por "Adicionar cartões" (começa vazio) e pela edição no estudo (começa com `carregar`).
 */
export function useCamposNota(aoErrar: (texto: string) => void) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [imagens, setImagens] = useState<Imagens>({})
  const [originais, setOriginais] = useState<Record<string, Original>>({})
  const caixas = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const proxima = useRef(1) // número da próxima imagem desta nota

  async function porImagem(campo: string, arquivo: Blob) {
    const el = caixas.current[campo]
    const ini = el?.selectionStart ?? (valores[campo] ?? '').length
    const fim = el?.selectionEnd ?? ini
    const n = proxima.current++
    try {
      const src = await comprimirImagem(arquivo)
      // a caixa mostra o texto mais recente (a pessoa pode ter digitado enquanto a imagem era comprimida)
      const atual = el?.value ?? valores[campo] ?? ''
      const r = inserirMarcador(atual, Math.min(ini, atual.length), Math.min(fim, atual.length), n)
      setImagens((im) => ({ ...im, [n]: src }))
      setValores((v) => ({ ...v, [campo]: r.texto }))
      requestAnimationFrame(() => {
        el?.focus()
        el?.setSelectionRange(r.cursor, r.cursor)
      })
    } catch (e) {
      aoErrar(e instanceof Error ? e.message : 'Não foi possível pôr a imagem.')
    }
  }

  function tirarImagem(n: number) {
    setValores((v) => Object.fromEntries(Object.entries(v).map(([c, t]) => [c, removerMarcador(t, n)])))
    setImagens(({ [n]: _fora, ...resto }) => resto)
  }

  /** Envolve a seleção do campo em `{{cN::…}}`. */
  function omissao(campo: string) {
    const el = caixas.current[campo]
    if (!el) return
    if (el.selectionStart === el.selectionEnd) return aoErrar('Selecione o trecho que será escondido e clique em "Omissão".')
    setValores((v) => ({ ...v, [campo]: envolverCloze(v[campo] ?? '', el.selectionStart, el.selectionEnd) }))
  }

  /** HTML dos campos para gravar. Campo que não mudou desde `carregar` volta exatamente como era. */
  function paraHtml(nomes: string[]): Campos {
    return Object.fromEntries(
      nomes.map((c) => {
        const texto = valores[c] ?? ''
        const o = originais[c]
        return [c, o && o.texto === texto ? o.html : trocarMarcadores(textoParaHtml(texto), imagens)]
      }),
    )
  }

  /** Abre campos já gravados para editar. */
  function carregar(campos: Campos) {
    const v: Record<string, string> = {}
    const ims: Imagens = {}
    const orig: Record<string, Original> = {}
    let n = 1
    for (const [c, html] of Object.entries(campos)) {
      const e = campoParaEdicao(html, n)
      n += Object.keys(e.imagens).length
      v[c] = e.texto
      Object.assign(ims, e.imagens)
      orig[c] = { html, texto: e.texto, temFormatacao: e.temFormatacao }
    }
    setValores(v)
    setImagens(ims)
    setOriginais(orig)
    proxima.current = n
  }

  function limpar() {
    setValores({})
    setImagens({})
    setOriginais({})
    proxima.current = 1
  }

  return { valores, setValores, imagens, originais, caixas, porImagem, tirarImagem, omissao, paraHtml, carregar, limpar }
}

export type EditorCampos = ReturnType<typeof useCamposNota>
