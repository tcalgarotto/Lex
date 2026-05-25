#!/usr/bin/env bash
# Teste POST do webhook JustOS (não abra no browser — use POST).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a && source .env.local && set +a

CASE_ID="${1:-cmp1w8i6w0005wmjf4x71phag}"
WS_ID="${2:-cmov676gj0000wm6kx7l7pm4c}"
EVENT="${3:-intake.saved}"

curl -s -w "\nHTTP %{http_code}\n" -X POST "$LEX_N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-lex-n8n-secret: $LEX_N8N_WEBHOOK_SECRET" \
  -d "{\"event\":\"$EVENT\",\"caseId\":\"$CASE_ID\",\"workspaceId\":\"$WS_ID\",\"title\":\"Teste webhook\",\"secretary\":{\"lawyerWhatsApp\":[\"${JUSTOS_TEST_LAWYER_WA:-5547984696731}\"],\"preferences\":{\"clientOptOut\":true,\"lawyerOptOut\":false}}}"
