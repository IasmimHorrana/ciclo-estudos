import type { SupabaseClient } from '@supabase/supabase-js'
import { mensagemDeErroDaConta, validarLogin } from '@/dados/conta-erros'
import { useConta } from '@/estado/conta'

/**
 * Conta na nuvem (Supabase, projeto compartilhado "financas-app"). O app funciona sem conta;
 * entrar só liga a sincronização (sub-etapa 5.4). Só a URL e a chave **publicável** ficam no app
 * (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`); a proteção dos dados vem das regras (RLS) no banco.
 *
 * A biblioteca do Supabase só é carregada quando precisa (import dinâmico), para não pesar a abertura do app.
 * A sessão fica guardada pelo próprio Supabase no navegador; sair não apaga nada dos dados locais.
 */

const URL_NUVEM = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const CHAVE_PUBLICA = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? ''

/** O app foi gerado com o endereço e a chave da nuvem? (sem isso, a seção Conta explica e nada quebra) */
export const nuvemConfigurada = () => !!URL_NUVEM && !!CHAVE_PUBLICA

let cliente: Promise<SupabaseClient> | null = null

/** Cliente do Supabase (um só para o app todo). Lança erro se a nuvem não estiver configurada. */
export function clienteNuvem(): Promise<SupabaseClient> {
  if (!nuvemConfigurada()) return Promise.reject(new Error('A nuvem não está configurada neste app.'))
  cliente ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_NUVEM, CHAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'ciclo-estudos-conta' },
    }),
  )
  return cliente
}

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)

/** Ao abrir o app: lê a sessão guardada (sem rede) e acompanha entradas, saídas e renovações. */
export async function iniciarConta(): Promise<() => void> {
  if (!nuvemConfigurada()) {
    useConta.setState({ estado: 'semNuvem', email: '' })
    return () => undefined
  }
  try {
    const sb = await clienteNuvem()
    const { data } = await sb.auth.getSession()
    useConta.setState({ estado: data.session ? 'dentro' : 'fora', email: data.session?.user.email ?? '' })
    const { data: sub } = sb.auth.onAuthStateChange((_evento, sessao) => {
      useConta.setState({ estado: sessao ? 'dentro' : 'fora', email: sessao?.user.email ?? '' })
    })
    return () => sub.subscription.unsubscribe()
  } catch {
    useConta.setState({ estado: 'fora', email: '' })
    return () => undefined
  }
}

/** Entra com e-mail e senha. Devolve `null` se deu certo, ou a mensagem de erro em português. */
export async function entrar(email: string, senha: string): Promise<string | null> {
  const invalido = validarLogin(email, senha)
  if (invalido) return invalido
  if (!online()) return mensagemDeErroDaConta(null, false)
  try {
    const sb = await clienteNuvem()
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha })
    if (error) return mensagemDeErroDaConta(error)
    useConta.setState({ estado: 'dentro', email: data.user?.email ?? email.trim() })
    return null
  } catch (e) {
    return mensagemDeErroDaConta(e, online())
  }
}

/** Sai da conta neste aparelho. Os dados continuam no aparelho; só a sincronização para. */
export async function sair(): Promise<void> {
  try {
    const sb = await clienteNuvem()
    await sb.auth.signOut({ scope: 'local' })
  } finally {
    useConta.setState({ estado: 'fora', email: '' })
  }
}
