# UX Flow Audit — Caso (P0 Lane C)

**Status:** F-1 sign-off provisório. Release público bloqueado. Owners Legal / Security / QA Lead: **PROVISÓRIO** (dupla revisão Thales PO + Cursor CTO interim).

## Atualização (2026-05-19) — Case Cockpit: caso ≠ processo (Fase 1)

- **Frente:** produto/UX do fluxo do caso (release monitoring congelado).
- **Plano:** `docs/plans/CASE_COCKPIT_2026_05_19.md`.
- **Entregue (Fase 1):** aba **Processo vinculado** (`/cases/[id]/processo`, `CaseProcessTab`); subnav com 7 seções (“Fatos e partes”, “Processo vinculado”); CNJ/tribunal/vara na entrevista **somente** se “Sim — já há autos”; links de pesquisa recomendada e menu cockpit apontam para rotas do caso; rótulo **Excluir** visível em documentos (sm+).
- **Pendente (Fases 3–4):** stepper entrevista por tópicos, revisão prompt estruturação, E2E pré-processual sem CNJ.

## Atualização (2026-05-19) — Case Cockpit Fase 2 (tabs + CTAs + documentos)

- **Subnav (8):** Visão geral · Entrevista · Fatos e partes · Documentos · Pesquisa jurídica · **Estratégia** · **Peças e minutas** · Processo vinculado.
- **Rotas:** `src/lib/cases/case-cockpit-routes.ts`; nova `/cases/[id]/pecas` (`CasePiecesTab`).
- **CTAs:** overview, copiloto, chips, pesquisa do caso, `next-actions`, morning briefing — sem `/strategy` ou `/pesquisa-juridica` soltos nos fluxos do caso; CNJ via `/cases/[id]/processo`.
- **Documentos:** botão **Excluir** com rótulo visível + `title` / `aria-label` dinâmico; `DELETE /api/documents/[id]` inalterado.
- **Testes:** `tests/ui/case-flow.test.ts`, `tests/lib/case-cockpit-next-actions.test.ts`.

## P0.2 Lazy Intake

- **Salvar caso não chama IA:** `POST /api/cases/fundamental-intake` com `action=save` (ou `draft`) persiste `metadataJson.intakeForm`, campos determinísticos do caso (`uf`, `summary`, `intakeLegalArea`) e timeline “Entrevista salva”, sem `runDeepseekFundamentalStructure`.
- **Organizar com Lex AI é opcional:** botão secundário no formulário; materializa `CaseParty` / `CaseFact` / pedidos / riscos e define `intakeStructuredAt`. Falha da IA devolve caso salvo + `structureError` (HTTP 200), não apaga o rascunho.
- **Reorganizar:** se o caso já foi organizado, o botão mostra **Reorganizar com Lex AI**; a UI pede confirmação (“Isso pode atualizar partes, fatos… A entrevista salva será preservada.”) e envia `reorganize: true` (ou `action=reorganize`). Sem flag, a API responde **400** `REORGANIZE_REQUIRED` (não mais 409). `applyFundamentalStructure` continua a respeitar secções marcadas como revisadas pelo advogado (`userConfirmedPaths`).
- **Pesquisa / estratégia / minuta sem organizar:** usam contexto compacto por tarefa (`buildCaseTaskContext` + `formatCaseTaskContextForPrompt` em `src/lib/cases/intake/case-intake-context.ts`). O guard de minuta e o bootstrap da aba Estratégia aceitam autor/fatos derivados da entrevista (`intakeDisplay`), não só linhas em `CaseParty`/`CaseFact`.
- **Casos antigos:** `intakeStructuredAt` e materialização relacional seguem válidos; checklist legado permanece em casos sem fluxo fundamental.
- **Testes:** contratos Vitest `tests/cases/lazy-intake-*.test.ts`, `lazy-intake-p02-closure.test.ts`; E2E autenticado `tests/e2e/lazy-intake-p02.spec.ts` (salvar sem organizar + pesquisa/estratégia sem bloqueio indevido). Passos com IA real dependem de chave do motor (`test.skip` explícito).

## Atualização (2026-05-14) — Entrevista fundamental vs checklist legado (fonte de verdade)

