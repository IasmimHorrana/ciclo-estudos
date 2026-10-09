# Guia do app Ciclo de Estudos

Arquivo único: `ciclo-estudos.html` (HTML + CSS + JS, sem dependências, funciona offline).
Para usar: abrir o arquivo no navegador. Para mexer: editar o arquivo e dar F5.

**Autoria:** app pessoal de Iasmim, evoluído a partir do gerador de ciclos de Gabriel Ângelo (a lógica de geração e espaçamento do ciclo vem dele). O crédito não aparece mais na tela do app (removido a pedido); fica registrado apenas aqui.

> Regra do projeto: toda mudança no app atualiza este guia (seções afetadas + entrada no Histórico de mudanças no fim).

> **Em migração.** Este guia descreve o app em arquivo HTML único (tag `v0-html`). A base nova, que vai substituí-lo, está em `app/` e o plano completo e o andamento estão em `docs/PLANO.md`. Veja a seção "Base nova (`app/`)" logo abaixo.

---

## Base nova (`app/`)

Projeto Vite + React + TypeScript, com Tailwind CSS e componentes no padrão shadcn/ui, estado de tela em Zustand, dados locais em Dexie (IndexedDB, a partir da etapa 2), PWA instalável e, mais adiante, Supabase para sincronizar. Para rodar:

```
cd app
npm install
npm run dev        # servidor local (http://localhost:5173)
npm test           # testes (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # versão de produção (gera também o service worker do PWA)
npm run icones     # regera os ícones do PWA a partir de public/favicon.svg
```

Estrutura da base nova (etapas 1, 2 e 4 prontas; etapa 3 em andamento):
- `src/dominio/`: regras puras e testadas (Vitest), sem tela nem banco. Ciclo e semana (`ciclo.ts`), datas em fuso local (`datas.ts`), Pomodoro (`pomodoro.ts`), Desempenho (`desempenho.ts`), Markdown e editor dos resumos (`markdown.ts`, `notas.ts`), geometria dos gráficos (`graficos.ts`), passos das opções (`passos.ts`) e as regras de flashcards listadas abaixo. Ainda por vir: `busca.ts` (Navegar).
- `src/dados/`: banco local (Dexie, `db.ts`; para mudar o formato crie `version(2)` com `upgrade`, nunca edite a v1), esquemas Zod do backup (`esquemas.ts`), conversão do backup do app em HTML e exportação (`converter.ts`), leitura/gravação (`repositorio.ts`), `.zip` sem dependências (`zip.ts`), `.md` dos resumos (`arquivos.ts`, `mesclar.ts`) e backup automático em pasta (`pasta.ts`, só Chrome/Edge; a pasta e o registro do que foi gravado ficam na tabela `local`, só deste aparelho). Nada é apagado de verdade: o que sai ganha `excluidoEm`. Dados do ciclo e da semana em `ciclo.ts`, de Desempenho em `desempenho.ts`, dos resumos em `notas.ts`; `useCiclo.ts` traz o ciclo para as telas e a data de hoje (que se atualiza na virada do dia).
- `src/dominio/` (flashcards): `mapaCalor.ts` (calendário de calor e sequências), `sm2.ts` (agendador SM-2 como o Anki: passos, Errei/Difícil/Bom/Fácil, atraso, variação, sanguessuga, rótulos dos botões, virada do dia às 4h), `fila.ts` (limites diários por baralho, o limite do pai vale para os filhos, ordem aprendizado → revisão → novos, antecipação, irmãos), `cloze.ts` e `modelo.ts` (tipos de nota, campos, `{{FrontSide}}`, `{{cloze:}}`, `{{type:}}`, seções), `passos.ts`.
- `src/dados/flashcards*.ts`: baralhos (um por matéria e um subbaralho por assunto, criados sozinhos; ou à mão com `::`), notas → cartões, responder/desfazer, suspender/enterrar/marcar/bandeira. Tabelas do Dexie v3 (a v4 acrescenta `materiasEdital`): `baralhos`, `gruposOpcoes`, `tiposNota`, `notasFc`, `cartoes`, `revlog` (histórico só acrescenta).
- `src/estado/`: Zustand, só o que é de tela. `ui.ts` (aba e tema, guardados no navegador), `pomodoro.ts` (cronômetro), `dialogo.ts` (confirmar/avisar/formulários), `backup.ts` (estado do backup em pasta), `flashcards.ts`, `desempenho.ts` e `resumos.ts` (filtros e seleções). Os dados de estudo ficam no Dexie, não aqui.
- `src/componentes/`: `ui/` (padrão shadcn: botão, entradas), `barra-lateral/` (menu, calendário, Pomodoro), `graficos/` (rosca, pizza e barras em SVG), diálogos (`Dialogos.tsx` e `dialogos-api.tsx`), `CampoNumero.tsx` (campo que só confirma ao sair), `FormularioQuestoes.tsx`, `RegistrarTempo.tsx`, `IniciarFoco.tsx` (+ `iniciar-foco-api.tsx`) e `AvisoSemana.tsx`.
- `src/telas/`: `Dados.tsx` (importar/exportar JSON e .zip, backup em pasta e restaurar; botão no rodapé da barra lateral, que fica verde com o backup em pasta ativo); `Edital.tsx` e `telas/edital/` (importar com pré-visualização); `telas/flashcards/` (Baralhos, Estudo, Adicionar, Opções do baralho); as demais abas têm só um aviso "em breve" por aba; as telas reais chegam nas etapas 3 e 4.
- `src/index.css`: paleta verde-menta (claro e escuro) com os nomes de variáveis do shadcn/ui; `.dark` na raiz ativa o tema escuro. Temas testados e descartados (para consultar no histórico do Git): cinza-carvão neutro (`775e642`), roxo/lilás/limão (`6d073d4`) e neutro com coral e slate (`bf71c51`); o **claro** voltou ao verde-menta original e o **escuro** ficou com o cinza-carvão neutro (`775e642`: fundo `#141414`, barra lateral `#1a1a1a`, cartões `#212121`, bordas `#353535`, destaque verde-menta; `--calor-1..4` pintam o calendário de calor, pastéis no claro e verdes vivos no escuro).
- Layout de tela única no computador (a página não rola), e empilhado no celular.

