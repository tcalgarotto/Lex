# Red Team Security Audit Report

**Projeto:** Lex (staff adv)  
**Ambiente:** local/dev (Supabase pooler via `DATABASE_URL`; `npm run dev` ativo)  
**Data:** 2026-05-16  
**Fases concluídas nesta rodada:** FASE 0, FASE 1, FASE 2, **FASE 3 (Storage/RLS)**, **FASE 3.1 (hardening upload/policies)**, **FASE 10 parcial (P1/P2)**  
**Correções aplicadas (FASE 10):** rate limit fail-closed seletivo, RL em rotas IA, ingest tenant guard, timeline 404

---

## Resumo executivo

| Item | Resultado |
|------|-----------|
| **P0 confirmados (exploit dinâmico)** | **0** — nenhum vazamento cross-tenant reproduzido com fixtures A/B |
| **P1 confirmados (antes)** | fail-open global; rotas IA sem RL |
| **P1 após FASE 10** | **Mitigados** — ver seção FASE 10; Redis em prod continua obrigatório |
| **P0 FASE 3 (storage cross-tenant)** | **0** — download/upload bloqueados antes de `service_role` |
| **Risco de lançamento** | **Não pode lançar** sem Redis em prod + **aplicar** policies Storage em staging + teste remoto anon |
| **Recomendação** | Staging com `REDIS_URL`, `RATE_LIMIT_FAIL_CLOSED=true`, `supabase/storage/documents_policies.sql` aplicado |

Principais riscos remanescentes: isolamento de arquivos na **camada app** (Prisma ignora RLS Storage); policies SQL **versionadas mas não provadas no remoto** sem `RED_TEAM_CONFIRM_STAGING=1`; quota sem reserva atômica entre dois `assert` paralelos sem persistência (QC.3b documentado).

---

# FASE 10 parcial — Correções P1/P2

## Resumo

| Correção | Status | Evidência |
|----------|--------|-----------|
| Fail-closed seletivo (`tier: "expensive"`) | **Aplicado** | `src/lib/rate-limit.ts`, `.env.example` |
| Rate limit IA (`enforceAiRouteRateLimit`) | **Aplicado** | `completion`, `chat`, `generate/piece` |
| Ingest document tenant | **Resolvido** | `workspaceId` no evento + `assertDocumentIngestTenant` |
| Timeline cross-tenant | **P2 corrigido** | 404 em vez de 200 vazio |

## Comandos pós-patch

```bash
npm run security:red-team   # 38 passed (2026-05-16)
npm run typecheck             # OK
npm test                      # 726 passed
```

## P1 mitigados

### Rate limit fail-open → fail-closed seletivo

- `rateLimit({ tier: "expensive" })` bloqueia com `source: fail-closed` e HTTP **503** quando Redis offline e (`NODE_ENV=production` \| `REDIS_REQUIRED` \| `RATE_LIMIT_FAIL_CLOSED`).
- Dev: `RATE_LIMIT_FAIL_OPEN_DEV=1` mantém fail-open para testes locais.
- Upload, convites, legal-research, drafting usam `tier: "expensive"`.

### Rotas IA

- `src/lib/rate-limit-ai.ts` — chave `ai:{workspaceId}:{userId}:{routeName}`.
- Aplicado **antes** de `retrieveContext` / `streamText`.

### Ingest document

- Evento `lex/document.ingest` exige `{ documentId, workspaceId }`.
- `findFirst` + `assertDocumentIngestTenant` — evento adulterado A→doc B → **NonRetriableError**.
- Classificação: **vulnerável corrigido** (defesa em profundidade no worker; Inngest signing continua crítico).

### Timeline P2

- `GET /api/processes/[processId]/timeline` → **404** se processo não pertence ao workspace.
- Teste B3.1 atualizado: processo B → 404; processo A → 200.

## Risco residual

- Sem Redis em **produção**, rotas caras retornam 503 (correto), mas app de IA/upload fica indisponível até Redis voltar.
- FASE 3 auditada — ver seção FASE 3; policies Storage ainda não versionadas.
- `findUnique` em `ingest-document` substituído por `findFirst` + validação de tenant.

---

# FASE 2 — Cross-Tenant / IDOR / Authorization

## Resumo

