# Supabase — produção

## 1. Auth → URL Configuration

**Site URL:**
```
https://lex-navy.vercel.app
```

**Redirect URLs** (cole exatamente):
```
https://lex-navy.vercel.app/auth/callback
https://lex-navy.vercel.app/**
https://*.vercel.app/**
https://lex-navy.vercel.app/forgot-password
https://lex-navy.vercel.app/reset-password
https://lex-navy.vercel.app/invite/**
https://lex-navy.vercel.app/onboarding/**
http://localhost:3000/auth/callback
http://localhost:3000/**
```

**Dev na LAN (opcional):** se testar pelo IP da máquina (`http://192.168.x.x:3000`), adicione também `http://<SEU_IP>:3000/auth/callback` e `http://<SEU_IP>:3000/**`. Passo a passo: `docs/DEV_LAN_ACCESS.md`.

> Sem `/auth/callback` na lista, o login com OAuth/magic link falha em produção.

## 2. OAuth providers

Habilite Google/GitHub no painel Supabase (`Auth → Providers`).
- Para o painel OAuth do Google/GitHub, callback URL é:
  ```
  https://<PROJECT_REF>.supabase.co/auth/v1/callback
  ```
- Salve `client_id` e `client_secret` no Supabase (não vão pra `.env`).

## 3. Storage

- Bucket: **`documents`** (privado).
- Policies (fonte de verdade: `supabase/storage/documents_policies.sql`):
  - `documents_authenticated_select` / `insert` / `update` / `delete` — tenant via `lex_storage_user_owns_prefix` + validação de path; membership via **`auth.uid()`** (ver `docs/security/AUTH_AND_STORAGE.md`).
  - **Não** manter em paralelo policies `documents_*_own_workspace` (legado do dashboard).
- Aplicar no SQL Editor: colar e executar o arquivo `supabase/storage/documents_policies.sql` inteiro após backup.
- Auth: `User.id` = Supabase `auth.users.id`; sync em `/auth/callback` e `POST /api/auth/sync`.
- Limite de tamanho: 50MB por upload.
- MIME permitidos: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`.

Validar policies:
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

## 4. Database

- Migrations aplicadas via `npm run db:migrate:deploy` (ou Vercel build hook).
- RLS HABILITADO em todas as tabelas com `workspaceId`.
- Pooler:
  - `DATABASE_URL` — TRANSACTION mode, porta 6543, `pgbouncer=true&connection_limit=1`.
  - `DIRECT_URL` — SESSION mode, porta 5432 (uso exclusivo do Prisma migrate).

Smoke do RLS (deve falhar sem JWT de membership):
```sql
-- Login como anon (sem JWT)
SELECT count(*) FROM "Case";
-- Esperado: 0
```

## 5. Seed para staging/demo

Use `seed/seed-demo-legal.ts` (já existe) — popula:
- Workspace demo.
- Casos fictícios (sem PII).
- Normas públicas (CF/88, CDC, CC, CPC).
- Exemplos jurídicos sintéticos.

```bash
DATABASE_URL=... npm run seed:demo-legal
```

> **Nunca rode seeds com dados reais em produção.** O seed é projetado para ambiente de staging/demo.

## 6. Service role key

`SUPABASE_SERVICE_ROLE_KEY` é segredo absoluto. Use **apenas no servidor**:
- `src/lib/supabase/admin.ts` (cliente admin)
- jobs Inngest

Nunca exponha em cliente, nem em logs.

## 7. Observabilidade

- Supabase → Logs → Database / Auth / Edge → procure por `error`/`warning`.
- Vercel → Function Logs para erros do app.
- Sentry → DSN configurado captura erros server + client.
