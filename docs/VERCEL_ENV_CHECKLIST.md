# Vercel Environment Variables — checklist

Lista canônica do que precisa estar em **Vercel → Settings → Environment
Variables** (escopo **Production**) para o deploy do Lex em
`https://lex-navy.vercel.app` ficar saudável.

> Após **qualquer** edição: Vercel → Deployments → último → **Redeploy**
> (sem build cache em caso de dúvida). Variável só salva sem Redeploy
> **não** efetiva.

---

## ⚠️ Aliases automáticos da Vercel Supabase Integration

A integração `@vercel/supabase` provisiona automaticamente:

| Alias provisionado pela Vercel | Mapeia para (canonical) |
|---|---|
| `POSTGRES_PRISMA_URL`         | `DATABASE_URL`  |
| `POSTGRES_URL_NON_POOLING`    | `DIRECT_URL`    |
| `POSTGRES_URL`                | (não usado pelo Lex) |
| `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE` | (não usados pelo Lex) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | (NÃO use — `ioredis` não fala REST) |

O Lex faz **fallback automático no boot** (`src/lib/env-normalize.ts`):

- `DATABASE_URL` ← `POSTGRES_PRISMA_URL` (se ausente)
- `DIRECT_URL`  ← `POSTGRES_URL_NON_POOLING` (se ausente)

Mesmo assim, **recomendamos definir explicitamente** `DATABASE_URL` e
`DIRECT_URL`. Razão: deixar o histórico do Settings auditável e não
depender de ordem de boot.

### Como copiar os aliases para as canônicas (Vercel UI)

1. Settings → Environment Variables.
2. Localize `POSTGRES_PRISMA_URL` → copie o valor.
3. **Add New** → name `DATABASE_URL`, value (cole), scope **Production**
   (e Preview se usar). Save.
4. Localize `POSTGRES_URL_NON_POOLING` → copie o valor.
5. **Add New** → name `DIRECT_URL`, value (cole), scope **Production**.
   Save.
6. Deployments → último → **Redeploy** (sem cache).

---

## Obrigatórias em Production

```bash
# A) App
NEXT_PUBLIC_APP_URL=https://lex-navy.vercel.app        #
NODE_ENV=production           #                          
LOG_LEVEL=info     #
PRISMA_QUERY_LOGS=false     #

# B) Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...                  # secret server-side

# B.1) Postgres (Prisma) — formato exato
DATABASE_URL=postgresql://postgres.<ref>:<PWD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.<ref>:<PWD>@aws-1-<region>.pooler.supabase.com:5432/postgres
STORAGE_BUCKET_DOCUMENTS=documents    #

# C) Redis (Upstash recomendado)
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379    # TLS, NÃO https://
REDIS_REQUIRED=true     #
REDIS_NAMESPACE=lex:prod    #

# D) Qdrant Cloud
QDRANT_URL=https://<cluster>.<region>.aws.cloud.qdrant.io
QDRANT_API_KEY=<api-key>
QDRANT_COLLECTION=lex_main   #
QDRANT_COLLECTION_CORPUS_NORMS=lex_corpus_norms    #
QDRANT_COLLECTION_CORPUS_JURISPRUDENCE=lex_corpus_jurisprudence     #
QDRANT_REQUIRED=true    #

# E) Inngest Cloud
INNGEST_EVENT_KEY=<event-key>
INNGEST_SIGNING_KEY=signkey-<...>
INNGEST_APP_ID=lex-production

# F) IA
AI_CHAT_PROVIDER=deepseek
DEEPSEEK_API_KEY=<...>
DEEPINFRA_API_KEY=<...>                           # embeddings BGE-M3 + reranker
```

## Recomendadas em Production

