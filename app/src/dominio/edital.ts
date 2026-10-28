// Edital verticalizado: leitura do texto colado, prioridade dos assuntos e sugestão de passos no ciclo. Puro.

/** Um tópico do edital e os subtópicos dele (se houver). */
export interface ItemLido {
  nome: string
  filhos: string[]
}

export interface MateriaLida {
  materia: string
  assuntos: ItemLido[]
}

/** Uma linha da lista que se confere na pré-visualização: tópico (0) ou subtópico (1). */
export interface LinhaLida {
  nome: string
  nivel: 0 | 1
}

/** Tópicos com subtópicos → lista plana com o nível de cada linha. */
export const achatarItens = (itens: readonly ItemLido[]): LinhaLida[] =>
  itens.flatMap((i) => [{ nome: i.nome, nivel: 0 as const }, ...i.filhos.map((f) => ({ nome: f, nivel: 1 as const }))])

/** Lista plana → tópicos com subtópicos. Um subtópico sem tópico acima vira tópico. */
export function agruparLinhas(linhas: readonly LinhaLida[]): ItemLido[] {
  const itens: ItemLido[] = []
  for (const l of linhas) {
    const ultimo = itens[itens.length - 1]
    if (l.nivel === 1 && ultimo) ultimo.filhos.push(l.nome)
    else itens.push({ nome: l.nome, filhos: [] })
  }
  return itens
}

/** Sem acento, minúsculo e com espaços únicos: serve para comparar nomes ao reimportar. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const MARCADOR = /^\s*(?:\d+(?:\.\d+)*[.)]?|[a-z][.)]|[-–—•*·▪●○■])\s+/i
const PREFIXO_MATERIA = /^\s*(?:disciplina|mat[ée]ria)\s*[:\-–—]\s*(.+)$/i
const ABREVIACOES = /(?:\b(?:art|arts|inc|al|cf|ex|dr|dra|sr|sra|v|vs|lc|ec|obs|p|pp|n|nº|no|nos|c\/c)|§|\d)\.$/i

const temMinuscula = (s: string) => /[a-zà-ÿ]/.test(s)
const temLetra = (s: string) => /[A-Za-zÀ-ÿ]/.test(s)
const limpar = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Primeira letra em maiúscula ("hardware e software" → "Hardware e software"). */
export const maiuscula = (s: string): string => s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1)

/**
 * Separa o nome de um tópico em título e descrição, no primeiro ":" ("Redes: conceitos básicos" → "Redes" e "conceitos básicos").
 * Só para mostrar na tela; o nome guardado não muda.
 */
export function partirNome(nome: string): { titulo: string; resto: string } {
  const i = nome.indexOf(':')
  if (i < 3 || i > nome.length - 2) return { titulo: nome, resto: '' }
  return { titulo: nome.slice(0, i).trim(), resto: nome.slice(i + 1).trim() }
}

/** Divide `total` horas em `n` partes iguais com centésimos que fecham a conta (10 em 3 → 3,34 + 3,33 + 3,33). */
export function repartirHoras(total: number, n: number): number[] {
  if (n <= 0) return []
  const t = Math.max(0, total)
  const base = Math.floor((t / n) * 100) / 100
  const sobra = Math.round((t - base * n) * 100)
  return Array.from({ length: n }, (_, i) => Math.round((base + (i < sobra ? 0.01 : 0)) * 100) / 100)
}

/** Divide "A; B" e "A. B" (frase nova com maiúscula), sem quebrar "art. 5º" nem "nº 8.112". */
function dividir(item: string): string[] {
  const partes: string[] = []
  for (const bloco of item.split(';')) {
    const palavras = bloco.split(/(?<=\.)\s+(?=[A-ZÀ-Ý])/)
    let atual = ''
    for (const p of palavras) {
      atual = atual ? `${atual} ${p}` : p
      if (!ABREVIACOES.test(atual.trim()) || p === palavras[palavras.length - 1]) {
        partes.push(atual)
        atual = ''
      }
    }
    if (atual) partes.push(atual)
  }
  return partes.map((p) => limpar(p).replace(/[.;,\s]+$/, '')).filter(Boolean)
}

