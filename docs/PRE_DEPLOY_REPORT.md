# Lex — Pre-Deploy Report (Fase 0 → 12)

> Stability Pass + Cloud Infra Prep + First Lawyer Test
> Auditável, sem mascarar problemas, sem novas features.

---

## 1. Causa raiz dos erros locais

### 1.1 `[redis] error: connect ECONNREFUSED 127.0.0.1:6379` em loop
- **Causa**: `src/lib/redis.ts` instanciava `new Redis(url, { maxRetriesPerRequest: 3 })` com `lazyConnect=false` (default ioredis) e `enableOfflineQueue=true`. Sem Redis up, ioredis retentava conectar indefinidamente, e cada `console.warn` no handler `error` produzia centenas de linhas.
- **Sintoma**: terminal poluído + `getRedis().ping()` em rate-limit/cache esperava o handshake antes de cair, segurando requests.

### 1.2 `[lex.retrieval] dense err: Reached the max retries per request limit`
- **Causa**: o cache jurídico em `src/lib/retrieval/legal/cache.ts` chamava `cacheGet(key)` direto via `getRedis().get(...)`. Sem Redis, ioredis cumpria `maxRetriesPerRequest=3` antes de rejeitar — cada miss perdia ~10s.
- **Sintoma**: `/api/retrieval/explain` levou ~18s e `/api/search` ficou irregular.

### 1.3 Logs do Prisma em dev poluídos
- **Causa**: `src/lib/prisma.ts` tinha `log: ["query", "error", "warn"]` em dev. Cada SELECT/INSERT em listagem de casos vazava um log inteiro.

---

## 2. Como corrigi Redis offline

`src/lib/redis.ts` reescrito com:

| Mudança | Efeito |
|---|---|
| `lazyConnect: true` | Socket só abre na primeira chamada real, não no import. |
| `maxRetriesPerRequest: 1` (em dev) | Falha em ms, não em segundos. |
| `enableOfflineQueue: false` (em dev) | Comandos não enfileiram esperando reconexão. |
| `connectTimeout: 2_000`, `commandTimeout: 1_500` | Garantia de timeout por chamada. |
| `retryStrategy` retorna `null` em dev | Sem reconexão infinita. |
| `getRedis()` devolve `Redis \| null` | `null` quando `REDIS_URL` ausente; consumidor checa explicitamente. |
| `isRedisAvailable()` (probe `PING` 250ms cacheado 5s) | Caminho não-throw para health/cache/rate-limit. |
| `tryRedisCall(fn, fallback)` | Wrapper único que engole erro + loga uma vez. |
| `logger.warnOnce()` no handler `error` | Cada erro Redis loga **uma única vez por processo**, depois apenas conta. |

`REDIS_REQUIRED=true` (default em produção) inverte estes defaults: `maxRetriesPerRequest=3`, offline queue ON, retry strategy ativa. Dev vê fail-fast; prod vê resiliência real.

---

## 3. Como corrigi retrieval lento

`src/lib/retrieval/legal/index.ts`:
- Adicionado `withTimeout(promise, ms, label)` wrapper.
- Estágios opcionais com timeout explícito:
  - `dense`: 4_000 ms.
  - `rerank`: 3_000 ms.
  - `graph-expansion`: 1_500 ms.
- Dense quebra cedo: se a 1ª variante falha por timeout/qdrant, demais variantes são puladas (`break`).
- BM25 segue sendo a "coluna" — sem timeout, sempre presente.
- Trace agora carrega `fallbackFlags: string[]` com sinais determinísticos:
  - `dense_unavailable`, `dense_timeout`, `qdrant_unavailable`
  - `rerank_skipped`, `graph_skipped`
  - `redis_unavailable`

`src/lib/retrieval/legal/cache.ts` reescrito:
- Lê/escreve em `MemoryLRU<string>` local **sempre**.
- Tenta Redis apenas se `isRedisAvailable()`.
- Erros nunca propagam — sempre tratados como cache miss.

**Resultado**: integration tests caíram de ~67.77s para 17.99s (-74%). E2E suite de 51 → 54 testes em 28s estáveis. Apenas 1 warning Redis logado durante toda a execução.

