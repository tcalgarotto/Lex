# Supabase — produção

## 1. Auth → URL Configuration

**Site URL:**
```
https://lex.suapdominio.com.br
```

**Redirect URLs** (cole exatamente):
```
https://lex.suapdominio.com.br/auth/callback
https://lex.suapdominio.com.br/**
https://*.vercel.app/**
https://lex.suapdominio.com.br/forgot-password
https://lex.suapdominio.com.br/reset-password
https://lex.suapdominio.com.br/invite/**
https://lex.suapdominio.com.br/onboarding/**
http://localhost:3000/auth/callback
http://localhost:3000/**
```

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
- Policies:
  - `select_documents_owner` — SELECT permitido se `auth.uid()` for membro do workspace dono.
  - `insert_documents_authenticated` — INSERT permitido para qualquer authenticated user (gravação real é via service role após validação do workspace).
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