/**
 * Lê o texto de um edital e separa matérias, tópicos e subtópicos.
 * Matéria: "Disciplina: X", linha terminando em ":" ou linha toda em maiúsculas (sem marcador).
 * Tópico: item numerado (1., a)), com marcador (-, •) ou frase solta; ";" separa vários numa linha.
 * Subtópico: (1) numeração com ponto depois de um item numerado ("1." seguido de "1.1", "1.2");
 * (2) item com ";" cuja primeira parte tem ":", como "Redes: conceitos; arquiteturas; NAT" (a primeira parte é o tópico, as outras são os subtópicos).
 * Linha sem marcador que começa em minúscula continua o assunto anterior.
 */
export function lerEdital(texto: string): MateriaLida[] {
  const materias: MateriaLida[] = []
  let atual: MateriaLida | null = null
  let ultimo = '' // assunto em montagem (pode receber continuação)
  let ultimoEhFilho = false
  let topoNumerado = false // o último tópico veio de um item numerado ("1.", "2.")

  const fechar = () => {
    if (!atual || !ultimo) return
    const partes = dividir(ultimo).map(maiuscula)
    const donoDosFilhos = atual.assuntos[atual.assuntos.length - 1]
    if (ultimoEhFilho && donoDosFilhos) donoDosFilhos.filhos.push(...partes)
    else if (ultimo.includes(';') && partes.length >= 2 && (partes[0] as string).includes(':')) atual.assuntos.push({ nome: partes[0] as string, filhos: partes.slice(1) })
    else for (const p of partes) atual.assuntos.push({ nome: p, filhos: [] })
    ultimo = ''
    ultimoEhFilho = false
  }
  const abrirMateria = (nome: string) => {
    fechar()
    const n = limpar(nome).replace(/[:\s]+$/, '')
    atual = materias.find((m) => normalizar(m.materia) === normalizar(n)) ?? null
    if (!atual) {
      atual = { materia: n, assuntos: [] }
      materias.push(atual)
    }
    topoNumerado = false
  }

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = limpar(bruta)
    if (!linha) continue
    const m = PREFIXO_MATERIA.exec(linha)
    if (m) {
      abrirMateria(m[1] as string)
      continue
    }
    const comMarcador = MARCADOR.test(linha)
    if (!comMarcador) {
      const semDoisPontos = linha.replace(/:$/, '')
      const maiuscula = temLetra(linha) && !temMinuscula(linha) && linha.length <= 80
      if (linha.endsWith(':') || maiuscula) {
        abrirMateria(semDoisPontos)
        continue
      }
      // continuação do assunto anterior
      if (ultimo && (/^[a-zà-ÿ(]/.test(linha) || !/[.;]$/.test(ultimo))) {
        ultimo = `${ultimo} ${linha}`
        continue
      }
    }
    fechar()
    if (!atual) abrirMateria('Geral')
    const pontilhado = /^\s*\d+(?:\.\d+)+[.)]?\s+/.test(linha) // 1.1, 2.3.1…
    const numerado = /^\s*\d+[.)]\s+/.test(linha) // 1., 2)
    ultimoEhFilho = comMarcador && pontilhado && topoNumerado
    if (!ultimoEhFilho) topoNumerado = comMarcador && numerado // só um item "1." vira pai de "1.1", "1.2"
    ultimo = comMarcador ? linha.replace(MARCADOR, '') : linha
  }
  fechar()

  // sem repetições dentro de cada matéria (uma repetição de tópico junta os subtópicos dela ao primeiro)
  return materias.map((mat) => {
    const vistos = new Set<string>()
    const novos = (nomes: string[]) =>
      nomes.filter((n) => {
        const k = normalizar(n)
        if (!k || vistos.has(k)) return false
        vistos.add(k)
        return true
      })
    const assuntos: ItemLido[] = []
    for (const item of mat.assuntos) {
      const ja = assuntos.find((i) => normalizar(i.nome) === normalizar(item.nome))
      if (ja) {
        ja.filhos.push(...novos(item.filhos))
        continue
      }
      const nome = novos([item.nome])[0]
      if (nome) assuntos.push({ nome, filhos: novos(item.filhos) })
    }
    return { materia: mat.materia, assuntos }
  })
}

