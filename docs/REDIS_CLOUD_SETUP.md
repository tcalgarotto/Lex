# Redis Cloud (Upstash) — setup para o Lex

## Por que Upstash

- Serverless: sem cluster ocioso, paga por request.
- TLS nativo (`rediss://`).
- Latência baixa em região AWS próxima da Vercel.
- Free tier suficiente para os primeiros 100 advogados de teste.

Alternativa: Redis Cloud (Redis Inc.) — também serve, basta `REDIS_URL` TLS.

## Setup

1. https://upstash.com → Create Database
   - Region: `us-east-1` (mesma da Vercel) ou `sa-east-1` se Brasil.
   - Type: Regional.
   - TLS: enabled.
2. Copie a "TLS REDIS URL" (formato `rediss://default:<password>@...upstash.io:6379`).
3. Vercel → Project Settings → Environment Variables:
   - `REDIS_URL = rediss://...` (Production + Preview)
   - `REDIS_REQUIRED = true` (Production)
   - `REDIS_REQUIRED = true` (Preview)
   - `REDIS_NAMESPACE = lex:prod` (Production)
   - `REDIS_NAMESPACE = lex:preview` (Preview)
4. Deploy.

## Comportamento esperado

### Em produção
- `REDIS_REQUIRED=true` → `/api/health` vira 503 se Redis cair (alerta no Sentry/uptime).
- Rate limit conta em Redis. Quando cluster cair, libera com `X-RateLimit-Source: fail-open` (não bloqueia UX em incidente curto).
- Retrieval cache lê/escreve em Redis. Sem Redis, cai para LRU in-memory por instância.

### Em dev (sem Redis)
- `REDIS_URL` vazia → `getRedis()` retorna `null` silenciosamente.
- 1 warn por processo: `[redis] REDIS_URL ausente — operando em modo no-cache.`
- Nenhum spam de `ECONNREFUSED`.
- Rate-limit fail-open. Cache cai para LRU local.

## Smoke test

```bash
# Local
REDIS_URL=rediss://default:...@... node -e "
import('./src/lib/redis.ts').then(async (r) => {
  console.log('available?', await r.isRedisAvailable());
  await r.cacheSet('lex:smoke', 'hello', 60);
  console.log('echo:', await r.cacheGet('lex:smoke'));
  process.exit(0);
});
"

# Produção
curl https://lex-navy.vercel.app/api/health | jq '.checks.redis'
# Esperado: { "ok": true, "required": true, "latencyMs": <50ms> }
```

## Boas práticas

- Use namespaces separados para preview/prod (`REDIS_NAMESPACE`).
- Rotacione tokens trimestralmente (Upstash → Database → Reset Password).
- Não habilite `enableOfflineQueue` em código fora de `REDIS_REQUIRED=true` — fail-fast é melhor que pendurar requests.
