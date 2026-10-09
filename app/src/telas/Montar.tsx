import type { ReactNode } from 'react'
import { useState } from 'react'
import { CampoNumero } from '@/componentes/CampoNumero'
import { avisar, confirmar, pedirTexto } from '@/componentes/dialogos-api'
import { Button } from '@/componentes/ui/button'
import { Entrada, Selecao } from '@/componentes/ui/entrada'
import {
  atualizarModelo, excluirModelo, garantirCores, gerarSemana, mudarConfig, nomeModeloExiste, renomearModelo, repetirSemanaFechada, salvarModelo,
  usarModelo, voltarAoPadrao, type Ciclo,
} from '@/dados/ciclo'
import { db } from '@/dados/db'
import { useCiclo, useHojeISO } from '@/dados/useCiclo'
import {
  corDe, fmtH, MATERIAS_PADRAO, passosDe, previaAgenda, previaPassos, round2, soma, temProgresso, todasMaterias, validarGerar,
} from '@/dominio/ciclo'
import { fmtData, idxDia, NOMES_DIA, NOMES_DIA_LONGO } from '@/dominio/datas'
import { useUi } from '@/estado/ui'
import { abrirDialogo } from '@/estado/dialogo'
import { cn } from '@/lib/utils'

const card = 'rounded-xl border bg-card p-3.5 shadow-sm'
const titulo = 'm-0 mb-1.5 text-sm font-bold'
const apoio = 'm-0 text-xs text-muted-foreground'

function Secao({ titulo: t, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn(card, className)}>
      <h2 className={titulo}>{t}</h2>
      {children}
    </section>
  )
}

export function Montar() {
  const ciclo = useCiclo()
  const hojeISO = useHojeISO()
  if (!ciclo) return <p className="text-sm text-muted-foreground">Carregando…</p>
  return <MontarTela ciclo={ciclo} hojeISO={hojeISO} />
}

