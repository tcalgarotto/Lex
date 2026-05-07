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

> Crons sub-diários (alerts/integrations) **rodam dentro do Inngest Cloud**,
> independentes da Vercel — então o plano Hobby da Vercel não é limitação
> aqui. Veja `docs/DEPLOYMENT.md` §6.1.

## Endpoint de serve

`src/app/api/inngest/route.ts` exporta `GET`, `POST`, `PUT` via `serve()`:

- `runtime = "nodejs"` (Inngest depende de APIs do Node).
- `dynamic = "force-dynamic"` (sempre dinâmico).
- `maxDuration = 300` (steps longas em corpus ingest). Em Vercel Hobby
  o valor é silenciosamente capado para o limite do plano (60s); em Pro
  respeita 300s.
- App ID resolvido em `src/lib/inngest/client.ts` via `INNGEST_APP_ID`
  (fallback `lex-production`). Manter o ID estável é o que permite
  Inngest Cloud encontrar e atualizar funções a cada deploy.

## Setup

1. https://app.inngest.com → New App → `lex-production`.
2. Settings → Event Keys → copie para `INNGEST_EVENT_KEY`.
3. Settings → Signing Key → copie para `INNGEST_SIGNING_KEY`.
4. Vercel envs (Production):
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`
   - `INNGEST_APP_ID=lex-production`
5. Vercel envs (Preview): apontar para outro app, ex.: `INNGEST_APP_ID=lex-preview`.
6. **Antes de sincronizar, garantir que `/api/inngest` esteja acessível** (veja
   próxima seção). Sem isso o Inngest mostra "No syncs found".
7. Inngest Console → Apps → `lex-production` → **Sync**.
   - URL: `https://lex-navy.vercel.app/api/inngest`
8. Inngest descobre todas as funções automaticamente.

---

## Troubleshooting — "No syncs found"

Esse erro tem causas precisas. Em ordem de incidência:

### 1. Vercel Authentication (Deployment Protection) bloqueia a rota

Sintoma: `curl https://<dominio>/api/inngest` retorna **HTML 401** com
"Authentication Required" ou JSON `{"message":"Unauthorized"}` da Vercel.

Causa: por padrão a Vercel ativa "Vercel Authentication" em deploys protegidos
(team plans), o que faz a infra interceptar **todas** as requisições antes do
app rodar. Inngest Cloud não consegue autenticar contra esse gateway, então
acha que o endpoint não existe.

#### Opção A — desativar para Production (recomendado para o primeiro teste)

1. Vercel → Project Settings → **Deployment Protection**.
2. Em "Vercel Authentication", desligue **Production** (preview pode continuar
   protegido).
3. Re-deploy ou aguardar próximo push.
4. `curl https://<dominio>/api/inngest` deve retornar 200 com JSON Inngest.

#### Opção B — manter protegido + Protection Bypass for Automation

1. Vercel → Project Settings → Deployment Protection → **Protection Bypass for Automation**.
2. Crie um token (ex.: `INNGEST_BYPASS_TOKEN`).
3. Inngest Console → Apps → `lex-production` → Settings → **Custom Headers**:
   - `x-vercel-protection-bypass: <token>`
   - `x-vercel-set-bypass-cookie: true` (opcional, mantém cookie no client)
4. Inngest passa a anexar o header em todas as chamadas, e a Vercel libera.

> A opção B mantém preview seguro contra acesso público. Mais fricção mas
> recomendada para clientes/dados sensíveis.

### 2. Signing key / App ID mismatch

Sintoma: `curl /api/inngest` retorna **JSON 401** com `"Invalid signature"` ou
similar — corpo é JSON, não HTML.

Causa: `INNGEST_SIGNING_KEY` na Vercel difere do valor mostrado em
`https://app.inngest.com/env/<env>/manage/signing-key`.

Solução:
1. Inngest Console → Settings → Signing Key → "Reveal" → copie.
2. Vercel → Project → Settings → Environment Variables → atualize
   `INNGEST_SIGNING_KEY` (Production e Preview com valores distintos se usar
   apps separados).
3. Re-deploy (Vercel só promove envs em novo build).

Mesmo procedimento para `INNGEST_APP_ID` se a console reclamar de id desconhecido.

### 3. Endpoint deployado em URL errada

Sintoma: `curl /api/inngest` retorna **404**.

Causas comuns:
- A URL informada no Inngest é uma branch preview que já caducou.
- O custom domain ainda não propagou.
- Tem `next.config.ts` com `output: "export"` (estático) — incompatível com Inngest.

Solução: usar a URL **canônica de Production** (não a `https://<branch>-<hash>.vercel.app`).

### 4. Preview foi sincronizado mas Production não

Inngest mantém **um app por URL deployada**. Se você sincronizou apenas a
preview URL, a Production aparece "No syncs found". Sincronize as duas (ou
use apps separados via `INNGEST_APP_ID`).

---

## Diagnóstico rápido

Use o script:

```bash
INNGEST_SERVE_ORIGIN=https://lex-navy.vercel.app npm run inngest:check
```

Saída classifica a falha:

| Verdict | Significado |
|---|---|
| `OK` | Endpoint disponível, Inngest sincroniza. |
| `VERCEL-AUTH` | Deployment Protection bloqueia. Use opção A ou B acima. |
| `INNGEST-AUTH` | Signing key/App ID mismatch. |
| `NOT-FOUND` | Rota não deployada. |
| `SERVER-ERROR` | App quebrou — abrir Vercel Function logs. |

Exit code != 0 quando algo claramente impede o sync — bom para gate de CI.

---

## Configuração padrão das funções

Cada função tem:
- `retries: 3` (com exponential backoff)
- `concurrency: { limit: 5 }` (evita burst contra DB/LLM)
- `throttle: { limit: 100, period: "1m" }` (proteção do orçamento de IA)

## Logs / observabilidade

- Dashboard Inngest: lista runs com status, latency, payload.
- Sentry: erros não-recuperáveis chegam via `captureException` no run.
- Vercel Function logs: cada execução do endpoint `/api/inngest` aparece.

## Smoke test

```bash
# Disparar evento
curl -X POST https://lex-navy.vercel.app/api/inngest \
  -H "content-type: application/json" \
  -H "x-inngest-event-key: $INNGEST_EVENT_KEY" \
  -d '{"name":"lex/corpus.sync.requested","data":{"workspaceId":"<id>"}}'
```

Verifique no console Inngest se o run apareceu e teve status `Completed`.

## Quando NÃO usar Inngest

- Operação síncrona da UI (intake, drafting, review, retrieval) → roda inline.
- Apenas operações **idempotentes, retentáveis e batchable** vão para Inngest.

## Diferença preview/prod

Use **dois apps Inngest separados** (`lex-preview` e `lex-production`) com
keys e App IDs distintos. Isso evita que um job em preview dispare cron contra
dados de produção. Configure via `INNGEST_APP_ID` em cada Environment da Vercel.
