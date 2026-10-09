> **Andamento** (atualize ao fim de cada etapa)
>
> | Etapa | Estado |
> |---|---|
> | 0. Git (repositório local, tag `v0-html`) | feita |
> | 1. Esqueleto da base nova (`app/`) | feita |
> | 2. Dados (Dexie, importador do JSON antigo, backup) | feita |
> | 3. Flashcards no estilo Anki (SM-2) | em andamento na `dev`: sub-etapas 1 e 2 feitas (dados, SM-2, fila, estudo, baralhos, opções, adicionar simples); aguardando sua revisão ⏸. Faltam: editor rico (Tiptap, imagens), Navegar, Estatísticas, importar/exportar Anki |
> | 4. Portar Montar, Semana, Desempenho e Resumos | feita na `dev`: as quatro abas, a barra lateral e o Pomodoro já funcionam na base nova; aguardando o seu teste (a criar "cartão a partir dos Resumos" e o quadro de flashcards no Desempenho ficam para depois do Flashcards) |
> | 5. Supabase (login e sincronização) | a fazer |
> | 6. Publicar e instalar no celular | a fazer |
# Plano: base nova (Git + Vite/React/TS + Dexie + PWA), Flashcards estilo Anki (SM-2) nela e Supabase depois

## Contexto
O app atual é um único `D:\workspace\CLAUDE\ciclo-estudos\ciclo-estudos.html` (~2.350 linhas, `localStorage`, sem versionamento). A pessoa quer: (1) **versionar** o código, (2) uma aplicação **mais moderna, sem depender de um arquivo só**, com **Supabase gratuito** para sincronizar, (3) estudar **no celular e sem internet**, e (4) um sistema de **flashcards igual ao Anki com SM-2**. Como o Flashcards é a parte nova do zero, ele é construído **já na base nova**, em vez de fazer no HTML e reescrever depois.

Decisões já tomadas: núcleo fiel ao Anki; SM-2 "como o Anki usa"; decks = matérias › assuntos; criar cartão a partir dos Resumos; imagens desde já; PWA offline com sincronização; ordem **Git → base nova → Anki na base nova**.

## Stack final (e onde difere da que ela recebeu)
| Camada | Escolha | Observação |
|---|---|---|
| Código | **Git + GitHub privado**, tag `v0-html` no HTML atual | Substitui o "Histórico de mudanças" manual |
| Build/UI | **Vite + React + TypeScript** | igual à outra stack |
| Estilo | **Tailwind CSS + shadcn/ui**, tema mapeado para os tokens atuais (verde-menta, claro/escuro) | aceito da outra stack |
| Estado de tela | **Zustand** | igual |
| Dados locais | **Dexie.js** (IndexedDB) com `useLiveQuery` | **no lugar do TanStack Query** (que é para dados de rede) |
| Validação | **Zod** nos limites (importar, sincronizar) | evita número/string trocados |
| Editor dos flashcards | **Tiptap** (extensão própria de cloze, Ctrl+Shift+C, colar imagem) | só nos flashcards |
| Editor dos Resumos | **CodeMirror 6 + markdown-it + DOMPurify** | continua Markdown/`.md` |
| Gráficos | nossos **SVG** como componentes React (rosca, barras, calendário de calor) | Recharts só se precisar |
| Offline/celular | **vite-plugin-pwa** | fora da outra stack |
| Testes | **Vitest** (SM-2, busca, cloze, sanitização, migração do Dexie) | fora da outra stack |
| Nuvem | **Supabase**: Auth por link no e-mail, Postgres com **RLS**, Storage **privado** | chave `anon` no app; `service_role` nunca |
| Hospedagem | **GitHub Pages** ou **Cloudflare Pages** (grátis, estático) | |

## Arquitetura: local primeiro, nuvem depois
- O app **lê e grava sempre no Dexie**; a UI nunca espera a rede. O Supabase é cópia e sincronização.
- **Sincronização simples (uma pessoa só):** uma tabela genérica `registros(user_id, colecao, id, dados jsonb, atualizado_em, excluido_em, esquema_versao)` com RLS (`user_id = auth.uid()`). Empurra o que mudou (marcado "sujo"), puxa o que mudou desde o último cursor do servidor. Imagens: salvas no aparelho primeiro e enviadas ao Storage quando houver rede.