```bash
# Email
RESEND_API_KEY=<...>
EMAIL_FROM=lex@<dominio-verificado>

# Observabilidade
SENTRY_DSN=<...>
NEXT_PUBLIC_SENTRY_DSN=<...>

# Provedores jurídicos públicos (corpus RAG)
# LexML/STF/STJ são gratuitos, sem chave. DataJud exige chave (CNJ).
LEXML_BASE_URL=https://www.lexml.gov.br/busca/SRU
LEXML_PROVIDER_MODE=live
LEXML_RATE_LIMIT_PER_MINUTE=20
LEXML_DEFAULT_PAGE_SIZE=50
LEXML_MAX_PAGES_PER_SYNC=20

STF_BASE_URL=https://portal.stf.jus.br
STF_PROVIDER_MODE=live
STF_RATE_LIMIT_PER_MINUTE=10

STJ_BASE_URL=https://processo.stj.jus.br
STJ_PROVIDER_MODE=live
STJ_RATE_LIMIT_PER_MINUTE=10

# DataJud — REQUIRED: DATAJUD_API_KEY. Solicite a chave em
# https://datajud-wiki.cnj.jus.br/api-publica/acesso
# 91 aliases disponíveis em src/lib/datajud/datajud-aliases.ts
# (4 superiores + 27 TJs + 6 TRFs + 24 TRTs + 27 TREs + 3 TJMs).
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
DATAJUD_API_KEY=                # ← preencher
DATAJUD_DEFAULT_ALIAS=api_publica_tjrs
DATAJUD_MODE=live
DATAJUD_RATE_LIMIT_PER_MINUTE=30
DATAJUD_DEFAULT_PAGE_SIZE=100
DATAJUD_MAX_PAGES_PER_SYNC=10

# Câmara dos Deputados — REST/JSON público, sem chave
CAMARA_BASE_URL=https://dadosabertos.camara.leg.br/api/v2
CAMARA_PROVIDER_MODE=live
CAMARA_RATE_LIMIT_PER_MINUTE=30

# Senado Federal — REST/JSON público, sem chave
SENADO_BASE_URL=https://legis.senado.leg.br/dadosabertos
SENADO_PROVIDER_MODE=live
SENADO_RATE_LIMIT_PER_MINUTE=30

# Feature flags — produção: TUDO habilitado
ENABLE_CORPUS_SYNC=true
ENABLE_LEGAL_RETRIEVAL=true
ENABLE_CORPUS_GRAPH=true
ENABLE_LEXML_PROVIDER=true
ENABLE_STF_PROVIDER=true
ENABLE_STJ_PROVIDER=true
ENABLE_DATAJUD=true              
ENABLE_CAMARA_PROVIDER=true
ENABLE_SENADO_PROVIDER=true
ENABLE_INTEGRATIONS_MOCKS=false
ENABLE_E2E_TEST_HELPERS=false    # NUNCA habilitar em prod
```

> Detalhes do papel de cada provider: `docs/LEGAL_PROVIDERS.md`.
> Como popular o corpus: `docs/CORPUS_SEEDING.md`.
> Setup do DataJud: `docs/DATAJUD_SETUP.md`.

---

## Validação rápida

```bash
# Local (com env do shell, ex.: depois de `vercel env pull`)
NEXT_PUBLIC_APP_URL=https://lex-navy.vercel.app NODE_ENV=production npm run vercel:check

# Online (após deploy)
curl -fsS https://lex-navy.vercel.app/api/ready  | jq .   # esperado: { ready: true }
curl -fsS https://lex-navy.vercel.app/api/health | jq .   # esperado: status=ok ou degraded com db.ok=true
```

O `/api/health` agora carrega `hint` por componente — se algo estiver
errado, ele já aponta a próxima ação concreta:

```json
{
  "status": "down",
  "hint": "POSTGRES_PRISMA_URL existe (Vercel Supabase Integration), mas DATABASE_URL não. Copie o valor para DATABASE_URL...",
  "checks": {
    "db": {
      "ok": false,
      "error": "Environment variable not found: DATABASE_URL",
      "hint": "..."
    }
  }
}
```

---

## Erros comuns e correção exata

| Sintoma | Causa | Correção |
|---|---|---|
| `/api/ready=200` mas `/api/health=down` com `db.error: Environment variable not found: DATABASE_URL` | Var só em Preview ou faltou Redeploy. Ou só `POSTGRES_PRISMA_URL` setada. | Copiar `POSTGRES_PRISMA_URL` para `DATABASE_URL` em Production. Redeploy. |
| `/api/health` mostra `db.error: Can't reach database server` | URL inválida, senha rotacionada, ou apontando para porta 5432 em runtime | Conferir endpoint pooler 6543 + senha em Supabase → Database |
| `redis.error: redis ping falhou` (com `REDIS_URL` setada) | Setou a URL REST `https://...` em vez de `rediss://` | Trocar para o endpoint TLS do Upstash (Connect → TLS) |
| `redis.error: REDIS_URL ausente` em prod | Var não setada com `REDIS_REQUIRED=true` (default) | Setar `REDIS_URL=rediss://...` ou temporariamente `REDIS_REQUIRED=false` |
| Build falha em `prisma migrate deploy` com erro de SSL | `DIRECT_URL` aponta para pooler 6543 (transaction não suporta DDL) | Use 5432 (session) ou direct connection |
| `/dashboard` mostra "Algo saiu do esperado" | DATABASE_URL não chegou no runtime → Prisma quebra Server Components | A página agora detecta e mostra "Configuração de produção incompleta" com link pra `/api/health` |

---

## Sobre escopos (Production / Preview / Development)

A Vercel oferece 3 escopos por variável. **Marque apenas os que precisar**:

- **Production** → `https://lex-navy.vercel.app` e qualquer alias custom. **Crítico**.
- **Preview** → cada PR/branch ganha seu próprio deploy. Útil para testar
  features antes do merge.
- **Development** → usado pelo `vercel dev` local; raramente necessário.

> Variável marcada **só em Preview** **não** vaza para o deploy de
> Production. É a causa #1 de "funciona em preview mas não em prod".

Recomendação:
- **Production + Preview** → para variáveis que tanto faz (NEXT_PUBLIC_*, IA keys).
- **Production apenas** → para secrets de produção real (chaves de prod do Stripe, domínios custom).
- **Preview apenas** → para overrides temporários (provider em modo fixture, etc.).
