# Security Review P0 — Lex (LGPD + Multi-tenant)

> Documento vivo de revisão de segurança focado em **P0** (bloqueadores de release).
> Última atualização: 2026-05-09.

## 1. Objetivo

Garantir que o Lex:
- não vaze dados entre workspaces (multi-tenant)
- não permita IDOR (Insecure Direct Object Reference)
- não exponha conteúdo sensível em logs/exports/downloads
- mantenha rotas admin/jobs/debug protegidas **server-side**

## 2. Escopo auditado (P0)

- **Casos**: rotas `/cases`, `/api/cases/*`
- **Documentos**: upload/download/viewer/delete/reprocess (`/api/documents/*`)
- **Minutas**: drafts, review, export (`/api/cases/[id]/drafts/*`)
- **Biblioteca**: lista/grid, ações de arquivo (rename/delete/tags/vínculos)
- **Processos**: `Process` legado vs `processo judicial` (CNJ)
- **Admin/Jobs/Debug**: `/settings/admin`, `/settings/jobs`, `/retrieval/explain`
- **Qdrant**: `lex_main` (workspace) e `lex_corpus_*` (global)
- **Cache**: Redis (chaves com `workspaceId` quando aplicável)
- **Logs**: scrub de PII/segredos e proibição de log de texto cru

## 3. Fontes de verdade (documentos)

- `docs/SECURITY.md` (defesas implementadas + limites conhecidos)
- `docs/audits/AUDIT_SECURITY.md` (risco histórico; pode estar desatualizado)
- `docs/audits/AUDIT_ARCHITECTURE.md` (riscos de tenancy por “filtro manual”)
- `docs/RAG_ARCHITECTURE.md` (separação de motores e collections)

## 4. Estado atual (a confirmar por evidência)

### 4.1 Defesas declaradas como implementadas (ver `docs/SECURITY.md`)

- Auth de sessão via Supabase SSR + cookies httpOnly
- Origin guard (CSRF) via `src/middleware.ts` para mutações cross-origin
- Headers de segurança (CSP/HSTS/XFO/Referrer/Permissions)
- Logger com scrub de segredos/PII (`src/lib/logger.ts`) + testes
- Inngest: `/api/inngest` protegido por signing key em produção
- Qdrant: deleção por `documentId + workspaceId` obrigatórios + testes

### 4.2 Risco estrutural conhecido

- O isolamento por workspace depende de **filtros manuais por `workspaceId`** em cada query Prisma/Qdrant. Se um handler esquecer esse filtro, pode haver vazamento/IDOR.

## 5. Regras P0 (bloqueadores)

Um item é **P0** se permitir:
- acesso/leitura de dados de outro workspace
- mutação (delete/link/export) em recursos de outro workspace
- bypass de rotas admin/jobs/debug por URL
- vazamento de PII em logs (relato/documento/cpf/email/telefone) sem scrub
- export/download de arquivo fora do workspace

## 6. Checklist de verificação (executável)

> Marcar como ✅ apenas com evidência (teste/log/trecho de código). “Aceito com justificativa” indica amostragem + testes de regressão, não prova matemática de todas as rotas.

- ✅ **Workspace scoping em Prisma (superfície crítica)** — **aceito-com-justificativa**: não foi provada exaustividade em 100% das rotas; há amostragem por `rg workspaceId` em `src/app/api/documents/*`, `src/app/api/cases/*`, `src/app/api/library/*`, `src/app/api/office-memory/*`, `src/app/api/pieces/*` + testes de integração multi-tenant listados na §7.
- ✅ **Anti-IDOR (regressão automatizada nas rotas mais sensíveis)**  
  - **Evidência**: `tests/integration/case-structured-crud-routes.test.ts`, `case-delete.test.ts`, `case-draft-export.test.ts`, `library-foundations.test.ts`, `office-memory.test.ts` (404 cross-workspace onde aplicável).
- ✅ **Admin gating server-side**: rotas admin/jobs/debug bloqueadas por role no servidor.  
  - **Evidência**: `src/app/api/retrieval/explain/route.ts`, `src/app/(app)/retrieval/explain/page.tsx`, `src/app/(app)/settings/jobs/page.tsx`, `src/app/(app)/processos/actions.ts` (actions sensíveis).
- ✅ **Uploads (documentos)**: `getWorkspaceContext()` + `documentStoragePath(workspaceId, documentId, …)` + validação de `caseId`/`processId` no mesmo workspace.  
  - **Evidência**: `src/app/api/documents/upload/route.ts` (linhas com `where: { … workspaceId }` antes de persistir).
- ✅ **Leitura / delete de documento por API**: `findFirst({ id: documentId, workspaceId })` em GET/DELETE/reprocess/link-case.  
  - **Evidência**: `src/app/api/documents/[documentId]/route.ts`, `link-case/route.ts`, `reprocess/route.ts`.
- ✅ **Deletes (casos + confirmação)**: `tests/integration/case-delete.test.ts` + rota com `?confirm=1` e `workspaceId`.
- ✅ **Exports (minuta do caso + peça)**: `workspaceId` obrigatório nas queries.  
  - **Evidência**: `src/app/api/cases/[id]/drafts/[draftId]/export/route.ts` + `src/app/api/pieces/[id]/export/route.ts` + `tests/integration/case-draft-export.test.ts`.
