# Post-release monitor — 2026-05-25T12:08:45.361Z

| Campo | Valor |
|-------|--------|
| Fase | daily |
| Base URL | https://lex-navy.vercel.app |
| Commit | 4c08cfbc2aee00a634478bc6284be602cb990b4b |
| Janela logs | 24h |

## Checks

| Check | Status | Detalhe |
|-------|--------|---------|
| ready | PASSOU | HTTP 200 |
| health | PASSOU | HTTP 200, status=ok |
| playwright | PASSOU | 13 passed |
| logs_review | PASSOU | exit 0 |
| db_sample | PASSOU | exit 0 |
| npm_audit | PASSOU | 0 vulnerabilities |
| vercel_logs | PASSOU | queries com hits: 11; findings: 0 |
| inngest | PASSOU | PDF_NO_TEXT/206/500 operacional documentado |
| sentry | PENDENTE | API Sentry indisponível ou resposta inválida |
| langfuse | PARCIAL | smoke falhou (CI sem .env — use LANGFUSE_* nos secrets) |

## Achados por severidade

_Nenhum achado P0–P3 em sinks/logs amostrados._

## Resumo

- **P0:** 0
- **P1:** 0
- **Rollback necessário:** NÃO
- **Próxima janela:** daily (amanhã UTC) ou T+72h

**Não declarar sistema seguro.**
