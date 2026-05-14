# Production env setup

Guia operacional completo. Cada categoria explica:
- **onde pegar** o valor;
- **se é obrigatório** em produção (P) ou apenas recomendado (R);
- **comportamento quando ausente** (graceful degradation? falha de boot?).

> Use `.env.production.example` como template. Todos os secrets devem viver em
> Vercel Project Settings → Environment Variables (escopo Production), nunca em
> arquivos commitados.

---

## ⚠️ Regras de ouro na Vercel

Estas três regras evitam 90% dos incidentes pós-deploy:

1. **Escopo correto.** Toda variável usada em runtime de produção precisa estar
   marcada como **Production** em Vercel → Settings → Environment Variables.
   Variável só em **Preview** **não vaza** para Production. Sintoma típico:
   `/api/ready` retorna `{ ready: true }` mas `/api/health` retorna `down` com
   `Environment variable not found: DATABASE_URL`.
2. **Redeploy obrigatório.** Editar/adicionar uma env var **não atualiza** o
   deployment ativo. É preciso ir em Deployments → … → **Redeploy** (sem
   "Use existing build cache" se houver dúvida) ou fazer um novo `git push`.
3. **Formato exato.** O Prisma e o ioredis exigem URLs específicas:
   - `DATABASE_URL` deve ser **pooler transaction** (porta 6543) com
     `?pgbouncer=true&connection_limit=1`. URL direta na 5432 estoura limite
     de conexões.
   - `REDIS_URL` deve ser `rediss://` (TLS) — **não** a URL REST `https://...`
     da Upstash. ioredis fala protocolo nativo, não REST.

### Sintoma → causa raiz

| Sintoma | Causa provável | Ação |
|---|---|---|
| Login funciona, dashboard quebra com "Algo saiu do esperado" | DATABASE_URL ausente em Production | Adicionar var, marcar Production, Redeploy |
| `/api/health` → `db.error: Environment variable not found: DATABASE_URL` | Var só em Preview ou faltando Redeploy | Idem |
| `/api/health` → `redis.error: redis ping falhou` (e REDIS_URL existe) | Usando URL REST `https://...` em vez de `rediss://` | Trocar para endpoint TLS |
| `/api/health` → `redis.error: REDIS_URL ausente` em produção | Var não setada e `REDIS_REQUIRED=true` | Setar URL, ou para o primeiro teste setar `REDIS_REQUIRED=false` |
| Build falha com `prisma migrate` erro de SSL | DIRECT_URL apontando para pooler 6543 | Trocar para 5432 (session) |

---

## A. App

| Var                   | Status | Onde pegar                            | Default seguro                   |
|-----------------------|--------|---------------------------------------|----------------------------------|
| `NODE_ENV`            | P      | Vercel define automaticamente em prod | `production`                     |
| `NEXT_PUBLIC_APP_URL` | P      | URL canônica de produção              | `https://lex-navy.vercel.app` |
| `LOG_LEVEL`           | R      | —                                     | `info`                           |
| `PRISMA_QUERY_LOGS`   | R      | —                                     | `false`                          |

**Sem `NEXT_PUBLIC_APP_URL` correto**: links em emails/convites quebram, OAuth callback falha.

---

## B. Supabase (Auth + Storage + Postgres)

Console: https://supabase.com/dashboard

| Var                             | Status | Onde pegar                                                                           |
|---------------------------------|--------|--------------------------------------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | P      | Project Settings → API → Project URL                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | P      | Project Settings → API → anon key                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | P      | Project Settings → API → service_role (manter secreto)                               |
| `DATABASE_URL`                  | P      | Project Settings → Database → Connection string → URI (modo **Transaction**, porta **6543**) |
| `DIRECT_URL`                    | P      | Mesma fonte, modo **Session** (porta **5432**) — só usado por `prisma migrate deploy`        |
| `STORAGE_BUCKET_DOCUMENTS`      | P      | Storage → criar bucket `documents` (privado)                                         |

### Formato exato em produção

```bash
# DATABASE_URL — usado em RUNTIME (Server Components, API routes)
# Precisa ser pooler TRANSACTION (porta 6543) com pgbouncer=true
DATABASE_URL=postgresql://postgres.<project-ref>:<PWD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

# DIRECT_URL — usado APENAS por prisma migrate deploy
# Precisa ser pooler SESSION (porta 5432) ou direct connection
DIRECT_URL=postgresql://postgres.<project-ref>:<PWD>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

> Pegue ambas em **Supabase → Project Settings → Database → Connection string**:
> - "Transaction" pooler → vai em `DATABASE_URL`
> - "Session" pooler → vai em `DIRECT_URL`
>
> Aspas/escape **não** são necessários, mas se for colar manualmente em Vercel,
> preserve `&` literal (não `&amp;`).

**Sem `DATABASE_URL` em runtime → o Prisma joga
`PrismaClientInitializationError: Environment variable not found: DATABASE_URL`
e qualquer Server Component que toque o banco quebra com "Algo saiu do
esperado". O `error.tsx` do Lex já detecta isso e mostra a hint correta para
o admin.**

**Migrations:** rode `npm run db:migrate:deploy` em CI ou via Vercel Build Command.

**Sem `SUPABASE_SERVICE_ROLE_KEY`**: uploads/downloads via Storage admin ficam offline; auth normal continua funcionando.

---

## C. Redis (Upstash recomendado)

| Var | Status | Onde pegar |
|---|---|---|
| `REDIS_URL` | P | Upstash → Database → **Endpoints → TLS** (`rediss://`) |
| `REDIS_REQUIRED` | P | `true` em produção (faz `/api/health` retornar 503 quando Redis cai) |
| `REDIS_NAMESPACE` | R | `lex:prod` (separa preview/prod no mesmo cluster) |