export interface EntradaPrioridade {
  /** Peso da matéria na prova, 1 a 5. */
  pesoMateria: number
  /** Importância/dificuldade do assunto para você, 1 a 5. */
  importancia: number
  horasIdeais: number
  horasFeitas: number
  estudado: boolean
  questoes: number
  acertos: number
}

/**
 * Quanto maior, mais cedo estudar. peso × importância, mais forte quanto mais falta das horas ideais
 * e quanto pior o acerto (a partir de 3 questões). Assunto já estudado cai bastante; só volta um pouco se o acerto está baixo.
 */
export function prioridade(e: EntradaPrioridade): number {
  // importância 0 = não definida: conta como média (3) para a ordem, mas a tela mostra a barra cinza (ver `semDados`)
  const base = Math.max(0, e.pesoMateria) * (e.importancia > 0 ? e.importancia : 3)
  const falta = e.horasIdeais > 0 ? Math.max(0, e.horasIdeais - e.horasFeitas) / e.horasIdeais : e.estudado ? 0 : 1
  const taxa = e.questoes >= 3 ? e.acertos / e.questoes : null
  const fatorAcerto = taxa === null ? 1 : 1 + (1 - taxa)
  const fatorEstudo = e.estudado ? (taxa !== null && taxa < 0.6 ? 0.6 : 0.25) : 1
  return Math.round(base * (1 + falta) * fatorAcerto * fatorEstudo * 100) / 100
}

/** Quantos passos de uma matéria colocar no ciclo para cobrir as horas que faltam (no mínimo 1, no máximo o total do ciclo). */
export function sugerirRepeticoes(horasQueFaltam: number, duracaoPasso: number, totalPassos: number): number {
  if (duracaoPasso <= 0 || totalPassos <= 0) return 1
  const n = horasQueFaltam > 0 ? Math.ceil(horasQueFaltam / duracaoPasso - 1e-9) : 1
  return Math.min(Math.max(1, n), totalPassos)
}

/** Texto que vai na anotação do passo com os assuntos escolhidos. */
export const notaDosAssuntos = (nomes: readonly string[]): string => nomes.join('; ')

/**
 * Reparte os assuntos escolhidos de cada matéria entre os passos dela (em rodízio) e os escreve na anotação.
 * Passos com anotação já preenchida e matérias sem assuntos ficam como estão.
 */
export function distribuirAssuntos<P extends { materia: string; nota: string }>(passos: readonly P[], porMateria: Readonly<Record<string, readonly string[]>>): P[] {
  const contador = new Map<string, number>()
  const total = new Map<string, number>()
  for (const p of passos) if (!p.nota) total.set(p.materia, (total.get(p.materia) ?? 0) + 1)
  return passos.map((p) => {
    const assuntos = porMateria[p.materia]
    const n = total.get(p.materia) ?? 1
    if (!assuntos?.length || p.nota) return p
    const i = contador.get(p.materia) ?? 0
    contador.set(p.materia, i + 1)
    const meus = assuntos.filter((_, k) => k % n === i)
    return meus.length ? { ...p, nota: notaDosAssuntos(meus) } : p
  })
}

export interface ResumoEdital {
  assuntos: number
  estudados: number
  pctEstudados: number
  horasIdeais: number
  horasFeitas: number
  /** Horas feitas (limitadas ao ideal em cada assunto) ÷ horas ideais, de 0 a 100. */
  pctHoras: number
}

export function resumoEdital(itens: readonly { estudado: boolean; horasIdeais: number; horasFeitas: number }[]): ResumoEdital {
  const estudados = itens.filter((i) => i.estudado).length
  const horasIdeais = itens.reduce((s, i) => s + i.horasIdeais, 0)
  const horasFeitas = itens.reduce((s, i) => s + i.horasFeitas, 0)
  const uteis = itens.reduce((s, i) => s + (i.horasIdeais > 0 ? Math.min(i.horasFeitas, i.horasIdeais) : 0), 0)
  return {
    assuntos: itens.length,
    estudados,
    pctEstudados: itens.length ? Math.round((estudados / itens.length) * 100) : 0,
    horasIdeais,
    horasFeitas,
    pctHoras: horasIdeais > 0 ? Math.round((uteis / horasIdeais) * 100) : 0,
  }
}