- **Problema:** `/cases/[id]/entrevista` ainda carregava só `CaseChecklistTab` (F2.1); o bootstrap do checklist ignorava `metadataJson.intakeForm`, gerando pendências e bloqueios de fluxo fora de sincronia com `/cases/new` + `POST /api/cases/fundamental-intake`.
- **Correção:** `src/lib/cases/case-intake-source.ts` detecta fluxo fundamental; `loadCaseChecklistStateForBootstrap` passa a derivar `missingFields` de `pendingRequiredLabels` no rascunho, zera pendências quando `intakeStructuredAt` existe, e expõe `answeredAt` / `intakeMode` para UI e workflow. `GET/POST /api/cases/[id]/checklist`: POST devolve **409** se o caso for fundamental (evita gravar roteiro legado por engano).
- **UI:** `/cases/[id]/entrevista` renderiza `FundamentalIntakeFormContent` com `seedCaseId` + `seedForm` quando há rascunho não estruturado; mensagem + link quando já estruturado ou formulário ilegível. `/cases/new?continue=[caseId]` reabre o mesmo rascunho. Subnav: label **Entrevista** (neutro). Casos **sem** metadados de intake fundamental continuam com checklist legado, explicitamente titulado na página.
- **QA local (esta rodada):** `npm run lint`, `npm run typecheck`, `npm test` (665) — OK. **Build:** ver secções “P0 Case Flow Integrity” e “P0 Case Flow QA”.

## Atualização (2026-05-14) — P0 Case Flow Integrity (entrevista → caso → cache)

- **401 / “Unauthorized”:** `middleware.ts` passa a usar `getSession()` como fallback quando `getUser()` não devolve utilizador (cookies de sessão ainda presentes). Resposta JSON de API sem sessão: `code: "SESSION_REQUIRED"` + mensagem em português (em vez de só `Unauthorized`).
- **Caso parcial sem IA:** `POST /api/cases/fundamental-intake` com `action=structure` **sem** `caseId` chama `runDeepseekFundamentalStructure` **antes** de `persistFundamentalDraft` — falha da IA não cria registo de caso. Com `caseId`, mantém-se persistir rascunho antes da IA (caso já existe).
- **Cache / UI:** após rascunho ou estrutura, `revalidatePath` em `/cases`, `/cases/[id]` e sub-rotas (`entrevista`, `partes-fatos`, `documentos`, `pesquisa-juridica`, `estrategia`). O formulário chama `router.refresh()` após sucesso.
- **Layout entrevista no caso:** `FundamentalIntakeFormContent` com `mode="embedded"` em `/cases/[id]/entrevista` — grelha + sidebar `sticky` no centro, sem `fixed` em `md:right-0` que invadia o rail direito.
- **Pesquisa jurídica:** `credentials: "include"` nos `fetch` de `case-research-tab.tsx` (alinhado ao intake).
- **Testes:** `tests/cases/fundamental-intake-route-order.test.ts`, `tests/cases/p0-case-flow-qa-contracts.test.ts` (contratos P0 QA). `middleware.test.ts` atualizado.
- **Build desta sub-rodada:** `pkill -f "next dev" || true`, `rm -rf .next`, `npm run build:clean` — **OK** (Next.js production build concluído).

## Atualização (2026-05-14) — P0.1 Case Flow E2E autenticado + asserts no Postgres

