# Post-release monitor — 2026-06-15T14:46:40.584Z

| Campo | Valor |
|-------|--------|
| Fase | weekly |
| Base URL | https://lex-navy.vercel.app |
| Commit | 2deb01092daec2875d9db8b6e4a1cf01a3dc5219 |
| Janela logs | 24h |

## Checks

| Check | Status | Detalhe |
|-------|--------|---------|
| ready | PASSOU | HTTP 200 |
| health | FALHOU | HTTP 503, status=not-ok (retry) |
| playwright | FALHOU | exit 1 |
| logs_review | PASSOU | exit 0 |
| db_sample | FALHOU | exit 2 |
| npm_audit | FALHOU | 12 vulnerabilities |
| vercel_logs | PASSOU | queries com hits: 11; findings: 0 |
| inngest | PASSOU | PDF_NO_TEXT/206/500 operacional documentado |
| sentry | PENDENTE | API Sentry indisponível ou resposta inválida |
| langfuse | PARCIAL | smoke falhou (CI sem .env — use LANGFUSE_* nos secrets) |

## Achados por severidade

_Nenhum achado P0–P3 em sinks/logs amostrados._

## Resumo

- **P0:** 0
- **P1:** 0
- **Rollback necessário:** SIM
- **Próxima janela:** weekly (próxima segunda UTC)

**Não declarar sistema seguro.**
