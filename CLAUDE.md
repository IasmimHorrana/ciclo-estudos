# Ciclo de Estudos

Projeto em duas partes, versionado com Git. O trabalho do dia a dia fica na branch **`dev`**; a `main` só recebe o que a Iasmim aprovar. Repositório privado no GitHub (`IasmimHorrana/ciclo-estudos`). **Só dê `push` com a confirmação dela.**

- **`ciclo-estudos.html`** (raiz): o app antigo em arquivo único, congelado na tag `v0-html`. Só recebe correção crítica enquanto a base nova não o substitui. Seu guia é o `GUIA.md`.
- **`app/`**: a base nova (Vite + React + TypeScript + Tailwind/shadcn + Dexie + PWA; Supabase depois). É onde o desenvolvimento continua. O plano e as etapas estão em `docs/PLANO.md`.

Regras (valem para os dois):

- Responda e escreva textos da interface em português do Brasil.
- Depois de qualquer mudança, atualize o `GUIA.md` (seções afetadas) e `docs/PLANO.md` quando uma etapa mudar de estado.
- Faça commits pequenos, um assunto por commit, com mensagem em português.
- Segredos (chaves, tokens, `.env*`) nunca vão para o Git. No app só pode ir a URL e a chave `anon` do Supabase, e nunca a `service_role`.
- Todo texto vindo do usuário que vira HTML passa por sanitização (no app antigo: `esc()`; na base nova: React escapa sozinho, e HTML rico passa por DOMPurify).

Só no app antigo:

- Se mudar o formato do `state`, atualize `defaults()`, `carregar()` e `normalizarEstado()` para não quebrar dados salvos no `localStorage`.

Só na base nova (`app/`):

- Lógica de estudo (SM-2, fila, busca, cloze, datas) fica em `src/dominio/`, **pura e com testes Vitest**. Rode `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` antes de commitar.
- Dados locais ficam no Dexie (IndexedDB). Nada que já foi sincronizado é apagado de verdade: usa-se `excluidoEm` (ver o plano).
- Datas sempre no fuso local, em texto `AAAA-MM-DD` (`src/dominio/datas.ts`).
- Layout de tela única no computador: nada de rolar a página; só listas longas rolam dentro do próprio quadro (`min-h-0` + `overflow-auto`).
- Mudou o formato dos dados? Crie uma versão nova do banco (`version(n+1)` em `src/dados/db.ts`, nunca edite a anterior), ajuste o esquema Zod do backup (`src/dados/esquemas.ts`) e o conversor, e teste a importação (um campo com tipo errado no esquema perde o dado em silêncio).
- Tudo que o usuário apaga vira `excluidoEm` (exclusão lógica); consultas ignoram os excluídos.
- Texto de interface em português do Brasil; diálogos pelo `dialogos-api.tsx` (nada de `alert`/`confirm` do navegador, exceto onde já existe).
- Teste no navegador (preview) antes de dizer que funciona, e diga com honestidade o que não foi testado (celular, seletor de pasta do Windows, Pomodoro até o fim).