- **Objetivo:** prova de produto (browser + DB), não só contratos Vitest — ver prompt P0.1 na última instância.
- **Ficheiros:** `tests/e2e/auth.setup.ts` (grava `tests/e2e/.auth/user.json`, ignorado no git), `tests/e2e/case-flow-fundamental.spec.ts`, `tests/e2e/helpers/intake-form-e2e.ts`, `tests/e2e/helpers/case-materialization.ts`, `playwright.config.ts` (projetos `setup` + `chromium` + `chromium-auth` quando há credenciais), `tests/e2e/05-api-auth-required.spec.ts` (POST recommend/pin → **401** + `SESSION_REQUIRED`), `tests/e2e/07-cases.spec.ts` (intake sem auth → `SESSION_REQUIRED`).
- **Variáveis:** `E2E_BASE_URL` (opcional; senão `next dev` na porta `E2E_PORT` ou 3000), **`E2E_USER_EMAIL` + `E2E_USER_PASSWORD`** (obrigatórias para correr o spec fundamental; sem elas o `playwright.config` **não** regista o projeto `chromium-auth` e o spec é ignorado), **`DATABASE_URL`** no mesmo processo que executa Playwright para contagens Prisma após estruturação, **`DEEPSEEK_API_KEY`** (ou `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` conforme `AI_CHAT_PROVIDER`) para estruturar com Lex AI e passos pesquisa/estratégia/minuta que dependem do motor.
- **Cenários no spec (serial):** (1) rascunho em `/cases/new` + 201 + lista em `/cases`; (2) `?continue=` reabre título; (3) estruturar + redirect + toast; (4) Prisma: `CaseParty`/`CaseFact`/`CaseRequest`/`CaseRisk` + `metadataJson.intakeStructuredAt` + `intakeForm`; (5) segundo POST `structure` → **409** sem duplicar contagens; (6) `/partes-fatos` com `Partes·`/`Fatos·`/`Pedidos·` ≥ 1; (7) `/entrevista` pós-estruturação + `scrollWidth` ≤ `innerWidth`; (8) pesquisa: POST recommend ≠ 401 + POST pin sintético ≠ 401; (9) POST `/api/cases/[id]/strategy` e `/draft` ≠ 401 (aceita 4xx/5xx reais documentados na anotação do teste). **Limpeza:** `afterAll` apaga o caso se o título começa por `E2E Case Flow` (best-effort).
- **Skips:** passos 3–9 usam `test.skip` quando falta modelo de IA ou `DATABASE_URL`; mensagens indicam o env em falta.
- **Comandos (rodar localmente com credenciais):** `npm run test:e2e -- --project=chromium-auth` (implica `setup` + app acessível). Sem credenciais: `npm run test:e2e -- --project=chromium` continua a correr os outros specs (o fluxo fundamental fica de fora).
- **Comandos (agente, 2026-05-14 — continuação):** `npm run lint` — OK após corrigir script (`eslint .`), ignores em `eslint.config.mjs` (`.next`, `public`, `scripts`, `codigos de leis`) e pequenos fixes em `tailwind.config.ts` / testes. `npm run typecheck` — OK (`maxOutputTokens` em chamadas `generateText`/`streamText`, rota `api/chat` com `createUIMessageStream`, `embedMany` com `EmbeddingModel`, `JSONValue` de `@ai-sdk/ui-utils` no processo). `npm test` — **677** OK. `npx playwright test tests/e2e/05-api-auth-required.spec.ts --project=chromium` — **14** OK (recommend/pin com `SESSION_REQUIRED`). `npm run build:clean` (`.next` limpo, sem `next dev`) — OK (~32s). **`chromium-auth` / `case-flow-fundamental.spec.ts`:** não executado neste ambiente (sem `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` nem `DATABASE_URL` de teste expostos ao agente); contagens Prisma antes/depois — N/D. **Commit atómico P0.1:** não feito pelo agente (working tree mistura A e B; requer `git add` só dos ficheiros da lista P0.1 + eventual commit separado para gates AI/lint). **Push:** não executado.
- **CI:** sem `E2E_USER_EMAIL`/`E2E_USER_PASSWORD`, o projeto autenticado não existe — não quebra o job; para prova P0.1 completa configure secrets no CI ou rode manualmente.
- **Commit/push:** feitos nesta rodada apenas se o utilizador integrar o diff; caso contrário manter pendência explícita no git.

## Atualização (2026-05-14) — P0 Case Flow QA (validação ponta a ponta)

- **QA manual autenticado** (rascunho → estruturar → `/cases` → partes-fatos → entrevista embutida → pesquisa → estratégia → minuta; erros sessão/IA; idempotência; caso legado): continua recomendado como complemento visual; **P0.1** cobre automatizado autenticado + DB quando envs existem.
- **Automatizado (contratos no repo):** `tests/cases/p0-case-flow-qa-contracts.test.ts` — middleware (`getSession` + `SESSION_REQUIRED`), POST checklist **409** em fluxo fundamental, `credentials: "include"` na pesquisa do caso, ordem **persist → 409 gate → DeepSeek** no ramo `caseId` existente, dedupe de partes em `applyFundamentalStructure`, `mode="embedded"` na entrevista, `router.refresh()` após intake. Mantém-se `tests/cases/fundamental-intake-route-order.test.ts` (novo caso: IA antes de persistir).
- **Comandos (esta rodada):** `npm run lint`, `npm run typecheck`, `npm test` (**665**), `npx prisma migrate status` (up to date), `npm run build:clean` — OK.
- **Materialização:** lógica existente em `applyFundamentalStructure`; partes com `partyKeys` anti-duplicado no mesmo `caseId`; segunda estruturação devolvida **409** antes de nova chamada DeepSeek quando `intakeStructuredAt` já existe. **P0.1** adiciona contagens Prisma e segundo POST no mesmo `caseId`.
- **Pesquisa / estratégia / minuta:** P0.1 valida rotas autenticadas e códigos HTTP reais; sucesso 2xx depende de corpus/chaves e é anotado no teste quando não ocorre.
- **Commit/push:** ver secção P0.1 acima.

