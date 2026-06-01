# Post-release monitor — 2026-06-01T14:42:32.223Z

| Campo | Valor |
|-------|--------|
| Fase | weekly |
| Base URL | https://lex-navy.vercel.app |
| Commit | 89bc5b2610db2b137a2c6c02528d0d4dbdf84f57 |
| Janela logs | 24h |

## Checks

| Check | Status | Detalhe |
|-------|--------|---------|
| ready | PASSOU | HTTP 200 |
| health | PASSOU | HTTP 200, status=ok |
| playwright | PASSOU | 12 passed |
| logs_review | PASSOU | exit 0 |
| db_sample | PASSOU | exit 0 |
| npm_audit | FALHOU | 6 vulnerabilities |
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
