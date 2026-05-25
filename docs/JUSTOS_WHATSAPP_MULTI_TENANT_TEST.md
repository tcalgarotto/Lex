# JustOS — teste WhatsApp multi-tenant (OpenClaw)

## Modo ativo

No `.env.local`:

```env
JUSTOS_OPENCLAW_MODE=process-per-workspace
JUSTOS_OPENCLAW_PORT_BASE=34000
OPENCLAW_ENTRY=/home/thales/OpenClaw/index.js
JUSTOS_COMMAND_URL=http://127.0.0.1:3301
```

Cada `workspaceId` recebe:

- `sessionKey` = `ws_<hash>` (único)
- Bridge dedicada em `http://127.0.0.1:34000–34499`
- Sessão WhatsApp em `local-ai-control/services/justos-command/sessions/<sessionKey>/`
- Credenciais isoladas (não usa `.openclaw` global do SOLD)

## Subir serviços

**Terminal 1 — Lex**

```bash
cd ~/Projetos/Lex && npm run dev -- --hostname 0.0.0.0 --port 3000
```

**Terminal 2 — JustOS Command** (obrigatório; reinicie após mudar `.env.local`)

```bash
cd ~/Projetos/Lex && npm run justos:command
```

Confirme no log: `mode=process-per-workspace`.

## Ver workers e portas

```bash
cd ~/Projetos/Lex && npm run justos:openclaw:status
npm run justos:wa:test-isolation
```

## Teste com 2 números WhatsApp

1. Faça login no **escritório A** (workspace 1) → Integrações → JustOS → **Conectar WhatsApp** → escaneie QR com **número 1**.
2. Faça login no **escritório B** (outro workspace / outro usuário owner) → mesma tela → **Conectar** → QR com **número 2**.
3. Em A: **Testar envio** para um celular de teste — mensagem deve sair do número 1.
4. Em B: idem — deve sair do número 2.
5. Confirme no Asaas/CRM que conversas de A não aparecem em B.

## Voltar ao modo SOLD (dev rápido)

```env
JUSTOS_OPENCLAW_MODE=dev-single
```

Reinicie o Command. Aí todos os escritórios compartilham o bridge :3310 do SOLD.

## Troubleshooting

| Sintoma | Ação |
|---------|------|
| Command offline | `npm run justos:command` |
| EADDRINUSE :3301 | Command já rodando — OK |
| Sem QR após 45s | Veja `logs/ws_*.log` em justos-command; Chromium/WhatsApp Web pode demorar na 1ª vez |
| Mesmo número nos 2 escritórios | Desconecte um, apague pasta `sessions/ws_*` se necessário, conecte de novo |
| Porta em uso | `npm run justos:openclaw:status` — cada workspace tem porta derivada do hash |