### Formato exato em produção

```bash
# CORRETO — protocolo Redis nativo via TLS (porta 6379 ou 6380)
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379

# ERRADO — endpoint REST da Upstash (HTTP)
# REDIS_URL=https://<host>.upstash.io   ← ioredis NÃO fala REST
```

> Na console do Upstash, a aba "Connect" mostra duas URLs:
> - **TLS** (`rediss://`) → use esta
> - **REST API** (`https://`) → **não** funciona com `ioredis` (esta é para
>   `@upstash/redis`, biblioteca diferente). Sintoma se usar a errada:
>   `redis ping falhou` ou `Connection is closed.`

**Sem Redis em produção**: rate-limit fica fail-open (não recomendado em prod), retrieval cache cai para LRU in-memory (cada lambda tem o seu — perde dedup cross-instance).

Dev local pode operar **sem `REDIS_URL`**: `getRedis()` devolve `null` e tudo cai para fail-open silencioso (sem spam de ECONNREFUSED).

### Primeiro teste sem Redis configurado

Se você ainda não provisionou Upstash mas precisa subir um deploy para um
advogado testar, defina temporariamente em Production:

```bash
REDIS_REQUIRED=false
```

(deixe `REDIS_URL` em branco). O `/api/health` vai marcar `redis: degraded`
mas o app continua funcional. Reverta para `REDIS_REQUIRED=true` quando o
Redis estiver pronto.

---

## D. Qdrant Cloud

| Var                                      | Status | Onde pegar                    |
|------------------------------------------|-----|----------------------------------|
| `QDRANT_URL`                             | P | Qdrant Cloud → Cluster → Endpoint  |
| `QDRANT_API_KEY`                         | P | Qdrant Cloud → API Keys            |
| `QDRANT_COLLECTION`                      | R | default `lex_main` (legacy)        |
| `QDRANT_COLLECTION_CORPUS_NORMS`         | R | default `lex_corpus_norms`         |
| `QDRANT_COLLECTION_CORPUS_JURISPRUDENCE` | R | default `lex_corpus_jurisprudence` |
| `QDRANT_REQUIRED`                        | R | `true` em prod                     |

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

Endpoint: `POST https://lex-navy.vercel.app/api/inngest` (a Inngest descobre via deploy hook ou `inngest sync`).

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
https://lex-navy.vercel.app/auth/callback
https://lex-navy.vercel.app/**
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

## J. Provedores jurídicos (corpus indexado)

> Detalhes completos de pipeline e como popular: ver §J.4 abaixo + `docs/QDRANT_CLOUD_SETUP.md`.

### J.1 Variáveis

| Var | Status | Onde pegar / o que faz |
|---|---|---|
| `DATAJUD_API_KEY`   | R (apenas se for usar DataJud) | https://datajud-wiki.cnj.jus.br/api-publica/acesso → preencha o formulário do CNJ → key gratuita por email em poucos minutos |
| `DATAJUD_DEFAULT_ALIAS` | R (fallback técnico) | alias oficial usado quando o CNJ/processo não identifica o tribunal — ex.: `api_publica_tjrs`. Lista oficial: https://datajud-wiki.cnj.jus.br/api-publica/endpoints |
| `STF_PROVIDER_MODE` | R | `live` em prod (provider real do portal STF), `fixture` em dev |
| `STJ_PROVIDER_MODE` | R | `live` em prod (provider real STJ), `fixture` em dev |

> **STF/STJ/LexML/Fixture não exigem chave** — são portais públicos. As variáveis `*_PROVIDER_MODE` apenas alternam entre o provider real (`live`) e o embutido (`fixture`).

### J.2 Mapa: o que cada provider alimenta no corpus

