# Release Security Gate

Checklist objetiva antes de promover build para produção. **Não substitui** revisão humana nem auditoria legal.

Última atualização: **2026-05-19** (FASE 5.7 — limpeza documental + RC controlado).

---

## Estado final consolidado

| Item | Status |
|------|--------|
| Storage / Auth / Upload | **PASSOU** |
| Storage remoto SR.1–SR.6 | **PASSOU** |
| RAG / Prompt Injection (PI.*) | **PASSOU** |
| Red team sem P0 dinâmico | **PASSOU** |
| Completion provider real (CE.R*) | **PASSOU** — ver evidência abaixo |
| Completion mock (CE.M*) | **PASSOU** |
| Secrets/logs estático | **PASSOU** — P0=0 P1=0 |
| ObservabilityLog (DB) | **PASSOU** |
| Vercel / Sentry / Langfuse (painéis) | **PASSOU** — `EXTERNAL_LOGS_REVIEW.md` (FASE 5.6) |
| QA LQA + Playwright | **PASSOU** — 11/11 + 13/13 |
| Peça E2E (minuta API) | **PARCIAL** — sem vazamento Bravo; geração LLM completa pode retornar 409 (guardas drafting) |
| npm audit | **0** vulnerabilidades |

**Não declarar sistema seguro.**

### CE.R* — evidência (sem contradição)

Com `DEEPSEEK_API_KEY` no `.env` local:

```bash
set -a && . ./.env && set +a
npm run security:red-team:test -- tests/security/red-team/completion-e2e-provider.integration.test.ts
# → 3 passed (CE.R1, CE.R2, CE.G1)

npm run security:red-team:test
# → 113 passed, 0 skipped (inclui CE.R1–CE.R2 na suíte completa)
```

Execução isolada e suíte geral **passam** quando a key está carregada via `.env` + passthrough em `vitest.security.config.ts`. Sem key: CE.R* skipped (comportamento esperado).

---

## Decisão final de release candidate

| Linha | Decisão | Motivo |
|-------|---------|--------|
| **RC não-IA** | **APROVADO** | Storage, SR.*, RAG, red-team, LQA, Playwright, logs estáticos, DB sample, npm audit, painéis externos |
| **RC IA** | **APROVADO** | CE.R* PASSOU (provider real); CE.M* PASSOU; painéis externos; peça com ressalva 409/guardas |
| **Produção sensível** | **APROVADA PARA RELEASE CANDIDATE** | Vercel, Sentry e Langfuse assinados **PASSOU** sem P0/P1 na amostra (`EXTERNAL_LOGS_REVIEW.md` FASE 5.6) |

---

## Pode lançar somente se

| # | Critério | Comando / evidência |
|---|----------|---------------------|
| 1–22 | (inalterado) | ver tabelas anteriores |
| 20 | Completion E2E provider | `completion-e2e-provider` + `DEEPSEEK_API_KEY` |
| 23 | Painéis externos | `EXTERNAL_LOGS_REVIEW.md` assinado **PASSOU** |

---

## Não pode lançar se

- P0 dinâmico em red-team ou secrets scan.
- Cross-tenant em storage/RAG/completion.
- Release **IA crítico** sem `CE.R*` (**atendido** no host com key).
- **Produção sensível** sem Vercel + Sentry + Langfuse **PASSOU** no painel (**atendido** FASE 5.6).

---

## Release Candidate controlado (FASE 5.7)

**Decisão:** promover build com monitoramento pós-deploy — **não** declarar sistema seguro.

| Etapa | Ação |
|-------|------|
| Pré-deploy | Confirmar envs prod: `DATABASE_URL`, Redis, `DEEPSEEK_*`, `LANGFUSE_*`, `NEXT_PUBLIC_SENTRY_DSN`, sem secrets em logs |
| Deploy | Vercel production/preview aprovado; migrations `prisma migrate deploy` se aplicável |
| T+0–1h | Vercel Runtime Logs — sem P0/P1; Sentry — sem eventos reais com dados sensíveis |
| T+0–1h | Langfuse — amostrar traces de chat/minuta (não só smoke); arquivar issues Sentry de `/sentry-example-page` |
| T+24h | Reexecutar `security:logs:review` + amostra DB; reamostrar painéis se houver tráfego de usuários |
| Rollback | Runbook documentado; reverter deploy Vercel se P0 em produção |

---

## Verificação final (FASE 5.7 — 2026-05-19)

```bash
npm run security:storage:hardening-check
npm run security:logs:review
npm run security:sample-observability-logs
set -a && . ./.env && set +a && npm run security:red-team:test
npm run security:legal-qa
npm run lint && npm run typecheck && npm test && npm audit --json
set -a && . ./.env && set +a && npx playwright test tests/e2e/security-qa-staging.spec.ts
```

| Comando | Resultado (rodada 5.7) |
|---------|------------------------|
| `security:storage:hardening-check` | PASSOU |
| `security:logs:review` | PASSOU (P0=0 P1=0) |
| `security:sample-observability-logs` | PASSOU |
| `security:red-team:test` | **113 passed**, 0 skipped |
| `security:legal-qa` | **11 passed** |
| `npm test` | **871/872** — B3.3 intermitente em suite paralela (passa isolado) |
| `lint` / `typecheck` | OK (3 warnings lint) |
| `npm audit` | **0** vulnerabilities |
| Playwright staging | **13 passed** |
| Painéis externos | **PASSOU** (FASE 5.6, revalidado 5.7) |

---

## Setup staging

```bash
npm run security:red-team:setup-auth
npm run security:red-team:staging-check
npm run security:storage:hardening-check
set -a && . ./.env && set +a && npm run security:red-team:test
```

Docs: `EXTERNAL_LOGS_REVIEW.md`, `RED_TEAM_AUDIT_REPORT.md`, `LEGAL_QA_MANUAL_CHECKLIST.md`.
