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
- ⚠️ **Logs fora do logger (P1, não P0 de exploração direta)**: `src/app/api/search/route.ts` usa `console.warn` em falha de corpus e `catch {}` silencioso no ramo vetorial (L190–192, L227–229) — não passa pelo scrub central; **risco**: ruído e possível mensagem bruta de erro em `warn`.

### 6.1 Tabela P0 / P1 / P2 (status)

| ID | Tema | Severidade | Status | Notas |
|----|------|------------|--------|-------|
| SEC-01 | IDOR cross-workspace em CRUD caso / export / delete | P0 | **Resolvido** | Testes de integração + rotas com `workspaceId`. |
| SEC-02 | `buildCaseContext` + texto de documentos | P2 | **Resolvido** | `fetchDocumentTexts` agora filtra `{ workspaceId, id: { in } }` em `src/lib/cases/context.ts`. |
| SEC-03 | Memória do escritório (`OfficeMemory`) | P0 | **Resolvido** | `src/app/api/office-memory/*` + `src/lib/office-memory/visibility.ts` + `tests/integration/office-memory.test.ts`. |
| SEC-04 | Busca global — tratamento de erro | P1 | **Aberto** | `console.warn` / `catch {}` em `src/app/api/search/route.ts`; migrar para `logger` com scrub. |
| SEC-05 | Exaustividade “toda rota do monorepo” | P2 | **Aceito-com-justificativa** | Amostragem + testes; revisão contínua em novas rotas. |

## 7. Comandos executados (rodada final 2026-05-09)

- ✅ `npm run lint` → sem erros.
- ✅ `npm run typecheck` → OK.
- ✅ `npm test` → 534 passed.
- ✅ `npm run test:integration` → 43 passed (inclui `office-memory.test.ts`).
- ✅ `npm run test:e2e` → 79 passed (inclui `GET /api/office-memory` → 401 sem auth).
- ✅ `NODE_ENV=production npm run build` → OK.
- ✅ `npm run qa:retrieval:domains` → 10/10.
- ✅ `npm run db:migrate:deploy` → migração `20260509220000_office_memory` aplicada no ambiente usado pela equipe (remoto).

## 8. Achados (evidência)

### 8.1 Críticos (P0) — bloqueiam release

- **Nenhum P0 de vazamento/IDOR documentado como aberto** nesta rodada, após correção de `context.ts` e entrega de `OfficeMemory` com testes.

### 8.2 Altos (P1)

- **Busca global (`/api/search`) — logging e degrade**  
  - **Evidência**: `src/app/api/search/route.ts` (`console.warn` + `catch {}` no bloco vetorial).  
  - **Próximo passo**: usar `logger` + não engolir erro sem contador/`warnOnce`.

### 8.3 Médios/Baixos (P2/P3)

- **Defesa em profundidade em updates por `id` após `findFirst`** (padrão já notado em `docs/CODE_REVIEW_P0.md`): preferir `updateMany` com `{ id, workspaceId }` onde risco de TOCTOU for relevante.

## 9. Pendências imediatas

- Fechar P1 **SEC-04** (search route) com logger scrub + teste mínimo de não-vazamento de meta bruta.
- Manter varredura em **novas** rotas `/api/*` sempre com checklist: `getWorkspaceContext()` → `where: { workspaceId }` ou join equivalente.

## 10. Status final (P0 segurança)

**Status**: **NOT READY** (release comercial global — ver `docs/P0_COMMERCIAL_RELEASE_REPORT.md`)

**Motivo (segurança)**: não há **P0 crítico aberto** listado acima, porém o critério comercial global de release exige também UX/RAG/honestidade de checklist A–N; permanece **P1 aberto** em logs da busca global (`SEC-04`). Para declarar READY só de segurança P0, a equipe pode considerar **SEC-04** como aceitável temporariamente com registro explícito — esta rodada **não** faz essa aceitação formal.