function MontarTela({ ciclo, hojeISO }: { ciclo: Ciclo; hojeISO: string }) {
  const irParaAba = useUi((s) => s.irParaAba)
  const { config: c, semana, cores, modelos, fechadas } = ciclo
  const livre = c.modo === 'Livre'
  const passos = passosDe(c)
  const horasEf = round2(passos * c.duracao)
  const prev = previaPassos(c)
  const diff = passos - soma(c.mats, (m) => m.rep)
  const validacao = validarGerar(c)
  const disponiveis = todasMaterias(c).filter((m) => !c.mats.some((x) => x.nome === m))
  const ultima = [...fechadas].reverse().find((r) => r.modelo)
  const [nomeModelo, setNomeModelo] = useState('')

  const mexer = (fn: (x: typeof c) => typeof c) => mudarConfig(db, fn)

  async function salvarComoModelo() {
    if (!c.mats.length) return void avisar('Modelo', 'Adicione ao menos uma matéria ao ciclo antes de salvar como modelo.')
    const nome = nomeModelo.trim()
    if (nome && (await nomeModeloExiste(db, nome)) && !(await confirmar(`Já existe um modelo chamado "${nome}". Substituí-lo pela montagem atual?`, 'Substituir'))) return
    await salvarModelo(db, nome)
    setNomeModelo('')
  }

  async function aplicarModelo(id: string, nome: string) {
    if (c.mats.length && !(await confirmar(`Carregar o modelo "${nome}" substitui a montagem atual (matérias, meta e dias). Os modelos salvos não mudam. Continuar?`, 'Carregar'))) return
    await usarModelo(db, id)
  }

  async function gerar() {
    if (!validacao.ok) return void avisar('Erro de configuração', validacao.erro)
    if (temProgresso(semana)) {
      if (!(await confirmar('Já existe uma semana com marcações. Gerar um novo ciclo substitui a semana atual sem salvar estatísticas. Continuar?'))) return
    } else if (semana && !(await confirmar('Gerar um novo ciclo substitui a semana atual. Continuar?'))) return
    const r = await gerarSemana(db)
    if (!r.ok) return void avisar('Erro de configuração', r.erro)
    irParaAba('semana')
    if (r.passosSemDia) {
      void avisar('Passos sem dia', `${r.passosSemDia} passo(s) não couberam nos dias de estudo restantes da semana e ficaram em "Sem dia". Aumente os "passos por dia", marque mais dias ou mova-os manualmente.`)
    }
  }

  async function addMateria(v: string) {
    if (!v) return
    if (v === '__nova') return void novaMateria()
    await mexer((x) => (x.mats.some((m) => m.nome === v) ? x : { ...x, mats: [...x.mats, { nome: v, rep: 1, peso: 3 }] }))
    await garantirCores(db, [v])
  }

  async function novaMateria() {
    const t = await pedirTexto('Nova matéria', 'Nome (várias, separadas por vírgula)', '', {
      placeholder: 'Ex.: Legislação Específica, Inglês',
      ajuda: 'A matéria nova fica na lista para usar nas próximas semanas e já entra neste ciclo.',
      ok: 'Adicionar',
    })
    const nomes = (t ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!nomes.length) return
    await mexer((x) => {
      const custom = [...x.custom]
      const mats = [...x.mats]
      for (const n of nomes) {
        const ex = [...MATERIAS_PADRAO, ...custom].find((m) => m.toLowerCase() === n.toLowerCase())
        const nome = ex ?? n
        if (!ex) custom.push(n)
        if (!mats.some((m) => m.nome === nome)) mats.push({ nome, rep: 1, peso: 3 })
      }
      return { ...x, custom, mats }
    })
    await garantirCores(db, nomes)
  }

  function distribuirIgual() {
    void mexer((x) => {
      const n = x.mats.length
      if (!n) return x
      const base = Math.floor(passos / n)
      const extra = passos % n
      return { ...x, mats: x.mats.map((m, i) => ({ ...m, rep: base + (i < extra ? 1 : 0) })) }
    })
  }

  async function resetar() {
    if (await confirmar('Voltar ao padrão apaga as matérias adicionadas e a configuração atual do ciclo. A semana em andamento e o histórico não são afetados. Continuar?', 'Voltar ao padrão', true)) await voltarAoPadrao(db)
  }

  async function usarUltima() {
    if (!ultima) return
    if (c.mats.length && !(await confirmar('Carregar o ciclo dessa semana substitui a montagem atual. Continuar?', 'Carregar'))) return
    await repetirSemanaFechada(db, ultima.id)
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3 max-[1000px]:grid-cols-1 max-[1000px]:overflow-visible">
      {/* coluna esquerda: modelos, tamanho, dias */}
      <div className="flex min-h-0 flex-col gap-3 overflow-auto pr-0.5 max-[1000px]:overflow-visible">
        <Secao titulo="Modelos de ciclo">
          <p className={cn(apoio, 'mb-2')}>Salve a montagem atual para reaproveitar nas próximas semanas. Ao usar um modelo, as matérias voltam preenchidas e você ajusta antes de gerar.</p>
          <div className="flex gap-2">
            <Entrada
              className="min-w-0 flex-1"
              placeholder="Nome (ex.: Semana padrão 28h)"
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void salvarComoModelo()}
            />
            <Button onClick={() => void salvarComoModelo()}>💾 Salvar modelo</Button>
          </div>
          {ultima && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void usarUltima()}>
              ↻ Repetir o ciclo da última semana fechada ({fmtData(ultima.inicio)})
            </Button>
          )}
          <div className="mt-2 flex max-h-40 flex-col gap-1.5 overflow-auto">
            {modelos.length === 0 && <p className={apoio}>Nenhum modelo salvo ainda.</p>}
            {modelos.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{m.nome}</b>
                  <span className={apoio}>
                    {m.config.mats.length} matéria(s) · {fmtH(passosDe(m.config) * m.config.duracao)} por semana · {m.config.modo === 'Livre' ? 'Livre' : 'Ponderado'}
                  </span>
                </div>
                <Button size="sm" onClick={() => void aplicarModelo(m.id, m.nome)}>Usar</Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Substituir este modelo pela montagem atual"
                  onClick={async () => {
                    if (!c.mats.length) return void avisar('Modelo', 'A montagem atual está vazia.')
                    if (await confirmar(`Substituir o conteúdo do modelo "${m.nome}" pela montagem atual?`, 'Atualizar')) await atualizarModelo(db, m.id)
                  }}
                >
                  Atualizar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Renomear"
                  aria-label="Renomear modelo"
                  onClick={async () => {
                    const n = await pedirTexto('Renomear modelo', 'Nome', m.nome)
                    if (n) await renomearModelo(db, m.id, n)
                  }}
                >
                  ✎
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Excluir"
                  aria-label="Excluir modelo"
                  onClick={async () => {
                    if (await confirmar(`Excluir o modelo "${m.nome}"? As semanas já geradas não mudam.`, 'Excluir', true)) await excluirModelo(db, m.id)
                  }}
                >
                  🗑
                </Button>
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo="Tamanho do ciclo">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
              Meta semanal (horas)
              <CampoNumero key={`h${c.horas}`} valor={c.horas} aoConfirmar={(n) => n && n > 0 && void mexer((x) => ({ ...x, horas: n }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
              Duração de cada passo (h)
              <CampoNumero key={`d${c.duracao}`} valor={c.duracao} aoConfirmar={(n) => void mexer((x) => ({ ...x, duracao: n && n > 0 ? n : 1 }))} />
            </label>
          </div>
          <p className={cn(apoio, 'mt-2')}>
            {fmtH(c.horas)} ÷ {fmtH(c.duracao)} = <b>{passos} passos</b>
            {Math.abs(horasEf - c.horas) > 0.01 ? ` (arredondado: o ciclo terá ${fmtH(horasEf)})` : ''}. A duração de cada passo pode ser ajustada depois, na aba Semana.
          </p>
          <div className="mt-2 inline-flex rounded-lg border p-0.5">
            {(['Livre', 'Recomendado'] as const).map((m) => (
              <button
                key={m}
                onClick={() => void mexer((x) => ({ ...x, modo: m }))}
                className={cn('cursor-pointer rounded-md px-3 py-1 text-sm font-semibold', c.modo === m ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
              >
                {m === 'Livre' ? 'Ciclo Livre' : 'Ciclo Ponderado'}
              </button>
            ))}
          </div>
          <p className={cn(apoio, 'mt-1.5')}>
            {livre ? 'Livre: você diz quantas vezes cada matéria aparece.' : 'Ponderado: você dá um peso de 1 a 5 e o app divide os passos proporcionalmente.'}
          </p>
        </Secao>

        <Secao titulo="Dias de estudo">
          <p className={apoio}>
            Hoje é <b>{NOMES_DIA_LONGO[idxDia(hojeISO)]}, {fmtData(hojeISO)}</b>. A semana vai de segunda a domingo e os passos são distribuídos a partir de hoje, só nos dias marcados.
          </p>
          <div className="my-2 flex flex-wrap gap-1.5">
            {NOMES_DIA.map((n, i) => (
              <button
                key={n}
                aria-pressed={c.dias[i]}
                onClick={async () => {
                  if (c.dias[i] && c.dias.filter(Boolean).length === 1) return void avisar('Aviso', 'Mantenha ao menos um dia de estudo marcado.')
                  await mexer((x) => ({ ...x, dias: x.dias.map((d, k) => (k === i ? !d : d)) }))
                }}
                className={cn('cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold', c.dias[i] ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="flex max-w-64 flex-col gap-1 text-xs font-bold text-muted-foreground uppercase">
            Passos por dia (vazio = automático)
            <CampoNumero
              key={`pd${c.porDia}`}
              vazioOk
              placeholder="automático"
              valor={c.porDia}
              aoConfirmar={(n) => void mexer((x) => ({ ...x, porDia: n && n >= 1 ? Math.trunc(n) : null }))}
            />
          </label>
          <p className={cn(apoio, 'mt-2')}>{previaAgenda(c, hojeISO)}</p>
        </Secao>
      </div>

      {/* coluna direita: matérias do ciclo */}
      <Secao titulo="Matérias do ciclo" className="flex min-h-0 flex-col">
        <p className={cn(apoio, 'mb-2')}>
          {livre ? `Defina quantas vezes cada matéria aparece. A soma deve ser ${passos} passos.` : `Dê um peso de 1 a 5; os ${passos} passos serão divididos proporcionalmente.`} Para incluir uma matéria, use o seletor abaixo da lista.
        </p>
        {livre && c.mats.length > 0 && (
          <div className={cn('mb-2 rounded-lg px-3 py-1.5 text-sm font-semibold', diff === 0 ? 'bg-ok-bg text-ok' : diff > 0 ? 'bg-aviso-bg text-aviso' : 'bg-erro-bg text-erro')}>
            {diff === 0 && `Soma correta: ${passos} de ${passos} passos (${fmtH(horasEf)}).`}
            {diff > 0 && `Faltam ${diff} passo(s) para completar o ciclo de ${passos}. `}
            {diff < 0 && `Tire ${-diff} passo(s). O total do ciclo é ${passos}. `}
            {diff !== 0 && (
              <Button size="sm" variant="outline" className="ml-1" onClick={distribuirIgual}>
                Distribuir igualmente
              </Button>
            )}
          </div>
        )}
        {!livre && c.mats.length > passos && (
          <div className="mb-2 rounded-lg bg-erro-bg px-3 py-1.5 text-sm font-semibold text-erro">
            São {c.mats.length} matérias para {passos} passos. Aumente a meta de horas ou tire matérias.
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {c.mats.length === 0 && <p className={apoio}>Nenhuma matéria no ciclo ainda. Use o seletor abaixo para adicionar.</p>}
          {c.mats.map((m, i) => (
            <div key={m.nome} className="flex items-center gap-2 border-b py-1.5 last:border-b-0">
              <i className="size-2.5 shrink-0 rounded-full" style={{ background: corDe(cores, m.nome) }} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={m.nome}>{m.nome}</span>
              {livre ? (
                <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Repetições no ciclo">
                  Rep.
                  <CampoNumero
                    key={`r${m.nome}${m.rep}`}
                    className="w-14 text-center"
                    valor={m.rep}
                    aoConfirmar={(n) => void mexer((x) => ({ ...x, mats: x.mats.map((y, k) => (k === i ? { ...y, rep: n !== null && n >= 0 ? Math.min(Math.trunc(n), passos) : 0 } : y)) }))}
                  />
                </label>
              ) : (
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Peso
                  <Selecao className="w-16" value={m.peso} onChange={(e) => void mexer((x) => ({ ...x, mats: x.mats.map((y, k) => (k === i ? { ...y, peso: Number(e.target.value) } : y)) }))}>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Selecao>
                </label>
              )}
              <span className="hidden w-32 text-xs text-muted-foreground min-[1200px]:inline">
                {prev[m.nome] != null ? `≈ ${prev[m.nome]} passo(s) · ${fmtH((prev[m.nome] as number) * c.duracao)}` : ''}
              </span>
              <Button size="sm" variant="outline" title="Tirar do ciclo" aria-label={`Tirar ${m.nome} do ciclo`} onClick={() => void mexer((x) => ({ ...x, mats: x.mats.filter((_, k) => k !== i) }))}>
                ✕
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Selecao className="min-w-48 flex-1" aria-label="Adicionar matéria" value="" onChange={(e) => void addMateria(e.target.value)}>
            <option value="">＋ Adicionar matéria ao ciclo…</option>
            {disponiveis.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value="__nova">✏️ Digitar uma matéria nova…</option>
          </Selecao>
          <Button size="sm" variant="outline" onClick={() => void gerenciarMaterias()}>⚙ Gerenciar lista</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={!validacao.ok} onClick={() => void gerar()}>Gerar ciclo e abrir a semana</Button>
          <Button variant="destructive" onClick={() => void resetar()}>Voltar ao padrão</Button>
        </div>
      </Secao>
    </div>
  )
}

/** Tirar (ou trazer de volta) matérias da lista de escolha, sem apagar notas, questões ou semanas que usam o nome. */
function gerenciarMaterias() {
  return abrirDialogo('Lista de matérias', (fechar) => <GerenciarMaterias fechar={() => fechar()} />)
}

function GerenciarMaterias({ fechar }: { fechar: () => void }) {
  const ciclo = useCiclo()
  if (!ciclo) return null
  const { config: c, cores } = ciclo
  const lista = todasMaterias(c)
  return (
    <>
      <p className={cn(apoio, 'mb-2')}>
        São estas as matérias que aparecem para escolher no app. Tirar uma matéria da lista a remove também do ciclo que está sendo montado, mas não apaga notas, questões ou semanas que já usam o nome dela.
      </p>
      <div className="max-h-64 overflow-auto">
        {lista.length === 0 && <p className={apoio}>A lista está vazia.</p>}
        {lista.map((m) => (
          <div key={m} className="flex items-center gap-2 border-b py-1 last:border-b-0">
            <i className="size-2.5 rounded-full" style={{ background: corDe(cores, m) }} />
            <span className="flex-1 text-sm">{m}</span>
            <Button size="sm" variant="destructive" onClick={() => void mudarConfig(db, (x) => ({ ...x, ocultas: [...x.ocultas, m], mats: x.mats.filter((y) => y.nome !== m) }))}>
              Tirar da lista
            </Button>
          </div>
        ))}
      </div>
      {c.ocultas.length > 0 && (
        <>
          <h3 className="mt-3 mb-1 text-sm font-bold">Tiradas da lista</h3>
          {c.ocultas.map((m) => (
            <div key={m} className="flex items-center gap-2 border-b py-1 last:border-b-0">
              <span className="flex-1 text-sm">{m}</span>
              <Button size="sm" variant="outline" onClick={() => void mudarConfig(db, (x) => ({ ...x, ocultas: x.ocultas.filter((y) => y !== m) }))}>
                Trazer de volta
              </Button>
            </div>
          ))}
        </>
      )}
      <p className={cn(apoio, 'mt-3')}>Para incluir uma matéria nova, use "Digitar uma matéria nova…" no seletor.</p>
      <div className="mt-3 flex justify-end">
        <Button onClick={fechar}>Fechar</Button>
      </div>
    </>
  )
}
