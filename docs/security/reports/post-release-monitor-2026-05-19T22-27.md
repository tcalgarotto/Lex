# Post-release monitor — 2026-05-19T22:27:03.995Z

| Campo | Valor |
|-------|--------|
| Fase | t72 |
| Base URL | https://lex-navy.vercel.app |
| Commit | 1a16850d20b5 |
| Janela logs | 72h |

## Checks

| Check | Status | Detalhe |
|-------|--------|---------|
| ready | PASSOU | HTTP 200 |
| health | PASSOU | HTTP 200, status=ok |
| playwright | PASSOU | 13 passed |
| logs_review | PASSOU | exit 0 |
| db_sample | PASSOU | exit 0 |
| npm_audit | PASSOU | 0 vulnerabilities |
| vercel_logs | PENDENTE | VERCEL_TOKEN ausente |
| inngest | PENDENTE | VERCEL_TOKEN ausente |
| sentry | NÃO EXECUTADO | SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT ausente |
| langfuse | PARCIAL | smoke OK; sem traces reais além de langfuse-smoke-test |

## Achados por severidade

_Nenhum achado P0–P3 em sinks/logs amostrados._

## Resumo

- **P0:** 0
- **P1:** 0
- **Rollback necessário:** NÃO
- **Próxima janela:** weekly / T+7d

**Não declarar sistema seguro.**