- **22 testes PASSOU** (integração real: Prisma + route handlers + `retrieveContext`)
- **0 FALHOU P0** em ataques dinâmicos
- **1 NÃO EXECUTADO** — `POST /api/completion` (falta `DEEPSEEK_API_KEY` no ambiente do teste)
- **Achados estáticos / rate limit:** 3 itens **P1** documentados (não abortam CI; reportados na suíte)

## Fixtures criadas

Script: `npm run security:red-team:seed` → `scripts/security-audit/seed-red-team-fixtures.ts`  
IDs fixos: `tests/security/red-team/fixture-ids.ts`

| Entidade | Workspace A | Workspace B |
|----------|-------------|-------------|
| Workspace | `rt_workspace_a` / slug `redteam-workspace-a` | `rt_workspace_b` / `redteam-workspace-b` |
| Admin | `rt_user_admin_a` (OWNER) | — |
| Comum | `rt_user_common_a` (LAWYER) | `rt_user_common_b` (LAWYER) |
| Cliente | `rt_client_a` | `rt_client_b` |
| Caso | `rt_case_a` | `rt_case_b` |
| Processo | `rt_process_a` | `rt_process_b` |
| LegalProcess | `rt_legal_process_a` | `rt_legal_process_b` |
| Documento + chunk | `rt_document_a` / `rt_chunk_a` | `rt_document_b` / `rt_chunk_b` |
| Marcador RAG B | — | `segredo ultra confidencial Bravo` |
| Chat thread | `rt_thread_a` | `rt_thread_b` |
| Agenda | `rt_calendar_a` | `rt_calendar_b` |
| Integração fake | `rt_integration_a` | `rt_integration_b` |

**Regra:** dados obviamente falsos; **sem delete** no seed; upsert idempotente.

## Testes executados

| Suíte | Caminho |
|-------|---------|
| Cross-tenant (principal) | `tests/security/red-team/cross-tenant.integration.test.ts` |
| Rate limit / fail-open | `tests/security/red-team/rate-limit-red-team.integration.test.ts` |
| Padrões estáticos P0 | `tests/security/red-team/static-p0-patterns.test.ts` |
| Alias documentado | Equivalente a `authz-cross-tenant.integration.test.ts` → arquivo acima |

**Comandos:**

```bash
npm run security:red-team:seed
npm run security:red-team:test
# ou
npm run security:red-team
```

**Guard de ambiente:** `scripts/security-audit/env-guard.ts` (bloqueia `NODE_ENV=production`, `VERCEL_ENV=production`, URL HTTPS remota sem `RED_TEAM_CONFIRM_STAGING=1`).

## P0 encontrados

_Nenhum confirmado por teste dinâmico nesta fase._

## P1 encontrados

### P1.1 — Rate limit fail-open — **MITIGADO (FASE 10)**

Correção aplicada. Rotas leves permanecem fail-open em dev com `RATE_LIMIT_FAIL_OPEN_DEV=1`.

### P1.2 — Rotas IA sem rate limit — **MITIGADO (FASE 10)**

`enforceAiRouteRateLimit` em completion, chat, generate/piece.

### P1.3 — Ingest `findUnique` — **RESOLVIDO (FASE 10)**

`findFirst` + `workspaceId` no evento + `assertDocumentIngestTenant`.

## P2 observações

- **Timeline cross-tenant** — **corrigido** na FASE 10 (404 uniforme).
- **RLS Supabase:** template apenas (`supabase/workspace_rls_template.sql`); isolamento via Prisma — FASE 3 pendente.

## Rotas que passaram (atacante = usuário comum A → alvo B)

| Bloco | Rotas / comportamento | Resultado |
|-------|----------------------|-----------|
| B1 Casos | GET/PATCH parties/DELETE/sub-recursos | 404 / 403 |
| B1 Payload | `workspaceId` B em legal-research | **403** |
| B2 Documentos | GET meta, GET /file, list, DELETE | 404; lista sem `rt_document_b` |
| B3 Processos | timeline B → **404**; docs processo, busca "Bravo" | sem vazamento |
| B4 Admin | corpus-stats (LAWYER) | **403** |
| B4 Membership | PATCH `rt_membership_common_b` | **404** |
| B4 Workspace | POST active → workspace B | **403** |
| B5 RAG | `retrieveContext` com query do marcador B | sem chunk B |
| B5 Search | `retrieval/search?caseId=rt_case_b` | sem marcador |
| B5 Chat | POST `rt_thread_b` | **404** |
| B5 Cache | `buildCacheKey` / `legalResearchRequestHash` | chaves distintas por workspace |

