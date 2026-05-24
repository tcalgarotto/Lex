# Monitoramento pós-release — Release Candidate (FASE 5.8)

**Deploy:** `https://lex-navy.vercel.app`  
**Deployment RC:** `lex-8ipwj4r57` (production, Ready) — commit `509e3ec` (FASE 5.7 docs) + CI automático  
**Data deploy monitorado:** 2026-05-19  
**Última reamostragem:** 2026-05-19 (FASE 5.9 — T+24h)

**Não declarar sistema seguro.**

---

## FASE A — Pré-deploy (checklist)

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1 | `DATABASE_URL` / `DIRECT_URL` | OK | `/api/health` → `db.ok: true` |
| 2 | `REDIS_URL` + `REDIS_REQUIRED=true` | OK | health: `redis.ok`, `flags.REDIS_REQUIRED: true` |
| 3 | `RATE_LIMIT_FAIL_CLOSED` (prod) | OK | fail-closed em prod (sem `RATE_LIMIT_FAIL_OPEN_DEV` no health) |
| 4 | `DEEPSEEK_API_KEY` | OK | providers AI ativos; CE.R* PASSOU no gate |
| 5 | `LANGFUSE_*` | OK | configurado localmente; smoke PASSOU (5.6) |
| 6 | `NEXT_PUBLIC_SENTRY_DSN` | OK | Sentry integrado; eventos teste controlados (5.6) |
| 7 | `SUPABASE_SERVICE_ROLE_KEY` server-side | OK | nunca em logs Vercel (busca 2h: 0 hits) |
| 8 | `RATE_LIMIT_FAIL_OPEN_DEV` ausente em prod | OK | inferido por comportamento prod + health |
| 9 | Bucket `documents` privado | OK | gate SR.* + hardening-check histórico |
| 10 | Policies Storage | OK | `npm run security:storage:hardening-check` (rodada 5.7) |
| 11 | Runbook rollback | OK | `docs/security/PRODUCTION_ROLLBACK_RUNBOOK.md` |

---

## FASE B — Deploy

| Etapa | Status | Notas |
|-------|--------|-------|
| Promover build RC (Vercel) | **FEITO** | Auto-deploy `main` → production Ready |
| `prisma migrate deploy` | **N/A** | `prisma migrate status` → schema up to date (37 migrations) |
| `GET /api/ready` | **200** | |
| `GET /api/health` | **200** | db, redis, qdrant, supabase, inngest OK |
| Login / dashboard / casos | **OK** | Playwright prod 13/13 (smoke) |

---

## FASE C — Smoke pós-deploy (produção)

Comando:

```bash
set -a && . ./.env && set +a
E2E_BASE_URL="https://lex-navy.vercel.app" npx playwright test tests/e2e/security-qa-staging.spec.ts
```

| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | Login | PASSOU |
| 2 | Casos workspace A | PASSOU |
| 3 | Upload PDF válido | PASSOU |
| 4 | Upload PDF falso → 415 | PASSOU |
| 5 | Download / doc cross-tenant | PASSOU |
| 6 | Pesquisa RAG sem Bravo | PASSOU |
| 7 | Estratégia / completion IA | PASSOU (API) |
| 8 | Minuta/peça API | PASSOU (sem Bravo) |
| 9 | DevTools sem token na rede | PASSOU |

**Smoke pós-deploy:** **PASSOU** (13/13 em `lex-navy.vercel.app`).

---

## FASE D — Monitoramento T+0–1h

### Vercel Runtime Logs

Busca CLI (`vercel logs --since 2h --query <padrão>`): **0 hits** para  
`service_role`, `SUPABASE_SERVICE_ROLE`, `DEEPSEEK`, `sk-`, `Bearer`, `eyJ`, `segredo ultra confidencial Bravo`, `extractedText`, `SYSTEM_BASE`.

Amostra manual: mensagens `env-normalize`, Inngest, `GET /api/health` 200.

**Vercel T+0–1h:** **PASSOU**

### Sentry T+0–1h

- Gate 5.6: apenas eventos controlados `/sentry-example-page`.
- Pós-deploy smoke: sem novos erros reportados no Playwright.
- **Ação manual recomendada:** arquivar/resolver issues de teste no painel Sentry.

**Sentry T+0–1h:** **PASSOU** (sem evento real crítico na janela; reamostrar após tráfego)

### Langfuse T+0–1h

- Gate 5.6: smoke `langfuse-smoke-test` sem dados sensíveis.
- Traces de chat/minuta em produção: **reamostrar** quando houver uso real (não bloqueante para RC).

**Langfuse T+0–1h:** **PASSOU** (smoke histórico; amostra real pendente de tráfego)

---

## FASE E — T+24h e T+72h (agenda)