## Atualização (2026-05-14) — QA layout foundation (validação final checklist)

- **Automático (fecho P1.1 layout):** `npm run lint`, `npm run typecheck`, `npm test` (654) — OK. **`npm run build:clean` passou** com `next dev` parado (`pkill -f "next dev"`), `.next` removido, e build de produção concluído (2026-05-14; duas corridas seguidas após suíte). Com dev a escrever no mesmo `.next`, o build pode falhar (ver `docs/LEX_LAYOUT_FOUNDATION.md`).
- **Visual mínimo autenticado (scrollWidth, sidebar aberta/recolhida):** não executável neste ambiente (sem browser com sessão). Rotas a validar localmente: `/dashboard`, `/agenda`, `/cases/[id]`, `/processos`, `/processos/[id]`, `/documentos`, `/publicacoes`, `/settings/integracoes` — consola: `document.documentElement.scrollWidth <= window.innerWidth`; centro estável, topbar alinhada, rails a absorver largura, cartões sem esticar indevidamente; `/dashboard` com `LexCenterGrid` 4 colunas; `/agenda` sem regressão; rail do caso via `CaseDetailRightRail` (sem CSS global novo).
- **Padrão:** corpo autenticado `(app)` via `LexPageFrame` (layouts de segmento, páginas `/cases` e `/cases/new`, `cases/[id]/layout`, ou `LexAgendaShell` com bleed para `/agenda`).

## QA manual — layout (sidebar × viewport × rotas)

**Viewports:** 1920×1080 e 1366×768 (DevTools responsive ou janela redimensionada). **Estados da sidebar:** expandida e recolhida (topbar: Recolher / hover na marca para Expandir).

**Por rota** (`/dashboard`, `/agenda`, `/cases/[id]`, `/processos`, `/processos/[id]`, `/documentos`, `/publicacoes`, `/settings/integracoes`):

1. **Overflow horizontal:** `document.documentElement.scrollWidth <= window.innerWidth` (ou barra de scroll horizontal ausente). Atéção extra em tabelas/listas densas (`/processos`, `/documentos`).
2. **Centro:** ao alternar só a sidebar, a coluna central não deve “saltar” de largura de forma errática; conteúdo com `min-w-0` onde há grelha/flex.
3. **Rails:** agenda (laterais), caso (copiloto desktop): devem crescer/recolher dentro do chrome, sem empurrar o viewport além da largura da janela.

**Dashboard — esqueleto:** `dashboard/loading.tsx` passou a usar os mesmos `col-span-*` que a página dentro de `LexCenterGrid` (alinhado aos cartões de calendário); regressão visual de loading a validar manualmente.

## Atualização (2026-05-14) — P1 UX fluxo do caso (cockpit / copiloto / visão geral)

- **Objetivo:** primeira dobra mais visual e menos textual, sem alterar `LexPageFrame`, grelha nem regras de negócio.
- **Cockpit (`CaseCockpitHeader`):** resumo longo removido do topo; métricas de linha única viraram `CockpitHealthChips` (até 3: docs travados, riscos, prontidão); bloqueios em **uma** linha “Bloqueio: …”; fase atual como badge; “Próxima ação” sem parágrafo de descrição (detalhe no `title` do botão em `CaseCockpitActions`).
- **Chips (`CaseCockpitMetricChips`):** pendências da entrevista + Docs / Fatos n/m / Pesquisa / Peças (sem duplicar “Sem CNJ” do badge).
- **Fluxo (`CaseWorkflowRail`):** legenda textual removida; critérios só em `title` das fases.
- **Copiloto (`CaseCopilotPanel`):** estrutura curta (Agora / Atenção máx. 3 / risco com link para Partes e fatos / atalhos 4); removidos critérios longos, bloqueadores duplicados e descrição da ação primária; prop `workflow` deixou de ser necessária.
- **Visão geral:** `page.tsx` sem bloco introdutório longo; `CaseOverviewTab` — cartão entrevista fundamental truncado; removido `ReadinessCard` duplicado; cartão pré-processual compacto; processo + próximos passos corrigidos na ordem JSX.
- **QA local (esta rodada):** `npm run lint`, `npm run typecheck`, `npm test` (654) — OK. `npm run build:clean` falhou neste ambiente com `PageNotFoundError: /_document` durante “Collecting page data” (artefacto conhecido quando o build corre em paralelo com dev ou cache inconsistente; repetir com dev parado).

