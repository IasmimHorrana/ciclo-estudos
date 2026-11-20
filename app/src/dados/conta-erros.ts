/**
 * Mensagens de erro do login, em português. O Supabase devolve textos em inglês e códigos;
 * aqui viram frases que ela entende. Função pura (testada à parte).
 */
export function mensagemDeErroDaConta(erro: unknown, online = true): string {
  if (!online) return 'Sem internet. Conecte-se para entrar na conta; o app continua funcionando sem ela.'
  const e = (erro ?? {}) as { code?: unknown; message?: unknown; status?: unknown; name?: unknown }
  const codigo = typeof e.code === 'string' ? e.code : ''
  const texto = typeof e.message === 'string' ? e.message : erro instanceof Error ? erro.message : ''

  if (codigo === 'invalid_credentials' || /invalid login credentials/i.test(texto)) return 'E-mail ou senha incorretos.'
  if (codigo === 'email_not_confirmed' || /email not confirmed/i.test(texto)) return 'Este e-mail ainda não foi confirmado. Abra o e-mail de confirmação que o Supabase enviou.'
  if (codigo === 'over_request_rate_limit' || codigo === 'over_email_send_rate_limit' || e.status === 429 || /rate limit/i.test(texto)) {
    return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  }
  if (codigo === 'user_banned') return 'Esta conta está bloqueada no Supabase.'
  if (codigo === 'validation_failed' || /missing email|invalid email/i.test(texto)) return 'Confira o e-mail digitado.'
  if (e.name === 'AuthRetryableFetchError' || /failed to fetch|network|fetch failed|load failed/i.test(texto)) {
    return 'Não foi possível falar com a nuvem. Confira a internet e tente de novo.'
  }
  return 'Não foi possível entrar agora. Tente de novo em instantes.'
}

/** Confere o formulário antes de chamar a nuvem. Devolve a mensagem de erro, ou `null` se está ok. */
export function validarLogin(email: string, senha: string): string | null {
  if (!email.trim()) return 'Digite o seu e-mail.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Confira o e-mail digitado.'
  if (!senha) return 'Digite a sua senha.'
  return null
}