**Flashcards (etapa 3, parcial):** aba Flashcards com **calendário de calor** embaixo dos baralhos, centralizado (último ano, um quadrado por dia, verdes pastéis: mais forte = mais cartões; mostra o estudado hoje, média diária, % de dias estudados, maior sequência e sequência atual, a partir do histórico `revlog`; passe o mouse num dia para ver a contagem), baralhos e contagens (azul novos, vermelho aprender, verde revisar), estudo com 4 botões e intervalos, atalhos `Espaço/Enter`, `1-4`, `Ctrl+Z`, `*` marcar, `-` e `=` esconder cartão/nota até amanhã, `@` e `!` suspender cartão/nota, `Ctrl+1..4` bandeira; opções do baralho (limites, passos, intervalos, sanguessuga); adicionar cartões (Básico, invertido, invertido opcional, digitar resposta, omissão/cloze) em caixa de texto simples. Ainda faltam: editor rico com imagens, Navegar, Estatísticas, importar/exportar do Anki.

**Abas portadas do app em HTML (etapa 4):**
- **Montar ciclo** (`telas/Montar.tsx`): modelos salvos, meta em horas, duração do passo, modo Livre/Ponderado, dias de estudo, passos por dia, matérias do ciclo, gerenciar a lista de matérias, gerar a semana. Regras em `dominio/ciclo.ts` (distribuição, ciclo espaçado, agenda por dias), dados em `dados/ciclo.ts`.
- **Semana** (`telas/Semana.tsx`; o quadro do ciclo está em `telas/QuadroSemana.tsx`): o "Ciclo da semana" é um quadro com uma coluna por dia (hoje em destaque) e um cartão colorido por passo (matéria, horas, anotação, círculo para concluir); clicar no cartão abre a edição (horas, dia, anotação, Resumo). Antes era uma lista. A tira de dias que ficava acima do quadro foi removida (o cabeçalho de cada coluna já mostra o dia e o andamento). A **Constância nos estudos** (`telas/PainelSemana.tsx`, regra em `dominio/constancia.ts`) é uma faixa de 28 dias acima do quadro: verde = estudou (foco do Pomodoro, questões ou passo concluído), vermelho = faltou num dia de estudo, cinza = folga, contorno = hoje; mostra "há N dias sem falhar". O quadro é um calendário com uma coluna por dia, de cima a baixo. A coluna da direita continua com a rosca "Ciclo" e "Por matéria"; horas planejadas/feitas, anotação, mudar o dia, rosca do ciclo, por matéria, copiar lista, fechar semana (resumo com pizza), reagendar pendentes, limpar. O botão "Resumo" de cada passo abre (ou cria) o resumo da matéria.
- **Publicação (GitHub Pages):** o repositório é **público** (conferido: não há dados pessoais, senhas nem backups nele; os dados de estudo ficam só no navegador de cada aparelho). O fluxo `.github/workflows/pages.yml` roda a cada mudança na `main`: testa, compila com `VITE_BASE=/ciclo-estudos/` e publica `app/dist` em **https://iasmimhorrana.github.io/ciclo-estudos/**. Depois de abrir o endereço uma vez com internet, o app instala (celular: "Adicionar à tela inicial"; computador: ícone de instalar na barra do Chrome) e abre sem internet. Cuidados: caminhos de arquivos do app usam `import.meta.env.BASE_URL` (nada de `/arquivo` fixo); no Windows (Git Bash), para testar a build com base, use `MSYS_NO_PATHCONV=1 VITE_BASE=/ciclo-estudos/ npm run build`, senão o caminho sai trocado. **Atualização:** o navegador guarda uma cópia do app para o modo offline. Quando sai versão nova, ela é baixada e ativada por baixo e o app **se recarrega sozinho** (`lib/atualizacao.ts`), esperando o Pomodoro parar se ele estiver rodando; os dados não são apagados. Se uma aba antiga (anterior a este recurso) não atualizar, feche todas as abas do site e abra de novo, ou em F12 → Application → Service Workers use **Unregister** (nunca "Clear site data", que apaga seus dados). Cada aparelho tem os próprios dados até a sincronização (etapa 5): use Dados → Exportar/Importar para levar de um para o outro.
- **Edital verticalizado** (`telas/Edital.tsx`, regras em `dominio/edital.ts`, dados em `dados/edital.ts`): uma tabela por matéria com os assuntos. **Importar edital**: cola o texto, o app separa matérias (linha em MAIÚSCULAS, "Disciplina: X" ou terminada em ":") de assuntos (itens numerados, com hífen ou separados por ";"), mostra uma pré-visualização para corrigir e só então salva; reimportar não duplica (compara sem acento e sem diferença de maiúsculas). Em cada assunto: ☐ estudado, certas/erradas/total/% (vêm das questões registradas no Desempenho), **importância** (1–5, sua), **horas ideais** (suas), **feito** (horas do Pomodoro/tempo registrado no assunto) e uma barra de **prioridade**. A matéria tem **peso** (1–5). Prioridade = peso × importância, mais forte quanto mais faltam das horas ideais e quanto pior o acerto (a partir de 3 questões); assunto estudado cai bastante (só sobe um pouco se o acerto está abaixo de 60%). Ordenar por ordem do edital, maior prioridade ou mais horas faltando; ocultar estudados; filtrar uma matéria. Rodapé com TOTAL (certas, erradas, questões, assuntos) e PROGRESSO (% de assuntos estudados e horas feitas × ideais). **＋ Ciclo**: na matéria, coloca-a em "Matérias do ciclo" (aba Montar) com repetições sugeridas pelas horas que faltam (limitadas ao total de passos) e leva os 3 assuntos de maior prioridade; no assunto, marca "no ciclo". Ao **Gerar ciclo**, os assuntos marcados viram a anotação dos passos da matéria, repartidos em rodízio (passo que já tem anotação não é mexido), e a marcação é consumida. **O Edital mostra só o que veio de um edital:** assuntos importados (ou criados com "＋ Assunto" na própria aba) têm a marca `noEdital`; os criados em Desempenho, no Pomodoro ou nos Flashcards não aparecem lá. Ao importar um edital, um assunto que já existia no app com o mesmo nome (sem acento/caixa) é **ligado** ao edital, sem duplicar, e as questões e horas dele passam a contar na tabela. Os assuntos são um cadastro só para o app inteiro (Desempenho, Pomodoro, Flashcards e Edital): a marca só decide quem aparece na aba Edital. **Tirar do edital** (matéria ou assunto) não apaga nada; só solta o assunto da tela. Uma matéria só com assuntos de fora do edital some da aba; matérias vazias (recém-criadas) aparecem. Dados: tabela `materiasEdital` (peso e ordem) e campos novos em `assuntos` (`ordem`, `importancia`, `horasIdeais`, `estudado`, `noCiclo`), Dexie v4; backups antigos abrem normalmente (campos novos ganham padrão). Edital importado em versões anteriores (sem a marca) precisa ser importado de novo: o app liga pelo nome, sem duplicar.
- **Desempenho** (`telas/Desempenho.tsx`, regras em `dominio/desempenho.ts`): visão Estudo (horas do Pomodoro, questões, nível por assunto, gráficos por dia) e visão Semanas (histórico, repetir ciclo, excluir). Registrar questões abre pelo botão ou pelo "+ Questões" da barra lateral.
- **Resumos** (`telas/Resumos.tsx`, Markdown em `dominio/markdown.ts`): notas por matéria (grupos que recolhem), busca, editor com Tab/Shift+Tab e continuação de listas, `[[ligações]]` com sugestões, "Mencionada em", tópicos que recolhem, importar texto do NotebookLM/ChatGPT/arquivos, exportar `.md`.
- **Barra lateral:** calendário marcado (o quadro "Hoje e semana" foi removido a pedido; o registro de questões continua em Desempenho), Pomodoro maior, no estilo do modelo de referência (abas Foco / Pausa curta / Pausa longa, anel de progresso com o tempo no centro, Iniciar/Pausar, Encerrar e reiniciar; as abas só trocam com o relógio parado). **Ao clicar em Iniciar num foco novo**, abre "O que você vai estudar?" (passo, tipo e assunto; o assunto vem sugerido pela anotação do passo ou pela última escolha, e "＋ Novo assunto…" cria um assunto na hora para a matéria (ele também aparece no Edital e nas Questões); "Estudar sem registrar" não soma nada). A escolha aparece no cartão (clique para trocar) e, quando o foco termina ou é encerrado, o tempo é somado sozinho ao passo e à sessão do Desempenho/Edital, sem janela. Pausar e retomar não pergunta de novo. Se não houve escolha (ex.: sem semana ou o passo sumiu), cai na janela antiga "a qual passo somar?" (`RegistrarTempo.tsx`); faixa de aviso quando a semana já terminou.

