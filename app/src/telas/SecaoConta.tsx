import { useState, type FormEvent } from 'react'
import { Cloud, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { Entrada } from '@/componentes/ui/entrada'
import { entrar, sair } from '@/dados/conta'
import { useConta } from '@/estado/conta'

/** Seção "Conta na nuvem" do painel Dados e backup: entrar e sair. A sincronização em si chega na sub-etapa 5.4. */
export function SecaoConta() {
  const { estado, email } = useConta()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function aoEntrar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro('')
    const msg = await entrar(form.email, form.senha)
    setOcupado(false)
    if (msg) setErro(msg)
    else setForm({ email: '', senha: '' })
  }

  async function aoSair() {
    setOcupado(true)
    try {
      await sair()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm" aria-labelledby="titulo-conta">
      <h2 id="titulo-conta" className="m-0 mb-1 flex items-center gap-1.5 text-sm font-bold">
        <Cloud className="size-4" /> Conta na nuvem
      </h2>

      {estado === 'semNuvem' && (
        <p className="m-0 text-sm text-muted-foreground">Esta versão do app foi gerada sem o endereço da nuvem. Tudo continua funcionando só neste aparelho.</p>
      )}

      {estado === 'carregando' && <p className="m-0 text-sm text-muted-foreground">Verificando a conta…</p>}

      {estado === 'dentro' && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 basis-full text-sm">
            ✅ Conectada como <strong className="break-all">{email}</strong>.
          </p>
          <p className="m-0 basis-full text-xs text-muted-foreground">
            A sincronização entre aparelhos chega na próxima versão. Por enquanto nada é enviado: os dados continuam só neste aparelho.
          </p>
          <Button variant="outline" size="sm" onClick={() => void aoSair()} disabled={ocupado}>
            <LogOut className="size-4" /> Sair da conta
          </Button>
        </div>
      )}

      {estado === 'fora' && (
        <form className="flex flex-col gap-2" onSubmit={(e) => void aoEntrar(e)} noValidate>
          <p className="m-0 text-sm text-muted-foreground">
            Entre para, em breve, ver os mesmos dados no computador e no celular. Use o e-mail e a senha da sua conta no Supabase (a mesma do app de finanças).
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs font-semibold">
              E-mail
              <Entrada
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={ocupado}
              />
            </label>
            <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs font-semibold">
              Senha
              <Entrada
                type="password"
                name="senha"
                autoComplete="current-password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                disabled={ocupado}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={ocupado}>
              <LogIn className="size-4" /> {ocupado ? 'Entrando…' : 'Entrar'}
            </Button>
            {erro && (
              <p role="alert" className="m-0 rounded-lg bg-erro-bg px-2 py-1 text-sm font-semibold text-erro">
                {erro}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