| Provider | Chave? | Cobre | Vai para a collection |
|---|---|---|---|
| `FIXTURE` | não — embutido em `src/lib/corpus/providers/fixture.ts` | CDC, CC, CPC, CF/88 (preâmbulo + arts), 1 súmula demo | depende do `kind` de cada item |
| `LEXML`   | não — `https://www.lexml.gov.br/busca/SRU` | **toda** legislação federal/estadual/municipal oficial brasileira (vade mecum completo) | `lex_corpus_norms` |
| `STF`     | não — scraping público | súmulas + súmulas vinculantes do STF | `lex_corpus_jurisprudence` |
| `STJ`     | não — `https://processo.stj.jus.br/SCON/` | acórdãos e súmulas STJ | `lex_corpus_jurisprudence` |
| `DATAJUD` | **sim — `DATAJUD_API_KEY` (CNJ)** | movimentações processuais de TJs, TRFs, TRTs, TREs, TJMs, STJ, TST, TSE e STM (STF fica em fonte própria) | `lex_corpus_jurisprudence` |

### J.3 Roteamento collection ↔ provider é automático

Não decida manualmente. O `kind` de cada `LegalNorm` decide a collection:

```
ORDINARY_LAW, COMPLEMENTARY_LAW, DECREE,
CONSTITUTIONAL_AMENDMENT, MEDIDA_PROVISORIA, ...     →  lex_corpus_norms
JURISPRUDENCE_STF, JURISPRUDENCE_STJ, JURISPRUDENCE_TST,
SUMULA_*, REPETITIVE_THEME, JURISPRUDENCE_OTHER     →  lex_corpus_jurisprudence
```

Implementação: `src/lib/corpus/qdrant-collections.ts` → `collectionForKind(kind)`.

### J.4 Como popular o corpus (passo-a-passo)

**Pré-requisito:** `DEEPINFRA_API_KEY` setada (gera os vetores BGE-M3 1024-d).

**1. Criar collections (uma vez):**

```bash
QDRANT_URL=https://<seu>.qdrant.io \
QDRANT_API_KEY=<sua> \
npm run qdrant:init
```

Cria `lex_main`, `lex_corpus_norms`, `lex_corpus_jurisprudence` + payload indexes. Idempotente.

**2. Bootstrap rápido com fixture (recomendado para o primeiro teste com advogado):**

```bash
DATABASE_URL=<pooler 6543> DIRECT_URL=<pooler 5432> \
QDRANT_URL=<seu> QDRANT_API_KEY=<sua> \
DEEPINFRA_API_KEY=<sua> \
npm run corpus:sync -- --provider=FIXTURE --inline
```

Popula CDC, Código Civil, CPC, CF/88 e 1 súmula em ~30s. Sem Inngest, sem chaves de provedor.

**3. Vade mecum oficial via LexML (legislação federal):**

```bash
# Leis ordinárias
npm run corpus:sync -- --provider=LEXML --kind=ORDINARY_LAW --max-pages=20 --inline
# Constituição + emendas
npm run corpus:sync -- --provider=LEXML --kind=CONSTITUTIONAL_AMENDMENT --max-pages=5 --inline
# Decretos
npm run corpus:sync -- --provider=LEXML --kind=DECREE --max-pages=10 --inline
```

Cada página = 50 normas. Watermark incremental — sync subsequente só pega novas.

**4. Jurisprudência:**

```bash
npm run corpus:sync -- --provider=STF --inline                    # súmulas STF
npm run corpus:sync -- --provider=STJ --max-pages=5 --inline      # acórdãos STJ
DATAJUD_API_KEY=<sua> DATAJUD_DEFAULT_ALIAS=api_publica_tjrs \
  npm run corpus:sync -- --provider=DATAJUD --max-pages=10 --inline
```

**5. Em produção (recorrente, via Inngest):**

Sem `--inline` = dispatch para Inngest Cloud, que roda async com retries, throttle e watermark:

```bash
npm run corpus:sync -- --provider=LEXML --kind=ORDINARY_LAW --max-pages=20
```

Inngest Cloud agenda corpus-sync diário sozinho — não exige cron da Vercel.

### J.5 Especialidades (direito do consumidor, tributário, etc.)

Não há entidade separada. O Lex deriva especialidade de:

1. `LegalNorm.tags` — array de strings (ex.: `["consumidor", "responsabilidade civil"]`).
   Vem automático dos metadados oficiais (LexML preenche via DC.subject).
2. `LegalNorm.kind` — categoria estrutural.

O classificador de intenção (`src/lib/retrieval/legal/intent.ts`) detecta a área da pergunta do advogado e filtra retrieval por `tags`/`kind`. **Funciona sem você marcar nada manualmente**, desde que o corpus tenha sido ingerido.

### J.6 Verificação

```bash
# Pontos no Qdrant
curl -H "api-key: $QDRANT_API_KEY" \
  "$QDRANT_URL/collections/lex_corpus_norms" | jq '.result.points_count'
curl -H "api-key: $QDRANT_API_KEY" \
  "$QDRANT_URL/collections/lex_corpus_jurisprudence" | jq '.result.points_count'

# Normas no Postgres
npx prisma studio   # tabelas: LegalNorm, LegalNormVersion, LegalChunk, LegalCitation
```

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
curl -fsS https://lex-navy.vercel.app/api/ready | jq .
curl -fsS https://lex-navy.vercel.app/api/health | jq .
```