Ainda **não** estão na base nova: (do Flashcards, o editor rico, Navegar, Estatísticas e importar do Anki) e a sincronização.

## 1. Como o app funciona (visão rápida)

### Layout (tela cheia com barra lateral)

O app usa a largura inteira do navegador. À esquerda há uma **barra lateral fixa**, presente em todas as abas, com:
- o **menu** de navegação (Montar ciclo, Semana, Desempenho, Edital, Resumos, Flashcards) e o botão de tema;
- o **calendário do mês** (‹ › mudam o mês, clicar no nome volta para hoje). Hoje fica em destaque, a semana em andamento tem fundo claro, um ponto marca dias com passos (verde = todos feitos) e um traço verde ou laranja na base marca semanas fechadas (ciclo fechado ou incompleto). Clicar em um dia da semana atual abre a aba Semana naquele dia; clicar em um dia de semana fechada abre o resumo dela;
- **Hoje e semana**: os passos de hoje (dá para marcar direto ali), as barras de passos e horas da semana, as **questões feitas hoje** e o botão ＋ Registrar questões;
- o **Pomodoro**, que continua rodando enquanto você troca de aba;
- no rodapé, o botão de **status do backup** ("☁ Backup em dia · 14:32", "⚠ Sem backup automático"…), que abre o painel **Dados e backup**.

**Tela única (computador).** Em telas a partir de 1100 px de largura e 620 px de altura o app **não rola a página**: a barra lateral e a área principal ocupam exatamente a altura da janela, cada aba é dividida em colunas (Montar: modelos | tamanho e dias | matérias; Semana: lista do ciclo | rosca e matérias; Desempenho: matérias e assuntos | rosca e horas | questões e registros (na visão Semanas: lista | gráfico); Resumos: notas | editor | pré-visualização) e **só as listas longas rolam dentro do próprio quadro**. Em telas menores (celular, janela pequena) o layout volta a empilhar e a página rola normalmente. Todas as regras disso estão no bloco de CSS `TELA ÚNICA`, dentro de uma `@media (min-width:1100px) and (min-height:620px)`.

Cada seção da lateral pode ser recolhida clicando no título. Em telas estreitas (celular) a lateral vira um bloco no topo, com as seções recolhidas.

Cinco abas:

| Aba | O que faz |
|---|---|
| **Montar ciclo** | Modelos salvos, meta semanal em horas, modo (Livre ou Ponderado), dias de estudo e a lista de matérias do ciclo (em duas colunas em tela larga). O botão "Gerar ciclo e abrir a semana" cria a semana. Ver "Montar o ciclo e repetir semanas". |
| **Semana** | Tira com os 7 dias (clique leva ao dia), checklist do ciclo por dia (cada passo com barra de progresso na cor da matéria), rosca do ciclo, horas, anotações, meta, atalho 📝 Resumo e "Fechar semana". |
| **Desempenho** | Duas visões: **Estudo** (matérias abertas em assuntos, registro de questões, nível de cada assunto e gráficos de horas e acertos) e **Semanas** (semanas fechadas, horas × meta, repetir ciclo). Ver seção "Desempenho". |
| **Resumos** | Notas em Markdown por matéria (estilo RemNote): tópicos, `[[links]]`, importação de texto pronto e backup em pasta. Ver seção "Resumos". |
| **Flashcards** | Aba em branco, de propósito: o sistema ainda vai ser desenhado em conversa (ver "Flashcards"). |

Fluxo: **Montar ciclo → gerar → Semana (preenchida automaticamente) → estudar e marcar → Fechar semana → Desempenho › Semanas**. Os resumos acompanham as matérias do ciclo.

### Montar o ciclo e repetir semanas