## Rotas que falharam

_Nenhuma falha P0 em cross-tenant._

## Itens não executados

| ID | Motivo |
|----|--------|
| B5.5 `POST /api/completion` | `DEEPSEEK_API_KEY` ausente no processo de teste |
| RL.2 Redis ativo | Redis local não rodando (`ECONNREFUSED 127.0.0.1:6379`) |
| Upload real caso B / signed URL | Não exercido HTTP multipart nesta rodada (handler de upload usa mesmo `requireCaseApiAccess`) |
| Prompt injection end-to-end LLM | Requer provider configurado |
| FASE 3 Storage RLS | Policies não versionadas no repo |

# FASE 3 — Storage / RLS / Upload / Signed URL

**Data:** 2026-05-16  
**Ambiente:** local/dev, fixtures `npm run security:red-team:seed`  
**Regra:** nenhuma alteração de policies/migrations; nenhum ataque a produção.

## Pré-requisitos produção (verificados)

| Variável | `.env.production.example` | Observação |
|----------|---------------------------|------------|
| `REDIS_REQUIRED=true` | Sim | Obrigatório para rate limit estável |
| `RATE_LIMIT_FAIL_CLOSED=true` | **Adicionado** nesta rodada | Rotas caras → 503 sem Redis |
| `RATE_LIMIT_FAIL_OPEN_DEV` | **Ausente** em produção | Só em `.env.example` (dev local) |

## Resumo executivo da FASE 3

| Item | Resultado |
|------|-----------|
| **P0 exploit (bytes de doc B para usuário A)** | **Não reproduzido** — 404/403 antes de Storage |
| **Signed URLs** | **Não existem** no código (`createSignedUrl` = 0) |
| **service_role em rota sem auth** | **Não** — só `src/lib/storage.ts` após handlers |
| **Upload cross-tenant (case B)** | **Bloqueado** (404) |
| **P1 governança** | **Mitigado em 3.1** — SQL versionado; aplicar no Supabase remoto pendente |
| **P2** | **Mitigado em 3.1** — magic bytes; ver limite QC.3b (assert paralelo) |

**Não declarar sistema seguro.** Testes passaram/falharam conforme tabela abaixo; Storage remoto e anon key não foram exercidos.

## Buckets auditados

| Bucket | Env | Uso |
|--------|-----|-----|
| `documents` (default) | `STORAGE_BUCKET_DOCUMENTS` | PDF/DOCX/TXT de casos e biblioteca privada |

Path canônico: `{workspaceId}/{documentId}/{safeFileName}` — `documentStoragePath()` sanitiza `/` e caracteres especiais.

Miniaturas: `{workspaceId}/{documentId}/__lex_thumbnail.webp` (+ PNG legado).

## Rotas de arquivo auditadas

| Rota | Auth | Valida posse | service_role | Signed URL | Risco |
|------|------|--------------|--------------|------------|-------|
| `GET /api/documents/[id]/file` | `getWorkspaceContext` | `findFirst` + `userCanReadDocument` | Após auth (`downloadDocumentBuffer`) | Não (proxy) | **P3** se Storage offline → 502 |
| `GET /api/documents/[id]/thumbnail` | Idem | Idem + geração lazy | Após auth | Não | **P3** |
| `GET /api/documents/[id]` | Idem | Metadados | Não | Não | **P3** |
| `GET /api/cases/[id]/documents/[docId]/extracted-text` | `findCaseInWorkspace` + doc no caso | Sim | Não | Não | **P3** |
| Inngest `ingest-document` | `workspaceId` no evento + `assertDocumentIngestTenant` | Sim | Download path do **banco** | Não | **P1** se signing Inngest falhar |

## Rotas de upload auditadas

| Rota | workspaceId | case/process | Quota antes storage | Path servidor | Risco |
|------|-------------|--------------|---------------------|---------------|-------|
| `POST /api/documents/upload` | Sessão | `findFirst` no workspace | `assertCanUploadFileToWorkspace` (2×) | `documentStoragePath(ws, nanoid(), name)` | **P2** MIME só por header |
| `POST /api/cases/[id]/documents` | Sessão | `findCaseInWorkspace` | Idem | Idem | **P3** |
| `POST /api/lawyer-brain/ingest` | Sessão | N/A (texto peça) | N/A | N/A | Fora escopo doc jurídico |