- ✅ **Qdrant `lex_main` (busca global vetorial)**: `workspaceIds: [workspaceId, GLOBAL_WORKSPACE_ID]` na busca vetorial.  
  - **Evidência**: `src/app/api/search/route.ts` (~L200–204).
- ✅ **Cache retrieval**: chave estável inclui `workspaceId` e fingerprint de contexto; sem `workspaceId` compartilhado entre tenants.  
  - **Evidência**: `src/lib/retrieval/legal/cache.ts` + testes `src/lib/retrieval/legal/cache.test.ts` (“inclui workspaceId…”).
- ✅ **Cache contextual**: desliga quando há `caseContext`.  
  - **Evidência**: `src/lib/retrieval/legal/index.ts`.
- ✅ **Logger com scrub (PII/segredos)** + testes dedicados.  
  - **Evidência**: `src/lib/logger.ts` (comentário de segurança no topo) + `src/lib/logger.test.ts`.
- ✅ **Logs em `/api/search` (busca global)**: falhas de `retrieveLegalContext` e do ramo vetorial (embed/Qdrant) usam `getLogger("lex.api.search")` com `requestId`, `workspaceId`, `queryLen`, `scope` e erro estruturado — **sem** texto bruto da query nos metadados; respostas incluem header `x-request-id`.  
  - **Evidência**: `src/app/api/search/route.ts`.
- ✅ **Logs em rotas sensíveis de documentos/casos**: substituídos `console.*` diretos por `getLogger` nos handlers de upload, reprocess, link-case, delete de documento, delete de caso, legal-sources.  
  - **Evidência**: arquivos sob `src/app/api/documents/*`, `src/app/api/cases/[id]/delete`, `legal-sources`.
- ✅ **Libs server-side críticas**: `removeDocumentBuffer` (`src/lib/storage.ts`), `recordObservabilityLog`, `recordCostEntry`, falha ao persistir FAILED no ingest Inngest — passam por logger com scrub.

### 6.1 Tabela P0 / P1 / P2 (status)

| ID | Tema | Severidade | Status | Notas |
|----|------|------------|--------|-------|
| SEC-01 | IDOR cross-workspace em CRUD caso / export / delete | P0 | **Resolvido** | Testes de integração + rotas com `workspaceId`. |
| SEC-02 | `buildCaseContext` + texto de documentos | P2 | **Resolvido** | `fetchDocumentTexts` agora filtra `{ workspaceId, id: { in } }` em `src/lib/cases/context.ts`. |
| SEC-03 | Memória do escritório (`OfficeMemory`) | P0 | **Resolvido** | `src/app/api/office-memory/*` + `src/lib/office-memory/visibility.ts` + `tests/integration/office-memory.test.ts`. |
| SEC-04 | Busca global — tratamento de erro / logs | P1 | **Resolvido** | `getLogger` + meta scrubada em `src/app/api/search/route.ts` (2026-05-09). |
| SEC-05 | Exaustividade “toda rota do monorepo” | P2 | **Aceito-com-justificativa** | Amostragem + testes; revisão contínua em novas rotas. |

## 7. Comandos executados (fechamento 2026-05-09)

- ✅ `npm run lint` → sem erros.
- ✅ `npm run typecheck` → OK.
- ✅ `npm test` → 534 passed.
- ✅ `npm run test:integration` → 43 passed (inclui `office-memory.test.ts`).
- ✅ `npm run test:e2e` → 80 passed.
- ✅ `NODE_ENV=production npm run build` → OK.
- ✅ `npm run qa:retrieval:domains` → 10/10.
- ✅ `npm run db:migrate:deploy` → migração `20260509220000_office_memory` aplicada no ambiente usado pela equipe (remoto).

## 8. Achados (evidência)

### 8.1 Críticos (P0) — bloqueiam release

- **Nenhum P0 de vazamento/IDOR documentado como aberto** nesta rodada, após correção de `context.ts` e entrega de `OfficeMemory` com testes.

### 8.2 Altos (P1)

- **(SEC-04 encerrado)** — ver §6 e tabela SEC-04.

### 8.3 Médios/Baixos (P2/P3)

- **Defesa em profundidade em updates por `id` após `findFirst`** (padrão já notado em `docs/CODE_REVIEW_P0.md`): preferir `updateMany` com `{ id, workspaceId }` onde risco de TOCTOU for relevante.
- **`src/lib/env.ts` / `src/lib/corpus/embeddings-pipeline.ts`**: ainda usam `console.*` para bootstrap e jobs de corpus — **aceito-com-justificativa** (fora do caminho de request HTTP típico; ver `docs/CODE_REVIEW_P0.md` §5).

## 9. Pendências imediatas

- Manter varredura em **novas** rotas `/api/*` sempre com checklist: `getWorkspaceContext()` → `where: { workspaceId }` ou join equivalente.
- Opcional: alinhar `env.ts` / pipelines longos ao `getLogger` para consistência total de observabilidade.

## 10. Status final (P0 segurança)

**Status**: **READY** para o **gate de segurança/logs P0** descrito neste documento (critério L e SEC-04 fechados com evidência em código + bateria §7 verde).

**Nota de produto**: melhorias de UX comercial (jargão, labels, etc.) seguem em `docs/COMMERCIAL_UX_P0_AUDIT.md` e não reabrem P0 de segurança aqui.

