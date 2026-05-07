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
- **Site URL:** `https://lex-navy.vercel.app`
- **Redirect URLs** (adicione todas):
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

> **⚠️ Três regras que evitam 90% dos incidentes pós-deploy:**
>
> 1. **Escopo correto.** Cada variável tem checkboxes "Production / Preview /
>    Development". Para o site de produção funcionar, marque **Production**.
>    Variável marcada só em Preview **não chega** ao deploy de produção. O
>    sintoma clássico: `/api/ready` devolve `{ ready: true }` mas
>    `/api/health` devolve `down` com
>    `Environment variable not found: DATABASE_URL` — porque `/api/ready` não
>    toca env, mas `/api/health` (e qualquer Server Component que use Prisma)
>    sim.
> 2. **Redeploy é obrigatório.** Editar uma env var **não atualiza** o
>    deployment ativo. Vá em Deployments → … → **Redeploy** ou faça um novo
>    `git push`. Sem isso, a Vercel continua servindo o build antigo, sem a
>    var nova.
> 3. **Formato exato.** O Prisma e o ioredis exigem URLs específicas — veja
>    abaixo.

Cole as variáveis de `.env.production.example` em **Production** e
`.env.preview.example` em **Preview**.

#### Variáveis críticas obrigatórias

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL                    ← Prisma runtime (Server Components quebram sem)
DIRECT_URL                      ← Prisma migrate deploy
REDIS_URL                       ← rediss:// (TLS), NÃO https://
QDRANT_URL
QDRANT_API_KEY
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
DEEPSEEK_API_KEY
DEEPINFRA_API_KEY
RESEND_API_KEY
```

#### Formato exato (Supabase Postgres)

Pegue em **Supabase → Project Settings → Database → Connection string**.
Copie **as duas** modalidades, são URLs diferentes:

```bash
# DATABASE_URL — runtime: pooler TRANSACTION (porta 6543)
DATABASE_URL=postgresql://postgres.<ref>:<PWD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# DIRECT_URL — migrations: pooler SESSION (porta 5432)
DIRECT_URL=postgresql://postgres.<ref>:<PWD>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

Por que é assim:
- A Vercel é serverless ⇒ cada lambda abre nova conexão. Sem PgBouncer
  (`pgbouncer=true&connection_limit=1`), o Postgres do Supabase estoura limite
  rapidamente.
- `prisma migrate deploy` precisa de **session mode** (porta 5432) para
  emitir DDL — pooler transaction em DDL falha.

#### Formato exato (Upstash Redis)

```bash
# CORRETO — TLS (rediss://)
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379

# ERRADO — REST API (https://) — ioredis não fala REST
# REDIS_URL=https://<host>.upstash.io
```

Pegue em **Upstash → Connect → TLS**, não em "REST API". Sintoma se errar:
`/api/health` mostra `redis.error: redis ping falhou` mesmo com a var setada.

#### Validação automática

```bash
npm run vercel:check                # checa formato e bate em /api/ready + /api/health
```

Esse script (`scripts/deploy-check.ts`) é o que você roda *depois* do
Redeploy para confirmar que cada variável saiu do "Settings" e chegou no
deployment ativo.

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
   https://lex-navy.vercel.app/api/inngest
   ```
4. Inngest Cloud descobre as funções automaticamente.

Veja `docs/INNGEST_PRODUCTION.md`.

---

## 6.1 Vercel Hobby vs Pro — limites de cron

A Vercel impõe limites de cron por plano:

| Plano | Frequência mínima de cron |
|---|---|
| **Hobby** (free) | **1× por dia** apenas |
| **Pro** | até **1× por minuto** |

> Cron expressions como `*/5 * * * *`, `0 * * * *` (hourly) ou `*/30 * * * *`
> **falham o deploy** no plano Hobby com:
> `Hobby accounts are limited to daily cron jobs.`

### Como o Lex lida com isso

- **`vercel.json` não declara `crons` por padrão** — para garantir compatibilidade Hobby.
- **Para o primeiro teste com advogado, cron NÃO é necessário**:
  - Health pode ser checado manualmente: `curl https://<dominio>/api/health`.
  - Ou via script: `NEXT_PUBLIC_APP_URL=https://<dominio> npm run deploy:check`.
  - Ou monitoring externo gratuito (UptimeRobot, BetterStack) batendo em `/api/health` — **fora da Vercel**, sem limite de plano.

### Quando habilitar cron diário (Hobby)

Quando precisar de jobs agendados (ex.: corpus sync), declare no `vercel.json`:

```json
"crons": [
  { "path": "/api/cron/corpus-sync", "schedule": "0 9 * * *" }
]
```

`0 9 * * *` = diariamente às 09:00 UTC. Único formato aceito no Hobby.

### Quando precisar de cron sub-diário

Caminhos sem upgrade para Pro:
1. **Inngest Cloud cron** — Inngest tem schedule próprio (sem dependência da Vercel) e o free tier aceita schedules de minutos. Use isto para `alerts:sync`, `integrations:sync`, etc. — já é o caminho oficial do Lex (`docs/INNGEST_PRODUCTION.md`).
2. **GitHub Actions com `schedule:`** — workflow batendo em `https://<dominio>/api/...` a cada N minutos.
3. **UptimeRobot Free** — 5 minutos.