Rollback: `removeDocumentBuffer(path)` se `prisma.document.create` falhar após upload.

## Signed URLs auditadas

- **Nenhuma** chamada a `createSignedUrl` / `createSignedUrls` no repositório.
- Download/thumbnail servidos via **proxy autorizado** (bytes na resposta HTTP, `Cache-Control: private, max-age=120`).
- **P1 recomendado:** se no futuro usar signed URL, TTL ≤ 5 min, nunca logar, nunca cache CDN compartilhado.

## Uso de service_role

| Arquivo | Função | Bucket | Path | Valida antes? |
|---------|--------|--------|------|---------------|
| `src/lib/supabase/admin.ts` | `createSupabaseAdminClient` | — | — | N/A (factory) |
| `src/lib/storage.ts` | upload/download/remove | `documents` | Parâmetro `path` | **Caller** deve validar |
| `src/lib/inngest/functions/ingest-document.ts` | download | `documents` | `doc.storagePath` do DB | Sim (tenant guard) |
| `src/lib/documents/document-thumbnail-persist.ts` | up/down | `documents` | paths fixos + `doc.storagePath` | Worker |

- **P0:** não encontrado — rotas API não importam `createSupabaseAdminClient` diretamente (`static-p0-patterns` INV.1).
- **P1:** policies Storage no Supabase remoto não auditadas neste repo.
- **P2:** singleton admin criado no primeiro uso de storage (após auth nas rotas testadas).

## RLS / policies auditadas

### RLS efetivo

- **Nenhum** `ENABLE ROW LEVEL SECURITY` em `prisma/migrations/**`.
- App usa **Prisma + `DATABASE_URL`** → role Postgres típico **bypassa RLS** Supabase.

### RLS apenas template

- `supabase/workspace_rls_template.sql` — comentários/exemplo, **não aplicado**.

### Policies ausentes do repo

- **Storage bucket policies** (SELECT/INSERT por tenant) — **não versionadas**.
- Risco: drift entre staging/prod e código; anon key + policy errada = exposição direta (não testado aqui).

### O que Prisma ignora

- Qualquer RLS definido só no Supabase **não protege** queries Prisma.

### O que Supabase client público conseguiria fazer

- `src/lib/supabase/browser.ts` / `server.ts` — uso limitado; **documentos não** são expostos via client anon no fluxo auditado.
- **Não executado:** tentativa real com `NEXT_PUBLIC_SUPABASE_ANON_KEY` contra bucket `documents`.

### Testes não executados (policy remota)

- Listagem/download direto no bucket com anon/authenticated JWT Supabase.
- Comparação policy remota vs template SQL.

## Quota 2GB (BLOCO 7)

| Aspecto | Implementação | Risco |
|---------|---------------|-------|
| Cálculo | `sumActiveDocumentBytes` + `storageQuotaBytes` no workspace | **P3** |
| Antes de salvar | `assertCanUploadFileToWorkspace` + `FOR UPDATE` no workspace | **P2** corrida residual se storage salvar antes do commit DB |
| Cross-tenant quota | `workspaceId` só da sessão | Teste S3.11 **PASSOU** |
| Delete | `recalculateWorkspaceStorageUsage` | Coberto em `tests/integration/workspace-storage-quota.test.ts` |
| Upload inválido | MIME 415 antes de storage; quota fail antes de buffer pesado | **P2** PDF falso só por MIME |

**Não executado:** upload concorrente E2E contra limite 2GB; arquivo órfão no Storage após falha parcial (rollback existe no código).

## Testes criados

| Arquivo | Escopo |
|---------|--------|
| `tests/security/red-team/storage-rls.integration.test.ts` | Download cross-tenant, upload, path, quota |
| `tests/security/red-team/storage-inventory.test.ts` | Inventário estático admin/signed URL |

## Testes executados (FASE 3)

