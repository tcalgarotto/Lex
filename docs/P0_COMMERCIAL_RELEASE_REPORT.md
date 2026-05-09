# P0 Commercial Release Report — Lex

> Relatório honesto de release P0 comercial (fluxo caso-cêntrico).  
> Última atualização: **2026-05-09** (fechamento sprint — logs P0 / critério L).

## 1. Resumo do que mudou

- **F19 — Memória do escritório (opt-in)**: modelo Prisma `OfficeMemory` com escopos `WORKSPACE` / `USER` / `CASE`, flags `useAsModel`, `useAsStyle`, `optInRag`, `private`, `originType`/`originId`, auditoria (`createdBy`/`updatedBy`, soft delete). API `/api/office-memory` e UI mínima em `/biblioteca/memoria`. Nada é promovido automaticamente para memória.
- **F20 — Painel “Origem dos dados”**: componente `CaseDataOriginButton` + `parseMetadataJson` em fatos, pedidos, riscos; para `CaseLegalSource` (sem `metadataJson` no schema) a origem é montada a partir de `excerpt`, `query`, `chunkId`, `pinnedById`, `createdAt`.
- **F21 / F23**: auditorias atualizadas com evidência em `docs/SECURITY_REVIEW_P0.md` e `docs/CODE_REVIEW_P0.md`.
- **Correção de segurança (defesa em profundidade)**: `buildCaseContext` / `fetchDocumentTexts` agora filtra `Document` por `workspaceId` além dos IDs vindos do caso (`src/lib/cases/context.ts`).
- **Critério L (logs)**: `/api/search` e rotas críticas de documentos/casos passam a usar `getLogger` com scrub; `x-request-id` na busca global; ver `docs/CODE_REVIEW_P0.md` §5.

## 2. Telas alteradas

- `/biblioteca` — link “Memória (opt-in)” para `/biblioteca/memoria`.
- `/biblioteca/memoria` — nova página (lista + formulário de criação + toggles RAG/arquivar/excluir).
- `/cases/[id]` — abas Fatos, Pedidos, Riscos e Pesquisa jurídica: botão **Origem** (diálogo) por item.

## 3. Arquivos principais

| Área | Caminhos |
|------|-----------|
| DB | `prisma/schema.prisma`, `prisma/migrations/20260509220000_office_memory/migration.sql` |
| API memória | `src/app/api/office-memory/route.ts`, `src/app/api/office-memory/[id]/route.ts` |
| Regras visibilidade | `src/lib/office-memory/visibility.ts` |
| UI memória | `src/app/(app)/biblioteca/memoria/page.tsx`, `src/components/biblioteca/office-memory-panel.tsx`, `src/app/(app)/biblioteca/page.tsx` |
| F20 | `src/lib/cases/data-origin-meta.ts`, `src/components/cases/case-data-origin.tsx`, `case-facts-tab.tsx`, `case-requests-tab.tsx`, `case-risks-tab.tsx`, `case-research-tab.tsx` |
| Contexto caso | `src/lib/cases/context.ts` |
| Testes | `tests/integration/office-memory.test.ts`, `tests/e2e/05-api-auth-required.spec.ts` |
| Docs | `docs/SECURITY_REVIEW_P0.md`, `docs/CODE_REVIEW_P0.md`, `docs/COMMERCIAL_UX_P0_AUDIT.md`, este relatório |
| Logging | `src/app/api/search/route.ts`, `src/app/api/documents/**`, `src/app/api/cases/[id]/delete`, `legal-sources`, `src/lib/storage.ts`, `observability/record.ts`, `cost/record.ts`, `inngest/functions/ingest-document.ts` |

## 4. Bugs corrigidos

- **IDOR em profundidade no contexto do caso**: leitura de texto de documentos para RAG/drafting ignorava `workspaceId` no `findMany` de `Document` — corrigido para `{ workspaceId, id: { in: documentIds } }`.

## 5. Riscos remanescentes (explícitos)

1. **Superfície de rotas**: não há prova matemática de que *cada* handler `/api/*` valida `workspaceId`; há amostragem + suíte de integração nas rotas mais sensíveis.
2. **Bootstrap / jobs offline**: `src/lib/env.ts` e `embeddings-pipeline.ts` ainda emitem `console.*` — aceito fora do gate HTTP (ver `docs/CODE_REVIEW_P0.md` §5).
3. **UX comercial (além do gate A–N)**: checklist §3 do audit ainda tem itens ⏳ (cobertura total de telas, tabs em 1366×768, etc.); a rodada P1 em §13 fechou a maioria dos itens §5.2 — ver `docs/COMMERCIAL_UX_P0_AUDIT.md` §8.1.
4. **`AI_REASONING ≠ LEGAL_TRUTH`**: invariante de produto; qualquer regressão em drafting/review exige testes e revisão humana.

## 6. Testes rodados (comandos + resultados)

