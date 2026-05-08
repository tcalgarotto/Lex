# Redis Cloud (Upstash) — setup e diagnóstico

## TL;DR — formato canônico

```
REDIS_URL=rediss://default:<password>@<your-host>.upstash.io:6379
```

3 sinais de que está certo:
- **`rediss://`** com 2 `s` (TLS), não `redis://` nem `https://`
- porta **`6379`** (TCP), não `443` da REST API
- usuário **`default`** + senha embutida na URL

Se você copiou a URL **REST** (`https://...upstash.io`), o `ioredis` **não funciona**.
A REST API é HTTP, não RESP. Trocar para a aba **TLS** no Upstash → Connect.

---

## Por que Upstash

- Serverless: sem cluster ocioso, paga por request.
- TLS nativo (`rediss://`).
- Latência baixa em região AWS próxima da Vercel.
- Free tier suficiente para os primeiros 100 advogados de teste.

Alternativa: Redis Cloud (Redis Inc.) — também serve, basta `REDIS_URL` TLS.

## Setup

1. <https://upstash.com> → Create Database
   - Region: `us-east-1` (mesma região do Vercel) ou `sa-east-1` se Brasil.
   - Type: Regional.
   - TLS: enabled.
2. Database → **Connect** → escolha aba **TLS** (não REST).
3. Copie a "TLS REDIS URL" no formato `rediss://default:<password>@<host>.upstash.io:6379`.
4. Vercel → Project Settings → Environment Variables:
   - `REDIS_URL = rediss://...` (Production + Preview)
   - `REDIS_REQUIRED = true` (Production)
   - `REDIS_REQUIRED = true` (Preview)
   - `REDIS_NAMESPACE = lex:prod` (Production)
   - `REDIS_NAMESPACE = lex:preview` (Preview)
5. **Save** → Vercel → Deployments → último → **Redeploy SEM cache**.

> ⚠️ **Env changes não atualizam deployments antigos.** A nova `REDIS_URL` só
> entra em vigor para deployments criados DEPOIS do save. Sem o Redeploy, o
> deployment ativo continua usando a env antiga (a que estava no momento do
> build).

---

## Diagnóstico — `npm run redis:check`

Script seguro que valida `REDIS_URL` sem expor senha:

```bash
# Local (lê de .env)
npm run redis:check

# Contra produção (puxa env da Vercel)
npx vercel env pull .env.production.local
npx tsx --env-file=.env.production.local scripts/redis-check.ts
```

Saída quando tudo está certo:

```
═══ redis:check ═══════════════════════════════════════════

▸ REDIS_URL: presente
  protocol:    rediss
  host:        fluent-crappie-117882.upstash.io
  port:        6379
  username:    default
  password:    *** (52 chars)
  tls:         true
  REDIS_REQUIRED: true

▸ Conectando + PING (timeout 4000ms)…
  ✓ ok=true latency=312ms pong=PONG

✅ Redis acessível.
```

Saída quando algo está errado (exemplos):

```
✗ REDIS_URL usa scheme `https://` — esse é o endpoint REST do Upstash.
  Esse formato NÃO funciona com ioredis (que fala TCP+RESP).
  Vá no Upstash → Database → Connect → escolha aba TLS (não REST)…
```

```
  ✗ ok=false latency=4002ms
    errorName:    Error
    errorCode:    ETIMEDOUT
    errorMessage: ping timeout 4000ms

  Hint: timeout. Provedor TLS bloqueado por firewall/proxy, ou o database
        do Upstash está em outra região e a latência saturou o handshake.
```

---

## Diagnóstico — `/api/health`

O endpoint agora carrega um bloco `debug{}` para Redis com **dados não-secretos**
que confirmam o que chegou ao runtime:

```json
{
  "checks": {
    "redis": {
      "ok": false,
      "required": true,
      "latencyMs": 4012,
      "error": "ping timeout 3500ms",
      "errorCode": "ETIMEDOUT",
      "hint": "Timeout conectando no Redis. Confirme que o database Upstash está ativo…",
      "debug": {
        "envPresent": true,
        "protocol": "rediss",
        "host": "fluent-crappie-117882.upstash.io",
        "port": 6379,
        "username": "default",
        "hasPassword": true,
        "tls": true
      }
    }
  }
}
```

Use os campos do `debug{}` para descartar hipóteses na ordem:

| Campo | Sinal |
|---|---|
| `envPresent: false` | Var não chegou ao deployment ativo. **Faça Redeploy SEM cache.** |
| `protocol: "https"` | URL REST. Trocar para a TLS do Upstash. |
| `protocol: "redis"` (sem `s`) | Sem TLS. Em produção sempre `rediss://`. |
| `hasPassword: false` | Senha foi cortada. Reler a URL completa. |
| `tls: false` em prod | Errado. Trocar para `rediss://`. |
| Tudo verde mas `ok: false` | Conferir `errorCode`: `ETIMEDOUT`/`ENOTFOUND`/`NOAUTH`. Hint específico aparece em `hint`. |

---

## Comportamento esperado

### Em produção
- `REDIS_REQUIRED=true` → `/api/health` vira 503 se Redis cair (alerta no Sentry/uptime).
- Rate limit conta em Redis. Quando cluster cair, libera com
  `X-RateLimit-Source: fail-open` (não bloqueia UX em incidente curto).
- Retrieval cache lê/escreve em Redis. Sem Redis, cai para LRU in-memory por instância.

### Em dev (sem Redis)
- `REDIS_URL` vazia → `getRedis()` retorna `null` silenciosamente.
- 1 warn por processo: `[redis] REDIS_URL ausente — operando em modo no-cache.`
- Nenhum spam de `ECONNREFUSED`.
- Rate-limit fail-open. Cache cai para LRU local.

---

## Configuração interna do client (ioredis)

Definida em `src/lib/redis.ts`. Defaults seguros para serverless:

```ts
{
  lazyConnect: true,           // socket abre na 1ª op
  maxRetriesPerRequest: 1,     // fail-fast
  enableOfflineQueue: false,   // nunca pendura request
  enableReadyCheck: true,
  connectTimeout: 5_000,       // TLS Upstash em cold-start ~ 200-1500ms
  commandTimeout: 3_000,       // PING após handshake
  reconnectOnError: () => false,
  retryStrategy: (n) => n > 2 ? null : Math.min(n * 250, 1_000),
  // Quando rediss://: tls: { servername: host } para reforçar SNI
}
```

> Se você muda essas opções, mantenha o princípio: nunca pendurar uma request
> esperando Redis voltar. Em serverless isso esgota a função e gera 504.

---

## Boas práticas

- Use namespaces separados para preview/prod (`REDIS_NAMESPACE`).
- Rotacione tokens trimestralmente (Upstash → Database → Reset Password).
- Não habilite `enableOfflineQueue: true` em código fora do `REDIS_REQUIRED=true`
  — fail-fast é melhor que pendurar requests.
- **Após qualquer mudança em env: Redeploy SEM cache.** Env changes nunca
  alteram deployments existentes.
