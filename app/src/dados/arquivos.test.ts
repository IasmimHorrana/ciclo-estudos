import { describe, expect, it } from 'vitest'
import { caminhoNota, hashTexto, lerMd, nomeSeguro, notaParaArquivo } from '@/dados/arquivos'
import type { Dados, NotaResumo } from '@/dados/esquemas'
import { mesclarMd } from '@/dados/mesclar'
import { crc32, criarZip } from '@/dados/zip'

const nota = (o: Partial<NotaResumo> = {}): NotaResumo => ({
  id: 'nabc1234', titulo: 'Crase', materia: 'Língua Portuguesa', texto: '# Crase\n\n- regra', criado: 1, atualizado: 10,
  atualizadoEm: 10, excluidoEm: null, sujo: 0, ...o,
})

describe('zip', () => {
  it('crc32 bate com o valor conhecido de "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('gera um zip legível: assinaturas, quantidade e conteúdo em UTF-8', async () => {
    const blob = criarZip([
      { nome: 'Matéria/Título.md', texto: 'olá, ação' },
      { nome: '_backup-app.json', texto: '{}' },
    ])
    const b = new Uint8Array(await blob.arrayBuffer())
    const v = new DataView(b.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50) // cabeçalho do 1º arquivo
    expect(v.getUint32(b.length - 22, true)).toBe(0x06054b50) // fim do diretório central
    expect(v.getUint16(b.length - 22 + 10, true)).toBe(2) // 2 arquivos
    const nomeLen = v.getUint16(26, true)
    expect(new TextDecoder().decode(b.slice(30, 30 + nomeLen))).toBe('Matéria/Título.md')
    const tam = v.getUint32(22, true)
    expect(new TextDecoder().decode(b.slice(30 + nomeLen, 30 + nomeLen + tam))).toBe('olá, ação')
    expect(v.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('olá, ação')))
  })
})

describe('arquivos .md', () => {
  it('nomeSeguro tira caracteres proibidos e limita o tamanho', () => {
    expect(nomeSeguro('a/b:c*d?')).toBe('a-b-c-d-')
    expect(nomeSeguro('   ')).toBe('sem-titulo')
    expect(nomeSeguro('x'.repeat(200))).toHaveLength(80)
  })

  it('caminhoNota evita colisão de títulos na mesma matéria', () => {
    const usados = new Set<string>()
    expect(caminhoNota(nota(), usados)).toBe('Língua Portuguesa/Crase.md')
    expect(caminhoNota(nota({ id: 'nxyz9999' }), usados)).toBe('Língua Portuguesa/Crase (9999).md')
    expect(caminhoNota(nota({ materia: '' }), usados)).toBe('Sem matéria/Crase.md')
  })

  it('nota → arquivo → nota (ida e volta, inclusive com CRLF)', () => {
    const n = nota({ atualizado: 1234 })
    const volta = lerMd(notaParaArquivo(n).replace(/\n/g, '\r\n'), 'Crase.md')
    expect(volta).toEqual({ id: n.id, titulo: n.titulo, materia: n.materia, atualizado: 1234, texto: n.texto })
  })

  it('lê .md sem cabeçalho usando o nome do arquivo como título', () => {
    expect(lerMd('texto solto', 'Minha nota.md')).toMatchObject({ id: undefined, titulo: 'Minha nota', texto: 'texto solto' })
  })

  it('hashTexto muda quando o texto muda', () => {
    expect(hashTexto('a')).toBe(hashTexto('a'))
    expect(hashTexto('a')).not.toBe(hashTexto('b'))
  })
})

describe('mesclarMd (restaurar da pasta)', () => {
  const base = { notas: [nota()] } as unknown as Dados
  const md = (o: object) => ({ id: 'nabc1234', titulo: 'Crase', materia: 'Língua Portuguesa', atualizado: 10, texto: '# Crase\n\n- editada fora', ...o })

  it('arquivo editado depois da nota atualiza o texto', () => {
    const r = mesclarMd(base, [{ md: md({}), modificado: 99_999, pasta: 'Língua Portuguesa' }], 5)
    expect(r.atualizadas).toBe(1)
    expect(r.dados.notas[0]).toMatchObject({ texto: '# Crase\n\n- editada fora', atualizado: 99_999, sujo: 1 })
    expect(base.notas[0]?.texto).toBe('# Crase\n\n- regra') // não altera o original
  })

  it('arquivo mais antigo ou igual não mexe na nota', () => {
    const r = mesclarMd(base, [{ md: md({}), modificado: 10, pasta: '' }])
    expect(r.atualizadas).toBe(0)
  })

  it('arquivo desconhecido vira nota nova, com título único e matéria da pasta', () => {
    const r = mesclarMd(base, [{ md: md({ id: undefined, titulo: 'Crase', materia: '' }), modificado: 50, pasta: 'Informática' }])
    expect(r.novas).toBe(1)
    expect(r.dados.notas[1]).toMatchObject({ titulo: 'Crase (2)', materia: 'Informática', excluidoEm: null })
  })
})
