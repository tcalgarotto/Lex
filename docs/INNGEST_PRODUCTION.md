# Inngest Cloud — produção

## Funções registradas

O Lex tem as seguintes funções Inngest (em `src/lib/inngest/`):

| Função | Trigger | Frequência |
|---|---|---|
| Document ingestion | `lex/document.uploaded` | sob demanda |
| Corpus sync (norms) | `lex/corpus.sync.requested` + cron | diário |
| Corpus ingest (worker) | `lex/corpus.ingest-norm` (filhote) | sob demanda |
| Memory update | `lex/memory.refresh.requested` | sob demanda |
| Style profile update | `lex/style.refresh.requested` | sob demanda |
| Alerts sync | `lex/alerts.sync.requested` + cron | a cada 30 min |
| Integrations sync | `lex/integrations.sync.requested` + cron | a cada 30 min |

## Setup

1. https://app.inngest.com → New App → `lex-production`.
2. Settings → Event Keys → copie para `INNGEST_EVENT_KEY`.
3. Settings → Signing Key → copie para `INNGEST_SIGNING_KEY`.
4. Vercel envs:
   - `INNGEST_EVENT_KEY` (prod + preview com keys distintas)
   - `INNGEST_SIGNING_KEY`
   - `INNGEST_APP_ID=lex-production`
5. Após o primeiro deploy, registre o endpoint:
   - Inngest Console → Apps → `lex-production` → "Sync"
   - URL: `https://lex.suapdominio.com.br/api/inngest`
6. Inngest descobrirá todas as funções automaticamente.

## Configuração padrão

Cada função tem:
- `retries: 3` (com exponential backoff)
- `concurrency: { limit: 5 }` (evita burst contra DB/LLM)
- `throttle: { limit: 100, period: "1m" }` (proteção do orçamento de IA)

## Logs / observability

- Dashboard Inngest: lista runs com status, latency, payload.
- Sentry: erros não-recuperáveis chegam via `captureException` no run.
- Vercel Function logs: cada execução do endpoint `/api/inngest` aparece.

## Smoke test

```bash
# Disparar evento
curl -X POST https://lex.suapdominio.com.br/api/inngest \
  -H "content-type: application/json" \
  -H "x-inngest-event-key: $INNGEST_EVENT_KEY" \
  -d '{"name":"lex/corpus.sync.requested","data":{"workspaceId":"<id>"}}'
```

Verifique no console Inngest se o run apareceu e teve status `Completed`.

## Quando NÃO usar Inngest

- Operação síncrona da UI (intake, drafting, review, retrieval) → roda inline.
- Apenas operações **idempotentes, retentáveis e batchable** vão para Inngest.

## Diferença preview/prod

Use **dois apps Inngest separados** (`lex-preview` e `lex-production`) com keys distintos. Isso evita que um job em preview dispare cron contra dados de produção.
