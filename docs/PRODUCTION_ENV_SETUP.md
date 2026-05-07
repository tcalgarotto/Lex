# Production env setup

Guia operacional completo. Cada categoria explica:
- **onde pegar** o valor;
- **se é obrigatório** em produção (P) ou apenas recomendado (R);
- **comportamento quando ausente** (graceful degradation? falha de boot?).

> Use `.env.production.example` como template. Todos os secrets devem viver em
> Vercel Project Settings → Environment Variables (escopo Production), nunca em
> arquivos commitados.

---

## A. App

| Var | Status | Onde pegar | Default seguro |
|---|---|---|---|
| `NODE_ENV` | P | Vercel define automaticamente em prod | `production` |
| `NEXT_PUBLIC_APP_URL` | P | URL canônica de produção | `https://lex.suapdominio.com.br` |
| `LOG_LEVEL` | R | — | `info` |
| `PRISMA_QUERY_LOGS` | R | — | `false` |

**Sem `NEXT_PUBLIC_APP_URL` correto**: links em emails/convites quebram, OAuth callback falha.

---

## B. Supabase (Auth + Storage + Postgres)

Console: https://supabase.com/dashboard

| Var | Status | Onde pegar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | P | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | P | Project Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | P | Project Settings → API → service_role (manter secreto) |
| `DATABASE_URL` | P | Project Settings → Database → Connection string → URI (modo Transaction, porta 6543) |
| `DIRECT_URL` | P | Mesma fonte, modo Session (porta 5432) — só usado por `prisma migrate deploy` |
| `STORAGE_BUCKET_DOCUMENTS` | P | Storage → criar bucket `documents` (privado) |

**Migrations:** rode `npm run db:migrate:deploy` em CI ou via Vercel Build Command.

**Sem `SUPABASE_SERVICE_ROLE_KEY`**: uploads/downloads via Storage admin ficam offline; auth normal continua funcionando.

---

## C. Redis (Upstash recomendado)

| Var | Status | Onde pegar |
|---|---|---|
| `REDIS_URL` | P | Upstash → Database → Endpoints → TLS rediss:// |
| `REDIS_REQUIRED` | P | `true` em produção (faz `/api/health` retornar 503 quando Redis cai) |
| `REDIS_NAMESPACE` | R | `lex:prod` (separa preview/prod no mesmo cluster) |

**Sem Redis em produção**: rate-limit fica fail-open (não recomendado em prod), retrieval cache cai para LRU in-memory (cada lambda tem o seu — perde dedup cross-instance).

Dev local pode operar **sem `REDIS_URL`**: `getRedis()` devolve `null` e tudo cai para fail-open silencioso (sem spam de ECONNREFUSED).

---

## D. Qdrant Cloud

| Var | Status | Onde pegar |
|---|---|---|
| `QDRANT_URL` | P | Qdrant Cloud → Cluster → Endpoint |
| `QDRANT_API_KEY` | P | Qdrant Cloud → API Keys |
| `QDRANT_COLLECTION` | R | default `lex_main` (legacy) |
| `QDRANT_COLLECTION_CORPUS_NORMS` | R | default `lex_corpus_norms` |
| `QDRANT_COLLECTION_CORPUS_JURISPRUDENCE` | R | default `lex_corpus_jurisprudence` |
| `QDRANT_REQUIRED` | R | `true` em prod |

Setup das collections:
```bash
QDRANT_URL=https://... QDRANT_API_KEY=... npm run qdrant:init
```

**Sem Qdrant**: retrieval cai para BM25 puro (PG FTS). A flag `dense_unavailable` aparece em `trace.fallbackFlags`.

---

## E. Inngest Cloud

Console: https://app.inngest.com

| Var | Status | Onde pegar |
|---|---|---|
| `INNGEST_EVENT_KEY` | P | App → Settings → Event Keys |
| `INNGEST_SIGNING_KEY` | P | App → Settings → Signing Key |
| `INNGEST_APP_ID` | P | nome do app (`lex-production`) |

