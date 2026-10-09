import { describe, expect, it } from 'vitest'
import { htmlParaTexto, textoParaHtml } from '@/lib/sanitizar'

describe('texto ↔ html dos campos', () => {
  it('escapa tags digitadas e preserva quebras de linha', () => {
    expect(textoParaHtml('a < b & c\n<script>x</script>')).toBe('a &lt; b &amp; c<br>&lt;script&gt;x&lt;/script&gt;')
  })

  it('ida e volta', () => {
    const t = 'linha 1\nlinha 2 <b> & {{c1::x}}'
    expect(htmlParaTexto(textoParaHtml(t))).toBe(t)
  })
})
