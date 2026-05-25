# JustOS Pro CRM — status de implementação

**Atualizado:** 2026-05-25 · Kommo parity sprint

## Concluído

### Base
- [x] Prisma CRM + RLS + migration foundation
- [x] APIs `/api/crm/*`, UI contacts/pipeline/inbox/automations
- [x] Asaas único, Stripe removido, anti-duplicidade
- [x] JustOS Command `:3301`, OpenClaw process-per-workspace
- [x] Teste 2 workspaces PASS

### Kommo sprint (esta rodada)
- [x] `CrmActivity` + migration `20260525120000_crm_activity_timeline`
- [x] Timeline service + APIs activities/tasks
- [x] Automação engine (inbound → tarefa/follow-up)
- [x] Inbox filtros API (`unread`, `q`, `stage`, `caseId`, `assignedTo`)
- [x] Inbox UI: busca, não lidas, poll, templates, lateral, link caso, follow-up
- [x] Reports: overview + funnel/messages/tasks/wa-health
- [x] Doctors: `justos:wa:doctor`, `command`, `crm`, `asaas`
- [x] `npm run typecheck` + `npm run build` verdes
- [x] Gap report + Kommo ready report

## Parcial

- [ ] WhatsApp outbound real (`JUSTOS_CRM_ENABLE_WA_SEND` no env)
- [ ] QR escaneado (BLOCKED_BY_HUMAN_INPUT)
- [ ] Pipeline drag/drop + aging + cards ricos
- [ ] Automações persistidas + logs execução
- [ ] Dashboard gráficos + tempo médio resposta
- [ ] Multiusuário RBAC completo
- [ ] Mídia download seguro
- [ ] Fila outbound / retry / DLQ
- [ ] E2E Playwright autenticado

## Comandos

```bash
npm run justos:crm:test-two-workspaces
npm run justos:wa:doctor
bash scripts/test-justos-crm-kommo-parity.sh
npx vitest run tests/unit/no-stripe-provider.test.ts tests/unit/asaas-webhook.test.ts
```

## Relatórios

- `reports/JUSTOS_PRO_CRM_KOMMO_PARITY_GAP_REPORT.md`
- `reports/JUSTOS_PRO_CRM_KOMMO_READY_REPORT.md`
- `docs/JUSTOS_PRO_CRM_EXECUTION_TRACKER.md`
