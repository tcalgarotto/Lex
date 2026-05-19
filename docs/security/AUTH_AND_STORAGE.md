# Auth, JWT e Storage — modelo de segurança Lex

## Resumo

| Camada | Mecanismo | O que protege |
|--------|-----------|----------------|
| Browser → Next API | Cookie de sessão + `supabase.auth.getUser()` no servidor | Rotas `/api/*`, RSC, Server Actions |
| Middleware | `getUser()` obrigatório em `/api/*`; `getSession()` só em páginas HTML (UX) | Bloqueio grosseiro sem sessão validada |
| Prisma / negócio | `getWorkspaceContext()` + `workspaceId` em queries | Dados do caso, documentos, etc. |
| Storage direto (JWT usuário) | RLS em `storage.objects` + funções `lex_storage_*` | Upload/download **sem** passar pelo Next |
| Storage servidor | `service_role` em `src/lib/storage.ts` | Upload após checagem de membership na API |

## JWT — o que é seguro e o que não é

- O JWT **não é criptografia de dados**: o payload é legível; a **assinatura** impede alteração sem a chave do projeto.
- **Não confiar** em claims editáveis (`user_metadata`) para autorização (ver [Supabase security](https://supabase.com/docs/guides/auth/jwts)).
- **Identidade canônica no Lex:** `auth.uid()` = `User.id` = `Membership.userId`, garantido por `syncAuthUserToDatabase` (`src/lib/auth/sync-user.ts`).
- **Email no JWT** pode mudar (OAuth); usamos email só para exibição/sync de perfil, **não** para RLS de Storage.

## Sync Auth ↔ Prisma

Disparos de sync completo (writes):

- `GET /auth/callback` (OAuth / magic link)
- `POST /api/auth/sync` (login por senha em `login-form.tsx`)
- `POST /api/invitations/accept`

Hot path de leitura: `ensureAuthUserForRead` só grava se faltar `User` ou `Membership`.

## Storage RLS (bucket `documents`)

Fonte de verdade: `supabase/storage/documents_policies.sql`.

- Path: `{workspaceId}/{documentId}/{fileName}`
- Policies: `documents_authenticated_*` (SELECT/INSERT/UPDATE/DELETE)
- Tenant: `lex_storage_user_owns_prefix(name)` → `lex_auth_workspace_ids()` via **`auth.uid()`**
- Validação de path: `lex_storage_path_is_valid` (≥3 segmentos, sem `..`)

**Não** manter policies legadas `documents_*_own_workspace` em paralelo.

### Aplicar em produção

SQL Editor → executar o arquivo inteiro `supabase/storage/documents_policies.sql` (idempotente).

## service_role

`SUPABASE_SERVICE_ROLE_KEY` **só no servidor**, nunca `NEXT_PUBLIC_*`. Bypassa RLS — toda rota que usa `createSupabaseAdminClient()` deve validar `workspaceId` antes.

## Checklist pós-mudança

- [x] `lex_auth_workspace_ids` usa `auth.uid()` (não `auth.jwt() ->> 'email'`) — validado no SQL Editor (2026-05-19)
- [x] Apenas 4 policies `documents_authenticated_*` no bucket
- [x] Bucket `documents` privado (painel: Public bucket OFF)
- [x] `npm run security:red-team:test` — camada app (84 testes); remoto SR.* requer env staging (ver abaixo)