**Tamanho do ciclo.** Você informa a **meta semanal em horas** (ex.: 28) e a **duração de cada passo** (ex.: 1h); o app calcula os passos (28 ÷ 1 = 28). Se a conta não fechar (28 ÷ 1,5), arredonda e avisa quantas horas o ciclo terá.

**Matérias do ciclo.** Existe uma lista única de matérias, e cada uma tem repetições (modo Livre) e peso de 1 a 5 (modo Ponderado), então trocar de modo não perde as matérias.
- Para incluir: seletor "＋ Adicionar matéria ao ciclo…" no fim da lista. Escolha uma matéria da lista (as 10 matérias padrão e as que você criou) ou "Digitar uma matéria nova…" (aceita várias, separadas por vírgula; a nova fica salva para as próximas semanas).
- Para tirar do ciclo: ✕ na linha. Isso só tira do ciclo, não apaga a matéria da lista.
- Para tirar uma matéria **da lista de escolha** (ex.: uma que você não estuda mais): botão **⚙ Gerenciar lista de matérias**, no fim da lista. Ali "Tirar da lista" remove a matéria dos seletores do app (ciclo, Desempenho, Resumos, importador) e do ciclo em montagem, sem apagar notas, questões ou semanas que usam o nome; as tiradas ficam numa seção "Tiradas da lista" com "Trazer de volta".
- Modo Livre: a soma das repetições precisa ser igual ao total de passos; o botão "Distribuir igualmente" divide o total entre as matérias.
- Modo Ponderado: o app mostra, ao lado de cada matéria, quantos passos e horas ela terá.

**Modelos e repetição.** Para não montar do zero toda semana:
1. Monte o ciclo e dê um nome em **Modelos de ciclo → Salvar como modelo** (ex.: "Semana padrão 28h"). Salvar com o mesmo nome substitui o modelo.
2. Na semana seguinte, **Usar** o modelo carrega as matérias, a meta e os dias no formulário; ajuste (tire uma matéria, mude repetições) e gere. O modelo salvo não muda sozinho; **Atualizar** o substitui pela montagem atual.
3. Atalhos sem nomear: ao **Fechar semana**, "Salvar e montar a próxima semana" já devolve o ciclo recém-fechado ao formulário; "↻ Repetir o ciclo da última semana fechada" faz o mesmo a qualquer momento; e no **Histórico** cada semana tem "↻ Repetir ciclo".
Cada semana gerada guarda uma cópia da montagem usada (`semana.modelo`), por isso o "repetir" funciona mesmo que você tenha mudado o formulário depois.

### Calendário e dias

O app usa a data do computador (fuso local) e trabalha com a **semana real, de segunda a domingo**:

- Na aba Montar, "Dias de estudo" define quais dias da semana você estuda (padrão seg–sáb) e, opcionalmente, quantos passos por dia (vazio = automático: passos ÷ dias restantes).
- `gerar()` distribui os passos, em ordem, **a partir de hoje** e só nos dias marcados (`agendar()`). Se não restar nenhum dia de estudo na semana atual, usa a próxima semana. Passos que não couberem (só acontece com "passos por dia" manual) ficam em "Sem dia", com aviso.
- Na aba Semana os passos aparecem agrupados por dia, com **HOJE** em destaque e o selo **atrasado** em dias passados com passos pendentes. Cada passo tem um seletor para mudar o dia à mão.
- "Reagendar pendentes a partir de hoje" redistribui os passos não concluídos nos dias que ainda restam (sobrescreve dias ajustados à mão nesses passos).
- Se a semana em andamento já terminou no calendário, aparece um aviso no topo de todas as abas pedindo para fechá-la. O app também percebe a virada do dia com a página aberta (checagem a cada minuto e ao voltar para a aba).
- Ao fechar a semana com "Salvar e limpar marcações" (ou "Limpar marcações sem salvar"), o ciclo é reagendado na semana real da data de hoje.
- Não há integração com Google Calendar nem com outro calendário externo.

Ao clicar em "Gerar ciclo e abrir a semana", a função `gerar()` cria `state.semana` com um passo por posição do ciclo e abre a aba Semana já preenchida. Se já existir uma semana em andamento, o app pergunta antes de substituí-la, e a semana antiga se perde sem salvar estatística (para guardar, feche a semana antes).

## Desempenho (assuntos, questões e horas)

No topo da aba há o seletor **Estudo | Semanas**.

**Visão Semanas** (ocupa o lugar da antiga aba Histórico): indicadores (semanas fechadas, ciclos completos, horas nessas semanas, % médio de passos concluídos), a lista de semanas fechadas (ciclo fechado ou incompleto, horas × meta, quanto faltou, % de passos, pomodoros) com **↻ Repetir ciclo**, **Ver detalhes** (pizza por matéria) e **Excluir**, e o gráfico de horas por semana com a meta tracejada. Clicar num dia de semana fechada no calendário da lateral abre o mesmo "Ver detalhes". Atenção: nas semanas fechadas as horas somam o que foi marcado nos passos (Pomodoro + horas digitadas à mão); na visão Estudo, só os focos do Pomodoro.

### Visão Estudo

- **Assuntos:** cada matéria pode ter vários assuntos (campo "Assuntos, separados por vírgula", com ✎ para renomear e 🗑 para excluir; excluir um assunto não apaga os registros, eles passam a contar como "(sem assunto)").
- **Registrar questões:** botão ＋ (na aba, na lateral e em cada assunto): data (não aceita futuro), matéria, assunto (ou criar um novo ali mesmo), questões feitas e acertos. Os últimos 8 registros aparecem na aba, com 🗑 para corrigir engano.
- **Horas:** vêm do **Pomodoro**. Ao fim de cada foco, além do passo, você escolhe o **tipo de estudo** (Teoria, Questões ou Revisão) e, opcionalmente, o **assunto**; cada foco vira uma sessão em `state.sessoes`. Horas digitadas à mão no passo não entram nos gráficos, só os focos do Pomodoro.
- **Nível do assunto** (`nivelDe()`), calculado só pela porcentagem de acertos **dentro do período escolhido** (7 dias, 30 dias ou Tudo): menos de 5 questões = Poucos dados; abaixo de 60% = Fraco; até 74% = Médio; até 89% = Bom; 90% ou mais = Dominado. O nível não altera o ciclo (decisão: só informar).
- **Gráficos** (SVG próprio): indicadores no topo (horas, questões, % de acerto, dias com estudo), rosca de horas por matéria (com horas por tipo de estudo), barras de horas por dia, barras de questões por dia (acertos x erros) e acerto por matéria.
- A rosca da aba Semana mostra um segmento por passo do ciclo: cor cheia = feito, clara = pendente.