| Quando | Ações |
|--------|--------|
| **T+24h** (2026-05-20) | Reamostrar Vercel/Sentry/Langfuse; `npm run security:logs:review`; `npm run security:sample-observability-logs` |
| **T+72h** (2026-05-22) | Idem; atualizar tabela abaixo; se P0/P1 → rollback (`PRODUCTION_ROLLBACK_RUNBOOK.md`) |

### Registro de reamostragens

| Janela | Responsável | Vercel | Sentry | Langfuse | DB sample | Notas |
|--------|-------------|--------|--------|----------|-----------|-------|
| T+0–1h | Cursor Agent | PASSOU | PASSOU* | PASSOU* | — | *smoke/histórico |
| T+24h | Cursor Agent (5.9 + **5.9.1**) | PASSOU† | PASSOU | PARCIAL | PASSOU | †Playwright/Inngest corrigidos em 5.9.1 |
| T+72h | github-actions | PASSOU | PENDENTE | PARCIAL | PASSOU | relatório [docs/security/reports/post-release-monitor-2026-05-23T10-17.md](docs/security/reports/post-release-monitor-2026-05-23T10-17.md); cron FASE 5.10 |
| Daily 2026-05-24 | github-actions | PASSOU | PENDENTE | PARCIAL | PASSOU | relatório [docs/security/reports/post-release-monitor-2026-05-24T10-23.md](docs/security/reports/post-release-monitor-2026-05-24T10-23.md); cron FASE 5.10 |
---

## FASE 5.9 — Reamostragem T+24h (2026-05-19)

### FASE A — Health e smoke

| Check | Resultado |
|-------|-----------|
| `GET /api/ready` | **PASSOU** (200, `ready: true`) |
| `GET /api/health` | **PASSOU** (200, `status: ok`, db/redis/qdrant/supabase/inngest OK) |
| Playwright prod (`security-qa-staging`) | **PASSOU** (13/13) — ver comando canônico § 5.9.1 |

### FASE B — Vercel logs T+24h

Busca `vercel logs --since 24h --query <padrão>`: **0 hits** para  
`service_role`, `SUPABASE_SERVICE_ROLE`, `DEEPSEEK_API_KEY`, `sk-`, `Bearer`, `eyJ`, `cookie`, `segredo ultra confidencial Bravo`, `extractedText`, `SYSTEM_BASE`, `prompt integral`.

**Vercel T+24h:** **PASSOU** — sem P0/P1 na amostra CLI.

### FASE C — Sentry T+24h

- Playwright prod 13/13 sem falhas de erro exposto na rede (UI.4).
- Sem novos padrões proibidos em logs Vercel na janela.
- Baseline 5.6/5.8: apenas eventos controlados `/sentry-example-page`; **recomendado** arquivar issues de teste no painel se ainda abertas.

**Sentry T+24h:** **PASSOU** (sem incidente real novo detectado na rodada automatizada).

### FASE D — Langfuse T+24h

- Sem API de painel nesta rodada; tráfego real de chat/minuta em produção **não confirmado** na janela.
- Baseline smoke `langfuse-smoke-test` (5.6) permanece válida; sem regressão reportada.

**Langfuse T+24h:** **PARCIAL** — sem traces reais de uso em prod na amostra; **reamostrar T+72h** após tráfego ou exercício manual de chat.

### FASE E — Scripts locais

| Comando | Resultado |
|---------|-----------|
| `security:logs:review` | **PASSOU** (P0=0 P1=0) |
| `security:sample-observability-logs` | **PASSOU** (200 registros) |
| `npm audit` | **0** vulnerabilities |

### Rollback T+24h

**Necessário:** **NÃO**

---

## FASE 5.9.1 — Correção evidência T+24h (Playwright + Inngest)

### Playwright T+24h — causa do “No tests found”

O spec `tests/e2e/security-qa-staging.spec.ts` existe, mas só roda no projeto **`chromium-auth`** (depende de `auth.setup.ts` + credenciais no `.env`).

**Comando canônico (produção):**

```bash
set -a && . ./.env && set +a
E2E_BASE_URL=https://lex-navy.vercel.app npx playwright test \
  --config=playwright.config.ts \
  --project=chromium-auth \
  tests/e2e/security-qa-staging.spec.ts
```

Sem `--project=chromium-auth` (ou sem `SUPABASE_TEST_USER_*` / `E2E_USER_*`), o Playwright pode reportar **“No tests found”**.

**Reexecução 5.9.1:** **PASSOU** — **13/13** (2026-05-19).

### `/api/inngest` — 500 / 400 / 206 (investigado)

| Status | Mensagem (amostra Vercel 24h) | Classificação |
|--------|------------------------------|---------------|
| GET/PUT **200** | sync Inngest (`env-normalize`) | OK — chaves presentes |
| POST **206** | steps Inngest (pipeline parcial) | **P3** operacional esperado |
| POST **400** / **206** | `NonRetriableError: PDF_NO_TEXT` | **P3** — PDF sem texto (uploads de teste QA) |
| POST **500** | sem detalhe na UI CLI; correlaciona com falhas de step | **P2** operacional — investigar job específico se recorrente |

