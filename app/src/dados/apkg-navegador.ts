import type { BancoCiclo } from '@/dados/db'
import { importarPacote, lerApkg, type ResumoImportacao } from '@/dados/apkg'
import { sanitizarHtml } from '@/lib/sanitizar'

/** Lê um `.apkg` escolhido pelo usuário e grava no banco. O SQLite (WebAssembly) só é baixado nesta hora. */
export async function importarArquivoApkg(db: BancoCiclo, arquivo: File): Promise<ResumoImportacao> {
  const [{ default: iniciar }, { default: urlWasm }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
  ])
  const sql = await iniciar({ locateFile: () => urlWasm })
  const pacote = lerApkg(new Uint8Array(await arquivo.arrayBuffer()), sql)
  return importarPacote(db, pacote, sanitizarHtml)
}
