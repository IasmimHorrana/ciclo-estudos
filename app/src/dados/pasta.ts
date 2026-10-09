import { liveQuery } from 'dexie'
import { caminhoNota, hashTexto, lerMd, notaParaArquivo } from '@/dados/arquivos'
import { lerArquivo, paraArquivo } from '@/dados/converter'
import { db } from '@/dados/db'
import { mesclarMd, type MdDaPasta } from '@/dados/mesclar'
import { carregarDados, substituirDados } from '@/dados/repositorio'
import { useBackup } from '@/estado/backup'

/**
 * Backup automático numa pasta do computador (File System Access API: só Chrome/Edge).
 * Grava um `.md` por resumo, em `Matéria/Título.md`, e o `_backup-app.json` com todos os dados.
 * Só apaga arquivos que o próprio app criou.
 */

// --- tipos mínimos da API (o lib.dom do TypeScript ainda não traz tudo) ---
interface PermissaoOpc {
  mode: 'readwrite'
}
interface ArquivoH {
  kind: 'file'
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<{ write(c: string): Promise<void>; close(): Promise<void> }>
}
interface PastaH {
  kind: 'directory'
  name: string
  getDirectoryHandle(n: string, o?: { create: boolean }): Promise<PastaH>
  getFileHandle(n: string, o?: { create: boolean }): Promise<ArquivoH>
  removeEntry(n: string): Promise<void>
  entries(): AsyncIterable<[string, PastaH | ArquivoH]>
  queryPermission(o: PermissaoOpc): Promise<string>
  requestPermission(o: PermissaoOpc): Promise<string>
}
type Janela = typeof window & { showDirectoryPicker?: (o: PermissaoOpc) => Promise<PastaH> }

export const pastaSuportada = () => typeof window !== 'undefined' && typeof (window as Janela).showDirectoryPicker === 'function'

const ARQUIVO_JSON = '_backup-app.json'
interface Registro {
  arquivos: Record<string, string> // id da nota -> caminho gravado
  hashes: Record<string, string> // id da nota -> hash do que foi gravado
}

let pasta: PastaH | null = null
let timer: ReturnType<typeof setTimeout> | undefined

const lerLocal = async <T>(chave: string): Promise<T | undefined> => (await db.local.get(chave))?.valor as T | undefined
const gravarLocal = (chave: string, valor: unknown) => db.local.put({ chave, valor })

async function pastaDe(raiz: PastaH, caminho: string, criar: boolean) {
  let d = raiz
  for (const p of caminho.split('/').slice(0, -1)) d = await d.getDirectoryHandle(p, { create: criar })
  return d
}
async function escrever(raiz: PastaH, caminho: string, conteudo: string) {
  const d = await pastaDe(raiz, caminho, true)
  const f = await d.getFileHandle(caminho.split('/').pop() as string, { create: true })
  const w = await f.createWritable()
  await w.write(conteudo)
  await w.close()
}
async function apagar(raiz: PastaH, caminho: string) {
  try {
    const d = await pastaDe(raiz, caminho, false)
    await d.removeEntry(caminho.split('/').pop() as string)
  } catch {
    /* já não existe */
  }
}

/** Ao abrir o app: recupera a pasta escolhida antes e vê se ainda há permissão. */
export async function carregarPasta() {
  if (!pastaSuportada()) return
  try {
    const h = await lerLocal<PastaH>('pasta')
    if (!h) return
    pasta = h
    const ok = (await h.queryPermission({ mode: 'readwrite' })) === 'granted'
    useBackup.setState({ estado: ok ? 'ok' : 'permissao', nomePasta: h.name, ultimoBackup: (await lerLocal<number>('ultimoBackup')) ?? 0 })
  } catch {
    /* sem pasta guardada */
  }
}

export async function gravarTudo(forcar: boolean) {
  const raiz = pasta
  if (!raiz) return
  clearTimeout(timer)
  useBackup.setState({ estado: 'gravando' })
  try {
    const d = await carregarDados(db)
    if (!d) throw new Error('Ainda não há dados para guardar.')
    const antes = forcar ? { arquivos: {}, hashes: {} } : ((await lerLocal<Registro>('registroPasta')) ?? { arquivos: {}, hashes: {} })
    const usados = new Set<string>()
    const arquivos: Record<string, string> = {}
    const hashes: Record<string, string> = {}
    for (const n of d.notas) {
      const caminho = caminhoNota(n, usados)
      const conteudo = notaParaArquivo(n)
      const h = hashTexto(caminho + '\u0001' + conteudo)
      arquivos[n.id] = caminho
      hashes[n.id] = h
      if (antes.hashes[n.id] !== h) await escrever(raiz, caminho, conteudo)
    }
    for (const [id, antigo] of Object.entries((await lerLocal<Registro>('registroPasta'))?.arquivos ?? {})) {
      if (arquivos[id] !== antigo) await apagar(raiz, antigo) // só o que o app criou
    }
    await escrever(raiz, ARQUIVO_JSON, JSON.stringify(paraArquivo(d)))
    const agora = Date.now()
    await gravarLocal('registroPasta', { arquivos, hashes } satisfies Registro)
    await gravarLocal('ultimoBackup', agora)
    useBackup.setState({ estado: 'ok', ultimoBackup: agora, erro: '' })
  } catch (e) {
    const semPermissao = e instanceof DOMException && e.name === 'NotAllowedError'
    useBackup.setState({ estado: semPermissao ? 'permissao' : 'erro', erro: e instanceof Error ? e.message : String(e) })
  }
}

