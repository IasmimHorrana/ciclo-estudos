import type { SupabaseClient } from '@supabase/supabase-js'
import type { Servidor } from '@/dados/sincronizar'
import type { Colecao, RegistroNuvem } from '@/dominio/sincronia'

/**
 * O `Servidor` de verdade: tabelas `ciclo_` no Supabase (SQL em `supabase/migrations/0001_ciclo_sincronizacao.sql`).
 * As regras de acesso (RLS) garantem que só as linhas da conta logada são lidas e gravadas.
 */
interface LinhaNuvem {
  colecao: Colecao
  id: string
  dados: Record<string, unknown>
  editado_em: number | string
  excluido_em: number | string | null
  esquema_versao: number
  atualizado_em: string
}

/** Erro da nuvem com mensagem em português e o detalhe original guardado. */
export class ErroNuvem extends Error {
  readonly detalhe: unknown
  constructor(mensagem: string, detalhe: unknown) {
    super(mensagem)
    this.detalhe = detalhe
  }
}

const falhou = (onde: string, e: unknown): never => {
  const msg = (e as { message?: unknown })?.message
  if (typeof msg === 'string' && /atualize o app/i.test(msg)) throw new ErroNuvem('A nuvem pede uma versão mais nova do app. Atualize o app.', e)
  if (typeof msg === 'string' && /jwt|token|not authorized|permission denied|42501/i.test(msg)) {
    throw new ErroNuvem('A sessão expirou ou não tem permissão. Saia e entre de novo na conta.', e)
  }
  if (typeof msg === 'string' && /fetch|network|load failed/i.test(msg)) throw new ErroNuvem('Sem conexão com a nuvem.', e)
  throw new ErroNuvem(`Erro ao ${onde} na nuvem.`, e)
}

export function servidorSupabase(sb: SupabaseClient, usuarioId: string): Servidor {
  return {
    async agora() {
      const { data, error } = await sb.rpc('ciclo_agora')
      if (error) falhou('ler a hora', error)
      const n = Number(data)
      if (!Number.isFinite(n)) throw new ErroNuvem('A nuvem devolveu uma hora inválida.', data)
      return n
    },

    async versaoMinima() {
      const { data, error } = await sb.from('ciclo_config').select('valor').eq('chave', 'esquema_minimo').maybeSingle()
      if (error) falhou('ler a configuração', error)
      return Number((data as { valor?: unknown } | null)?.valor ?? 0) || 0
    },

    async temRegistros() {
      const { count, error } = await sb.from('ciclo_registros').select('id', { count: 'exact', head: true })
      if (error) falhou('conferir os dados', error)
      return (count ?? 0) > 0
    },

    async enviar(lote) {
      const linhas = lote.map((r) => ({
        user_id: usuarioId, // o gatilho do banco força o dono de qualquer jeito
        colecao: r.colecao,
        id: r.id,
        dados: r.dados,
        editado_em: r.editadoEm,
        excluido_em: r.excluidoEm,
        esquema_versao: r.esquemaVersao,
      }))
      const { error } = await sb.from('ciclo_registros').upsert(linhas, { onConflict: 'user_id,colecao,id' })
      if (error) falhou('enviar', error)
    },

    async buscar(desdeMs, deslocamento, limite) {
      const { data, error } = await sb
        .from('ciclo_registros')
        .select('colecao,id,dados,editado_em,excluido_em,esquema_versao,atualizado_em')
        .gt('atualizado_em', new Date(desdeMs).toISOString())
        .order('atualizado_em', { ascending: true })
        .order('colecao', { ascending: true })
        .order('id', { ascending: true })
        .range(deslocamento, deslocamento + limite - 1)
      if (error) falhou('receber', error)
      return ((data ?? []) as LinhaNuvem[]).map(
        (l): RegistroNuvem => ({
          colecao: l.colecao,
          id: l.id,
          dados: l.dados,
          editadoEm: Number(l.editado_em),
          excluidoEm: l.excluido_em === null ? null : Number(l.excluido_em),
          esquemaVersao: l.esquema_versao,
          atualizadoEm: Date.parse(l.atualizado_em),
        }),
      )
    },

    async marcarAparelho(id, nome, agoraServidor) {
      const { error } = await sb
        .from('ciclo_dispositivos')
        .upsert({ user_id: usuarioId, id, nome: nome.slice(0, 60), ultima_sync: new Date(agoraServidor).toISOString() }, { onConflict: 'user_id,id' })
      if (error) falhou('registrar o aparelho', error)
    },
  }
}
