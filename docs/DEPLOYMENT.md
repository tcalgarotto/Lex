# Deployment — Vercel + Supabase + Upstash + Qdrant Cloud + Inngest Cloud

Caminho oficial para colocar o Lex 100% online, sem nada local.

## Visão geral

| Camada | Provedor | Por quê |
|---|---|---|
| App (SSR + API) | **Vercel** | runtime Next.js otimizado, preview por branch, edge headers |
| Postgres | **Supabase Cloud** | banco gerenciado + pooler PgBouncer + RLS |
| Auth | **Supabase Auth** | email/password + magic link + OAuth (Google/GitHub) |
| Storage | **Supabase Storage** | buckets privados com signed URLs |
| Redis | **Upstash** (TLS) | rate limit + retrieval cache, low-cost serverless |
| Vector DB | **Qdrant Cloud** | collections corpus jurídico (norms + jurisprudence) |
| Jobs | **Inngest Cloud** | corpus sync, document ingestion, alerts sync |
| Email | **Resend** | convites, magic link override, notificações |
| Observabilidade | **Sentry + Vercel logs** | erros + traces |
| LLM/Embeddings | **DeepSeek + DeepInfra** | chat + BGE-M3 + reranker |

---

## 1. Pré-requisitos

- Conta GitHub com o repositório do Lex.
- Conta Vercel conectada ao GitHub.
- Projeto Supabase Cloud criado (anote `PROJECT_REF`).
- Conta Upstash com 1 database criado (anote `REDIS_URL`).
- Conta Qdrant Cloud com 1 cluster (anote `QDRANT_URL` + `QDRANT_API_KEY`).
- Conta Inngest Cloud com 1 app `lex-production` criado.

---

## 2. Setup Supabase

### 2.1 Auth → URL Configuration
- **Site URL:** `https://lex.suapdominio.com.br`
- **Redirect URLs** (adicione todas):
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

### 2.2 Auth → Providers
- Habilite Google/GitHub (opcional). Callback URL para o painel OAuth do provedor:
  ```
  https://<PROJECT_REF>.supabase.co/auth/v1/callback
  ```

### 2.3 Storage
- Crie bucket `documents` (privado).
- Policies já estão modeladas via Prisma `Document` (validate via `npm run smoke:team`).

### 2.4 Database
- `prisma migrate deploy` aplica migrations (rode em CI/build hook).
- Verifique RLS habilitado nas tabelas críticas.

---

## 3. Setup Vercel

### 3.1 Importar repo
- Vercel → New Project → Import GitHub → selecionar `lex`.
- Framework: **Next.js** (autodetect).
- Build Command: `npm run build` (já inclui `prisma generate`).
- Install Command: `npm ci`.
- Output: deixe padrão.

### 3.2 Environment Variables
Cole as variáveis de `.env.production.example` em **Production** e
`.env.preview.example` em **Preview**.

Variáveis críticas obrigatórias para subir saudável:
```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
DIRECT_URL
REDIS_URL
QDRANT_URL
QDRANT_API_KEY
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
DEEPSEEK_API_KEY
DEEPINFRA_API_KEY
RESEND_API_KEY
```

Valide com `npm run vercel:check` (executa `scripts/deploy-check.ts`).

### 3.3 Migrations no build
Adicione o build command:
```
prisma migrate deploy && prisma generate && next build
```

Ou rode `prisma migrate deploy` em GitHub Actions antes do deploy.

---

## 4. Setup Upstash Redis

1. Console Upstash → Create Database → Region próxima da Vercel.
2. Copie a TLS endpoint (`rediss://default:<password>@...upstash.io:6379`).
3. Cole em `REDIS_URL` na Vercel (Production + Preview).
4. Para preview, use o **mesmo cluster** com `REDIS_NAMESPACE=lex:preview`.

Veja `docs/REDIS_CLOUD_SETUP.md` para detalhes.

---

## 5. Setup Qdrant Cloud

1. Console Qdrant Cloud → Create Cluster (free tier suficiente para começar).
2. Anote `QDRANT_URL` e gere `QDRANT_API_KEY`.
3. Inicialize as collections:
   ```bash
   QDRANT_URL=... QDRANT_API_KEY=... npm run qdrant:init
   ```
4. Confira em `https://<cluster>.qdrant.io/dashboard`.

Veja `docs/QDRANT_CLOUD_SETUP.md`.

---

## 6. Setup Inngest Cloud

1. Console Inngest → New App → `lex-production`.
2. Copie `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` para a Vercel.
3. Após o primeiro deploy, registre o endpoint:
   ```
   https://lex.suapdominio.com.br/api/inngest
   ```
4. Inngest Cloud descobre as funções automaticamente.

Veja `docs/INNGEST_PRODUCTION.md`.

---

## 7. Diferença Preview vs Production

| | Preview | Production |
|---|---|---|
| URL | `https://<branch>-<hash>.vercel.app` | `https://lex.suapdominio.com.br` |
| Supabase | Mesmo projeto | Mesmo projeto |
| Redis | Mesmo cluster (namespace `lex:preview`) | namespace `lex:prod` |
| Inngest | App `lex-preview` | App `lex-production` |
| Email | Resend test domain ou dry-run | Domínio verificado |
| Feature flags | `ENABLE_INTEGRATIONS_MOCKS=true` | `ENABLE_INTEGRATIONS_MOCKS=false` |

---

## 8. Validação pós-deploy

```bash
# Smoke (do laptop)
curl -fsS https://lex.suapdominio.com.br/api/ready | jq .
curl -fsS https://lex.suapdominio.com.br/api/health | jq .
```

Esperado:
- `/api/ready` → `{ "ready": true, ... }` 200.
- `/api/health` → `{ "status": "ok", ... }` 200, com todos os checks `ok=true, required=true|false`.

Manualmente:
- [ ] `/login` carrega.
- [ ] criar conta + receber email de confirmação.
- [ ] `/dashboard` protegido (redireciona).
- [ ] `/cases/new` aceita texto e cria caso.
- [ ] `/strategy?q=...` retorna grounding panel.
- [ ] `/cockpit` lista alertas/integrações/notificações.
- [ ] upload de PDF em um Process.

---

## 9. Rollback

Vercel mantém histórico de deploys. Para reverter:
```
vercel ls
vercel promote <deployment-url>
```

Ou pelo dashboard: Project → Deployments → "..." → Promote to Production.

---

## 10. Checklist final pré-go-live

- [ ] `npm run vercel:check` em produção retorna 0 erros.
- [ ] `/api/health` retorna `status=ok`.
- [ ] Migrations aplicadas (`prisma migrate status` limpo).
- [ ] Redis TLS funcionando (não plain `redis://`).
- [ ] Qdrant collections existem e têm dimensão correta.
- [ ] Inngest mostra o app conectado e recebendo events.
- [ ] Email de teste chegou (criar conta com email real).
- [ ] OAuth Google/GitHub redireciona corretamente.
- [ ] Sentry recebe erros (force um throw em /api/health).
- [ ] Sourcemap upload no build (se Sentry habilitado).
- [ ] DNS apontado para Vercel + SSL ativo.