## Resumos (aba estilo RemNote)

**Notas.** Cada nota tem título, matéria e texto em Markdown. A barra lateral agrupa por matéria (mesmas cores da pizza), tem busca e o botão `+` em cada matéria. Modos: Editar, Dividido (editor + pré-visualização) e Ver.

**Fechar grupos.** Cada matéria da lista de notas é um grupo que se fecha ou abre ao clicar no nome dela (▾ aberto, ▸ fechado; o número mostra quantas notas há dentro, mesmo fechado). "Recolher tudo" e "Expandir tudo" ficam logo acima da lista. O estado fica guardado no navegador (chave `ciclo.rsGruposFechados`, uma preferência de tela que não entra no backup dos dados). Regras: durante a **busca** os grupos aparecem abertos para mostrar tudo que casa; escolher, criar, importar ou mover uma nota para um grupo fechado **abre** esse grupo para a nota aparecer.

**Sintaxe que o app entende**
- `- tópico` com recuo de 2 espaços: vira tópicos que recolhem e expandem na pré-visualização. Atalhos no editor: `Tab` / `Shift+Tab` recuam, `Enter` continua o marcador.
- `[[Nome da nota]]`: link entre notas (ao digitar `[[` aparecem sugestões). Link para nota inexistente aparece em laranja e cria a nota ao clicar. A nota de destino mostra "Mencionada em". Renomear uma nota atualiza os links nas outras.
- Também: títulos `#`, **negrito**, *itálico*, `código`, blocos de código, citações `>`, tabelas, `- [ ]` / `- [x]`, links `[texto](https://…)`.

**Flashcards.** Saíram da aba Resumos: o texto `pergunta :: resposta` agora aparece como texto comum e nada nas notas vira cartão. A aba **Flashcards** existe, mas está vazia; o sistema (como criar, estudar e agendar revisões) será definido depois, em conversa. A versão anterior (cartões `::` com revisão espaçada em 4 níveis) foi removida do código; o campo `cartoes` que ela gravava, se existir em dados salvos antes, é ignorado e não é apagado.

**Importar / colar texto (NotebookLM e similares).** Botão "Importar / colar texto": cole o texto e/ou escolha arquivos `.md` ou `.txt`. Opções de adaptação (`adaptarTexto()`):
- remover citações `[1]`, `[2, 3]`, `[1-3]` (o NotebookLM numera as fontes);
- normalizar marcadores (•, ◦, –, tabs) para `- ` com recuos de 2 espaços;
- opcional: dividir em várias notas a cada `## Seção`.

Dica para o Google Docs: *Arquivo → Fazer download → Markdown (.md)* gera um arquivo que este importador lê direto.

**Backup e exportação** (painel **Dados e backup**, aberto pelo botão de status no rodapé da barra lateral; é o único lugar com essas opções)
- **Pasta de backup** (Chrome/Edge): você escolhe uma pasta, de preferência dentro do Google Drive, OneDrive ou Dropbox do computador; o app grava `Matéria/Título.md` (com cabeçalho `id`, `titulo`, `materia`, `atualizado`) e `_backup-app.json` (o app inteiro: ciclo, semana, semanas fechadas, assuntos, questões) 2 segundos depois de cada alteração. A nuvem é a do sincronizador da pasta.
- A cada sessão o navegador pode pedir permissão de novo: botão **Reconectar pasta**.
- **Restaurar de uma pasta**: lê `_backup-app.json` e junta os `.md` (inclusive os que você editou direto no arquivo, ex.: no Obsidian ou VS Code, e os arquivos novos). Se o app abrir vazio, um aviso no topo oferece restaurar.
- O app só apaga na pasta os arquivos que ele mesmo criou (renomear ou excluir uma nota).
- **Exportar tudo (.zip)** funciona em qualquer navegador e traz os mesmos arquivos do backup. Também há **Exportar / Importar backup completo (.json)**, que leva o app inteiro em um arquivo só.
- Limpar os dados do site apaga o `localStorage` e também a lembrança da pasta no navegador; por isso a restauração é uma ação sua (escolher a pasta de novo). Ao ativar o backup o app pede ao navegador armazenamento persistente.

## 2. Estrutura do arquivo

Tudo está dentro de `ciclo-estudos.html`, nesta ordem:

1. `<style>`: variáveis de tema no topo (`:root`, claro e escuro), depois estilos dos componentes.
2. HTML: barra lateral (`<aside class="side">`), área principal com cinco `<section>` (`view-montar`, `view-semana`, `view-desempenho`, `view-resumos`, `view-flashcards`) e o modal.
3. `<script>`, dividido por blocos comentados com `// ====`:
   - Constantes e estado
   - Utilidades
   - Modal
   - Tema e abas
   - Lógica do ciclo
   - Aba Montar
   - Aba Semana
   - Pomodoro
   - Semanas fechadas (visão do Desempenho)
   - Início

## 3. Dados (o "estado")

Tudo vive no objeto `state`, salvo no `localStorage` do navegador sob a chave `cicloEstudos.app.v1` (função `salvar()`; carregamento em `carregar()`).

```
state = {
  tema: 'auto' | 'light' | 'dark',
  config: { horas /* meta semanal */, duracao /* h por passo */, passos /* derivado: horas ÷ duracao */, modo,
            mats:[{ nome, rep /* Livre */, peso /* Ponderado, 1–5 */ }], custom:[…] /* matérias criadas por você */, ocultas:[…] /* tiradas da lista */,
            dias:[7 booleanos seg..dom], porDia: null | número },
  modelos: [{ id, nome, criado, config:{ modo, horas, duracao, mats, dias, porDia } }],
  semana: null | { id, inicio, seg, dom, meta, pomodoros, modelo /* cópia da montagem usada */,       // seg/dom = segunda e domingo da semana (ISO yyyy-mm-dd)
                   passos:[{id, materia, dia, horasPlanejadas, horasFeitas, feito, nota}] },  // dia = ISO ou null
  fechadas: [{ id, inicio, fim, modelo /* idem */, cicloFechado, passosFeitos, passosTotal, pctConcluido,
               horasEstudadas, metaHoras, horasFaltando, porMateria:{matéria:horas}, pomodoros }],
  pomo: { foco, pausa, longa, ate },
  cores: { matéria: índiceNaPaleta },
  notas: [{ id, titulo, materia, texto /* Markdown */, criado, atualizado }],
  assuntos: [{ id, materia, nome }],
  questoes: [{ id, data /* ISO */, materia, assuntoId /* ou null */, feitas, acertos }],
  sessoes: [{ id, data /* ISO */, materia, assuntoId /* ou null */, minutos, tipo /* Teoria | Questões | Revisão */ }],   // focos do Pomodoro
  backup: { nomePasta, ultimoBackup, arquivos: {idNota: caminho}, hashes: {idNota: hash} }   // a pasta em si fica no IndexedDB
}
```

