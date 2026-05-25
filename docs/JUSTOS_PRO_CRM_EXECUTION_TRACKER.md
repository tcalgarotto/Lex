# JustOS Pro CRM — execution tracker

**Atualizado:** 2026-05-25 · Kommo parity

| Área | Status | Notas |
|------|--------|-------|
| Asaas billing | DONE | Idempotência, webhook, Pix/cartão embutido |
| Stripe removal | DONE | 410 + unit tests |
| Command/WA multi-tenant | PARTIAL | process-per-workspace; QR humano pendente |
| Inbox E2E | PARTIAL | UI Kommo-lite; outbound env off |
| CrmActivity timeline | DONE | Migration aplicada + APIs |
| Automações | PARTIAL | Engine + UI templates; persistência TODO |
| Pipeline Kommo | PARTIAL | Board; drag/aging TODO |
| Reports/dashboard | PARTIAL | APIs funnel/messages/tasks/wa-health |
| Multiusuário RBAC | PARTIAL | assignedToUserId; permissões TODO |
| Doctors | DONE | wa/command/crm/asaas |
| E2E Kommo matrix | PARTIAL | Shell + unit; Playwright skipped |
| RLS | DONE | Migration aplicada |
| Teste 2 tenants | DONE | PASS |

## Baseline 2026-05-25 (Kommo Fase 0)

- `prisma validate` — OK
- `prisma migrate deploy` — `20260525120000_crm_activity_timeline` OK
- `typecheck` / `build` — OK
- `justos:crm:test-two-workspaces` — PASS
- `npm test` — 985 pass; 2 red-team timeout (fora escopo)

## Bloqueios externos

| Item | Motivo |
|------|--------|
| QR pairing 2 números | BLOCKED_BY_HUMAN_INPUT |
| Asaas E2E pagamento real | BLOCKED_BY_CREDENTIAL |
| Outbound staging | Env `JUSTOS_CRM_ENABLE_WA_SEND=true` |

## Próximo

1. Habilitar send em staging + validar 1 QR
2. Pipeline drag/drop
3. E2E autenticado no CI
