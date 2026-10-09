// Tipos de nota e modelos de cartão (frente/verso), com a sintaxe de campos do Anki.
// Suportado: {{Campo}}, {{FrontSide}}, {{cloze:Campo}}, {{type:Campo}}, {{#Campo}}…{{/Campo}} e {{^Campo}}…{{/Campo}}.

import { indicesCloze, renderizarCloze } from '@/dominio/cloze'

export interface ModeloCartao {
  nome: string
  frente: string
  verso: string
}

export interface TipoNotaBase {
  id: string
  nome: string
  campos: string[]
  modelos: ModeloCartao[]
  /** Cartões vêm dos números {{cN::…}} do texto, não dos modelos. */
  cloze: boolean
}

export const TIPOS_DE_FABRICA: TipoNotaBase[] = [
  {
    id: 'basico', nome: 'Básico', campos: ['Frente', 'Verso'], cloze: false,
    modelos: [{ nome: 'Cartão 1', frente: '{{Frente}}', verso: '{{FrontSide}}<hr id="resposta">{{Verso}}' }],
  },
  {
    id: 'basico-invertido', nome: 'Básico (e cartão invertido)', campos: ['Frente', 'Verso'], cloze: false,
    modelos: [
      { nome: 'Cartão 1', frente: '{{Frente}}', verso: '{{FrontSide}}<hr id="resposta">{{Verso}}' },
      { nome: 'Cartão 2', frente: '{{Verso}}', verso: '{{FrontSide}}<hr id="resposta">{{Frente}}' },
    ],
  },
  {
    id: 'basico-invertido-opcional', nome: 'Básico (cartão invertido opcional)', campos: ['Frente', 'Verso', 'Adicionar invertido'], cloze: false,
    modelos: [
      { nome: 'Cartão 1', frente: '{{Frente}}', verso: '{{FrontSide}}<hr id="resposta">{{Verso}}' },
      {
        nome: 'Cartão 2',
        frente: '{{#Adicionar invertido}}{{Verso}}{{/Adicionar invertido}}',
        verso: '{{FrontSide}}<hr id="resposta">{{Frente}}',
      },
    ],
  },
  {
    id: 'basico-digitar', nome: 'Básico (digite a resposta)', campos: ['Frente', 'Verso'], cloze: false,
    modelos: [{ nome: 'Cartão 1', frente: '{{Frente}}<br>{{type:Verso}}', verso: '{{Frente}}<hr id="resposta">{{Verso}}' }],
  },
  {
    id: 'cloze', nome: 'Omissão de texto (cloze)', campos: ['Texto', 'Extra'], cloze: true,
    modelos: [{ nome: 'Cloze', frente: '{{cloze:Texto}}', verso: '{{cloze:Texto}}<br>{{Extra}}' }],
  },
]

export type Campos = Record<string, string>

/** Texto sem tags HTML (para saber se um campo está vazio e para busca). */
export const textoPuro = (html: string): string =>
  html
    .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

const vazio = (v: string | undefined) => !v || textoPuro(v) === ''

export interface Renderizado {
  html: string
  /** Campo a digitar (modelo com {{type:Campo}}): a tela mostra a caixa de digitação. */
  digitar: string | null
}

interface Contexto {
  campos: Campos
  /** Número da omissão (cloze) deste cartão. */
  cloze?: number
  lado: 'frente' | 'verso'
  frente?: string
}

function processar(tpl: string, ctx: Contexto, estado: { digitar: string | null }): string {
  // seções condicionais, de dentro para fora
  let t = tpl
  const secao = /\{\{([#^])([^{}]+?)\}\}([\s\S]*?)\{\{\/\2\}\}/
  for (let guarda = 0; guarda < 50 && secao.test(t); guarda++) {
    t = t.replace(secao, (_m, tipo: string, campo: string, miolo: string) => {
      const cheio = !vazio(ctx.campos[campo.trim()])
      return (tipo === '#') === cheio ? miolo : ''
    })
  }
  return t.replace(/\{\{([^{}]+?)\}\}/g, (_m, bruto: string) => {
    const nome = bruto.trim()
    if (nome === 'FrontSide') return ctx.frente ?? ''
    if (nome.startsWith('cloze:')) return renderizarCloze(ctx.campos[nome.slice(6).trim()] ?? '', ctx.cloze ?? 1, ctx.lado)
    if (nome.startsWith('type:')) {
      if (ctx.lado === 'frente') estado.digitar = nome.slice(5).trim()
      return ''
    }
    return ctx.campos[nome] ?? ''
  })
}

/** Frente e verso de um cartão (`indice` = posição do modelo; nas omissões, o número da omissão menos 1). */
export function renderizarCartao(tipo: TipoNotaBase, campos: Campos, indice: number): { frente: Renderizado; verso: Renderizado } {
  const modelo = tipo.cloze ? tipo.modelos[0] : tipo.modelos[indice]
  if (!modelo) return { frente: { html: '', digitar: null }, verso: { html: '', digitar: null } }
  const cloze = tipo.cloze ? indice + 1 : undefined
  const ef = { digitar: null as string | null }
  const frente = processar(modelo.frente, { campos, cloze, lado: 'frente' }, ef)
  const ev = { digitar: null as string | null }
  const verso = processar(modelo.verso, { campos, cloze, lado: 'verso', frente }, ev)
  return { frente: { html: frente, digitar: ef.digitar }, verso: { html: verso, digitar: ef.digitar } }
}

/**
 * Quais cartões (índices) uma nota gera. Modelos comuns: os que têm algo na frente.
 * Omissões: um por número `cN` que aparece no campo do cloze.
 */
export function indicesDeCartoes(tipo: TipoNotaBase, campos: Campos): number[] {
  if (tipo.cloze) {
    const modelo = tipo.modelos[0]
    const campo = /\{\{cloze:([^{}]+?)\}\}/.exec(modelo?.frente ?? '')?.[1]?.trim()
    const nums = indicesCloze(campo ? (campos[campo] ?? '') : '')
    return nums.map((n) => n - 1)
  }
  const r: number[] = []
  tipo.modelos.forEach((_m, i) => {
    const { frente } = renderizarCartao(tipo, campos, i)
    if (textoPuro(frente.html) !== '') r.push(i)
  })
  return r
}