## Atualização (2026-05-14) — Chrome: toggle da sidebar no rodapé

- **Concluído:** recolher/expandir menu lateral na **parte inferior** da `AppSidebar` (após conta/workspace), com `border-t`; header volta a ser só logo + wordmark condicional.
- **Ficheiros:** `src/components/app/app-sidebar.tsx`, `src/components/app/app-topbar.tsx`.

## Atualização (2026-05-14) — P1.1 layout global (LexPageFrame em `(app)`)

- **Segment layouts:** `settings`, `documentos`, `processos`, `biblioteca`, `editor`, `dashboard`, `publicacoes`, `pesquisa-juridica`, `busca`, `demo`, `test-guide`, `apresentacao` — cada um envolve `{children}` em `LexPageFrame` (wide ou default conforme pasta).
- **Cockpit / strategy:** `LexPageFrame` no `layout.tsx` existente (substitui fragmento vazio).
- **Casos:** lista (`/cases`) e novo caso (`/cases/new`) com `LexPageFrame` na página; detalhe continua em `cases/[id]/layout` com `CaseDetailRightRail` + `centerWidth="default"`.
- **Config:** `matchRouteLayout()` em `page-layout-config.ts` (classificação explícita por rota); testes em `page-layout-config.test.ts`.
- **Documentação:** `docs/LEX_LAYOUT_FOUNDATION.md`.
- **QA local:** `npm run lint`, `npm run typecheck`, `npm test` (654), `npm run build` — OK; `npx prisma migrate status` — schema up to date.

## Atualização (2026-05-14) — P1 fundação de layout (LexPageFrame + grelha central)

- **Objetivo:** padrão global de rails + centro fixo + grelha interna de 4 colunas (desktop-first), extraído da Agenda.
- **Componentes:** `src/components/layout/lex-page-frame.tsx`, `src/components/layout/lex-center-grid.tsx`; config de bleed: `src/lib/layout/page-layout-config.ts` (substitui `pathname === "/agenda"` no `AppChrome`).
- **CSS:** tokens em `:root` (`--lex-content-default|wide|full`, `--lex-page-gap`, `--lex-center-grid-columns`, `--lex-rail-*`, `--lex-center-track`, `--lex-rail-right-max`); classes `.lex-layout-three-well` (+ alias `.lex-agenda-three-well`), `.lex-layout-center-grid`, `.lex-layout-constrained-*` (poço sem bleed).
- **Agenda:** `LexAgendaShell` usa `LexPageFrame` com `bleed` + `leftRail` / `rightRail` (visual alinhado ao legado); `agenda/loading.tsx` usa `lex-layout-three-well` + `data-lex-tracks="lcr"`.
- **Caso:** `cases/[id]/layout.tsx` — `LexPageFrame` + `rightRail` = copiloto (rail padronizado; cópia mobile `xl:hidden` mantida).
- **Dashboard:** `LexPageFrame` com `centerWidth="wide"` + `LexCenterGrid`; cartões de calendário com `col-span-*` responsivos.
- **QA local (esta rodada):** `npm run lint`, `npm run typecheck`, `npm test` (646 + `page-layout-config.test`), `npm run build` — OK.

## Atualização (2026-05-14) — P1 fluxo jurídico (Kanban/Scrumban explícito)

- **Modelo:** `src/lib/cases/case-legal-workflow.ts` — 8 fases (Coleta → … → Protocolo), DoD heurístico, bloqueios e confirmação manual de protocolo só com `metadataJson.brain.workflow.protocolReadyConfirmed` (sem automação).
- **UI:** `CaseWorkflowRail` no cockpit; métricas de fluxo (criado, última atividade, prontidão, docs travados, riscos); até 2 avisos de política; copiloto com WIP (bloqueadores, critérios, lacunas, riscos, atalhos limitados).
- **QA local:** `npm run lint`, `npm run typecheck`, `npm test` — ver rodada abaixo.

