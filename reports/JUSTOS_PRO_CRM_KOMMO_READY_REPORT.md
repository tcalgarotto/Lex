# JustOS Pro CRM — Kommo Ready Report

**Data:** 2026-05-25  
**Veredito:** **Não release-ready** para advogado sem terminal — faltam QR real + outbound habilitado + E2E humano.

## Checklist advogado (9 critérios)

| # | Critério | Status |
|---|----------|--------|
| 1 | Ativar Pro via Asaas | Parcial — código OK; pagamento real BLOCKED_BY_CREDENTIAL |
| 2 | Conectar WhatsApp QR no site | Parcial — BLOCKED_BY_HUMAN_INPUT (escanear) |
| 3 | Receber mensagem em /crm/inbox | Parcial — inbound API OK; precisa sessão |
| 4 | Responder pela inbox | Parcial — `JUSTOS_CRM_ENABLE_WA_SEND` desligado no env local |
| 5 | Contato/conversa/pipeline atualizados | Parcial — hooks CrmActivity; UI básica |
| 6 | Vincular conversa a caso | Pronto — API + UI lateral |
| 7 | Criar tarefa/follow-up | Pronto — API + inbox lateral |
| 8 | Histórico contato/caso | Pronto — CrmActivity + APIs timeline |
| 9 | Sem vazamento entre workspaces | Pronto — RLS + teste 2 workspaces PASS |

## Rotas principais

- `/crm` — dashboard operacional
- `/crm/inbox` — atendimento WhatsApp
- `/crm/pipeline` — funil
- `/crm/contacts` — contatos
- `/crm/automations` — regras (templates)
- `/settings/integracoes/justos` — QR WhatsApp

## Testes executados nesta rodada

- typecheck, build, migrate deploy, `justos:crm:test-two-workspaces`, vitest JustOS unit
- `justos:wa:doctor` — Command OK, 5 workers, modo `process-per-workspace`

## Bloqueios humanos

- **BLOCKED_BY_QR:** escanear QR por workspace
- **BLOCKED_BY_CREDENTIAL:** Asaas produção / tunnel webhook
- **Env:** definir `JUSTOS_CRM_ENABLE_WA_SEND=true` em staging

## Recomendação técnica

- **Curto prazo:** OpenClaw `process-per-workspace` (já em uso) para escritórios com 1 número cada
- **Médio prazo:** WhatsApp Business API (Meta) para escala e SLA — quando volume justificar

## Release checklist (antes de “pronto”)

- [ ] QR real 1 workspace — inbound + outbound
- [ ] QR real 2 workspaces — isolamento
- [ ] `JUSTOS_CRM_ENABLE_WA_SEND=true` em staging
- [ ] E2E simulado autenticado verde
- [ ] Lint sem erros no escopo CRM
- [ ] Documentação advogado (sem terminal)
