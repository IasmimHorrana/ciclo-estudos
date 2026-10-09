import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import { lerArquivo, paraArquivo } from '@/dados/converter'
import { db } from '@/dados/db'
import { carregarDados, substituirDados, type ResumoImportacao } from '@/dados/repositorio'
import { hoje } from '@/dominio/datas'

type Aviso = { tipo: 'ok' | 'erro'; texto: string }

function descreve(r: ResumoImportacao) {
  const partes = [
    r.temSemana ? 'semana em andamento' : null,
    `${r.fechadas} semana(s) fechada(s)`,
    `${r.modelos} modelo(s)`,
    `${r.notas} resumo(s)`,
    `${r.assuntos} assunto(s)`,
    `${r.questoes} registro(s) de questões`,
    `${r.sessoes} sessão(ões) de foco`,
  ]
  return partes.filter(Boolean).join(', ')
}

function baixar(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Dados() {
  const entrada = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  // `undefined` = ainda lendo; `null` = banco vazio
  const dados = useLiveQuery(() => carregarDados(db).then((d) => d ?? null), [])

  async function importar(arquivo: File) {
    try {
      const novos = lerArquivo(await arquivo.text())
      if (dados && !window.confirm('Já existem dados neste app. Importar vai SUBSTITUIR tudo pelo conteúdo do arquivo. Continuar?')) return
      const r = await substituirDados(db, novos)
      setAviso({ tipo: 'ok', texto: `Importado: ${descreve(r)}.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível importar o arquivo.' })
    }
  }

  async function exportar() {
    const d = await carregarDados(db)
    if (!d) return setAviso({ tipo: 'erro', texto: 'Ainda não há dados para exportar.' })
    baixar(`ciclo-estudos-backup-${hoje()}.json`, JSON.stringify(paraArquivo(d), null, 2))
    setAviso({ tipo: 'ok', texto: 'Backup exportado. Guarde o arquivo fora da pasta do projeto (Documentos ou nuvem).' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <h1 className="m-0 text-xl font-bold">Dados e backup</h1>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="m-0 mb-1 text-sm font-bold">O que está guardado neste navegador</h2>
        {dados === undefined ? (
          <p className="m-0 text-sm text-muted-foreground">Lendo…</p>
        ) : dados === null ? (
          <p className="m-0 text-sm text-muted-foreground">Nada ainda. Importe o backup do app em HTML para começar com os seus dados.</p>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            {dados.config.mats.length} matéria(s) no ciclo, {dados.fechadas.length} semana(s) fechada(s), {dados.notas.length} resumo(s),{' '}
            {dados.assuntos.length} assunto(s), {dados.questoes.length} registro(s) de questões.
          </p>
        )}
        <p className="m-0 mt-2 text-xs text-muted-foreground">
          Os dados ficam só neste navegador e neste computador. Limpar os dados do site apaga tudo, por isso exporte um backup de vez em quando.
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <Button onClick={() => entrada.current?.click()}>
          <Upload className="size-4" /> Importar backup
        </Button>
        <Button variant="outline" onClick={exportar}>
          <Download className="size-4" /> Exportar backup
        </Button>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importar(f)
          }}
        />
        <p className="m-0 basis-full text-xs text-muted-foreground">
          Aceita o "Exportar backup completo" do app em HTML e os arquivos exportados daqui.
        </p>
      </section>

      {aviso && (
        <p
          role="status"
          className={`m-0 rounded-lg px-3 py-2 text-sm font-semibold ${aviso.tipo === 'ok' ? 'bg-ok-bg text-ok' : 'bg-erro-bg text-erro'}`}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  )
}