Endpoint: `POST https://lex.suapdominio.com.br/api/inngest` (a Inngest descobre via deploy hook ou `inngest sync`).

**Sem Inngest**: jobs assíncronos (corpus sync, document ingestion, alerts sync) ficam offline. UI continua funcionando — só não há background processing.

---

## F. IA (chat + embeddings + reranker)

| Var | Status | Onde pegar |
|---|---|---|
| `AI_CHAT_PROVIDER` | P | `deepseek` (default), `openai`, `anthropic`, `openrouter` |
| `DEEPSEEK_API_KEY` | P (se provider=deepseek) | https://platform.deepseek.com |
| `OPENAI_API_KEY` | P (se provider=openai) | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | P (se provider=anthropic) | https://console.anthropic.com |
| `OPENROUTER_API_KEY` | P (se provider=openrouter) | https://openrouter.ai/keys |
| `DEEPINFRA_API_KEY` | P | https://deepinfra.com — embeddings BGE-M3 + reranker BGE-v2-m3 |

**Sem `DEEPINFRA_API_KEY`**: dense retrieval e rerank ficam offline; pipeline cai para BM25 + grounding heurístico.

---

## G. OAuth providers (configurados no Supabase)

| Variável documental | Configurar em |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Supabase → Auth → Providers → Google |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Supabase → Auth → Providers → GitHub |

Callback URL para Google/GitHub OAuth console:
```
https://<project-ref>.supabase.co/auth/v1/callback
```

E nas Redirect URLs do Supabase, adicione:
```
https://lex.suapdominio.com.br/auth/callback
https://lex.suapdominio.com.br/**
https://*-<vercel-team>.vercel.app/**
```

---

## H. Email

| Var | Status | Onde pegar |
|---|---|---|
| `RESEND_API_KEY` | P | https://resend.com — recomendado |
| `EMAIL_FROM` | P | endereço com domínio verificado no Resend |

Alternativas: SES (`AWS_*`), SMTP genérico, ou Supabase Auth SMTP nativo.

**Sem provider**: emails de convite/recuperação ficam offline.

---

## I. Observabilidade

| Var | Status | Onde pegar |
|---|---|---|
| `SENTRY_DSN` | R | https://sentry.io → Project Settings → Client Keys |
| `SENTRY_AUTH_TOKEN` | R | só para upload de sourcemaps no build |
| `NEXT_PUBLIC_SENTRY_DSN` | R | mesma DSN, exposta ao client |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | R | https://cloud.langfuse.com |
| `LANGFUSE_HOST` | R | default `https://cloud.langfuse.com` |

---

## J. Provedores jurídicos

| Var | Status | Onde pegar |
|---|---|---|
| `DATAJUD_API_KEY` | R | CNJ DataJud público |
| `DATAJUD_ALIAS` | R | sigla do tribunal alvo |
| `STF_PROVIDER_MODE` | R | `live` em prod, `fixture` em dev |
| `STJ_PROVIDER_MODE` | R | `live` em prod, `fixture` em dev |

---

## K. Feature flags

| Var | Default prod | Uso |
|---|---|---|
| `ENABLE_CORPUS_SYNC` | `true` | habilita worker de sync de corpus |
| `ENABLE_LEGAL_RETRIEVAL` | `true` | retrieval jurídico |
| `ENABLE_COCKPIT` | `true` | UI cockpit |
| `ENABLE_STRATEGY` | `true` | UI estratégia |
| `ENABLE_LAWYER_BRAIN` | `true` | UI lawyer brain |
| `ENABLE_INTEGRATIONS_MOCKS` | `false` | desliga modo `mock` em prod |
| `ENABLE_E2E_TEST_HELPERS` | `false` | NUNCA habilitar em prod |

---

## Validação rápida

```bash
# Local (.env)
npm run deploy:check

# Staging/preview (com env do shell — preferido em CI)
NEXT_PUBLIC_APP_URL=... DATABASE_URL=... npm run vercel:check

# Production após deploy
curl -fsS https://lex.suapdominio.com.br/api/ready | jq .
curl -fsS https://lex.suapdominio.com.br/api/health | jq .
```
