#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== JustOS CRM Kommo parity (API/unit) ==="
npx vitest run tests/unit/no-stripe-provider.test.ts \
  tests/unit/asaas-webhook.test.ts \
  tests/unit/justos-session-key.test.ts \
  tests/unit/justos-whatsapp-session-security.test.ts
npm run justos:crm:test-two-workspaces
echo "E2E Playwright (skipped sem auth): npx playwright test tests/e2e/justos-crm-kommo-parity.spec.ts"
echo "WhatsApp real: npm run justos:wa:e2e-real-checklist"
