# Monitoramento pós-release — Release Candidate (FASE 5.8)

**Deploy:** `https://lex-navy.vercel.app`  
**Deployment RC:** `lex-8ipwj4r57` (production, Ready) — commit `509e3ec` (FASE 5.7 docs) + CI automático  
**Data deploy monitorado:** 2026-05-19  

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
| T+24h | _pendente_ | | | | | |
| T+72h | _pendente_ | | | | | |

---

## FASE F — Issues de follow-up

| Issue | Título |
|-------|--------|
| [#12](https://github.com/tcalgarotto/Lex/issues/12) | Estabilizar teste flaky B3.3 (`cross-tenant.integration`) |
| [#13](https://github.com/tcalgarotto/Lex/issues/13) | Fechar peça/minuta E2E completa (guardas 409 drafting) |
| [#14](https://github.com/tcalgarotto/Lex/issues/14) | CSP: remover `style-src 'unsafe-inline'` (P2) |
| [#15](https://github.com/tcalgarotto/Lex/issues/15) | Quota concorrente QC.3b — assert paralelo estável |

---

## Rollback

**Necessário nesta rodada:** **NÃO**

---

## Comandos úteis

```bash
curl -sS https://lex-navy.vercel.app/api/health | jq .status,.flags
E2E_BASE_URL=https://lex-navy.vercel.app npx playwright test tests/e2e/security-qa-staging.spec.ts
npx vercel logs https://lex-navy.vercel.app --since 24h
npm run observability:langfuse:smoke   # local, valida export
```
