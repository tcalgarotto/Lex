# JustOS Pro CRM — security release checklist

| Item | Status | Notas |
|------|--------|-------|
| Secrets não commitados (.env.local gitignored) | PASS | |
| ASAAS_API_KEY / WEBHOOK_TOKEN fora do repo | PASS | |
| Webhook Asaas valida `asaas-access-token` | PASS | Produção exige token |
| Webhook idempotente (`JustosBillingEvent`) | PASS | migration aplicada |
| CSRF isento só `/api/asaas/webhook`, inbound Command | PASS | |
| APIs CRM não aceitam workspaceId do client | PASS | sessão server-side |
| `requireJustosPro` em rotas CRM/WA | PASS | |
| Inbound exige `JUSTOS_COMMAND_SECRET` + headers | PASS | |
| Opt-out bloqueia outbound | PASS | `appendCrmMessage` |
| Logs sem corpo completo (hash) | PASS | `bodyHash` em metaJson |
| RLS CRM habilitado | PASS | migration `20260525100100` |
| Stripe provider removido | PASS | 410 + teste |
| SOLD :3300 não usado em workflow JustOS | PASS | `justos-case-secretary.json` |
| `JUSTOS_USE_LEGACY_BRIDGE=false` default | PASS | |
| Teste 2 workspaces DB | PASS | 2026-05-25 |
| Asaas E2E Sandbox pagamento | BLOCKED_BY_CREDENTIAL | tunnel + chave |
| WA QR pairing real | BLOCKED_BY_CREDENTIAL | OpenClaw |