| ID | Resultado |
|----|-----------|
| S3.1–S3.4 download/meta/thumbnail/extracted-text B | **PASSOU** (404) |
| S3.5 path traversal helper | **PASSOU** |
| S3.6 upload válido A | **PASSOU** (mock storage) |
| S3.7 upload caseId B | **PASSOU** (404) |
| S3.8 POST caso B | **PASSOU** (404) |
| S3.9 MIME inválido | **PASSOU** (415) |
| S3.10 sem sessão | **PASSOU** (rejeição antes de upload) |
| S3.11 quota B inalterada | **PASSOU** |
| INV.1–INV.4 inventário | **PASSOU** |
| B2.* (FASE 2) file/list/delete doc B | **PASSOU** (já existente) |

## P0 encontrados

**Nenhum** reproduzido com fixtures A/B.

## P1 encontrados

1. **Governança:** policies RLS/Storage Supabase não versionadas no repositório.
2. **Dependência Inngest:** worker ingest usa `service_role` com path do DB — comprometimento de signing = risco alto (mitigado por `assertDocumentIngestTenant`).

## P2 encontrados

1. Upload aceita `application/octet-stream` e MIME declarado sem magic bytes.
2. Possível drift quota vs objeto no Storage se upload Storage suceder e DB falhar sem `removeDocumentBuffer` (código tenta rollback).

## P3 encontrados

1. Erro 502 em download quando objeto ausente no Storage (não distingue tenant).
2. Catálogo global Lex (`documentReadScopeOr`) — fora do escopo cross-tenant A/B.

## Itens não executados e motivo

| Item | Motivo |
|------|--------|
| Storage anon key / policy remota | `RED_TEAM_CONFIRM_STAGING=1` + credenciais teste ausentes localmente |
| Rate limit upload 21× com Redis | Redis offline local (`npm run infra:up`) |
| Signed URL TTL / vazamento em logs | Não há signed URLs no código |
| Timing oracle (404 vs 403) | Não automatizado nesta fase |

## Correções recomendadas (pós FASE 3.1)

1. **Aplicar** `supabase/storage/documents_policies.sql` no projeto Supabase de staging e rodar `storage-policy-remote.integration.test.ts`.
2. Reserva de quota atômica no upload (evitar QC.3b — dois asserts paralelos sem doc).
3. Documentar que **defesa primária = app layer** até RLS Postgres no role Prisma (improvável).

---

# FASE 3.1 — Hardening Storage / Upload / Policies

**Data:** 2026-05-16

## Entregas

| Bloco | Artefato | Status |
|-------|----------|--------|
| 1 | `supabase/storage/documents_policies.sql` (versionado) | **Feito** |
| 1 | `storage-policies-sql.test.ts` + `storage-policies-versioned.test.ts` | **Feito** |
| 2 | `storage-policy-remote.integration.test.ts` | **NÃO EXECUTADO** (env staging) |
| 3 | `src/lib/documents/file-signature.ts` + `validate-upload-buffer.ts` | **Feito** |
| 3 | Rotas upload + caso (`validateLegalDocumentUploadBuffer` antes de storage) | **Feito** |
| 3 | `upload-magic-bytes.test.ts` (M1–M10) | **Feito** |
| 3 | S3.12 PDF falso → 415 sem storage/DB | **Feito** |
| 4 | `storage-quota-concurrency.test.ts` | **Feito** |
| 5 | `upload-rate-limit-redis.integration.test.ts` | **NÃO EXECUTADO** (Redis offline) |

## Política de upload (P2 mitigado)

- Magic bytes: PDF `%PDF-`, DOCX ZIP com `[Content_Types].xml` + `word/document.xml`, TXT UTF-8 sem HTML/script.
- `application/octet-stream` aceito **somente** se magic bytes confirmarem tipo; MIME canônico gravado no DB/storage.
- `application/msword` removido da triagem inicial.
- Validação **antes** de `uploadDocumentBuffer` / ingest.

## Testes executados (FASE 3.1)

```bash
npm run security:red-team:test   # 85 passed (2026-05-16)
npm run typecheck                # OK
```

| ID | Resultado |
|----|-----------|
| SP.1–SP.4 SQL policies | **PASSOU** |
| M1–M10 magic bytes | **PASSOU** |
| S3.12 PDF inválido | **PASSOU** |
| QC.1–QC.5 quota/concorrência | **PASSOU** (QC.3b documenta limite de assert paralelo) |
| SR.1–SR.6 Storage remoto | **NÃO EXECUTADO** |
| UR.1–UR.2 upload RL Redis | **NÃO EXECUTADO** |