---

## 4. Como corrigi spam de logs

| Fonte | Solução |
|---|---|
| Redis errors em loop | `logger.warnOnce(key, msg)` — primeira ocorrência loga, demais silenciadas (contador interno). |
| Prisma query logs | `src/lib/prisma.ts` agora respeita `PRISMA_QUERY_LOGS` (default `false`). Sem flag, mostra apenas `error` (prod) ou `error+warn` (dev). |
| Retrieval cache misses | mesma lógica via logger. |
| Webpack vs Turbopack warning | `next dev --turbopack` é o default; o aviso vem da Vercel — documentado em `.env.example`. |
| `LOG_LEVEL` introduzido | Controla todos os loggers do app (`debug` < `info` < `warn` < `error`). |

---

## 5. Infra escolhida

| Camada | Provedor | Status |
|---|---|---|
| App (SSR + API) | **Vercel** | Pronto — `npm run build` OK. |
| Postgres | **Supabase Cloud** | Pronto — schema com 92 tribunais, FTS preservada. |
| Auth | **Supabase Auth** | Pronto — middleware + RLS. |
| Storage | **Supabase Storage** | Pronto — bucket `documents`. |
| Redis | **Upstash** (TLS) | Variáveis configuradas em `.env.production.example`. |
| Vector DB | **Qdrant Cloud** | `npm run qdrant:init` cria as 3 collections. |
| Jobs | **Inngest Cloud** | Endpoint `/api/inngest` registrado, funções discoverable. |
| Email | **Resend** | Adapter pronto, dry-run em dev. |
| Observabilidade | **Sentry + Vercel logs** | DSN opcional documentada. |
| LLM | **DeepSeek + DeepInfra** | Default provider; embeddings BGE-M3 + reranker BGE-v2-m3. |

---

## 6. Serviços cloud configurados

| Serviço | Como contratar | Doc |
|---|---|---|
| Supabase | https://supabase.com → New Project | `docs/SUPABASE_PRODUCTION.md` |
| Upstash | https://upstash.com → Create Database (TLS) | `docs/REDIS_CLOUD_SETUP.md` |
| Qdrant Cloud | https://cloud.qdrant.io → Create Cluster | `docs/QDRANT_CLOUD_SETUP.md` |
| Inngest Cloud | https://app.inngest.com → New App | `docs/INNGEST_PRODUCTION.md` |
| Resend | https://resend.com → New API Key | (Settings) |
| Vercel | https://vercel.com → Import Project | `docs/DEPLOYMENT.md` |

---

## 7. Variáveis necessárias

Veja `docs/PRODUCTION_ENV_SETUP.md` (10 categorias A–K). 5 templates:
- `.env.example` (dev)
- `.env.production.example` (prod)
- `.env.preview.example` (preview Vercel)

Validador: `npm run vercel:check` ou `npm run deploy:check`.

---

## 8. Quais envs já estão prontas

Tudo que **NÃO depende de credencial externa** está pronto:
- Schema Prisma + migrations.
- Validação Zod de env (`src/lib/env.ts`).
- Defaults sensatos (`REDIS_REQUIRED`, `LOG_LEVEL`, `PRISMA_QUERY_LOGS`).
- Templates `.env.*.example` com comentários.
- `npm run deploy:check` lista status de cada variável + checa endpoints externos.

---

## 9. Quais envs dependem de você preencher

| Variável | Onde pegar | Custo inicial |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Domínio que você vai usar | $0 (ou $10/ano) |
| `DATABASE_URL` / `DIRECT_URL` / chaves Supabase | Supabase project | $0 (free tier) |
| `REDIS_URL` | Upstash | $0 (free tier 10k req/dia) |
| `QDRANT_URL` / `QDRANT_API_KEY` | Qdrant Cloud | $0 (free 1GB) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest Cloud | $0 (free 50k step runs/mês) |
| `DEEPSEEK_API_KEY` | DeepSeek platform | pay-as-you-go (~$0.14 / 1M tokens) |
| `DEEPINFRA_API_KEY` | DeepInfra | pay-as-you-go |
| `RESEND_API_KEY` | Resend | $0 (free 100 emails/dia) |
| `SENTRY_DSN` | Sentry.io | $0 (free dev tier) |