### Regras de sincronização (cuidados recebidos e acrescentados)
1. **Relógio.** `atualizado_em` é preenchido por **gatilho no banco** (`now()` do servidor, ISO UTC), ignorando o valor enviado pelo app. O cursor de "puxar" é desse relógio. Quando o mesmo registro mudou em dois aparelhos, comparo as horas de edição locais **corrigidas pelo desvio** (`servidor − local`, medido a cada sincronização). Para o SRS: o **revlog é a fonte que une os históricos** (só acrescenta, ids únicos, nada se perde) e, em conflito de um cartão estudado em dois aparelhos offline, o estado do cartão é **recalculado a partir do revlog** em vez de "a última escrita vence".
2. **Fila de imagens.** Envio **em série ou com concorrência 2** (`p-limit`), com nova tentativa e espera crescente; opção manual "enviar imagens só no Wi-Fi" (a detecção automática de rede móvel não é confiável no Safari/iOS); imagens já redimensionadas antes de entrar na fila; progresso visível.
3. **Exclusão (soft delete).** Nenhum registro já sincronizado é apagado de verdade no Dexie: vira `excluidoEm` + "sujo" e as consultas ignoram os excluídos. Apagar uma nota marca também os cartões dela (e a mídia órfã é limpa depois). As marcas de exclusão só são **expurgadas** depois de o servidor confirmar **e** de uma retenção de 90 dias, olhando o último sincronismo de cada aparelho (tabela `dispositivos`), para o cartão não "ressuscitar".
4. **Paginação e lotes.** O Supabase limita ~1000 linhas por consulta: a primeira sincronização e a restauração leem e gravam em **páginas/lotes** (por exemplo 500).
5. **Versão do esquema.** Cada registro leva `esquema_versao`; o servidor recusa gravação de versão mais antiga que a mínima aceita, e o app mostra "atualize o app" em vez de corromper dados.
- **Limites do plano gratuito** (conferidos em supabase.com/pricing): 500 MB de banco, 1 GB de arquivos, 5 GB de tráfego, 2 projetos, **pausa após 1 semana sem atividade**, **sem backup automático**. Respostas: o app funciona sem a nuvem; mantém exportação JSON/.zip e backup em pasta; mostra o estado da sincronização; opcionalmente um agendamento semanal (GitHub Actions) mantém o projeto ativo.
- **Cuidados técnicos recebidos** (todos incorporados): liberar `URL.revokeObjectURL` ao trocar de cartão/sair do estudo (`fcLiberarUrls()`); carregar imagens e revlog **sob demanda** (memória só com metadados); migração de banco com `oldVersion` e checagem `contains` (no Dexie: `version(n).stores()` + `upgrade()`), sem apagar o que já existe; tratar `versionchange`/`blocked` quando houver outra aba antiga aberta.

## Estrutura do repositório
```
ciclo-estudos/            (repo Git)
  ciclo-estudos.html      (legado, intocado até a nova versão ficar equivalente)
  GUIA.md  CLAUDE.md      (atualizados; GUIA passa a descrever a base nova)
  app/                    (Vite + React + TS)
    src/dominio/          (puro, testado: sm2.ts, fila.ts, cloze.ts, busca.ts, ciclo.ts, datas.ts)
    src/dados/            (Dexie: db.ts, esquemas Zod, importar-legado.ts, backup.ts, sincronizar.ts)
    src/estado/           (Zustand)
    src/componentes/      (shadcn/ui + os nossos)
    src/telas/            (Montar, Semana, Desempenho, Resumos, Flashcards)
  supabase/migrations/    (SQL com RLS, versionado)
  .github/workflows/      (testes + build + deploy)
```

## Etapas (cada uma entrega algo; paro para você ver ao fim das marcadas ⏸)
0. **Git:** `git init` na pasta atual, `.gitignore` (inclui `.env*`, `node_modules`), commit do HTML + GUIA + CLAUDE, tag `v0-html`. O repositório remoto no GitHub depende do login dela: ela cria o repo privado (ou autoriza o `gh`) e eu só dou `push` com a confirmação dela.
1. **Esqueleto ⏸:** `app/` com Vite + React + TS + Tailwind + shadcn/ui, tema verde-menta claro/escuro, **layout de tela única** (barra lateral com menu, calendário, hoje, Pomodoro e status de backup; área principal), PWA instalável, Vitest e ESLint, CI.
2. **Dados:** Dexie v1 (entidades atuais: config, semana, semanas fechadas, modelos, notas, assuntos, questões, sessões), esquemas Zod, **importador do JSON do app atual** (o "Exportar backup completo"), exportar JSON/.zip, backup em pasta portado.
3. **Flashcards no Anki ⏸ (depois da 2ª e da 4ª sub-etapa):**
   1. Modelo de dados no Dexie (decks, grupos de opções, tipos de nota de fábrica, notas, cartões, revlog, mídia) + `fcSincronizarDecks()` (matéria e assunto viram deck e subdeck, a partir do que foi importado do app atual).
   2. **Agendador SM-2** (`sm2.ts`, puro e testado) + fila e limites do dia + **estudo** (4 botões com intervalos, atalhos do Anki, desfazer) + **Baralhos** + opções do deck.
   3. **Adicionar/Editar** (Tiptap, cloze, digitar resposta, imagens, tags, sanitização).
   4. **Navegar** (busca estilo Anki, ações em massa) e **Estatísticas**.
   5. Importar/exportar `.txt` do Anki; backup e restauração dos flashcards.
