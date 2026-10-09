import DOMPurify from 'dompurify'

/** HTML de cartões e de campos: tira scripts, eventos (onerror…) e javascript:, mantém formatação e imagens. */
export function sanitizarHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'] })
}

/** Texto digitado em caixa simples → HTML seguro (escapa e troca quebras de linha por <br>). */
export function textoParaHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>')
}

/** O contrário de `textoParaHtml`, para editar um campo numa caixa simples. */
export function htmlParaTexto(h: string): string {
  return h.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
}

/** HTML gerado pelo nosso Markdown: além do básico, deixa passar as caixinhas de tarefa e os dados das ligações e dos tópicos recolhíveis. */
export function sanitizarMarkdown(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['input', 'details', 'summary'],
    ADD_ATTR: ['data-t', 'data-k', 'checked', 'disabled', 'type', 'open', 'target', 'rel'],
    FORBID_TAGS: ['style', 'form', 'button', 'iframe', 'object', 'embed', 'script'],
  })
}
