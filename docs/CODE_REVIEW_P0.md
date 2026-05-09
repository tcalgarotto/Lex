# Code Review P0 — Lex

> Checklist de code review focado em riscos P0 (produto jurídico + multi-tenant + RAG seguro).
> Última atualização: 2026-05-09.

## 1. Objetivo

Impedir regressões críticas em:
- multi-tenant / workspace scoping
- IDOR
- RAG grounding (fonte citável)
- placeholders mascarados em minuta
- export/download/segurança

## 2. Checklist P0 (bloqueia merge)

> Legenda: ✅ evidência forte · ⚠️ parcial / P1 remanescente · “aceito-com-justificativa” = amostragem + testes, não exaustão de todas as rotas.

- ✅ **Tenancy (Prisma, superfície crítica)** — aceito-com-justificativa: padrão `getWorkspaceContext()` + `where: { id, workspaceId }` em documentos, casos, fundamentos, memória, peças; regressão em `tests/integration/*`.
- ✅ **Tenancy (Qdrant lex_main)**: busca vetorial restrita a `workspaceIds: [workspaceId, GLOBAL_WORKSPACE_ID]` em `src/app/api/search/route.ts`.
- ✅ **Cache**: `workspaceId` + opções estáveis em `src/lib/retrieval/legal/cache.ts` + testes `cache.test.ts`; cache desligado com `caseContext` em `src/lib/retrieval/legal/index.ts`.
- ✅ **Admin gating**: rotas sensíveis com checagem server-side (ver `docs/SECURITY_REVIEW_P0.md`).
- ⚠️ **Logs**: `src/lib/logger.ts` + `logger.test.ts` cobrem o caminho “oficial”; **exceção P1**: `src/app/api/search/route.ts` (`console.warn`, `catch {}` sem logger).
- ✅ **Uploads / path**: `documentStoragePath(workspaceId, …)` + validações em `src/app/api/documents/upload/route.ts`.
- ✅ **Exports**: `case-draft-export` + `pieces/[id]/export` com `workspaceId` na query.
- ✅ **Drafting / grounding**: `src/lib/cases/drafting.ts` + `orchestrator.ts` consomem `ApprovedLegalFoundation` via `buildApprovedLegalFoundation` / `validateLegalGrounding` + `src/lib/cases/drafting.test.ts`.
- ⚠️ **UX / jargão**: ainda há pontos em `/busca` e painéis técnicos (ver §4.3 e `docs/COMMERCIAL_UX_P0_AUDIT.md`).

## 3. Evidências exigidas

- testes novos/atualizados cobrindo o bug/feature
- comandos rodados local/CI (quando aplicável): lint, typecheck, test, build

**Evidência desta rodada (2026-05-09, ambiente local do agente):**
- ✅ `npm run lint`
- ✅ `npm run typecheck`
- ✅ `npm test` (534 passed)
- ✅ `npm run test:integration` (43 passed)
- ✅ `npm run test:e2e` (79 passed; inclui `GET /api/office-memory` → 401)
- ✅ `NODE_ENV=production npm run build`
- ✅ `npm run qa:retrieval:domains` (10/10)

## 4. Relatório de revisão (preencher com evidência)

> Não declarar “revisado” sem evidência (diff + testes quando aplicável).

### 4.1 Arquivos revisados (diff / novidades desta rodada)

- `src/lib/cases/context.ts` — `fetchDocumentTexts` com `workspaceId` no `where`.
- `src/app/api/office-memory/route.ts`, `src/app/api/office-memory/[id]/route.ts` — CRUD multi-tenant + visibilidade.
- `src/lib/office-memory/visibility.ts` — regras USER / WORKSPACE / CASE + `private`.
- `src/components/biblioteca/office-memory-panel.tsx`, `src/app/(app)/biblioteca/memoria/page.tsx`, `src/app/(app)/biblioteca/page.tsx`.
- `src/lib/cases/data-origin-meta.ts`, `src/components/cases/case-data-origin.tsx`.
- `src/components/cases/case-facts-tab.tsx`, `case-requests-tab.tsx`, `case-risks-tab.tsx`, `case-research-tab.tsx` (F20).
- `tests/integration/office-memory.test.ts`, `tests/e2e/05-api-auth-required.spec.ts`.

### 4.2 Varredura auxiliar (`rg`)

- `catch {` em APIs: **`src/app/api/search/route.ts`** (L227) — único match relevante em busca rápida por `catch {` sob `src/app/api` nesta rodada.
- `workspaceId` em `src/app/api/documents`: ocorrências em `upload`, `[documentId]`, `link-case`, `reprocess`, `route` (lista).

### 4.3 Problemas críticos (P0)

- Nenhum **P0 novo** aberto após a rodada; multi-tenant de memória coberto por teste dedicado.

### 4.4 Problemas médios (P1)

- **UI exibindo identificadores técnicos (URN/provider/enums crus)**  
  - **Evidência**: `src/app/(app)/busca/page.tsx`, `src/components/legal-search/legal-search-panel.tsx`, `src/components/cases/case-drafts-tab.tsx`.  
  - **Correção proposta**: mapeadores PT-BR + “Detalhes técnicos (avançado)”.

- **Busca global: tipo “vetorial” e hits sem `href` estável**  
  - **Evidência**: `src/app/api/search/route.ts` + `src/app/(app)/busca/page.tsx`.  
  - **Correção proposta**: garantir `href` sempre que houver `documentId`/`pieceId`.

### 4.5 Sugestões (P2)

- **Defesa em profundidade: atualizar por `id` após buscar por `{ id, workspaceId }`**  
  - **Evidência**: `src/app/api/pieces/[id]/route.ts`.  
  - **Correção proposta**: `updateMany({ where: { id, workspaceId }, ... })` com `count===1`.

- **Try/catch silencioso em busca global**  
  - **Evidência**: `src/app/api/search/route.ts` (`catch {}` no ramo vetorial).  
  - **Correção proposta**: `logger.warnOnce` ou contador + scrub.

### 4.6 Pendências / itens adiados

- **Exaustão de rotas**: manter revisão contínua em novos handlers `/api/*`.
- **Componentes grandes**: `src/components/cases/case-facts-tab.tsx` e `src/app/(app)/cases/[id]/page.tsx` continuam candidatos a extração de subcomponentes (sem mudança nesta sprint).