**Config produção (`/api/health`):** `inngest.ok: true`, `hasEventKey: true`, `hasSigningKey: true`, `appId: lex-production`.

**Não é:** “No signing key” / “No event key” em produção (sync 200). O truncamento `Error [No...` nos logs = **`NonRetriableError`** (ex.: `PDF_NO_TEXT`), não vazamento de secret.

**Ação:** nenhuma correção de env obrigatória para RC. Opcional: melhorar logging do step que retorna 500; tratar thumbnail `Event key not found` no **send** client-side como não-fatal (já logado).

**Inngest 500/400:** **EXPLICADO** (sem P0/P1; sem rollback).

### Revalidação 5.9.1

| Check | Resultado |
|-------|-----------|
| `/api/ready` | 200 |
| `/api/health` | `ok`, flags prod |
| Playwright (comando acima) | **13/13** |
| Vercel P0/P1 (24h) | **0** hits |
| Langfuse smoke | **PASSOU** (`ok`) |
| DB sample | **PASSOU** |
| `npm audit` | **0** |

---

## FASE F — Issues de follow-up

| Issue | Título |
|-------|--------|
| [#12](https://github.com/tcalgarotto/Lex/issues/12) | Estabilizar teste flaky B3.3 (`cross-tenant.integration`) |
| [#13](https://github.com/tcalgarotto/Lex/issues/13) | Fechar peça/minuta E2E completa (guardas 409 drafting) |
| [#14](https://github.com/tcalgarotto/Lex/issues/14) | CSP: remover `style-src 'unsafe-inline'` (P2) |
| [#15](https://github.com/tcalgarotto/Lex/issues/15) | Quota concorrente QC.3b — assert paralelo estável |

---

## Rollback (histórico)

| Rodada | Necessário |
|--------|------------|
| T+0–1h (5.8) | NÃO |
| T+24h (5.9) | NÃO |
| T+72h dry-run script (5.10 local) | NÃO |

---

## FASE 5.10 — Cron automático (validação local 2026-05-19)

Script: `scripts/security-audit/post-release-monitor.ts` — workflow `.github/workflows/post-release-monitor.yml`.

| Check (local, sem `VERCEL_TOKEN` / `SENTRY_*`) | Resultado |
|--------------------------------------------------|-----------|
| `GET /api/ready` / `health` | PASSOU |
| Playwright prod (`chromium-auth`, 13 cenários) | PASSOU |
| `security:logs:review` | PASSOU |
| `security:sample-observability-logs` | PASSOU |
| `npm audit` | PASSOU (0) |
| Vercel logs / Inngest | PENDENTE (secrets no CI) |
| Sentry API | NÃO EXECUTADO (secrets no CI) |
| Langfuse | PARCIAL (smoke OK; traces reais pendentes) |

**Exit code:** 0 (sem P0/P1 em checks core).  
**Relatório:** `docs/security/reports/post-release-monitor-2026-05-19T22-27.md`  
**Próxima rodada oficial T+72h:** 2026-05-22 (~08:37 UTC, fase `auto` → `t72`).

---

## Comandos úteis

```bash
curl -sS https://lex-navy.vercel.app/api/ready
curl -sS https://lex-navy.vercel.app/api/health | jq .status,.flags,.checks.inngest
set -a && . ./.env && set +a
E2E_BASE_URL=https://lex-navy.vercel.app npx playwright test \
  --config=playwright.config.ts --project=chromium-auth \
  tests/e2e/security-qa-staging.spec.ts
npx vercel logs https://lex-navy.vercel.app --since 24h --query inngest
npm run observability:langfuse:smoke
```


## Cron automático (FASE 5.10)

| Frequência | Janela | Ação |
|------------|--------|------|
| Manual | quando necessário | `workflow_dispatch` |
| Diário 08:37 UTC | 1ª semana pós-RC | health, logs, Sentry, Langfuse, DB, Playwright |
| Semanal 09:43 UTC (seg) | semanas 2–4 pós-RC | idem |
| T+72h | ~72h após deploy | rodada obrigatória (`POST_RELEASE_PHASE=t72`) |

GitHub Actions usa **UTC**; o horário real pode atrasar alguns minutos — a evidência é o relatório em `docs/security/reports/`.

Workflow: `.github/workflows/post-release-monitor.yml`

### Secrets GitHub (Actions)

Configure em **Settings → Secrets and variables → Actions** (nunca commitar valores):

- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`
- `DATABASE_URL`, `DIRECT_URL` (opcional)
- `DEEPSEEK_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TEST_USER_A_EMAIL`, `SUPABASE_TEST_USER_A_PASSWORD`
- `SUPABASE_TEST_USER_B_EMAIL`, `SUPABASE_TEST_USER_B_PASSWORD`

Scripts: `npm run security:post-release:monitor`, `security:post-release:t72`, etc.