Resumo: o Lex já usa Inngest para todos os jobs sub-diários. Vercel cron fica reservado apenas para tarefas diárias muito ocasionais — e o `vercel.json` atual não precisa dele.

---

## 7. Diferença Preview vs Production

| | Preview | Production |
|---|---|---|
| URL | `https://<branch>-<hash>.vercel.app` | `https://lex-navy.vercel.app` |
| Supabase | Mesmo projeto | Mesmo projeto |
| Redis | Mesmo cluster (namespace `lex:preview`) | namespace `lex:prod` |
| Inngest | App `lex-preview` | App `lex-production` |
| Email | Resend test domain ou dry-run | Domínio verificado |
| Feature flags | `ENABLE_INTEGRATIONS_MOCKS=true` | `ENABLE_INTEGRATIONS_MOCKS=false` |

---

## 8. Validação pós-deploy

```bash
# Smoke (do laptop)
curl -fsS https://lex-navy.vercel.app/api/ready | jq .
curl -fsS https://lex-navy.vercel.app/api/health | jq .
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

## 9.1 Troubleshooting — Dashboard quebra em produção

### Sintoma: estou logado, mas `/dashboard` mostra "Algo saiu do esperado"

`/api/ready` retorna 200, mas `/api/health` retorna `down` com algum dos:

| `/api/health` mostra | Causa | Correção |
|---|---|---|
| `db.error: Environment variable not found: DATABASE_URL` | DATABASE_URL ausente em Production (talvez só em Preview, ou faltando Redeploy) | Vercel → Settings → Env Vars → adicione `DATABASE_URL` em **Production** com formato pooler 6543 → Deployments → **Redeploy** |
| `db.error: Can't reach database server` | URL inválida, senha rotacionada, ou IP da Vercel bloqueado | Confirmar pooler endpoint + senha atual no Supabase |
| `db.error: PrismaClientInitializationError` | Prisma engine não inicializou (geralmente falta `DATABASE_URL` ou inválido) | Idem acima |
| `redis.error: REDIS_URL ausente` | Var não setada e `REDIS_REQUIRED=true` (default em prod) | Setar URL `rediss://...`, OU para o primeiro teste setar `REDIS_REQUIRED=false` |
| `redis.error: redis ping falhou` | URL setada mas inválida — comum se usar `https://` REST em vez de `rediss://` TLS | Trocar para endpoint TLS do Upstash |
| `supabase.error: ausentes` | `NEXT_PUBLIC_SUPABASE_URL` ou `ANON_KEY` faltando | Adicionar em Production e Redeploy |

O `error.tsx` do Lex já detecta `Environment variable not found` /
`PrismaClientInitializationError` e mostra um aviso "Configuração de produção
incompleta" com link direto para `/api/health` — em vez do genérico "Algo
saiu do esperado".

### Bypass temporário do Redis (primeiro teste com advogado)

Se o Upstash ainda não está provisionado e você só quer mostrar o app para
um advogado, pode rodar **sem** Redis em produção:

```bash
# Em Vercel → Settings → Environment Variables (Production):
REDIS_REQUIRED=false
# (deixe REDIS_URL em branco)
```

Depois Redeploy. `/api/health` vai marcar `redis: degraded` (`required:
false`), mas o status geral fica `degraded` — o app continua 100% funcional.
Reverta para `REDIS_REQUIRED=true` quando o Upstash estiver pronto.

### Checklist após cada mudança de env var

1. Variável marcada **Production** (e Preview se aplicável)?
2. Após salvar, fui em **Deployments → Redeploy** (sem cache se em dúvida)?
3. `curl https://<dominio>/api/health | jq` mostra `status: ok` ou
   `degraded` (mas com `db.ok=true`)?
4. `/dashboard` carrega sem o aviso de "Configuração de produção
   incompleta"?

---

## 9.2 Workflow solo-dev — merge rápido sem review obrigatório

Se você é o único maintainer e não quer ficar autorizando review/merge a
cada PR, o caminho oficial é usar o **GitHub CLI**:

```bash
# Ver o estado do PR
gh pr view 3
gh pr checks 3

# Mergear assim que os checks passarem (squash + delete branch)
gh pr merge 3 --squash --delete-branch
```

Auto-merge: a Vercel/GitHub também suportam auto-merge. Habilite **uma vez**:

```bash
gh pr merge 3 --squash --delete-branch --auto
```

Isso enfileira o merge para **assim que os checks ficarem verdes**. Se algum
check falhar, o auto-merge fica bloqueado e você corrige normalmente.

### Se um ruleset bloquear o merge

Settings → Rules → Rulesets → escolha o ruleset que protege `main`:

- Para **push direto** (sem PR): desative *Require pull request before merging*.
- Para **manter PR mas merge sem review**:
  - desative *Require approvals* (deixe em 0).
  - mantenha *Require status checks to pass before merging* — isso garante CI verde.
- Para **auto-merge**: ative *Allow auto-merge* em Settings → General.

> Em projetos solo-dev, manter o PR + checks obrigatórios + 0 aprovações é
> o sweet spot: você ainda tem o histórico de PRs (audit), CI bloqueia
> regressão, e não fica esperando review fantasma.

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
