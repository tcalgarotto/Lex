#!/usr/bin/env bash
# Simula webhook Asaas local (requer app :3000 e ASAAS_WEBHOOK_TOKEN no .env.local)
set -euo pipefail

BASE="${JUSTOS_API_BASE_URL:-http://127.0.0.1:3000}"
TOKEN="${ASAAS_WEBHOOK_TOKEN:-}"
WS_ID="${1:-}"

if [[ -z "$WS_ID" ]]; then
  echo "Uso: ASAAS_WEBHOOK_TOKEN=... $0 <workspaceId>" >&2
  exit 1
fi

BODY=$(cat <<EOF
{
  "event": "PAYMENT_CONFIRMED",
  "payment": {
    "id": "pay_test_$(date +%s)",
    "customer": "cus_test",
    "subscription": "sub_test",
    "externalReference": "$WS_ID",
    "status": "CONFIRMED",
    "value": 129.9,
    "dueDate": "2026-06-01"
  }
}
EOF
)

HDR=()
if [[ -n "$TOKEN" ]]; then
  HDR=(-H "asaas-access-token: $TOKEN")
fi

curl -sS -X POST "$BASE/api/asaas/webhook" \
  "${HDR[@]}" \
  -H "Content-Type: application/json" \
  -d "$BODY" | jq . 2>/dev/null || cat

echo ""
