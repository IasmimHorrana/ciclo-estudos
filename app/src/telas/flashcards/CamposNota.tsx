import { useRef, type ClipboardEvent, type DragEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { AreaTexto } from '@/componentes/ui/entrada'
import { marcador, numerosNoTexto } from '@/dominio/imagens'
import type { EditorCampos } from '@/telas/flashcards/useCamposNota'

/** Primeira imagem de uma lista de arquivos (colar ou arrastar). */
const imagemDe = (arquivos: Iterable<File | null>): File | null => [...arquivos].find((f) => f?.type.startsWith('image/')) ?? null

/** As caixas dos campos, cada uma com o botão "Imagem" e as miniaturas das imagens que ela cita. */
export function CamposNota({ ed, campos, cloze }: { ed: EditorCampos; campos: string[]; cloze: boolean }) {
  const seletor = useRef<HTMLInputElement>(null)
  const campoDoSeletor = useRef('')
  const { valores, setValores, imagens, originais, caixas, porImagem, tirarImagem } = ed

  function aoColar(campo: string, e: ClipboardEvent<HTMLTextAreaElement>) {
    const img = imagemDe([...e.clipboardData.items].map((i) => (i.kind === 'file' ? i.getAsFile() : null)))
    if (!img) return // texto comum: cola normal
    e.preventDefault()
    void porImagem(campo, img)
  }

  function aoSoltar(campo: string, e: DragEvent<HTMLTextAreaElement>) {
    const img = imagemDe(e.dataTransfer.files)
    if (!img) return
    e.preventDefault()
    void porImagem(campo, img)
  }

  return (
    <>
      <input
        ref={seletor}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void porImagem(campoDoSeletor.current, f)
        }}
      />
      {campos.map((campo, i) => {
        const desteCampo = numerosNoTexto(valores[campo] ?? '').filter((n) => imagens[n])
        const o = originais[campo]
        const perdeFormatacao = o?.temFormatacao && o.texto !== (valores[campo] ?? '')
        return (
          <div key={campo} className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
              {campo}
              <AreaTexto
                ref={(el) => { caixas.current[campo] = el }}
                value={valores[campo] ?? ''}
                placeholder={cloze && i === 0 ? 'Ex.: A capital do Brasil é {{c1::Brasília}}.' : ''}
                onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
                onPaste={(e) => aoColar(campo, e)}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
                onDrop={(e) => aoSoltar(campo, e)}
              />
            </label>
            {o?.temFormatacao && (
              <span className={`text-xs ${perdeFormatacao ? 'font-semibold text-aviso' : 'text-muted-foreground'}`}>
                {perdeFormatacao
                  ? 'Ao salvar, este campo fica só com texto e imagens: a formatação (negrito, cores, links…) sai. Desfaça a mudança para mantê-la.'
                  : 'Este campo tem formatação (negrito, cores, links…). Sem mudar o texto, ela é mantida.'}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  campoDoSeletor.current = campo
                  seletor.current?.click()
                }}
              >
                <ImagePlus className="size-4" /> Imagem
              </Button>
              {desteCampo.length === 0 && i === 0 && (
                <span className="text-xs text-muted-foreground">ou cole um print (Ctrl+V) / arraste uma imagem para a caixa</span>
              )}
              {desteCampo.map((n) => (
                <span key={n} className="flex items-center gap-1.5 rounded-lg border bg-background p-1 pr-1.5 text-xs text-muted-foreground">
                  <img src={imagens[n]} alt={marcador(n)} className="h-10 max-w-20 rounded object-contain" />
                  {marcador(n)}
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-accent hover:text-foreground"
                    aria-label={`Tirar ${marcador(n)}`}
                    title="Tirar a imagem"
                    onClick={() => tirarImagem(n)}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
