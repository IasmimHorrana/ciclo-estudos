/** Lado maior, em pixels, da imagem guardada no cartão. */
const LADO_MAX = 1280
const QUALIDADE = 0.8
const LIMITE_BYTES = 15 * 1024 * 1024

/**
 * Reduz a imagem (no máximo 1280 px no lado maior) e devolve como data URL WebP
 * (ou JPEG, se o navegador não gerar WebP), para embutir no cartão sem inchar a base.
 */
export async function comprimirImagem(arquivo: Blob): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Esse arquivo não é uma imagem.')
  if (arquivo.size > LIMITE_BYTES) throw new Error('Imagem grande demais (máximo de 15 MB).')
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(arquivo)
  } catch {
    throw new Error('Não foi possível ler essa imagem.')
  }
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * escala))
  canvas.height = Math.max(1, Math.round(bmp.height * escala))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const webp = canvas.toDataURL('image/webp', QUALIDADE)
  if (webp.startsWith('data:image/webp')) return webp
  // Sem WebP: JPEG não tem transparência, então pinta o fundo de branco antes.
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', QUALIDADE)
}
