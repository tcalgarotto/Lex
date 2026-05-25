# JustOS Pro CRM — QR / OpenClaw / Asaas — relatório final

**Data:** 2026-05-25

## Checklist de saída

| Item | Status |
|------|--------|
| Asaas duplicidade corrigida | **sim** — `createOrReuseJustosProSubscription`, UI reutiliza cobrança |
| QR no site | **sim** — card + `GET /api/justos/whatsapp/qr` + polling |
| JustOS Command QR endpoints | **sim** — `/sessions/:id/qr`, connect, status |
| OpenClaw mode | **sim** — `JUSTOS_OPENCLAW_MODE` (default `dev-single`) |
| Session per workspace | **sim** — `ws_<hash>` + dirs isolados |
| Inbox inbound | **sim** — API + Command webhook (E2E real = BLOCKED_BY_QR) |
| Inbox outbound | **parcial** — com `JUSTOS_CRM_ENABLE_WA_SEND=true` + sessão connected |
| Teste isolamento 2 workspaces | **sim** — PASS |
| n8n usa Command | **sim** — `justos-case-secretary.json` |
| SOLD global removido | **sim** — workflow JustOS sem :3300 |
| RLS | **sim** — aplicada |
| Build | ver seção testes abaixo |

## Asaas

- Reuso de assinatura/cobrança pendente antes de criar nova.
- `forceNew: true` só via botão "Gerar nova cobrança".
- Scripts: `justos:asaas:audit-subscriptions`, `justos:asaas:cleanup-sandbox-duplicates`.

## OpenClaw / QR

- Manager em `local-ai-control/services/justos-command/lib/openclaw-session-manager.js`.
- QR obtido do bridge OpenClaw (`/qr`) convertido para `dataUrl` (pacote `qrcode`).
- Em `dev-single`: um bridge global — aviso explícito na UI.
- Em `process-per-workspace`: worker por workspace na porta `34000+`.

### Correção “QR inválido” no WhatsApp (2026-05-25)

**Causa:** workers sem `WHATSAPP_PROVIDER=openclaw` + `OPENCLAW_ENABLED=true` ficavam em `SIMULATOR`; o endpoint `/qr` do OpenClaw priorizava `last-qr.txt` (arte ASCII do terminal) em vez do token real do `whatsapp-web.js`.

**Correção aplicada:** env no spawn do worker; `/qr` prioriza `lastQrCode`; validação `isValidWhatsAppPairingQr` no Command; UI só exibe imagem quando `qrAvailable`.

**Verificação:** `curl http://127.0.0.1:34189/qr` → token `2@...` (não `Sessao em modo SIMULATOR.`); Command `qrAvailable: true` com `dataUrl`.

## Segurança anti-vazamento

- `sessionKey` derivado server-side do `workspaceId`.
- Command valida `x-justos-command-secret` + `x-justos-workspace-id`.
- Inbound resolve workspace por `sessionKey` em state persistido.
- Teste 2 workspaces PASS.

## Testes executados

```bash
npm run justos:crm:test-two-workspaces  # PASS
npx vitest run tests/unit/no-stripe-provider.test.ts tests/unit/asaas-webhook.test.ts \
  tests/unit/justos-session-key.test.ts tests/unit/justos-whatsapp-session-security.test.ts \
  tests/unit/browser-mutation-origin.test.ts
```

## Pendências humanas

1. **BLOCKED_BY_QR** — escanear QR no celular com OpenClaw rodando.
2. **BLOCKED_BY_CREDENTIAL** — `ASAAS_WEBHOOK_TOKEN` + tunnel para webhook produção.
3. Staging: definir `JUSTOS_OPENCLAW_MODE=process-per-workspace` e validar 2 números reais.

## Próximo comando

```bash
# Terminal 1 — Command
cd ~/local-ai-control/services/justos-command
export JUSTOS_COMMAND_SECRET=<secret>
export JUSTOS_OPENCLAW_MODE=dev-single
npm start

# Terminal 2 — App
cd ~/Projetos/Lex
./scripts/setup-justos-env.sh
npm run dev -- --hostname 0.0.0.0 --port 3000

# UI: /settings/integracoes/justos → Conectar WhatsApp → escanear QR
```