export async function escolherPasta() {
  let h: PastaH
  try {
    h = await (window as Janela).showDirectoryPicker!({ mode: 'readwrite' })
  } catch {
    return // ela cancelou
  }
  pasta = h
  await gravarLocal('pasta', h)
  await gravarLocal('registroPasta', { arquivos: {}, hashes: {} } satisfies Registro)
  useBackup.setState({ nomePasta: h.name })
  try {
    await navigator.storage?.persist?.() // pede ao navegador para não descartar os dados sozinho
  } catch {
    /* sem suporte */
  }
  await gravarTudo(true)
}

export async function reconectarPasta() {
  if (!pasta) return
  try {
    if ((await pasta.requestPermission({ mode: 'readwrite' })) === 'granted') await gravarTudo(false)
  } catch (e) {
    useBackup.setState({ estado: 'erro', erro: e instanceof Error ? e.message : String(e) })
  }
}

/** Liga o backup automático: a cada mudança nos dados, espera 2 s e grava. Devolve a função que desliga. */
export function iniciarBackupAutomatico() {
  const sub = liveQuery(() => carregarDados(db)).subscribe({
    next: () => {
      if (!pasta || useBackup.getState().estado !== 'ok') return
      clearTimeout(timer)
      timer = setTimeout(() => void gravarTudo(false), 2000)
    },
    error: () => undefined,
  })
  return () => {
    sub.unsubscribe()
    clearTimeout(timer)
  }
}

async function varrer(dir: PastaH, prefixo: string, saida: MdDaPasta[], prof: number) {
  for await (const [nome, h] of dir.entries()) {
    if (nome.startsWith('.') || nome.startsWith('_')) continue
    if (h.kind === 'directory') {
      if (prof < 3) await varrer(h, prefixo + nome + '/', saida, prof + 1)
    } else if (/\.(md|markdown)$/i.test(nome)) {
      const arq = await h.getFile()
      saida.push({ md: lerMd(await arq.text(), nome), modificado: arq.lastModified, pasta: prefixo.split('/')[0] ?? '' })
    }
  }
}

export interface ResultadoRestauro {
  nome: string
  temJson: boolean
  novas: number
  atualizadas: number
}

/**
 * Restaura de uma pasta: o `_backup-app.json` substitui os dados e os `.md` novos ou editados são juntados.
 * `confirmarSubstituir` é perguntado só se já houver dados. Devolve `null` se ela cancelar.
 */
export async function restaurarDaPasta(confirmarSubstituir: () => boolean): Promise<ResultadoRestauro | null> {
  let h: PastaH
  try {
    h = await (window as Janela).showDirectoryPicker!({ mode: 'readwrite' })
  } catch {
    return null
  }
  let base = await carregarDados(db)
  let temJson = false
  try {
    const f = await (await h.getFileHandle(ARQUIVO_JSON)).getFile()
    base = lerArquivo(await f.text())
    temJson = true
  } catch (e) {
    if (e instanceof Error && !(e instanceof DOMException)) throw e // JSON existe mas está inválido
  }
  const mds: MdDaPasta[] = []
  await varrer(h, '', mds, 0)
  if (!temJson && !mds.length) throw new Error('Nenhum backup encontrado nesta pasta.')
  if (!base) base = lerArquivo(JSON.stringify({ config: {}, fechadas: [] }))
  if ((await carregarDados(db)) && !confirmarSubstituir()) return null

  const { dados, novas, atualizadas } = mesclarMd(base, mds)
  await substituirDados(db, dados)
  pasta = h
  await gravarLocal('pasta', h)
  await gravarLocal('registroPasta', { arquivos: {}, hashes: {} } satisfies Registro)
  useBackup.setState({ estado: 'ok', nomePasta: h.name })
  return { nome: h.name, temJson, novas, atualizadas }
}
