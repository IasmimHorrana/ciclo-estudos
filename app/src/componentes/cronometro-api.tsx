import { FecharSessao, type FimDaSessao } from '@/componentes/FecharSessao'
import { IniciarLivre } from '@/componentes/IniciarLivre'
import { Button } from '@/componentes/ui/button'
import { carregarCiclo, type Ciclo } from '@/dados/ciclo'
import { db } from '@/dados/db'
import { todasMaterias } from '@/dominio/ciclo'
import { fmtHHMMSS, minutosDe, restaurarCronometro, type AlvoLivre } from '@/dominio/cronometro'
import { hoje, type DataISO } from '@/dominio/datas'
import { diaDe, materiasDoDia } from '@/dominio/livre'
import { abrirDialogo } from '@/estado/dialogo'
import { useCronometro } from '@/estado/cronometro'
import { useUi } from '@/estado/ui'
import { iniciarGravacaoCronometro, lerCronometroGravado } from '@/lib/cronometroSalvo'

/** Matérias para escolher: as do dia (modo Livre) e todas as outras (do ciclo e da semana). */
function materiasDe(c: Ciclo): { doDia: string[]; outras: string[] } {
  const doDia = c.preferencias.modoEstudo === 'livre' ? materiasDoDia(diaDe(c.preferencias.diaLivre, hoje())) : []
  const outras = [...new Set([...(c.semana?.passos.map((p) => p.materia) ?? []), ...todasMaterias(c.config)])]
  return { doDia, outras }
}

/** Pergunta o que será estudado e guarda a escolha. Devolve `false` se ela cancelou. */
export async function escolherAlvoLivre(): Promise<boolean> {
  const c = await carregarCiclo(db)
  const { doDia, outras } = materiasDe(c)
  const s = useCronometro.getState()
  const a = await abrirDialogo<AlvoLivre>('O que você vai estudar?', (fechar) => <IniciarLivre doDia={doDia} outras={outras} inicial={s.alvo ?? s.ultimoAlvo} fechar={fechar} />)
  if (!a) return false
  useCronometro.getState().definirAlvo(a)
  return true
}

/** "Estudar agora" do painel do modo Livre: escolhe a matéria (confirmando tipo e assunto) e liga o cronômetro livre. */
export async function estudarMateria(materia: string): Promise<void> {
  const s = useCronometro.getState()
  if (s.rodando || s.seg > 0) return
  useUi.getState().escolherRelogio('livre')
  s.definirAlvo({ materia, tipo: s.ultimoAlvo?.materia === materia ? s.ultimoAlvo.tipo : 'Teoria', assuntoId: null })
  if (await escolherAlvoLivre()) useCronometro.getState().alternar()
}

/** Botão Iniciar/Pausar: para começar, precisa saber a matéria. */
export async function iniciarOuPausarLivre(): Promise<void> {
  const s = useCronometro.getState()
  if (!s.rodando && !s.alvo && !(await escolherAlvoLivre())) return
  useCronometro.getState().alternar()
}

/** Encerra: para o relógio e abre "Fechar sessão". Salvar ou descartar zera; "Voltar" deixa parado, com o tempo. */
export async function encerrarLivre(data: DataISO = hoje()): Promise<void> {
  const s = useCronometro.getState()
  s.pausar()
  const { seg, alvo } = useCronometro.getState()
  if (!alvo) {
    if (seg < 60) return useCronometro.getState().zerar()
    if (!(await escolherAlvoLivre())) return
  }
  const a = useCronometro.getState().alvo
  if (!a) return
  const c = await carregarCiclo(db)
  const { doDia, outras } = materiasDe(c)
  const passos = c.preferencias.modoEstudo === 'ciclo' ? (c.semana?.passos ?? []) : []
  const r = await abrirDialogo<FimDaSessao>(`Fechar sessão · ${fmtHHMMSS(seg)}`, (fechar) => (
    <FecharSessao inicial={{ ...a, minutos: minutosDe(seg), data }} doDia={doDia} outras={outras} passos={passos} fechar={fechar} />
  ))
  if (r) useCronometro.getState().zerar()
}

type EscolhaRestaurar = 'fechar' | 'continuar' | 'descartar'

let iniciada = false

/** Ao abrir o app: devolve o cronômetro livre ao ponto em que estava e só depois passa a guardá-lo. */
export async function iniciarPersistenciaCronometro(): Promise<void> {
  if (iniciada) return
  iniciada = true
  const r = restaurarCronometro(lerCronometroGravado(), Date.now())
  if (r.tipo !== 'nada') useCronometro.getState().restaurar(r.estado)
  iniciarGravacaoCronometro()
  if (r.tipo !== 'perguntar') return
  const fora = r.minutosFora >= 90 ? `${Math.floor(r.minutosFora / 60)} h ${r.minutosFora % 60} min` : `${r.minutosFora} min`
  const escolha =
    (await abrirDialogo<EscolhaRestaurar>('Você tinha um estudo livre em andamento', (fechar) => (
      <>
        <p className="mt-0 mb-1 text-sm">
          O app foi fechado com o cronômetro rodando{r.estado.alvo ? <> (<b>{r.estado.alvo.materia}</b>)</> : null} e voltou depois de cerca de <b>{fora}</b>.
          Até o último momento em que ele estava aberto, foram <b>{r.minutosEstudados} min</b>.
        </p>
        <p className="m-0 mb-3 text-xs text-muted-foreground">Se você continuou estudando com o app fechado, ajuste os minutos ao fechar a sessão.</p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => fechar('fechar')}>Fechar a sessão ({r.minutosEstudados} min)</Button>
          <Button variant="outline" onClick={() => fechar('continuar')}>Continuar de onde parou</Button>
          <Button variant="outline" onClick={() => fechar('descartar')}>Descartar</Button>
        </div>
      </>
    ))) ?? 'continuar' // fechar a janela sem escolher não perde nada
  if (escolha === 'fechar') await encerrarLivre(r.data)
  else if (escolha === 'descartar') useCronometro.getState().zerar()
}
