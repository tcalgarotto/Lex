# P0 Commercial Release Report — Lex (integração Lane E)

> Relatório **honesto** pós-swaps de integração (2026-05-10). Sign-off **F-1** vigente: owners Legal/Security/QA **\[PROVISÓRIO\]**; **promoção a produção pública pagante permanece bloqueada** (`docs/governance/F-1_SIGNOFF.md`).

## 1. Status global

**NOT READY — produção pública pagante.** Justificativa: owners provisórios + gates de segurança/UX ainda ⏳ no audit (admin gating server-side, checklist amplo §3), e **`src/lib/legal-research/types.ts` segue fora do índice git** (`??` no `git status`) até decisão de versionamento/commit humano.

**READY — uso interno / demo controlada (F0)** condicionado a: revisão humana obrigatória de toda saída assistida; ambiente com chaves DeepSeek e `LEGAL_RESEARCH_PROVIDER=deepseek` conforme ADR; equipe ciente de que E2E Playwright **não foi reexecutado nesta sessão** após todos os swaps.

## 2. Fase 1 — Integração (swaps)

| # | Swap | Estado |
|---|------|--------|
| 1 | `estrategia-lazy.tsx` → `CaseDraftingTab` | Feito |
| 2 | `POST .../pin` e `mark-verified` → Case Brain real | Feito |
| 3 | `case-brain-shim.ts` delega snapshot/pins/verify | Feito |
| 4 | Pesquisa no caso → `GET /api/cases/[id]/case-brain` | Feito |
| 5 | UI pesquisa — contrato Lane A real (sem 404/501 “esperado”) | Feito |
| 6 | `types.ts` versionado | **Não** — arquivo ainda **untracked** |
| 7 | Inngest `case-ready-for-research` | **Não** registrado (deliberado) |
| 8 | `next-actions.ts` + `strategy-gaps-panel` hrefs | Feito |
| 9 | `claims` / `requests` | Mantidos ambos; unificação **TODO** |

**Conflitos:** nenhum conflito de merge detectado; ajustes de tipo em `activity-log.ts`, cast em `pinned-foundations/route.ts` e `prefer-const` em `drafting-markdown-export.ts` para fechar lint/typecheck.

## 3. Fase 2 — QA (comandos)

| Comando | Resultado |
|---------|-------------|
| `npm run lint` | OK — **1 warning** pré-existente: `interview-extraction.ts` (`risksBrain` unused) |
| `npm run typecheck` | OK |
| `npm test` | **595 passed** |
| `npm run test:integration` | **43 passed** |
| `NODE_ENV=production npm run build` | OK |
| `npm run test:e2e` | **Não executado** nesta sessão pós-swaps |
| `npm run qa:retrieval:domains` | **10/10** (Redis avisou indisponível localmente; script passou) |

## 4. Fase 3 — Testes adicionados

| Arquivo | Foco |
|---------|------|
| `tests/legal-research/deepseek-provider.test.ts` | JSON válido/inválido; provider sem throw com key ausente; upstream; retry |
| `tests/legal-research/research-flow.test.ts` | Schemas pin/mark/search |
| `tests/cases/case-flow.test.ts` | Contrato pin com `foundation` |
| `tests/ui/case-flow.test.ts` | Ordem das abas + ausência de jargão nas mensagens USER_FACING testadas |
| `tests/security/legal-research-security.test.ts` | `scrubPii` |
| `tests/security/case-tenancy.test.ts` | Schema `recommend` exige `caseId` |

`vitest.config.ts`: inclui `tests/**/*.test.ts(x)`.

## 5. Fase 4 — Documentação

- **Governança:** `PRIORITY_MATRIX.md`, `FORBIDDEN_ORDERINGS.md` (nota F-O-08/09 + **F-O-21**), `PRODUCT_SURVIVAL_MODE.md`, `TRUTH_HIERARCHY.md` (nível 9b + regra 13 + linha na matriz).
- **Validação / planos / features:** `docs/validation/*` (3 arquivos), `docs/plans/P0_CASE_FLOW_REPAIR_PLAN.md`, `docs/features/CASE_RESEARCH_TAB.md`.
- **README:** sem alteração necessária (sem referência a `?tab=strategy` obsoleta).

## 6. Bugs P0 corrigidos nesta leva

- Integração incompleta entre pesquisa assistida, Case Brain e drafting (pins “mortos”, 202 shim, payload/schema divergentes).
- `recommend-for-case` no cliente com corpo inválido e parse de resposta errado.
- Pesquisa global usando rota errada sem `caseId`.
- Links do dashboard e painel de lacunas ainda apontando para `?tab=`.

## 7. Bloqueadores reais (NOT READY)

- Release **público pagante** bloqueado por **F-1** (owners provisórios), independente do verde técnico.
- **`src/lib/legal-research/types.ts` não rastreado no git** — risco de perda/revisão incompleta em PR.
- **E2E** não revalidado após integração; **admin gating** ainda conforme audit de segurança.

## 8. Pré-existentes observados

- Warning ESLint `risksBrain` em `interview-extraction.ts` (fora do escopo Lane E).
- Integrações externas (Qdrant/Redis) com stderr em testes de integração quando serviços ausentes — tratado como ambiente de CI/local.

## 9. TODOs futuros

- Registrar evento Inngest `case-ready-for-research` quando houver critério de produto.
- Unificar `claims` vs `requests` com migração de clientes.
- `git add` + commit dos arquivos Lane A incluindo `types.ts`.
- Reexecutar `npm run test:e2e` e `npm run qa:retrieval:domains` em CI antes de ampliar pilotos.

## 10. Confirmações explícitas

- **Não** foi executado `git add` / `git commit` / `git push` por esta lane.
- **motor interno de busca no corpus** (`src/lib/retrieval/**`) e **Qdrant** **não** foram removidos nem alterados para esta entrega.
- Owners Legal/Security/QA continuam **\[PROVISÓRIO\]**; release público **bloqueado** conforme F-1.