Pontos de atenção:
- Se você **mudar o formato** do `state`, atualize `defaults()`, `carregar()` e `normalizarEstado()` (garante que listas novas existam em dados salvos antes) para não quebrar dados já salvos (e anote no Histórico de mudanças).
- `meta` da semana: `null` significa "soma das horas planejadas" (`metaEf()`).
- Os dados ficam só no navegador onde foram criados. O painel Dados e backup (pasta automática, .zip e .json) é a proteção contra perda.
- Na primeira abertura, o app importa modelos do gerador antigo (`cicloEstudosModeloV2_*`) se existirem (`migrarModelosAntigos()`).

## 4. Onde mexer para cada tipo de mudança

| Quero… | Onde mexer |
|---|---|
| Mudar cores, fontes, espaçamentos | Variáveis em `:root` no começo do `<style>` (há um bloco para tema claro e dois para escuro: mantenha os três em sincronia) |
| Cores das matérias (pizza, bolinhas) | Constante `PALETA` |
| Lista de matérias padrão (hoje são 10: Língua Portuguesa, Direito Constitucional, Direito Administrativo, Direito Tributário, Contabilidade Geral, Estatística, Noções de Igualdade Racial, Informática, Gestão Organizacional, Raciocínio Lógico) | Constante `MATERIAS_PADRAO`. A lista de escolha é `todasMaterias()` (padrão + próprias − tiradas). Ao trocar a lista padrão, `normalizarEstado()` limpa dos dados salvos as matérias da lista antiga (`MATERIAS_ANTIGAS`) que **não** estiverem em uso de verdade (notas, assuntos, questões, horas, semana atual ou semanas fechadas) e mantém disponíveis as que estiverem; para tirar qualquer matéria pela tela, use "Gerenciar lista de matérias" |
| Tempos padrão do Pomodoro | `defaults()` → `pomo` |
| Algoritmo de distribuição/espaçamento | `calcularDistribuicao()` e `gerarCicloEspacado()` (vêm do original, mexa com cuidado) |
| O que `gerar()` valida ou cria | `gerar()` |
| Regras de calendário e distribuição por dias | Helpers de data no começo do `<script>` (`hoje`, `addDias`, `segundaDe`, `idxDia`) e bloco "calendário" depois de `cfgPorDia` (`semanaAlvo`, `diasDisponiveis`, `agendar`, `previaAgenda`) |
| Aviso de semana encerrada / virada de dia | `atualizarAviso()` e `checarVirada()` perto do fim do `<script>` |
| Agrupamento por dia na aba Semana | `renderSemana()` (`grupo`, `linhaPasso`), `setDia()`, `reagendar()` |
| Visual da aba Montar | `renderMontar()` |
| Modelos (salvar, usar, atualizar) e "repetir ciclo" | `salvarModelo()`, `usarModelo()`, `atualizarModelo()`, `repetirUltima()`, `repetirDoHistorico()`, `aplicarSnapshot()` / `snapshotConfig()` |
| Lista de matérias do ciclo (adicionar, tirar, distribuir) | `addMatSelect()`, `abrirNovaMateria()`, `removerMat()`, `distribuirIgual()`, `cfgRep()`, `cfgPeso()` |
| Conta horas → passos | `passosDe()` e `sincronizarPassos()` |
| Conversão de dados antigos da configuração | `migrarConfig()` (chamada por `normalizarEstado()`) |
| Colunas/campos de cada passo | `renderSemana()` (HTML do passo) + modelo do passo em `gerar()` + handlers (`togglePasso`, `setPlan`, `setFeito`, `setNota`) |
| O que é salvo ao fechar a semana | `resumo()` (dados) e `resumoHTML()` / `pieSVG()` (exibição) |
| Semanas fechadas (lista, gráfico por semana, repetir/excluir) | `renderSemanasFechadas()`; o seletor Estudo \| Semanas é `topoDesempenho()` / `dsVisao()` |
| Botão de status e painel de backup | `atualizarStatusBackup()`, `abrirBackup()`, `htmlBackup()` |
| Níveis dos assuntos (cortes de 60/75/90%, mínimo de questões) | `nivelDe()` e `MIN_QUESTOES` no bloco `// DESEMPENHO` |
| Gráficos (rosca, barras) | `roscaSVG()`, `roscaCiclo()`, `barrasSVG()` e `arcoAnel()` no bloco `// GRÁFICOS`; o conteúdo da aba está em `renderDesempenho()` |
| Registro de questões / assuntos | `abrirQuestoes()`, `salvarQuestoes()`, `dsAddAssuntos()`, `dsRenomear()`, `dsExcluir()` |
| Registro de foco do Pomodoro (tipo, assunto) | `registrarTempo()` e `regAtualizarAssuntos()` |
| Cores das matérias nos gráficos (pastéis) | constante `PALETA` |
| Aparência da aba Resumos | CSS `/* ----- Resumos ----- */` e `renderResumos()`, `renderRsMain()`, `htmlLista()` |
| Grupos fechados na lista de notas | `rsFechadosG`, `rsToggleGrupo()`, `rsTodosGrupos()`, `rsAbrirGrupoDe()` (perto de `lsSet`) e `htmlLista()` |
| Markdown (o que é renderizado) | `inl()` (inline) e `mdParaHtml()` / `htmlLista2()` (blocos) |
| Aba Flashcards (hoje em branco) | `renderFlashcards()` e a seção `view-flashcards` |
| Importação (o que é adaptado do NotebookLM) | `adaptarTexto()`, `dividirSecoes()`, `abrirImportar()` / `importarConfirmar()` |
| Backup em pasta, restaurar, ZIP | bloco `// EXPORTAR (.zip) E BACKUP EM PASTA` (`bkGravarTudo`, `bkRestaurar`, `criarZip`) |
| Barra lateral (calendário, hoje, Pomodoro) | HTML `<aside class="side">` no começo do `<body>`, CSS `/* ----- barra lateral …` e `renderLateral()` (é chamada por `salvar()` e `showTab()`, então se atualiza sozinha) |
| Tela única (nada de rolar a página) e colunas de cada aba | bloco CSS `TELA ÚNICA` (`@media (min-width:1100px) and (min-height:620px)`); ao criar um quadro novo, dê `min-height:0` e `overflow:auto` ao que pode crescer, para a rolagem ficar dentro dele |
| Largura e colunas de cada aba | CSS `.app`, `.main`, `#view-montar`, `#view-desempenho` (e `.vis-semanas`), `.layout` (Semana) e `.rs-layout` (Resumos); tela estreita em `@media (max-width:900px)` |
| Cores do tema (verde-menta, inspirado no Estudei) | variáveis `:root` no topo do CSS (`--bg`, `--side`, `--accent`…), nos três blocos (claro, escuro automático e escuro manual) |
| Comportamento do Pomodoro | bloco `// POMODORO` (`pomoTick`, `pomoTerminou`, `pomoEncerrar`, `registrarTempo`); os botões e campos ficam na barra lateral (ids `pomo*` e `pi-*`) |