## Env para teste remoto (staging)

```bash
RED_TEAM_CONFIRM_STAGING=1
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_TEST_USER_A_EMAIL=redteam-common-a@fixture.lex.invalid
SUPABASE_TEST_USER_A_PASSWORD=...
SUPABASE_TEST_USER_B_EMAIL=redteam-common-b@fixture.lex.invalid
SUPABASE_TEST_USER_B_PASSWORD=...
# opcional: seed objeto no bucket
SUPABASE_SERVICE_ROLE_KEY=...
```

## P1 / P2 após 3.1

| Antes | Depois |
|-------|--------|
| P1 policies não versionadas | **Mitigado no repo** — falta aplicar no Supabase remoto |
| P2 MIME/octet-stream sem validação | **Mitigado** — magic bytes obrigatórios |

## Risco residual

- Tenant isolation de arquivos depende de **rotas Next + Prisma**, não de RLS Storage.
- Bucket privado + service_role server-side é o modelo atual; vazamento de `SUPABASE_SERVICE_ROLE_KEY` = **P0 catastrófico** (operacional).
- Sem Redis em produção, uploads/IA retornam **503** (comportamento desejado após FASE 10).

## Comandos FASE 3

```bash
npm run security:red-team   # após correção dos testes S3.x
npm run lint
npm run typecheck
npm test
```

---

# FASE 3.1 — Hardening Storage / Upload / Policies

**Data:** 2026-05-16  
**Escopo:** fechar P1/P2 da FASE 3 (policies versionadas, magic bytes, testes ampliados).

## Entregas

| Item | Status |
|------|--------|
| `supabase/storage/documents_policies.sql` | **Criado** — template aplicável + checklist |
| Magic bytes (`src/lib/documents/file-signature.ts`) | **Implementado** — PDF/DOCX/TXT; octet-stream só com assinatura válida |
| Rotas upload | **Atualizadas** — validação antes de Storage/Inngest |
| `upload-magic-bytes.test.ts` | **10 casos PASSOU** |
| `storage-policies-sql.test.ts` | **4 casos PASSOU** |
| `storage-policy-remote.integration.test.ts` | **NÃO EXECUTADO** sem `RED_TEAM_CONFIRM_STAGING=1` + passwords |
| `storage-quota-concurrency.test.ts` | **PASSOU** (QC.3b documenta limite de assert paralelo sem doc) |
| `upload-rate-limit-redis.integration.test.ts` | **NÃO EXECUTADO** se Redis offline no host de teste |

## P1 mitigado

- Policies Storage **versionadas** em `supabase/storage/documents_policies.sql` (aplicação manual no Supabase staging/prod).
- Teste remoto preparado; execução requer credenciais staging (não produção).

## P2 mitigado

- `application/msword` removido da triagem declarada.
- `application/octet-stream` só persiste se magic bytes confirmarem PDF/DOCX/TXT.
- Upload inválido → **415** antes de `uploadDocumentBuffer` (teste S3.9b).

## Risco residual / limite conhecido

- **QC.3b:** duas chamadas paralelas a `assertCanUploadFileToWorkspace` sem `document.create` intermediário podem ambas passar (quota reservada só após persistir documento).
- **Storage remoto:** policies SQL não substituem aplicar o script no projeto Supabase.
- **Redis:** `UR.1` requer `REDIS_URL` apontando para instância acessível no ambiente de teste.

## Comandos FASE 3.1

```bash
npm run security:red-team:test   # 85 passed (2026-05-16)
npm run lint && npm run typecheck && npm test
# Staging Storage (opcional):
# RED_TEAM_CONFIRM_STAGING=1 SUPABASE_TEST_USER_*_PASSWORD=... npm run security:red-team:test
```

---

# FASE 3.2 — Staging Storage Policy / Redis Validation

**Data:** 2026-05-16

## Storage policy remoto

| Item | Resultado |
|------|-----------|
| `supabase/storage/documents_policies.sql` verificado no repo | **PASSOU** (SP.1–SP.4) |
| Supabase CLI / `config.toml` no projeto | **Ausente** — aplicação manual no SQL Editor staging |
| `npm run security:red-team:staging-check` | **INCOMPLETO** — faltam `RED_TEAM_CONFIRM_STAGING=1`, `SUPABASE_TEST_USER_*_PASSWORD` |
| `storage-policy-remote.integration.test.ts` (SR.1–SR.6) | **NÃO EXECUTADO** |