## Atualização (2026-05-14) — P1 refinamento cockpit + visão geral

- **Título:** `SetPageTitle` e breadcrumb final passam a **“Detalhe do caso”** (título completo só no `h1` + `title` no crumb); chip **Sem CNJ** quando pré-processual sem número.
- **CTA:** `resolveCaseCockpitPrimaryAction` + `CaseCockpitActions` (primário dinâmico + **Mais ações**: gerar/revisar peça, pesquisa, processo, agenda, arquivar); `CaseActions` deixou de ser usado no layout (mantido no repo).
- **Progresso:** barra normal em **roxo Lex** (`--brand-primary`); **âmbar** só com doc travado ou etapa bloqueada; **verde** ao 100%.
- **Visão geral:** processo + agenda em **grid 2 colunas**; textos curtos; `CaseCalendarSection` com `compact`; removidos cartão roxo grande de pré-processual e **grid de 3 métricas** (substituídos por chips no cockpit).
- **Copiloto:** painel lateral `CaseCopilotPanel` (desktop) + mesmo bloco **abaixo do cockpit no mobile** (`xl:hidden` / `hidden xl:block`).
- **Ficheiros novos:** `case-cockpit-primary-action.ts`, `case-cockpit-actions.tsx`, `case-cockpit-metric-chips.tsx`, `case-copilot-panel.tsx`.
- **QA local:** `npm run lint`, `npm run typecheck`, `npm test` (642) — OK. `npm run build:clean` não repetido nesta sub-rodada.

## Atualização (2026-05-14) — P1 cabeçalho operacional do caso

- **Concluído:** resumo + progresso fundidos num único cartão `CaseCockpitHeader` (`src/components/cases/case-cockpit-header.tsx` + progresso compacto `case-cockpit-progress.tsx`); lógica de etapas extraída para `src/lib/cases/case-progress-model.ts` (sem mudança de regras). Removido `case-progress.tsx` (substituído).
- **Visão geral:** texto introdutório da página deixa de citar “progresso” (já no topo); resumo duplicado só aparece como “Descrição completa” quando o texto passa de ~200 caracteres (cabeçalho continua com prévia em 2 linhas).
- **Correção colateral:** `tests/cases/fundamental-intake.test.ts` — narrowing após `safeParse` para `tsc` no `tsconfig.test.json`.
- **Ajuste cockpit (mesma rodada):** “Próximo passo” usa `getNextStepCallToAction` (tom imperativo, ex. “Enviar documento”); quatro fases em `flex-nowrap` lado a lado com scroll horizontal discreto em viewports estreitas.

## Atualização (2026-05-14) — auditoria fluxo caso (demo)

- **Qualidade local:** `npm run lint` e `npm run typecheck` OK; `npm test` — 629 testes OK (incl. `case-tenancy`, `fundamental-intake`, fluxo caso).
- **Build produção:** com `.next` limpo e **sem** `next dev --turbopack` a escrever no mesmo diretório, `next build` concluiu com sucesso (2026-05-14). Se o dev estiver a correr, pode corromper `.next` (artefactos `[turbopack]_runtime.js` em `server/pages/_document.js`).
- **Dashboard → estratégia:** `buildNextActions` já usa `/cases/[id]/estrategia` (linha “Casos com fatos mas sem estratégia”); a nota antiga sobre `?tab=strategy` está **obsoleta**.
- **Pesquisa jurídica (API):** `POST /api/legal-research/recommend-for-case` e `POST /api/legal-research/pin` estão implementados (modo DeepSeek; ver ADR); a tabela de “stubs” abaixo ficou parcialmente desatualizada para estas rotas.

## Atualização (2026-05-12)

- Pesquisa do caso: pins assistidos aparecem em **Estratégia e peças** via espelho `CaseLegalSource`.
- Estratégia: `POST /api/cases/[id]/strategy` gera `draftingStrategy` com **DeepSeek**, sem `retrieveLegalContext`.
- Minuta: `POST /api/cases/[id]/drafts` chama `generateDraft` (DeepSeek). Botão **Editor final** → `POST .../drafts/[draftId]/promote` → `/editor/[pieceId]`.

