# JustOS CRM — isolamento 2 workspaces

**Data:** 2026-05-25  
**Script:** `npm run justos:crm:test-two-workspaces`

## Escopo

- Contato com mesmo `phoneE164` em workspace A e B (permitido).
- Mensagem criada em A não aparece em B.
- `sessionKey` único por workspace.
- Inbound via `processInboundWhatsapp` grava em A apenas.

## Resultado

Executar localmente após `npx prisma migrate deploy`:

```bash
npm run justos:crm:test-two-workspaces
```

Saída esperada: `PASS: isolamento 2 workspaces OK`