4. **Portar as outras abas** (Montar, Semana, Desempenho, Resumos), com "criar cartão a partir de Resumos" e o quadro de flashcards no Desempenho. Durante 3→4 a pessoa usa o HTML antigo para o ciclo e a base nova para os flashcards (transição assumida; os dados vêm por exportar/importar).
5. **Supabase:** projeto, SQL com RLS, login por link, sincronização, Storage de imagens, tela de status. Teste com dois perfis do navegador.
6. **Publicar** (GitHub Pages/Cloudflare), instalar no celular, testar offline; aposentar o HTML (mantendo a tag `v0-html`).

### Agendador SM-2 (função pura)
`responder(cartao, botao, opcoes, agora, hoje)` e `previsaoIntervalos(...)` (sem variação aleatória, para os rótulos).
- Novo/Aprendendo: Errei volta ao 1º passo; Difícil repete o passo (no 1º usa a média dos dois primeiros, ou ×1,5 com um passo só); Bom avança e no último passo gradua com 1 d; Fácil gradua com 4 d; facilidade inicial 250%.
- Revisão: Errei → lapso+1, facilidade −0,20 (mín. 1,3), reaprendizado, intervalo = max(mínimo, ivl × novo%); Difícil → −0,15 e (ivl + atraso/4) × 1,2; Bom → (ivl + atraso/2) × facilidade; Fácil → +0,15 e (ivl + atraso) × facilidade × bônus 1,3; garante difícil < bom < fácil, modificador, máximo e **fuzz** em ≥ 3 d.
- Dia: "hoje" = dia local deslocado em 4 h; aprendizado em ms exatos, revisão em número do dia. Valores finos (fuzz, atraso, enterrar irmãos) variam entre versões do Anki: reproduzo o comportamento sem prometer igualdade dia a dia.
- Opções padrão: 20 novos/dia, 200 revisões/dia, passos 1 e 10 min, reaprendizado 10 min, leech em 8 (marcar e suspender), antecipação 20 min.

### Telas do Flashcards
**Baralhos** (árvore com Novos azul / Aprendendo vermelho / Revisar verde), **Estudo**, **Adicionar/Editar**, **Navegar** (`deck:`, `tag:`, `is:`, `flag:`, `prop:`, `added:`, `rated:`, negação, frases), **Estatísticas** (hoje, previsão de 30 dias, calendário de calor, intervalos, facilidade, botões, contagem por estado) e **Opções do deck**. Atalhos como no Anki (`1–4`, `E`, `*`, `-`, `=`, `@`, `!`, `Ctrl+1..4`, `Ctrl+Z`, `I`).

## Segurança e privacidade
RLS em todas as tabelas e no bucket; imagens em bucket **privado** com URL assinada; nenhum segredo no repositório (`.env.local` fora do Git, só a URL e a chave `anon`); HTML dos cartões e dos resumos sempre sanitizado (DOMPurify/lista de tags).

## Verificação
- **Vitest:** sequências do SM-2 (novo → Bom → 10 min → Bom → 1 d; revisão 10 d, 2,5, Bom → ~25 d; Errei → facilidade 2,3 e reaprendizado; Difícil ×1,2; Fácil ×2,5×1,3; teto 36500; ordem difícil < bom < fácil; rótulos = resultado sem fuzz), limites diários, leech, virada às 4 h, cloze com 2 omissões gera 2 cartões, busca (cada operador, negação, frase), sanitização (`<script>`, `onerror`), migração do Dexie sem perder dados.
- **Importar o JSON real** do app atual e conferir ciclo, semana, notas, assuntos e questões.
- **No navegador:** layout sem rolar a página em 1920×950 e 1366×650, claro e escuro, estreito empilhando; estudo de ~50 cartões com imagens sem vazar URLs de Blob; base grande de teste (5.000 notas) abrindo sem travar.
- **PWA:** instalar e abrir sem internet; `npm run build` e `npm test` verdes; Lighthouse PWA.
- **Supabase:** dois usuários não leem os dados um do outro (teste de RLS); sincronizar entre dois perfis, editar offline nos dois e conferir o resultado; projeto pausado não quebra o app.
- **Sincronização (casos de borda):** relógio do segundo perfil atrasado em minutos não inverte o vencedor; o mesmo cartão estudado offline nos dois perfis mantém **todas** as revisões e o estado final bate com o recálculo pelo revlog; excluir um cartão num perfil e sincronizar o outro **não** o ressuscita (e continua excluído depois de 90 dias simulados); fila de imagens nunca passa de 2 envios simultâneos e retoma após queda de rede; base com 3.000 registros sincroniza em páginas sem estourar o limite de 1000; versão de esquema antiga é recusada com aviso.
- GUIA.md atualizado a cada etapa; **pedir à pessoa um teste real** no celular e no Chrome/Edge (backup em pasta e instalação do PWA).

