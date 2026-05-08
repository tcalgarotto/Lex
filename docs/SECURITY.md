# Lex — Decisões de Segurança

Este documento cobre as defesas implementadas, seus limites conhecidos e
o que ainda **não** está implementado. Use como referência ao auditar PRs
ou apontar regressões.

## Resumo executivo

| Frente | Estado | Implementação |
|---|---|---|
| Auth de sessão | ✅ | Supabase SSR cookies (httpOnly, SameSite=Lax) |
| Origin guard / CSRF | ✅ | `src/middleware.ts` bloqueia POST/PATCH/DELETE cross-origin com 403 |
| Headers de segurança | ✅ | CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy |
| Logger anti-vazamento | ✅ | `scrubSecrets()` em `src/lib/logger.ts` + testes |
| Inngest signing key | ✅ | obrigatória em produção; `/api/inngest` retorna 503 sem ela |
| Qdrant tenant isolation (delete) | ✅ | `deleteByDocumentId(documentId, workspaceId)` exige ambos; teste de regressão |
| Rate limiting | ✅ | Redis com fallback memory-LRU; `acquireProviderSlot` para providers públicos |
| Health check com `error/hint` | ✅ | `/api/health` reporta cada dependência com mensagem acionável |
| Secret scanning | ⚠️ | feito via scrub de log; sem CI scanner — atenção em PR |
| WAF / IP allowlist | ❌ | confiamos no Vercel + signing keys; sem WAF dedicado |

## Origin guard (CSRF)

`src/middleware.ts` aplica:

```ts
if (request.method !== "GET" && request.method !== "HEAD") {
  const origin = request.headers.get("origin");
  if (origin) {
    if (originHost !== url.host) {
      // 403 cross-origin blocked — exceto webhooks com signing próprio
    }
  }
}
```

- Mutações sem `Origin` header passam pelo guard, mas **caem no auth check
  do middleware** (`/api/*` exige `user` exceto webhooks). Sem cookie
  Supabase, retorna 401.
- Webhooks isentados: `/api/inngest` (signing key Inngest), `/api/stripe/webhook`
  (signing Stripe). Cada um valida assinatura no próprio handler.
- Limites: ataque que envie `Origin` legítimo via subdomínio comprometido
  passaria. Mitigamos com CSP `frame-ancestors 'none'` e cookies
  `SameSite=Lax`.

## Logger

`src/lib/logger.ts` faz `scrubSecrets()` antes de qualquer `JSON.stringify`:

- **Chaves sensíveis** (recursivo, qualquer profundidade): `password`,
  `passwd`, `pwd`, `secret`, `token`, `access_token`, `refresh_token`,
  `id_token`, `authorization`, `cookie`, `set-cookie`, `bearer`, `jwt`,
  `api_key`, `apikey`, `service_role`, `signing_key`, `event_key`,
  `private_key`, `client_secret`, `salt`, `cpf`, `cnpj`, `rg`, `oab`,
  `email`, `phone`, `telefone`, `celular`.
- **Padrões de valor**: JWT 3-segmentos, `Bearer ...`, password embutida
  em URL (`rediss://user:secret@host`), chaves Stripe `sk_*`.
- Trunca strings > 4 KB.
- Não quebra com referência circular.

Testes: `src/lib/logger.test.ts` (14 cenários, incluindo "não vaza
segredo em log com meta sensível").

## Inngest signing

- `src/lib/inngest/client.ts` exporta `inngestSecuritySnapshot()`.
- Em produção, exige `INNGEST_EVENT_KEY` E `INNGEST_SIGNING_KEY`. Se
  ausentes, `/api/inngest` devolve 503 antes de chamar `serve()`.
- Sem essa proteção, o SDK cai em modo "dev" silenciosamente e qualquer
  POST com payload arbitrário poderia disparar nossas funções (ingestão,
  embeddings, sync).
- `/api/health` inclui o check `inngest` com `required=true` em produção.

## Qdrant — isolamento multi-tenant (delete)

- `VectorStore.deleteByDocumentId(documentId, workspaceId)` — `workspaceId`
  é **obrigatório**. Sem ele, lança erro.
- O filtro Qdrant exige MATCH em **ambos** `documentId` e `workspaceId`.
  Defesa em profundidade contra:
  - colisão de id (cuid é único globalmente, mas defesa contra input
    malicioso vale a pena);
  - bug futuro que confunda ids entre tenants.
- Testes: `src/lib/retrieval/vector-store/qdrant-store.test.ts` cobre
  rejeição sem workspaceId, sem documentId, e MATCH AND no filtro.

## Headers (middleware)

```text
Content-Security-Policy: default-src 'self'; connect-src 'self' https://*.supabase.co ... ;
                         script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
                         img-src 'self' data: blob: https:; font-src 'self' data:;
                         frame-ancestors 'none'; base-uri 'self'; object-src 'none';
                         form-action 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload   # apenas em prod
```

Notas:
- `'unsafe-inline'` em `script-src` permitido por causa do Tailwind/Tiptap.
  Plano futuro: nonce + remoção do `unsafe-inline`.
- `'unsafe-eval'` só em dev (Turbopack precisa).

## Não implementado (com motivo)

- **Token CSRF próprio**: não usamos. Origin guard + cookies `SameSite=Lax`
  cobrem o vetor principal. Adicionar token só faria sentido se
  expuséssemos forms cross-origin legítimos (não é o caso).
- **WAF dedicado**: confiamos no Vercel edge + autenticação. Endpoints
  públicos (`/api/health`, `/api/ready`) não modificam estado.
- **Audit log centralizado**: `Activity` table cobre eventos de domínio;
  acesso direto ao DB é via Prisma (logado por `prisma:query`). Sem SIEM.

## Como reportar problema

- Pesquisar `docs/audits/AUDIT_SECURITY.md` antes de abrir issue.
- Para crédito: PR com teste de regressão demonstrando o bug, sem expor
  payload em texto claro.
