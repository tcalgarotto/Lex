# Plano — QR OpenClaw + produção JustOS Pro CRM

**Data:** 2026-05-25

## Estado antes desta rodada

- Command :3301 mock/in-memory
- Sem QR no site
- Asaas criava assinatura a cada clique em Assinar
- Build com erros em `browser-mutation-origin.test.ts`

## Entregas desta rodada

1. `openclaw-session-manager.js` — dev-single + process-per-workspace
2. Command endpoints status/connect/qr/disconnect
3. UI card com QR (dataUrl) + polling 2s
4. `createOrReuseJustosProSubscription` + scripts audit/cleanup
5. Testes session-key, security, browser fix
6. Docs arquitetura OpenClaw

## Pendências humanas

- Escanear QR real (BLOCKED_BY_QR)
- `JUSTOS_OPENCLAW_MODE=process-per-workspace` em staging com OpenClaw estável por porta
- Tunnel Asaas webhook em produção

## Comandos

```bash
cd ~/local-ai-control/services/justos-command && npm start
cd ~/Projetos/Lex && npm run dev -- --hostname 0.0.0.0 --port 3000
npm run justos:asaas:audit-subscriptions
npm run justos:crm:test-two-workspaces
```