Padrão usado nas telas: cada aba tem um `render…()` que recria o HTML da seção. Os eventos chamam funções globais via `onclick`/`onchange` no HTML gerado, alteram `state`, chamam `salvar()` e depois o `render…()` da aba. Siga esse padrão ao adicionar campos.

Segurança: todo texto vindo do usuário (nome de matéria, anotação) deve passar por `esc()` antes de entrar em `innerHTML`.

## 5. Como testar uma mudança

1. Abra o arquivo no navegador e faça F5.
2. Abra o console (F12) e confirme que não há erros.
3. Roteiro mínimo: gerar um ciclo Livre e um Ponderado, marcar passos, mudar horas, recarregar (deve persistir), rodar um Pomodoro (ajuste o foco para 1 min), fechar a semana, ver Desempenho › Semanas, exportar e importar o backup.
4. Teste também em tela estreita (celular) e no tema escuro.

Dica: para testar sem perder seus dados reais, abra o arquivo em uma janela anônima, onde o `localStorage` é separado.

## 6. Limitações conhecidas / ideias futuras

- Dados só no navegador; a proteção contra limpeza é o backup em pasta (Chrome/Edge) ou o .zip/JSON manual. Firefox e Safari não gravam em pasta.
- Resumos: sem imagens coladas nas notas, sem PDF importado e sem integração direta com o NotebookLM (o caminho é copiar/colar ou arquivo .md/.txt). Muitas notas grandes podem se aproximar do limite de ~5 MB do `localStorage`.
- Desempenho: as horas dos gráficos vêm só dos focos do Pomodoro; o nível dos assuntos não influencia o ciclo (o ciclo continua sendo montado só pelos pesos das matérias); não há metas de questões por dia nem comparação entre períodos.
- Ideias: sugerir o assunto mais fraco em cada passo do ciclo, meta diária de questões, calendário mensal com provas e flashcards por matéria (como o planejador de provas do RemNote), importar PDF/DOCX.
- Pomodoro avulso: o tempo é somado ao passo escolhido por você, não é ligado automaticamente a um passo.
- Sem metas por matéria nem lembretes.
- Calendário: sem meta diária em horas, sem dias de folga/prova e sem integração com Google Calendar (ideias para depois).
- Possível evolução: instalar como app (PWA).

---

## Histórico de mudanças

