/** Arquivo para dentro do .zip: nome com `/` para pastas e conteúdo em texto. */
export interface ArquivoZip {
  nome: string
  texto: string
}

const TABELA_CRC = (() => {
  const t: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = (TABELA_CRC[(c ^ b) & 255] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Zip sem compressão (método 0), nomes em UTF-8. Suficiente para texto e abre em qualquer programa. */
export function criarZip(arquivos: ArquivoZip[], agora = new Date()): Blob {
  const enc = new TextEncoder()
  const locais: Uint8Array[] = []
  const central: Uint8Array[] = []
  let deslocamento = 0
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1)
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate()

  for (const a of arquivos) {
    const nome = enc.encode(a.nome)
    const dados = enc.encode(a.texto)
    const crc = crc32(dados)

    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 20, true)
    h.setUint16(6, 0x0800, true) // bit 11: nome em UTF-8
    h.setUint16(10, hora, true)
    h.setUint16(12, data, true)
    h.setUint32(14, crc, true)
    h.setUint32(18, dados.length, true)
    h.setUint32(22, dados.length, true)
    h.setUint16(26, nome.length, true)
    locais.push(new Uint8Array(h.buffer), nome, dados)

    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint16(12, hora, true)
    c.setUint16(14, data, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, dados.length, true)
    c.setUint32(24, dados.length, true)
    c.setUint16(28, nome.length, true)
    c.setUint32(42, deslocamento, true)
    central.push(new Uint8Array(c.buffer), nome)

    deslocamento += 30 + nome.length + dados.length
  }

  const tamanhoCentral = central.reduce((s, x) => s + x.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true)
  fim.setUint16(8, arquivos.length, true)
  fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamanhoCentral, true)
  fim.setUint32(16, deslocamento, true)
  return new Blob([...locais, ...central, new Uint8Array(fim.buffer)] as BlobPart[], { type: 'application/zip' })
}