export type OrdemEdital = 'edital' | 'prioridade' | 'falta'

export interface EntradaMontagem {
  materias: readonly { id: string; nome: string; peso: number; ordem: number }[]
  assuntos: readonly {
    id: string; materia: string; nome: string; ordem: number; importancia: number; horasIdeais: number; estudado: boolean; noCiclo: boolean; noEdital: boolean
    /** Tópico a que pertence (subtópico), ou `null`. */
    paiId: string | null
  }[]
  questoes: readonly { assuntoId: string | null; feitas: number; acertos: number }[]
  sessoes: readonly { assuntoId: string | null; minutos: number }[]
  ordem: OrdemEdital
  ocultarEstudados: boolean
  /** Só esta matéria (id), ou todas. */
  filtroMateria: string | null
  /** Tópicos fechados na tela (ids): os subtópicos deles não entram na lista de linhas. */
  recolhidos?: ReadonlySet<string>
  /**
   * Palavras procuradas no nome (sem acento e caixa). Fica a linha que casa, os tópicos acima dela e, se casou um tópico
   * ou a matéria, tudo o que está dentro. Durante a busca os tópicos ficam abertos e as matérias sem nada encontrado somem.
   */
  busca?: string
}

export interface LinhaEdital {
  id: string
  nome: string
  /** 0 = tópico ou assunto solto, 1 = subtópico… */
  nivel: number
  /** É um tópico com subtópicos: os números abaixo são a soma deles. */
  temFilhos: boolean
  /** Assuntos de verdade (sem subtópicos) dentro desta linha e quantos já estão estudados. */
  folhas: number
  folhasEstudadas: number
  /** Importância (1 a 5, ou 0 = não definida); num tópico, o valor comum dos subtópicos, ou `null` se forem diferentes. */
  importancia: number | null
  horasIdeais: number
  /** Num tópico, todos os subtópicos estudados. */
  estudado: boolean
  noCiclo: boolean
  certas: number
  erradas: number
  total: number
  /** % de acerto, ou null se ainda não há questões. */
  pctAcerto: number | null
  horasFeitas: number
  /** Horas que faltam para as ideais (0 se não há ideal definido). */
  falta: number
  prioridade: number
  /** Nada definido ainda (sem importância, sem horas ideais, poucas questões): a prioridade não diz nada. */
  semDados: boolean
}

export interface BlocoEdital {
  materia: { id: string; nome: string; peso: number }
  linhas: LinhaEdital[]
  /** Resumo dos assuntos de verdade da matéria (sem contar os tópicos), inclusive os ocultos pelo filtro. */
  resumo: ResumoEdital
  /** Horas que faltam nos assuntos ainda não estudados. */
  faltam: number
  totais: { certas: number; erradas: number }
  maiorPrioridade: number
}

const arred = (n: number) => Math.round(n * 100) / 100

/**
 * Matérias que aparecem no Edital: as que têm assunto do edital e as que ainda estão vazias (recém-criadas).
 * Uma matéria que só tem assuntos de fora do edital (criados em Desempenho, por exemplo) fica de fora.
 */
export function materiasDoEdital<M extends { nome: string }>(materias: readonly M[], assuntos: readonly { materia: string; noEdital: boolean }[]): M[] {
  return materias.filter((m) => {
    const dela = assuntos.filter((a) => normalizar(a.materia) === normalizar(m.nome))
    return dela.length === 0 || dela.some((a) => a.noEdital)
  })
}

interface No {
  linha: LinhaEdital
  filhos: No[]
  /** Linhas dos assuntos de verdade (as folhas) desta árvore. */
  folhas: LinhaEdital[]
}

