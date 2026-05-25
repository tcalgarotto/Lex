#!/usr/bin/env npx tsx
/**
 * Checklist E2E real WhatsApp — marca BLOCKED_BY_HUMAN_INPUT quando sem QR.
 */

const checks = [
  "1. Command :3301 online (npm run justos:command)",
  "2. JUSTOS_OPENCLAW_MODE=process-per-workspace",
  "3. Conectar WhatsApp no painel JustOS",
  "4. Escanear QR no celular (BLOCKED_BY_HUMAN_INPUT se não feito)",
  "5. Enviar mensagem de outro número → aparece em /crm/inbox",
  "6. Responder pela inbox → chega no celular",
  "7. Segundo workspace: QR diferente, sem vazamento",
];

console.log("=== JustOS WhatsApp E2E Real ===\n");
for (const c of checks) {
  console.log(c.includes("BLOCKED") ? `[ ] ${c}` : `[?] ${c}`);
}
console.log("\nSimulado: npm run justos:wa:test-isolation && npm run justos:crm:test-two-workspaces");
