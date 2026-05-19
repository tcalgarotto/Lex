# Post-release monitor — 2026-05-19T22:50:17.852Z

| Campo | Valor |
|-------|--------|
| Fase | manual |
| Base URL | https://lex-navy.vercel.app |
| Commit | e1a81f6a2053dfbaf8f560577b04b8a843dce664 |
| Janela logs | 24h |

## Checks

| Check | Status | Detalhe |
|-------|--------|---------|
| ready | PASSOU | HTTP 200 |
| health | PASSOU | HTTP 200, status=ok |
| playwright | PASSOU | 12 passed |
| logs_review | PASSOU | exit 0 |
| db_sample | PASSOU | exit 0 |
| npm_audit | PASSOU | 0 vulnerabilities |
| vercel_logs | PASSOU | queries com hits: 0; findings: 0 |
| inngest | PASSOU | PDF_NO_TEXT/206/500 operacional documentado |
| sentry | PENDENTE | API Sentry indisponível ou resposta inválida |
| langfuse | PARCIAL | smoke falhou (CI sem .env — use LANGFUSE_* nos secrets) |

## Achados por severidade

_Nenhum achado P0–P3 em sinks/logs amostrados._

## Resumo

- **P0:** 0
- **P1:** 0
- **Rollback necessário:** NÃO
- **Próxima janela:** weekly (próxima segunda UTC)

**Não declarar sistema seguro.**
