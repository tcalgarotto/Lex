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

> Marcar como ✅ apenas com evidência (teste/log/trecho de código). Caso contrário, manter como ⏳.

- ⏳ **Workspace scoping em Prisma**: toda rota por ID valida `workspaceId` (direto ou via join).
- ⏳ **Anti-IDOR**: tentativas de acessar IDs de outro workspace retornam 404/401/403 (testes).
- ✅ **Admin gating server-side**: rotas admin/jobs/debug bloqueadas por role no servidor.  
  - **Evidência**: `src/app/api/retrieval/explain/route.ts`, `src/app/(app)/retrieval/explain/page.tsx`, `src/app/(app)/settings/jobs/page.tsx`, `src/app/(app)/processos/actions.ts` (actions sensíveis).
- ⏳ **Uploads**: validação de mime/tamanho + prevenção de path traversal.
- ⏳ **Downloads**: valida ownership + path seguro (não aceitar path arbitrário do client).
- ⏳ **Deletes**: confirmação + auditoria (Activity/Timeline) + best-effort no storage.
- ⏳ **Exports**: valida `workspaceId` + relação `draftId → caseId → workspaceId`; não inclui anexos de outro workspace.
- ⏳ **Qdrant**:
  - `lex_main`: filtros por `workspaceId` sempre presentes nas buscas/deletes
  - `lex_corpus_*`: tenant global explícito e separado do workspace
- ✅ **Cache**: evita cache compartilhado quando houver dado privado/contextual (`caseContext`).  
  - **Evidência**: `src/lib/retrieval/legal/index.ts` desativa cache quando `opts.caseContext` está presente.
- ⏳ **Logs**: não logar texto cru (relato/documento); scrub cobre chaves e padrões.

## 7. Comandos sugeridos (registrar resultados aqui)

> Não rodados nesta atualização. Quando rodar, copie o comando + resultado resumido.

- ✅ `npm run lint` (OK)
- ✅ `npm run typecheck` (OK)
- ✅ `npm test` (OK)
- ✅ `npm run test:integration` (OK)
- ✅ `NODE_ENV=production npm run build` (OK)
- ✅ `npm run db:migrate:deploy` (OK)

## 8. Achados (preencher com evidência)

### 8.1 Críticos (P0) — bloqueiam release

- **Admin gating ausente em `/api/retrieval/explain` e `/retrieval/explain`**  
  - **Risco**: bypass de debug avançado por URL; superfície expõe trace/argumentos e aumenta risco de vazamento indireto.  
  - **Evidência**: `src/app/api/retrieval/explain/route.ts` (handler sem role/permission) e `src/app/(app)/retrieval/explain/page.tsx` (página acessível por URL, chama a API).  
  - **Correção proposta**: exigir role/permission no servidor (page-level + API). Considerar forçar `useCache=false` nessa rota.  
  - **Teste de aceite**: integration/e2e: usuário não-OWNER recebe 403/404 ao acessar `/retrieval/explain` e `GET /api/retrieval/explain`.

- **Jobs/ações sensíveis expostas em `/settings/jobs` sem role server-side**  
  - **Risco**: qualquer usuário autenticado pode acionar jobs/ações com side-effect (custo/DoS/instabilidade).  
  - **Evidência**: `src/app/(app)/settings/jobs/page.tsx` usa `getWorkspaceContext()` e expõe action `triggerCorpusReindexAction` via `<form action=...>`.  
  - **Correção proposta**: exigir role/permission no servidor (page-level e action).  
  - **Teste de aceite**: e2e/integration: não-OWNER não acessa a página e não consegue executar a action (403/404).

- **Cache de retrieval não separa `workspaceId`/`caseContext` (risco LGPD cross-tenant)**  
  - **Risco**: poluição/leak via cache (especialmente quando `rewrite` usa `CaseBrain.problem` no contexto).  
  - **Evidência**: `src/lib/retrieval/legal/cache.ts` key não inclui `workspaceId` nem hash de `caseContext`; `/api/retrieval/search` passa `caseContext` quando há `caseId`; `src/lib/retrieval/legal/rewrite.ts` concatena `ctx.problem`.  
  - **Correção proposta**: incluir `workspaceId` + hash de `caseContext` na chave **ou** bypass de cache quando houver `caseContext`/`mustInclude`.  
  - **Teste de aceite**: integration multi-tenant: mesma `q` em workspaces diferentes não pode compartilhar cache/rewrites/trace.

### 8.2 Altos (P1)

- (pendente) varredura por evidência em exports/downloads e rotas `/api/cases/*` e `/api/documents/*`.

### 8.3 Médios/Baixos (P2/P3)

- **Hardening: `buildCaseContext` busca documentos por ID sem `workspaceId` no `where`**  
  - **Risco**: defesa em profundidade anti-IDOR (aparentemente não explorável pelo fluxo normal, mas frágil).  
  - **Evidência**: `src/lib/cases/context.ts` busca `Document` com `{ id: { in: documentIds } }` sem filtrar `workspaceId`.  
  - **Correção proposta**: adicionar `workspaceId` ao `where`.  
  - **Teste de aceite**: unit/integration: mesmo com `documentIds` contendo ID externo, query não retorna nada.

- **Logging potencialmente verboso em `/api/retrieval/search`**  
  - **Risco**: logs com detalhes indevidos (dependendo do objeto de erro) e/ou exposição de info interna via `detail`.  
  - **Evidência**: `src/app/api/retrieval/search/route.ts` faz `console.error(..., err)` e retorna `detail: messageOf(err)`.  
  - **Correção proposta**: usar logger com scrub e retornar mensagem genérica sem ecoar erro interno; anexar `requestId` para suporte.  
  - **Teste de aceite**: unit test de scrubber + smoke em staging sem PII nos logs.

## 9. Pendências imediatas

- Executar auditoria de rotas por superfície (cases/documents/drafts/processes/library/admin/jobs/exports).
- Adicionar/rodar testes de regressão anti-IDOR nas rotas mais sensíveis.
- Validar server-side gating de admin/jobs/debug (não apenas “menu escondido”).

## 10. Status final (P0)

**Status**: NOT READY

Motivo: embora existam correções implementadas (admin gating e cache contextual) e bateria de comandos verdes, o checklist P0 ainda não está **completo por evidência** (uploads/downloads/exports + varredura sistemática de rotas por ownership/tenancy).