## Fluxo canônico (6 seções)

Ordem fixa na subnavegação persistente (`CaseSubnav`):

1. **Visão geral** — `/cases/[id]` — progresso, narrativa, próximos passos, **atividades** (linha do tempo + colaboração).
2. **Entrevista** — `/cases/[id]/entrevista` — **fluxo fundamental:** `FundamentalIntakeFormContent` (continuação de `/cases/new`, `metadataJson.intakeForm`); **legado (casos antigos):** `CaseChecklistTab` + `GET/POST /api/cases/[id]/checklist` (Lane B).
3. **Partes e fatos** — `/cases/[id]/partes-fatos` — `CaseFactsPartiesTab` (CRUD inline existente: facts, parties, requests, risks via rotas `/api/cases/[id]/*`).
4. **Documentos** — `/cases/[id]/documentos` — `CaseDocumentsTab` (upload, status, texto extraído em diálogo, atalhos para estratégia/partes).
5. **Pesquisa jurídica** — `/cases/[id]/pesquisa-juridica` — `CaseResearchTab` em `src/components/cases/research/case-research-tab.tsx` (Case Brain resumido + recomendações + `LegalSearchPanel`).
6. **Estratégia e peças** — `/cases/[id]/estrategia` — lazy via `EstrategiaLazy` → `CaseStrategyPiecesTab` (**Lane D**; não editar nesta lane).

## Compatibilidade

- Links antigos `?tab=` são redirecionados por `CaseLegacyQueryRedirect` para a rota equivalente.
- **Dashboard:** `src/lib/dashboard/next-actions.ts` usa rotas por secção (ex.: `/cases/[id]/estrategia`).

## Página global

- **`/pesquisa-juridica`** — `GlobalPesquisaWorkbench`: busca com debounce 250 ms, abas de filtro (Todos · Leis · Jurisprudência · Teses · Estratégia), filtros em cartão, resultados + painel lateral assistido, mensagem de transparência DeepSeek (`USER_FACING_MESSAGES.DEEPSEEK_TRANSPARENCY_TOP`).

## Terminologia (PARTE 12)

- Fonte: `src/lib/ui/product-terminology.ts` — `PRODUCT_TERMINOLOGY`, `translateTerm`, `USER_FACING_MESSAGES`.
- **Regra:** não exibir ao usuário comum strings com jargão interno (ex.: nomes de infraestrutura técnica); usar tradução ou mensagem canônica.
- **Divergência intencional:** a mensagem obrigatória do prompt que citava “motor interno de busca no corpus” foi adaptada para **“A pesquisa interna no acervo…”** (mesmo significado, sem sigla na UI).

## Dados: Case Brain → UI

| Fonte | Uso na UI |
|-------|-----------|
| `Case.metadataJson.brain.narrative` | Resumo contextual na aba pesquisa; empty state se sem narrativa **e** sem `rawInput` **e** sem entidades |
| `facts`, `parties`, `requests`, `risks`, `documents` (Prisma) | Chips de contagem, corpo da aba pesquisa, empty states |
| `POST /api/legal-research/recommend-for-case` | Sugestões (Lane A). **404/501:** UI degrada com cartão informativo (sem stack). |
| `POST /api/legal-research/pin` | Fixar fundamento. **404/501:** aviso amigável (stub). |

## Acessibilidade (WCAG AA — baseline)

- `aria-current="page"` nos links da subnav; `aria-label` em botões só-ícone; `role="alert"` / `aria-live="polite"` em erro/loading onde aplicável.
- Foco visível: classes `focus-visible:ring-*` nos links da subnav e CTAs principais.

## Stubs / swaps pendentes (Lane E + orquestração)

| Stub | Ação |
|------|------|
| `POST /api/legal-research/recommend-for-case` | **Implementado** (DeepSeek + rate limit; 503 se desligado). |
| `POST /api/legal-research/pin` | **Implementado** (`addPinnedFoundationToCase`). |
| `CaseResearchTab` → “Adicionar à estratégia” | Integrar com Case Brain / Lane D (se ainda não espelhado na UI). |
| Import canônico Lane D | Documentado: hoje `EstrategiaLazy` importa `CaseStrategyPiecesTab`. Se Lane D publicar barrel (`case-drafting-tab`), trocar só o dynamic import em `estrategia-lazy.tsx`. |