## Anon key test

**NÃO EXECUTADO** — suite remota não rodou (env staging incompleta).

## User A vs Workspace B

**NÃO EXECUTADO** — idem.

## User B own workspace

**NÃO EXECUTADO** — idem.

## Redis upload rate limit

| ID | Resultado |
|----|-----------|
| UR.1 21ª chamada bloqueada (`source=redis`) | **PASSOU** (com `infra:up` + singleton reset) |
| UR.2 chaves workspace+user distintas | **PASSOU** |
| UR.3 isolamento userId | **PASSOU** |
| UR.4 isolamento workspaceId | **PASSOU** |
| UR.5 fail-closed sem Redis (mock) | **PASSOU** |
| UR.6 FAIL_OPEN_DEV | **PASSOU** |
| UR.7 rateLimit antes de storage na rota | **PASSOU** |

## Env ausente (release blocker)

- `RED_TEAM_CONFIRM_STAGING=1`
- `SUPABASE_TEST_USER_A_PASSWORD`
- `SUPABASE_TEST_USER_B_PASSWORD`
- Contas Auth Supabase staging com emails das fixtures + `documents_policies.sql` aplicado

## P0 encontrados

**Nenhum** (testes remoto não executados — sem evidência de falha em staging).

## P1/P2 remanescentes

| ID | Item |
|----|------|
| P1 | Policies SQL **não aplicadas** no Supabase remoto (só versionadas no git) |
| P1 | Gate #10 storage remoto **pendente** |
| P2 | Reserva de quota em asserts paralelos sem `document.create` (QC.3b) |

## Release gate atualizado

Ver `docs/security/RELEASE_SECURITY_GATE.md`. **Release bloqueado** até SR.* passar em staging.

## Risco residual

- Isolamento Storage direto (anon/JWT) **não validado** nesta rodada.
- Produção depende de aplicar SQL + Redis + envs documentados no gate.

## Comandos FASE 3.2

```bash
npm run infra:up
npm run security:red-team:test          # 84 passed; SR.* NÃO EXECUTADO
npm run security:red-team:staging-check # exit 1 — env incompleta
npm run lint && npm run typecheck && npm test
```

---

## Próximas fases recomendadas

1. **FASE 4** — Fuzz de inputs (Zod, path traversal, MIME magic bytes)
3. **FASE 5** — Prompt injection com LLM mock/fixture
4. **FASE 6** — Abuse test com Redis (`npm run infra:up`)
5. **FASE 7–10** — Secrets CI, suíte restante (`document-access`, `prompt-injection`, etc.), correções P1

---

# FASE 0–1 (referência rápida)

## Superfície mapeada

- **111** rotas `src/app/api/**/route.ts`
- **3** Server Actions (`onboarding`, `processos`, `publicacoes`)
- **Proxy** `src/proxy.ts` — auth `/api/*`, CSRF Origin, headers CSP
- **Prisma** = camada de dados (RLS Supabase não aplicada ao app)

## Comandos executados (acumulado)

```bash
npm run security:red-team:seed    # OK
npm run security:red-team:test    # 29 passed
npm audit --json                  # 0 vulnerabilidades reportadas
npx prisma migrate status         # up to date
```

## Plano de correção por prioridade

| Prioridade | Ação | Status |
|------------|------|--------|
| P1 | Rate limit fail-closed em rotas caras | **Feito** |
| P1 | `rateLimit` em completion/chat/generate/piece | **Feito** |
| P2 | Timeline 404 cross-tenant | **Feito** |
| P2 | Ingest tenant guard | **Feito** |
| P3 | FASE 3 Storage / RLS | **Auditada** (0 P0; P1 governança policies) |
| P3 | CSP nonces | Pendente |

---

_Status: FASE 2 e FASE 3 **sem P0 dinâmico**; FASE 3.1 **magic bytes + SQL versionado**; FASE 10 **P1/P2 endereçados**; **não** declarar release ready — aplicar policies no Supabase staging e rodar SR.* / UR.* com Redis._