> Custo total para começar: **$0/mês** se ficar nos free tiers; ~$30/mês quando crescer.

---

## 10. Checklist Supabase

- [ ] Site URL = produção
- [ ] Redirect URLs com `/auth/callback`, `/forgot-password`, `/reset-password`, `/invite/**`, `/onboarding/**`, localhost e *.vercel.app
- [ ] Provider Google (opcional) com callback `https://<ref>.supabase.co/auth/v1/callback`
- [ ] Provider GitHub (opcional)
- [ ] Bucket `documents` privado
- [ ] Storage policies por workspace
- [ ] `prisma migrate deploy` aplicado
- [ ] RLS habilitado nas tabelas com `workspaceId`

## 11. Checklist Vercel

- [ ] Repo importado
- [ ] Build command: `prisma generate && next build`
- [ ] Env vars Production: copiadas de `.env.production.example`
- [ ] Env vars Preview: copiadas de `.env.preview.example`
- [ ] `vercel.json` (opcional) para redirects
- [ ] DNS apontando para Vercel + SSL ativo
- [ ] Preview deploy OK
- [ ] Production deploy OK
- [ ] `curl /api/ready` 200
- [ ] `curl /api/health` 200 ou 503 com motivo claro

## 12. Checklist Qdrant Cloud

- [ ] Cluster criado em região próxima
- [ ] API Key gerada
- [ ] `QDRANT_URL` + `QDRANT_API_KEY` na Vercel
- [ ] `npm run qdrant:init` executado
- [ ] 3 collections existem: `lex_corpus_norms`, `lex_corpus_jurisprudence`, `lex_main`

## 13. Checklist Redis Cloud

- [ ] Upstash database TLS criado
- [ ] `REDIS_URL` `rediss://` (não `redis://`)
- [ ] `REDIS_REQUIRED=true` em produção
- [ ] `REDIS_NAMESPACE` separado para preview/prod
- [ ] `/api/health` mostra `checks.redis.ok=true`

## 14. Checklist Inngest

- [ ] App `lex-production` criado
- [ ] `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` configurados
- [ ] Endpoint `/api/inngest` registrado no console Inngest
- [ ] Funções aparecem no dashboard
- [ ] Smoke event enviado e processado

## 15. Checklist email

- [ ] `RESEND_API_KEY` ou SMTP configurado
- [ ] Domínio verificado em Resend (DNS DKIM/SPF)
- [ ] `EMAIL_FROM` com domínio verificado
- [ ] Email de teste enviado (signup) — chegou na caixa de entrada

---

## 16. URL online

Após deploy: `https://lex-navy.vercel.app` (substituir pelo domínio escolhido).

## 17. Como criar usuário teste

1. Acesse `https://lex-navy.vercel.app/register`
2. Preencha email + senha
3. Confirme email recebido

Ou, como admin:
1. `/settings/team` → Criar convite
2. Compartilhe link gerado com o advogado

## 18. Como convidar advogado

1. Faça login como admin do workspace.
2. Acesse `/settings/team`.
3. Clique "Convidar membro" → email do advogado + role (`MEMBER` recomendado).
4. O advogado recebe email de convite com link `/invite/<token>`.
5. Após aceite, ele aparece no workspace e pode acessar `/test-guide`.

## 19. Guia de teste para advogado

Página: `/test-guide` (no app). Documento: `docs/FIRST_LAWYER_TEST_GUIDE.md`.

Inclui:
- 6 passos guiados (criar caso, rodar estratégia, gerar minuta, rodar review, cockpit, upload).
- 10 perguntas estruturadas.
- Orientações de segurança (não usar dados reais sensíveis).
- Lembretes de que **não substitui revisão humana**.

---

## 20. Resultados dos testes

