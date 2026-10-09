import type { BancoCiclo } from '@/dados/db'
import type { NotaResumo } from '@/dados/esquemas'
import { novoId } from '@/dados/ids'
import { adaptarTexto, dividirSecoes, norm, type OpcoesImportar } from '@/dominio/markdown'
import { renomearLigacoes, tituloUnico } from '@/dominio/notas'

const vivas = (l: NotaResumo[]) => l.filter((n) => n.excluidoEm === null)

export async function carregarNotas(db: BancoCiclo): Promise<NotaResumo[]> {
  return vivas(await db.notas.toArray()).sort((a, b) => a.criado - b.criado)
}

/** Cria uma nota (o título é ajustado para não repetir). Sem texto, começa com "# Título" e um tópico. */
export async function criarNota(db: BancoCiclo, titulo: string, materia: string, texto?: string, agora = Date.now()): Promise<NotaResumo> {
  return db.transaction('rw', db.notas, async () => {
    const t = tituloUnico(vivas(await db.notas.toArray()).map((n) => n.titulo), titulo)
    const nota: NotaResumo = {
      id: novoId(agora), titulo: t, materia, texto: texto ?? `# ${t}\n\n- `, criado: agora, atualizado: agora,
      atualizadoEm: agora, excluidoEm: null, sujo: 1,
    }
    await db.notas.put(nota)
    return nota
  })
}

export async function salvarTextoNota(db: BancoCiclo, id: string, texto: string, agora = Date.now()): Promise<void> {
  const n = await db.notas.get(id)
  if (n && n.texto !== texto) await db.notas.put({ ...n, texto, atualizado: agora, atualizadoEm: agora, sujo: 1 })
}

export async function mudarMateriaNota(db: BancoCiclo, id: string, materia: string, agora = Date.now()): Promise<void> {
  const n = await db.notas.get(id)
  if (n) await db.notas.put({ ...n, materia, atualizado: agora, atualizadoEm: agora, sujo: 1 })
}

/** Renomeia a nota e atualiza as ligações [[...]] nas outras notas. Devolve o título final. */
export async function renomearNota(db: BancoCiclo, id: string, titulo: string, agora = Date.now()): Promise<string> {
  return db.transaction('rw', db.notas, async () => {
    const todas = vivas(await db.notas.toArray())
    const n = todas.find((x) => x.id === id)
    if (!n) return titulo
    const novo = tituloUnico(todas.filter((x) => x.id !== id).map((x) => x.titulo), titulo)
    if (novo === n.titulo) return novo
    for (const o of todas) {
      const texto = renomearLigacoes(o.texto, n.titulo, novo)
      if (texto !== o.texto && o.id !== id) await db.notas.put({ ...o, texto, atualizado: agora, atualizadoEm: agora, sujo: 1 })
    }
    await db.notas.put({ ...n, titulo: novo, texto: renomearLigacoes(n.texto, n.titulo, novo), atualizado: agora, atualizadoEm: agora, sujo: 1 })
    return novo
  })
}

export async function excluirNotaResumo(db: BancoCiclo, id: string, agora = Date.now()): Promise<void> {
  const n = await db.notas.get(id)
  if (n) await db.notas.put({ ...n, excluidoEm: agora, atualizadoEm: agora, sujo: 1 })
}

/** Abre (ou cria) o resumo de uma matéria: a primeira nota dela, ou "Matéria — resumo". */
export async function resumoDaMateria(db: BancoCiclo, materia: string, agora = Date.now()): Promise<NotaResumo> {
  const existente = (await carregarNotas(db)).find((n) => n.materia === materia)
  return existente ?? criarNota(db, `${materia} — resumo`, materia, undefined, agora)
}

/** Procura uma nota pelo título (sem diferenciar maiúsculas). */
export const acharPorTitulo = (notas: NotaResumo[], titulo: string) => notas.find((n) => norm(n.titulo) === norm(titulo))

export interface ItemImportar {
  titulo: string
  materia: string
  texto: string
}

/** Importa textos prontos (colados ou de arquivos), adaptando e dividindo conforme as opções. Devolve as notas criadas. */
export async function importarNotas(db: BancoCiclo, itens: ItemImportar[], o: OpcoesImportar, agora = Date.now()): Promise<NotaResumo[]> {
  const criadas: NotaResumo[] = []
  for (const it of itens) {
    const texto = adaptarTexto(it.texto, o)
    const partes = o.dividir ? dividirSecoes(texto, it.titulo) : [{ titulo: it.titulo, texto }]
    for (const p of partes) {
      const tx = /^\s*#\s/.test(p.texto) ? p.texto : `# ${p.titulo}\n\n${p.texto}`
      criadas.push(await criarNota(db, p.titulo, it.materia, tx, agora + criadas.length))
    }
  }
  return criadas
}
