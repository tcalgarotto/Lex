# JustOS Pro CRM — Kommo Parity Gap Report

**Data:** 2026-05-25  
**Repo:** `/home/thales/Projetos/Lex`  
**Referência:** Kommo (pipeline, inbox, automações, equipe, relatórios)

## Baseline (Fase 0)

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | OK |
| `npx prisma migrate status` | OK (migration `20260525120000_crm_activity_timeline` aplicada) |
| `npm run typecheck` | OK |
| `npm run lint` | 1 erro pré-existente + warnings (não CRM) |
| `npm test` | 985 pass / 2 fail (red-team timeout, não JustOS) |
| `npm run build` | OK |
| `justos:crm:test-two-workspaces` | PASS |
| Vitest JustOS/Asaas unit | 12 pass |

## Matriz pronto / parcial / mock / bloqueado

| Área | Status | Notas |
|------|--------|-------|
| Prisma CRM + RLS | **Pronto** | Contatos, conversas, mensagens, sessão WA |
| Asaas Pro único | **Pronto** | Anti-duplicidade, webhook, Pix/cartão embutido |
| APIs `/api/crm/*` base | **Pronto** | Inbox, pipeline, contacts, export LGPD |
| WhatsApp sessionKey | **Pronto** | Por workspace, testes unitários |
| OpenClaw process-per-workspace | **Parcial** | Código + Command OK; 2 QR reais não validados |
| QR no site | **Parcial** | UI + API; **BLOCKED_BY_HUMAN_INPUT** escanear |
| Inbound real | **Parcial** | API OK; depende sessão conectada |
| Outbound inbox | **Parcial** | `JUSTOS_CRM_ENABLE_WA_SEND=false` no `.env.local` atual |
| Inbox UI Kommo | **Parcial** | Filtros, poll 8s, templates, lateral, link caso, follow-up |
| CrmActivity + timeline | **Pronto** | Modelo + APIs + hooks em mensagens/stage/link |
| Pipeline visual | **Parcial** | Board existe; drag/drop e aging não completos |
| Automações Salesbot | **Parcial** | Engine + templates default; UI lista; persistência JSON pendente |
| Dashboard CRM | **Parcial** | Overview + novos endpoints funnel/messages/tasks/wa-health |
| Multiusuário | **Parcial** | `assignedToUserId` no schema; permissões MEMBER/VIEWER incompletas |
| Anexos/mídia | **Parcial** | Placeholder UI "Mídia recebida"; `mediaJson` no schema |
| Monitoramento | **Parcial** | Doctors criados; fila outbound/retry não implementada |
| Testes E2E Kommo | **Parcial** | Spec Playwright skipped; script shell + unit verdes |
| Stripe | **Removido** | 410 + testes |

## Mock / simulador

- OpenClaw `SIMULATOR` quando provider desligado (dev)
- Automações UI: toggle local até persistir em `onboardingJson.crmAutomationRules`
- E2E Playwright: skipped sem `storageState` autenticado

## Depende de QR / credencial humana

- Escanear QR por workspace (1 ou 2 números)
- Asaas pagamento real em produção (tunnel/webhook)
- App `:3000` online para doctor completo

## Lacunas para paridade Kommo-like

1. **Outbound real estável** — habilitar send em staging, retry/DLQ
2. **Inbox tempo real** — SSE ou websocket; hoje poll 8s
3. **Pipeline** — drag/drop, valor estimado, aging, motivo perda, última mensagem no card
4. **Automações** — CRUD persistido, logs de execução, UI criar regra
5. **Relatórios** — gráficos no `/crm`, tempo médio de resposta
6. **Equipe** — transferir conversa, filtro "meus", RBAC export
7. **Mídia** — download seguro, preview
8. **E2E** — matriz autenticada no CI

## Comandos úteis

```bash
npm run justos:wa:doctor
npm run justos:command:doctor
npm run justos:crm:doctor
npm run justos:asaas:doctor
npm run justos:crm:test-two-workspaces
bash scripts/test-justos-crm-kommo-parity.sh
```
