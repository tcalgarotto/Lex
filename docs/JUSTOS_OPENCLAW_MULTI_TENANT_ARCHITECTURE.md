# JustOS — OpenClaw multi-tenant

## Modelo alvo

```
JustOS App :3000
  → JustOS Command :3301
    → OpenClaw Session Manager
      → worker ws_<hash_A>  (credenciais isoladas)
      → worker ws_<hash_B>
```

## Modos (`JUSTOS_OPENCLAW_MODE`)

| Modo | Uso | Multi-tenant |
|------|-----|--------------|
| `dev-single` | Local, um bridge :3310 | Não — aviso na UI |
| `process-per-workspace` | Staging, um processo OpenClaw/porta por workspace | Sim |
| `container-per-workspace` | Futuro (compose pool) | Sim |

## Isolamento

- `sessionKey = ws_<sha256(workspaceId)[0:12]>`
- Credenciais: `credentials/whatsapp/{sessionKey}/`
- Estado: `sessions/{sessionKey}/state.json`
- Logs: `logs/{sessionKey}.log`
- **Nunca** `credentials/whatsapp/default` em produção.

## APIs (site)

- `GET /api/justos/whatsapp/status`
- `POST /api/justos/whatsapp/connect`
- `GET /api/justos/whatsapp/qr` — QR `dataUrl` para exibir no card
- `POST /api/justos/whatsapp/disconnect`
- `POST /api/justos/whatsapp/send-test`

## Command (:3301)

- `GET /sessions/:workspaceId/status`
- `POST /sessions/:workspaceId/connect`
- `GET /sessions/:workspaceId/qr`
- `POST /sessions/:workspaceId/disconnect`
- `POST /whatsapp/send`
- `POST /webhook/justos/inbound`

## Produção SaaS (recomendado)

- `JUSTOS_USE_LEGACY_BRIDGE=false`
- n8n → `JUSTOS_COMMAND_URL/whatsapp/send` (não SOLD :3300)
- RLS + `workspaceId` em todas as queries CRM
- Rate limit por workspace (futuro)

## Teste local (2+ números)

Ver **`JUSTOS_WHATSAPP_MULTI_TENANT_TEST.md`** — `.env.local` com `process-per-workspace`, `npm run justos:command`, `npm run justos:wa:test-isolation`.

Workers isolados **não** carregam `loadSoldEnvironment()` (flag `JUSTOS_ISOLATED_WORKER`).

## Futuro

- WhatsApp Business Platform oficial para escala enterprise.
- OpenClaw QR permanece como modo SMB / self-hosted assistido.