export function montarEdital(e: EntradaMontagem) {
  const assuntosDoEdital = e.assuntos.filter((a) => a.noEdital)
  const porAssunto = new Map<string, { feitas: number; acertos: number; minutos: number }>()
  const ac = (id: string) => {
    let x = porAssunto.get(id)
    if (!x) porAssunto.set(id, (x = { feitas: 0, acertos: 0, minutos: 0 }))
    return x
  }
  for (const q of e.questoes) if (q.assuntoId) { const x = ac(q.assuntoId); x.feitas += q.feitas; x.acertos += q.acertos }
  for (const s of e.sessoes) if (s.assuntoId) ac(s.assuntoId).minutos += s.minutos

  const procura = normalizar(e.busca ?? '')
  const casa = (nome: string) => procura !== '' && normalizar(nome).includes(procura)
  const chaveDaOrdem = (l: LinhaEdital) => (e.ordem === 'prioridade' ? -l.prioridade : e.ordem === 'falta' ? -l.falta : 0)

  let blocos: BlocoEdital[] = materiasDoEdital(e.materias, e.assuntos)
    .filter((m) => !e.filtroMateria || m.id === e.filtroMateria)
    .map((m) => {
      const dela = assuntosDoEdital.filter((a) => normalizar(a.materia) === normalizar(m.nome))
      const ids = new Set(dela.map((a) => a.id))
      const filhosDe = new Map<string, typeof dela>()
      const raizes: typeof dela = []
      for (const a of dela) {
        if (a.paiId && ids.has(a.paiId)) filhosDe.set(a.paiId, [...(filhosDe.get(a.paiId) ?? []), a])
        else raizes.push(a)
      }
      const emOrdem = <T extends { ordem: number; nome: string }>(l: readonly T[]) => [...l].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))

      const propria = (a: (typeof dela)[number], nivel: number): LinhaEdital => {
        const x = porAssunto.get(a.id) ?? { feitas: 0, acertos: 0, minutos: 0 }
        const horasFeitas = arred(x.minutos / 60)
        return {
          id: a.id, nome: a.nome, nivel, temFilhos: false, folhas: 1, folhasEstudadas: a.estudado ? 1 : 0,
          importancia: a.importancia, horasIdeais: a.horasIdeais, estudado: a.estudado, noCiclo: a.noCiclo,
          certas: x.acertos, erradas: Math.max(0, x.feitas - x.acertos), total: x.feitas,
          pctAcerto: x.feitas ? Math.round((x.acertos / x.feitas) * 100) : null,
          horasFeitas,
          falta: a.horasIdeais > 0 ? arred(Math.max(0, a.horasIdeais - horasFeitas)) : 0,
          prioridade: prioridade({ pesoMateria: m.peso, importancia: a.importancia, horasIdeais: a.horasIdeais, horasFeitas, estudado: a.estudado, questoes: x.feitas, acertos: x.acertos }),
          semDados: !(a.importancia > 0) && a.horasIdeais === 0 && x.feitas < 3,
        }
      }

      const construir = (a: (typeof dela)[number], nivel: number): No => {
        const eu = propria(a, nivel)
        const filhos = emOrdem(filhosDe.get(a.id) ?? []).map((f) => construir(f, nivel + 1))
        if (!filhos.length) return { linha: eu, filhos: [], folhas: [eu] }
        filhos.sort((x, y) => chaveDaOrdem(x.linha) - chaveDaOrdem(y.linha))
        const folhas = filhos.flatMap((f) => f.folhas)
        const soma = (f: (l: LinhaEdital) => number) => filhos.reduce((t, n) => t + f(n.linha), 0)
        const certas = eu.certas + soma((l) => l.certas)
        const erradas = eu.erradas + soma((l) => l.erradas)
        const total = certas + erradas
        const pendentes = folhas.filter((f) => !f.estudado)
        const importancias = new Set(folhas.map((f) => f.importancia))
        const linha: LinhaEdital = {
          ...eu,
          temFilhos: true,
          folhas: folhas.length,
          folhasEstudadas: folhas.filter((f) => f.estudado).length,
          importancia: importancias.size === 1 ? (folhas[0]?.importancia ?? null) : null,
          horasIdeais: arred(soma((l) => l.horasIdeais)),
          estudado: pendentes.length === 0,
          certas, erradas, total,
          pctAcerto: total ? Math.round((certas / total) * 100) : null,
          horasFeitas: arred(eu.horasFeitas + soma((l) => l.horasFeitas)),
          falta: arred(pendentes.reduce((t, f) => t + f.falta, 0)),
          prioridade: pendentes.reduce((mx, f) => Math.max(mx, f.prioridade), 0),
          semDados: folhas.every((f) => f.semDados),
        }
        return { linha, filhos, folhas }
      }

      const arvore = emOrdem(raizes).map((r) => construir(r, 0))
      arvore.sort((x, y) => chaveDaOrdem(x.linha) - chaveDaOrdem(y.linha))
      const temAchado = (n: No): boolean => casa(n.linha.nome) || n.filhos.some(temAchado)
      // `dentro`: um tópico acima (ou a matéria) já casou com a busca, então mostra tudo daqui para baixo
      const emitir = (n: No, dentro: boolean): LinhaEdital[] => {
        if (e.ocultarEstudados && n.linha.estudado) return []
        if (procura && !dentro && !temAchado(n)) return []
        const aberto = procura !== '' || !e.recolhidos?.has(n.linha.id)
        return [n.linha, ...(aberto ? n.filhos.flatMap((f) => emitir(f, dentro || casa(n.linha.nome))) : [])]
      }
      const folhas = arvore.flatMap((n) => n.folhas)
      const todosOsIds = dela.map((a) => porAssunto.get(a.id) ?? { feitas: 0, acertos: 0, minutos: 0 })
      return {
        materia: { id: m.id, nome: m.nome, peso: m.peso },
        linhas: arvore.flatMap((n) => emitir(n, casa(m.nome))),
        resumo: resumoEdital(folhas),
        totais: {
          certas: todosOsIds.reduce((t, x) => t + x.acertos, 0),
          erradas: todosOsIds.reduce((t, x) => t + Math.max(0, x.feitas - x.acertos), 0),
        },
        faltam: arred(folhas.filter((l) => !l.estudado).reduce((s, l) => s + l.falta, 0)),
        maiorPrioridade: folhas.filter((l) => !l.estudado).reduce((mx, l) => Math.max(mx, l.prioridade), 0),
      }
    })
  if (e.ordem === 'prioridade') blocos = [...blocos].sort((a, b) => b.maiorPrioridade - a.maiorPrioridade)
  if (e.ordem === 'falta') blocos = [...blocos].sort((a, b) => b.faltam - a.faltam)

  const soma = (f: (b: BlocoEdital) => number) => blocos.reduce((t, b) => t + f(b), 0)
  const horasIdeais = soma((b) => b.resumo.horasIdeais)
  const horasFeitas = soma((b) => b.resumo.horasFeitas)
  const uteis = soma((b) => (b.resumo.pctHoras / 100) * b.resumo.horasIdeais)
  const assuntos = soma((b) => b.resumo.assuntos)
  const estudados = soma((b) => b.resumo.estudados)
  const total = {
    certas: soma((b) => b.totais.certas),
    erradas: soma((b) => b.totais.erradas),
    questoes: soma((b) => b.totais.certas + b.totais.erradas),
    resumo: {
      assuntos,
      estudados,
      pctEstudados: assuntos ? Math.round((estudados / assuntos) * 100) : 0,
      horasIdeais,
      horasFeitas,
      pctHoras: horasIdeais > 0 ? Math.round((uteis / horasIdeais) * 100) : 0,
    } satisfies ResumoEdital,
  }
  // os totais continuam sendo de todas as matérias mostradas; a busca só esconde as que não acharam nada
  return { blocos: procura ? blocos.filter((b) => b.linhas.length > 0) : blocos, total }
}

/** Assunto sugerido a partir da anotação do passo ("Posse; Contratos" → o primeiro que existir entre os assuntos da matéria). */
export function sugerirAssunto(nota: string, assuntos: readonly { id: string; nome: string }[]): string | null {
  for (const parte of nota.split(';')) {
    const k = normalizar(parte)
    if (!k) continue
    const a = assuntos.find((x) => normalizar(x.nome) === k)
    if (a) return a.id
  }
  return null
}