## Arquivos tocados (Lane C)

- `src/app/(app)/cases/[id]/layout.tsx`, `_load-case.ts`, `page.tsx`, `entrevista/page.tsx`, `partes-fatos/page.tsx`, `documentos/page.tsx`, `pesquisa-juridica/page.tsx`, `estrategia/page.tsx`
- `src/app/(app)/pesquisa-juridica/page.tsx`
- `src/components/cases/case-subnav.tsx`, `case-legacy-query-redirect.tsx`, `estrategia-lazy.tsx`, `global-pesquisa-workbench.tsx`
- `src/components/cases/case-cockpit-header.tsx`, `case-cockpit-progress.tsx` (P1 cockpit)
- `src/lib/cases/case-legal-workflow.ts`, `case-workflow-rail.tsx`
- `src/components/cases/research/case-research-tab.tsx` (+ `credentials: "include"` na rodada P0 integrity)
- `src/middleware.ts`, `src/middleware.test.ts`
- `playwright.config.ts`, `tests/e2e/auth.setup.ts`, `tests/e2e/case-flow-fundamental.spec.ts`, `tests/e2e/helpers/intake-form-e2e.ts`, `tests/e2e/helpers/case-materialization.ts`, `tests/e2e/05-api-auth-required.spec.ts`, `tests/e2e/07-cases.spec.ts`
- `src/app/api/cases/fundamental-intake/route.ts`, `tests/cases/fundamental-intake-route-order.test.ts`, `tests/cases/p0-case-flow-qa-contracts.test.ts`
- `src/components/cases/fundamental-intake-form.tsx`, `src/app/(app)/cases/[id]/entrevista/page.tsx`, `src/app/(app)/cases/new/page.tsx`, `src/components/cases/case-checklist-tab.tsx`
- `src/lib/cases/case-intake-source.ts`, `case-checklist-state.ts`, `src/app/api/cases/[id]/checklist/route.ts`
- `src/components/cases/case-overview-tab.tsx`, `case-documents-tab.tsx`, `case-tabs.tsx`
- `src/lib/ui/product-terminology.ts`
- `docs/UX_FLOW_AUDIT.md`

## Case Cockpit — Fase 3 (entrevista guiada + IA, 2026-05-19)

| Entrega | Detalhe |
|---------|---------|
| Stepper guiado | 9 etapas (`intake-guided-flow.ts`, `IntakeGuidedStepper`); revisão com checklist complementar MVP |
| Caso ≠ processo | Card na entrevista; CNJ/tribunal/vara só se `preOrProcess === "existing_process"` |
| IA estrutura | `structured-output-schema` (+ lacunas, relações, provas, confirmações); `sanitizeStructuredSummary`; `intakeFundamental` em metadata |
| Fatos e partes | `buildCaseDisplaySnapshot` deriva fatos por categoria; `CaseIntakeDerivedSections` + banner insuficiência |
| Compat | `save`/`draft` sem IA; `REORGANIZE_REQUIRED` + dialog na UI; checklist legado em `/entrevista` sem fluxo fundamental |
| Testes | `tests/cases/case-cockpit-phase3-intake.test.ts` + suíte lazy-intake/case-flow (60 testes na rodada 2026-05-19) |

**Pendente Fase 4:** E2E autenticado pré-processual; `?q=` na pesquisa do caso; `COMMERCIAL_UX_P0_AUDIT.md`.

## Riscos abertos

- **Tabs Radix:** na pesquisa global, conteúdo de resultados fica **fora** de `TabsContent` para evitar mismatch de `value`; apenas `TabsList` + estado `tab` controla o filtro.
- **Dark theme:** referência HTML era clara; a UI segue o shell escuro existente (`AppShell`), com cartões `bg-card` e bordas suaves como padrão equivalente.

## Confirmações de processo

- **Lint / typecheck / test (2026-05-14):** ver secções “Entrevista fundamental vs checklist”, “P0 Case Flow Integrity” e “P0 Case Flow QA”.
- **Build produção:** `build:clean` OK nas sub-rodadas P0 integrity e P0 QA (dev parado, `.next` limpo).
- **Previews HTML:** não foram copiados assets, scripts, marca nem classes proprietárias; apenas padrões (hierarquia, cartões, busca ampla, painel lateral).