| Data | Mudança |
|---|---|
| 2026-10-09 | Versão inicial: abas Montar/Semana/Histórico, checklist semanal, Pomodoro avulso, fechamento de semana com pizza, histórico com gráfico, backup JSON, tema claro/escuro. Base: gerador de ciclos de Gabriel Ângelo. |
| 2026-10-09 | Calendário: semana real seg–dom, dias de estudo e passos por dia na aba Montar, passos distribuídos a partir de hoje e agrupados por dia na aba Semana (HOJE, atrasado, mover dia, reagendar pendentes), aviso de semana encerrada e detecção da virada do dia. Correção: `hoje()` agora usa o fuso local (antes usava UTC e podia marcar o dia seguinte à noite). Semanas salvas antes desta versão ganham `seg`/`dom` automaticamente. |
| 2026-10-09 | Aba **Resumos**: notas em Markdown por matéria, tópicos recolhíveis, `[[links]]` com backlinks, flashcards `::` com revisão espaçada (4 respostas), atalho 📝 Resumo em cada passo da semana, importação de texto/arquivos (NotebookLM, .md, .csv) com adaptação automática, backup automático em pasta sincronizada com restauração, exportar .zip. Estilo visual renovado inspirado no RemNote (paleta, barra lateral, botões de revisão). Novos campos no estado: `notas`, `cartoes`, `backup`. |
| 2026-10-09 | Layout em tela cheia com **barra lateral fixa** em todas as abas: menu, calendário do mês (clicável), passos de hoje e progresso da semana, e Pomodoro sempre visível (saiu da aba Semana). Aba Semana ganhou a tira dos 7 dias; Montar e Histórico passaram a usar duas colunas. Sem mudança no formato dos dados. |
| 2026-10-09 | Removido o rodapé com o crédito e o aviso de dados no navegador. |
| 2026-10-09 | Correção: as abas Semana, Resumos e Histórico apareciam embaixo da aba Montar ciclo. Causa: `display:grid` em `#view-montar` e `#view-historico` anulava o atributo `hidden`. Agora há a regra global `[hidden]{display:none !important}`. **Ao criar novas seções com `display:grid/flex`, essa regra já protege o `hidden`.** |
| 2026-10-09 | **Grupos que fecham na lista de notas** (aba Resumos): clicar no nome da matéria fecha ou abre as notas dela, com "Recolher tudo / Expandir tudo", contador de notas por grupo e estado lembrado entre sessões. Nome longo de matéria agora é cortado com "…" em vez de quebrar a linha. Sem mudança no formato dos dados. |
| 2026-10-09 | **Gerenciar lista de matérias**: botão no fim da lista de matérias do ciclo para tirar (e trazer de volta) matérias da lista de escolha, via novo campo `config.ocultas`. Matérias da lista antiga (como "Administração Financeira e Orçamentária (AFO)") que ficaram guardadas sem uso real são limpas automaticamente dos dados salvos, do ciclo em montagem e dos modelos. |
| 2026-10-09 | **Aba Histórico removida**: as semanas fechadas passaram para o Desempenho, na visão **Semanas** (seletor Estudo \| Semanas), com indicadores, lista, gráfico, repetir ciclo, ver detalhes e excluir. O **backup** saiu da aba Resumos e do Histórico e foi para um painel único (**Dados e backup**), aberto por um botão de status sempre visível no rodapé da barra lateral. Ao fechar a semana com "Salvar e limpar marcações" o app agora volta para a aba Semana. Barra lateral levemente compactada (sem a linha de focos concluídos; "hoje x/y" no cabeçalho). Sem mudança no formato dos dados. |
| 2026-10-09 | **Flashcards saíram da aba Resumos** (cartões `::`, revisão e contador, importação de cartões por CSV e as opções de Pergunta/Resposta e Termo na importação) e foi criada a aba **Flashcards**, vazia, para desenhar o sistema depois. Campo `cartoes` removido do estado (dados antigos com ele continuam abrindo). |
| 2026-10-09 | Lista padrão de matérias reduzida para as 10 do estudo atual (as outras 10 foram removidas). Matérias antigas que já estavam em uso continuam disponíveis; novas se adicionam pelo seletor "Digitar uma matéria nova…". |
| 2026-10-09 | **Tela única**: no computador a página não rola mais; barra lateral e área principal ocupam a altura da janela, as abas viraram colunas e só as listas longas rolam dentro do quadro (passos da semana, matérias, assuntos, registros). Barra lateral compactada (calendário com 5 ou 6 linhas conforme o mês, "Hoje e semana" mais curto, Pomodoro numa linha) para caber em uma tela de 900 px de altura. Na aba Semana cada passo ficou numa linha só. Telas pequenas continuam com o layout empilhado. |
| 2026-10-09 | Aba **Montar ciclo** reformulada: **meta semanal em horas** (os passos são calculados), **lista única de matérias** com "＋ Adicionar matéria" (escolher da lista ou digitar nova) e ✕ para tirar, botão "Distribuir igualmente", prévia de passos no modo Ponderado. Novos **modelos de ciclo** (salvar, usar, atualizar, renomear, excluir), "Repetir o ciclo da última semana fechada", "↻ Repetir ciclo" no Histórico e "Salvar e montar a próxima semana" ao fechar. **Mudança no formato de `config`** (`mats`, `horas` no lugar de `linhas`/`qtd`) com migração automática dos dados salvos; novos campos `modelos` e `semana.modelo`. |
| 2026-10-09 | Nova aba **Desempenho**: matérias abertas em **assuntos**, registro de **questões** (feitas e acertos por dia, matéria e assunto), nível automático de cada assunto pelos acertos, indicadores e gráficos (rosca de horas por matéria, horas por dia, questões por dia, acerto por matéria). O foco do Pomodoro agora registra tipo (Teoria/Questões/Revisão) e assunto. A aba Semana ganhou a rosca do ciclo e a barra de progresso em cada passo. Visual trocado para verde-menta com cores pastel por matéria (inspirado no Estudei). Novos campos no estado: `assuntos`, `questoes`, `sessoes` (+ `normalizarEstado()` para dados antigos). |
| 2026-10-09 | Correção na barra lateral: os campos de tempo do Pomodoro ("Ajustar tempos") passavam da largura e cortavam a lateral; agora encolhem para caber e a lateral não rola na horizontal. |
| 2026-10-09 | **Migração iniciada**: repositório Git criado (commit inicial e tag `v0-html` com o app em HTML único) e etapa 1 da base nova concluída em `app/`: esqueleto Vite + React + TypeScript + Tailwind/shadcn + Zustand, tema verde-menta claro/escuro, layout de tela única com barra lateral (menu, mini calendário, Pomodoro funcional), PWA instalável, Vitest (10 testes), ESLint e CI no GitHub Actions. Plano em `docs/PLANO.md`. O app em HTML não foi alterado. |
| 2026-10-09 | **Base nova, etapa 2 (parcial)**: banco local Dexie, importador do "Exportar backup completo" do app em HTML (validado com Zod, tolerante a campos ausentes), exportar backup em JSON (mesmo formato do HTML + `formato`/`versao`) e tela "Dados e backup". 20 testes, incluindo ida e volta e teste com o backup real. Branch `dev`. |
| 2026-10-09 | **Base nova, etapa 2 concluída**: exportar tudo em .zip (um .md por resumo + backup completo), backup automático em pasta com restaurar (junta .md editados fora do app), tabela `local` no Dexie (versão 2 do banco, sem perder dados) e indicador no rodapé da barra lateral. 29 testes. |
| 2026-10-09 | **Flashcards, etapa 3 (sub-etapas 1 e 2)**: agendador SM-2, fila com limites diários, modelo de dados (Dexie v3), baralhos por matéria/assunto, estudo, baralhos, opções do baralho e adicionar cartões simples. 108 testes. Na branch `dev`. |
| 2026-10-09 | **Base nova, etapa 4 (parcial)**: Montar ciclo (modelos, meta em horas, dias de estudo, matérias, gerenciar lista), Semana (checklist por dia, rosca, por matéria, fechar semana com resumo, reagendar, limpar), barra lateral com Hoje e semana e calendário marcado, Pomodoro com Encerrar, tempos salvos e registro do tempo no passo. Corrigido o esquema do backup (passos por dia era lido como lista). 148 testes. |
| 2026-10-09 | **Base nova, etapa 4 concluída**: Desempenho (Estudo e Semanas), Resumos (Markdown, ligações, importar), registro de questões, aviso de semana encerrada. As quatro abas do HTML agora existem na base nova. 196 testes. |