| Comando | Resultado (2026-05-09) |
|---------|-------------------------|
| `npm run lint` | OK (sem warnings) |
| `npm run typecheck` | OK |
| `npm test` | **534 passed** |
| `npm run test:integration` | **43 passed** (inclui `office-memory.test.ts`) |
| `npm run test:e2e` | **80 passed** (revalidado após UX P1) |
| `NODE_ENV=production npm run build` | OK (`/biblioteca/memoria` e rotas API compiladas) |
| `npm run qa:retrieval:domains` | **10/10** domínios OK |
| `npm run db:migrate:deploy` | Migração `20260509220000_office_memory` aplicada no DB configurado em `.env` |

## 7. Falhas encontradas

- Nenhuma falha nos comandos acima após correções finais (typecheck `OfficeMemoryUpdateInput` via `updatedBy: { connect }`).

## 8. Itens adiados (com justificativa)

- **Exaustão de “toda rota Prisma”**: adiado como processo contínuo; ver tabela em `SECURITY_REVIEW_P0.md`.
- **Refatorar componentes grandes** (`case-facts-tab`, página do caso): adiado (risco/retorno vs sprint).
- **UX P1 (restante §3 do audit)**: continuidade em sprints seguintes; entrega parcial documentada em §13 e no audit §8.1.

## 9. Critérios A–N (release) e status item a item

| Critério | Significado | Status |
|----------|-------------|--------|
| **A** | Lint | ✅ `npm run lint` |
| **B** | Typecheck | ✅ `npm run typecheck` |
| **C** | Testes unitários | ✅ `npm test` (534) |
| **D** | Testes integração | ✅ `npm run test:integration` (43) |
| **E** | E2E | ✅ `npm run test:e2e` (80) |
| **F** | Build produção | ✅ `NODE_ENV=production npm run build` |
| **G** | QA retrieval domínios | ✅ `npm run qa:retrieval:domains` (10/10) |
| **H** | Migrações DB aplicáveis | ✅ `db:migrate:deploy` (OfficeMemory) |
| **I** | Multi-tenant / IDOR (regressão nas rotas críticas) | ✅ Testes + APIs novas; não exaustivo |
| **J** | Uploads/exports com `workspaceId` | ✅ Amostragem documentos + exports + relatório segurança |
| **K** | Cache com isolamento por tenant/contexto | ✅ `cache.ts` + desliga com `caseContext` |
| **L** | Logs sem vazamento bruto (política) | ✅ `getLogger` + scrub + `requestId`/`workspaceId` onde aplicável; sem query bruta em `/api/search` |
| **M** | F20 Origem dos dados (UI) | ✅ Fatos, pedidos, riscos, fundamentos fixados |
| **N** | F19 Memória opt-in | ✅ Modelo + API + `/biblioteca/memoria` |

## 10. Status global

**READY + UX P1 (parcial)** — **READY** mantém-se para o **gate P0 comercial** (**A–N** + bateria §6). Após o fechamento do gate, a rodada **UX P1** em `7a7af85` fechou a maioria dos itens listados em `docs/COMMERCIAL_UX_P0_AUDIT.md` §5.2 (tabela §5.2.1), sem regressão de lint/typecheck/test/integration/e2e/build.

**Argumentação:** **A–N** atendidos com evidência de comandos (§6). O critério **L** foi fechado na sprint anterior com `getLogger` + scrub. **Transparência:** o checklist amplo §3 do audit (todas as telas, tabs 1366×768, estados vazios globais) permanece **parcialmente** ⏳; ver `docs/COMMERCIAL_UX_P0_AUDIT.md` §8.1.

## 11. Instruções para testar (manual)

1. Abrir o roteiro em **`/test-guide`** (após login), seguir jornadas sentinela.  
2. **F19**: `/biblioteca` → “Memória (opt-in)” → criar entrada WORKSPACE e CASE; alternar RAG/arquivar; em outro workspace (outro membro), confirmar que não vê IDs alheios (404 na API).  
3. **F20**: `/cases/[id]` → abas Fatos / Pedidos / Riscos / Pesquisa jurídica → **Origem** e conferir diálogo.

## 12. Pull Request

- **Branch**: `p0-commercial-sprint-2026-05-09`
- **PR #10**: https://github.com/tcalgarotto/Lex/pull/10
- **Compare**: https://github.com/tcalgarotto/Lex/compare/main...p0-commercial-sprint-2026-05-09

## 13. Pós-READY — UX P1 (`7a7af85`)

- **Objetivo**: aproximar o produto da linguagem e do fluxo do advogado (sem reabrir gate A–N).
- **Entregas**: ver `docs/COMMERCIAL_UX_P0_AUDIT.md` §5.2.1 e §7 (comandos reexecutados após o commit).
- **Arquivos tocados (resumo)**: `busca/page.tsx`, `pesquisa-juridica/page.tsx`, `legal-search-panel.tsx`, `case-overview-tab.tsx`, `processos/page.tsx`, `case-drafts-tab.tsx`, `case-research-tab.tsx`, `case-actions.tsx`, `orchestrator.ts`, `legal-sources/route.ts`, `cases/page.tsx`.
