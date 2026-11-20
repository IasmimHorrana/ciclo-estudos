import { describe, expect, it } from 'vitest'
import { mensagemDeErroDaConta, validarLogin } from '@/dados/conta-erros'

describe('mensagens de erro do login', () => {
  it('senha ou e-mail errados', () => {
    expect(mensagemDeErroDaConta({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 })).toBe('E-mail ou senha incorretos.')
    expect(mensagemDeErroDaConta({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
  })

  it('e-mail não confirmado, muitas tentativas, conta bloqueada', () => {
    expect(mensagemDeErroDaConta({ code: 'email_not_confirmed' })).toMatch('não foi confirmado')
    expect(mensagemDeErroDaConta({ status: 429, message: 'Request rate limit reached' })).toMatch('Muitas tentativas')
    expect(mensagemDeErroDaConta({ code: 'user_banned' })).toMatch('bloqueada')
  })

  it('sem internet ou rede falhando', () => {
    expect(mensagemDeErroDaConta(null, false)).toMatch('Sem internet')
    expect(mensagemDeErroDaConta(new TypeError('Failed to fetch'))).toMatch('Confira a internet')
    expect(mensagemDeErroDaConta({ name: 'AuthRetryableFetchError', message: '' })).toMatch('Confira a internet')
  })

  it('qualquer outro erro vira uma mensagem genérica em português (nunca o texto em inglês)', () => {
    expect(mensagemDeErroDaConta({ message: 'Database error querying schema' })).toBe('Não foi possível entrar agora. Tente de novo em instantes.')
    expect(mensagemDeErroDaConta(undefined)).toBe('Não foi possível entrar agora. Tente de novo em instantes.')
  })
})

describe('validar o formulário de login', () => {
  it('pede e-mail válido e senha', () => {
    expect(validarLogin('', 'x')).toBe('Digite o seu e-mail.')
    expect(validarLogin('sem-arroba', 'x')).toBe('Confira o e-mail digitado.')
    expect(validarLogin('a@b.com', '')).toBe('Digite a sua senha.')
    expect(validarLogin('  a@b.com ', 'segredo')).toBeNull()
  })
})