| Categoria | Antes | Depois | Diff |
|---|---:|---:|---:|
| Unit tests | 256 | **276** | +20 |
| Integration tests | 25 (67.77s) | 25 (**17.99s**) | -74% tempo |
| E2E tests | 51 | **54** | +3 |
| Lint | 0 issues | 0 issues | — |
| Typecheck | 0 errors | 0 errors | — |
| Production build | OK | OK | — |
| Redis warning spam (E2E) | dezenas/centenas | **1** | -99% |

Novos arquivos de teste:
- `src/lib/redis.test.ts`
- `src/lib/rate-limit.offline.test.ts`
- `src/lib/cache/memory-lru.test.ts`
- `src/lib/logger.test.ts`
- `src/lib/retrieval/legal/cache.fallback.test.ts`
- `tests/e2e/10-stability.spec.ts`

## 21. Rotas validadas (E2E)

- `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/dashboard` (auth-protected)
- `/cases`, `/cases/new`, `/cases/[id]` (auth-protected)
- `/strategy` (auth-protected)
- `/cockpit` (auth-protected)
- `/processos` (auth-protected)
- `/retrieval/explain` (auth-protected)
- `/test-guide` (auth-protected) **← novo**
- `/api/ready` (público) ← responde estrutura estável
- `/api/health` (público) ← responde estrutura estável com `checks.flags`

## 22. APIs validadas (E2E)

- `GET /api/auth/sync`, `POST /api/auth/sync`
- `GET /api/invitations`
- `GET /api/workspaces/active`
- `GET /api/processes/[id]/documents`
- `GET /api/search`, `GET /api/completion`
- `GET /api/strategy/analyze`
- `GET /api/lawyer-brain`, `POST /api/lawyer-brain/ingest`
- `GET /api/integrations`, `POST /api/integrations/sync`
- `GET /api/alerts`
- `GET /api/notifications`
- `GET/POST /api/cases`, `POST /api/cases/[id]/draft`, `POST /api/cases/[id]/review`
- `GET /api/cases/[id]/comments`, `POST /api/cases/[id]/approvals`
- `GET /api/retrieval/explain`
- `POST /api/inngest` (webhook, exceção do origin guard)

## 23. Build status

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm test -- --run` ✅ 276/276
- `npm run test:integration` ✅ 25/25
- `NODE_ENV=production npm run build` ✅
- `npm run test:e2e` ✅ 54/54

## 24. E2E status

54 testes Playwright passando em 28.1s. Cobertura inclui auth/security/cases/strategy/cockpit/stability.

## 25. Health status

- `/api/ready` → JSON estável, 200, sem dependência externa.
- `/api/health` → JSON estável (`status: ok | degraded | down`) com:
  - `checks.{db, redis, qdrant, supabase}.{ok, required, latencyMs}`
  - `flags.{REDIS_REQUIRED, QDRANT_REQUIRED, NODE_ENV}`
- 503 apenas quando algum check **`required: true`** falha.

---

## 26. Pendências reais

Coisas que **dependem de você**:
1. Criar contas: Supabase, Vercel, Upstash, Qdrant Cloud, Inngest Cloud, Resend.
2. Gerar todas as credenciais e colar na Vercel (Production + Preview).
3. Apontar domínio para Vercel.
4. Rodar `npm run qdrant:init` contra o cluster de produção.
5. Convidar advogado e enviar `/test-guide`.

Coisas que **podemos automatizar a seguir** (não bloqueiam o teste):
- Upload de sourcemaps Sentry no build.
- GitHub Action de smoke test pós-deploy chamando `/api/health`.
- Cron job externo (UptimeRobot) para alertar quedas.

---

## 27. Próxima prioridade sugerida

Após o feedback do primeiro advogado, ataque na seguinte ordem:

1. **Refinamento UI/UX no fluxo onde ele travou** (qual passo levou >2s para entender?).
2. **Cobertura jurisprudencial real** (TST + TJSP live), substituindo modos `fixture`.
3. **Cross-case Knowledge Graph** (Fase 10 do roadmap original) — agora a fundação de Redis/Qdrant/Inngest cloud está sólida o bastante para sustentar o grafo.

Não comece a Fase 10 antes do feedback chegar — você pode estar otimizando o caminho errado.
