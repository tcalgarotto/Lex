# Release Security Gate

Checklist objetiva antes de promover build para produção. **Não substitui** revisão humana nem auditoria legal.

Última atualização: **2026-05-19** (FASE 5.5 — CE.R* na suíte completa + assinatura logs externos).

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
| Vercel / Sentry / Langfuse (painéis) | **PENDENTE** — `EXTERNAL_LOGS_REVIEW.md` |
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
| **RC não-IA** | **APROVADO** | Storage, SR.*, RAG, red-team, LQA, Playwright, logs estáticos, DB sample, npm audit |
| **RC IA** | **APROVADO** | CE.R* PASSOU (provider real); CE.M* PASSOU; peça com ressalva 409/guardas |
| **Produção sensível** | **BLOQUEADO** | Vercel, Sentry e Langfuse **PENDENTE** no painel (sem credenciais de consulta no host FASE 5.5) |

---

## Pode lançar somente se

| # | Critério | Comando / evidência |
|---|----------|---------------------|
| 1–22 | (inalterado) | ver tabelas anteriores |
| 20 | Completion E2E provider | `completion-e2e-provider` + `DEEPSEEK_API_KEY` |
| 23 | Painéis externos | `EXTERNAL_LOGS_REVIEW.md` assinado PASSOU |

---

## Não pode lançar se

- P0 dinâmico em red-team ou secrets scan.
- Cross-tenant em storage/RAG/completion.
- Release **IA crítico** sem `CE.R*` (**atendido** no host com key).
- **Produção sensível** sem Vercel + Sentry + Langfuse **PASSOU** no painel.

---

## Verificação final (FASE 5.5 — 2026-05-19)

```bash
npm run security:storage:hardening-check
npm run security:logs:review
npm run security:sample-observability-logs
set -a && . ./.env && set +a && npm run security:red-team:test
npm run security:legal-qa
npm run lint && npm run typecheck && npm test && npm audit --json
set -a && . ./.env && set +a && npx playwright test tests/e2e/security-qa-staging.spec.ts
```

| Comando | Resultado |
|---------|-----------|
| `security:storage:hardening-check` | PASSOU |
| `security:logs:review` | PASSOU |
| `security:sample-observability-logs` | PASSOU |
| `security:red-team:test` | **113 passed**, 0 skipped (com `DEEPSEEK_API_KEY`) |
| `security:legal-qa` | 11 passed |
| `npm test` | 872 passed (B3.3 pode falhar intermitente em suite paralela) |
| `lint` / `typecheck` | OK |
| `npm audit` | 0 vulnerabilities |
| Playwright staging | **13 passed** |
| Painéis externos | **PENDENTE** |

---

## Setup staging

```bash
npm run security:red-team:setup-auth
npm run security:red-team:staging-check
npm run security:storage:hardening-check
set -a && . ./.env && set +a && npm run security:red-team:test
```

Docs: `EXTERNAL_LOGS_REVIEW.md`, `RED_TEAM_AUDIT_REPORT.md`, `LEGAL_QA_MANUAL_CHECKLIST.md`.
