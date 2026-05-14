# UX Flow Audit — Caso (P0 Lane C)

**Status:** F-1 sign-off provisório. Release público bloqueado. Owners Legal / Security / QA Lead: **PROVISÓRIO** (dupla revisão Thales PO + Cursor CTO interim).

## Atualização (2026-05-14) — QA layout foundation (validação final checklist)

- **Automático (fecho P1.1 layout):** `npm run lint`, `npm run typecheck`, `npm test` (654) — OK. `npm run build:clean` — **falhou** com `next dev` ativo (corrida em `.next` / módulo `[turbopack]_runtime.js` em fase “Collecting page data”). Repetir com dev parado (ver `docs/LEX_LAYOUT_FOUNDATION.md`).
- **Visual (sidebar aberta/recolhida):** não executado aqui com sessão autenticada nem screenshots por rota. Checklist manual sugerido: `/dashboard`, `/agenda`, `/cases/[id]`, `/processos`, `/processos/[id]`, `/documentos`, `/publicacoes`, `/settings/integracoes` — centro estável, rails a absorver largura, sem overflow horizontal, topbar alinhada, cartões sem esticar indevidamente; `/dashboard` com `LexCenterGrid` 4 colunas; `/agenda` sem regressão; rail do caso extensível só com JSX em `CaseDetailRightRail` (sem CSS global).
- **Padrão:** corpo autenticado `(app)` via `LexPageFrame` (layouts de segmento, páginas `/cases` e `/cases/new`, `cases/[id]/layout`, ou `LexAgendaShell` com bleed para `/agenda`).

## QA manual — layout (sidebar × viewport × rotas)

**Viewports:** 1920×1080 e 1366×768 (DevTools responsive ou janela redimensionada). **Estados da sidebar:** expandida e recolhida (topbar: Recolher / hover na marca para Expandir).

**Por rota** (`/dashboard`, `/agenda`, `/cases/[id]`, `/processos`, `/processos/[id]`, `/documentos`, `/publicacoes`, `/settings/integracoes`):

1. **Overflow horizontal:** `document.documentElement.scrollWidth <= window.innerWidth` (ou barra de scroll horizontal ausente). Atéção extra em tabelas/listas densas (`/processos`, `/documentos`).
2. **Centro:** ao alternar só a sidebar, a coluna central não deve “saltar” de largura de forma errática; conteúdo com `min-w-0` onde há grelha/flex.
3. **Rails:** agenda (laterais), caso (copiloto desktop): devem crescer/recolher dentro do chrome, sem empurrar o viewport além da largura da janela.

**Dashboard — esqueleto:** `dashboard/loading.tsx` passou a usar os mesmos `col-span-*` que a página dentro de `LexCenterGrid` (alinhado aos cartões de calendário); regressão visual de loading a validar manualmente.

## Atualização (2026-05-14) — Chrome: toggle da sidebar no header

- **Concluído:** recolher/expandir menu lateral saiu da `AppSidebar` e passou para `AppTopbar`, na faixa da marca (logo + wordmark à esquerda, **Recolher** à direita). Com sidebar recolhida, **hover** na área da logo mostra o botão **Expandir** (stack `peer` + z-index para cliques na logo quando não em hover; teclado: foco no botão expande).
- **Ficheiros:** `src/components/app/app-topbar.tsx`, `src/components/app/app-sidebar.tsx`.
- **QA local (esta sub-rodada):** `npm run typecheck` — OK.

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
2. **Entrevista guiada** — `/cases/[id]/entrevista` — `CaseChecklistTab` (API `/api/cases/[id]/checklist`, Lane B).
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
- `src/components/cases/research/case-research-tab.tsx`
- `src/components/cases/case-research-tab.tsx` (re-export)
- `src/components/cases/case-overview-tab.tsx`, `case-documents-tab.tsx`, `case-tabs.tsx`
- `src/lib/ui/product-terminology.ts`
- `docs/UX_FLOW_AUDIT.md`

## Riscos abertos

- **Tabs Radix:** na pesquisa global, conteúdo de resultados fica **fora** de `TabsContent` para evitar mismatch de `value`; apenas `TabsList` + estado `tab` controla o filtro.
- **Dark theme:** referência HTML era clara; a UI segue o shell escuro existente (`AppShell`), com cartões `bg-card` e bordas suaves como padrão equivalente.

## Confirmações de processo

- **Lint / typecheck / test (2026-05-14):** executados — ver secção “Atualização (2026-05-14)” no topo.
- **Build produção:** validar com dev server parado (ver topo).
- **Previews HTML:** não foram copiados assets, scripts, marca nem classes proprietárias; apenas padrões (hierarquia, cartões, busca ampla, painel lateral).
