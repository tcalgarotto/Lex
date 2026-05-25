#!/usr/bin/env bash
set -euo pipefail

LEX_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$LEX_ROOT"
set -a && source .env 2>/dev/null || true && source .env.local && set +a

LAWYER_WA="${JUSTOS_TEST_LAWYER_WA:-${SOLD_PARTNER_PHONE:-}}"
if [[ -z "$LAWYER_WA" ]]; then
  echo "Defina JUSTOS_TEST_LAWYER_WA (ex.: 5547999999999)" >&2
  exit 1
fi

export JUSTOS_TEST_LAWYER_WA="$LAWYER_WA"

echo "== Pré-requisitos =="
curl -sf http://127.0.0.1:5678/healthz >/dev/null && echo "n8n OK" || { echo "n8n down"; exit 1; }
curl -sf http://127.0.0.1:3000/api/health >/dev/null && echo "Lex OK" || { echo "Lex down — npm run dev -- --hostname 0.0.0.0"; exit 1; }

echo "== Setup workspace + caso =="
OUT=$(npx tsx scripts/setup-justos-controlled-test.ts)
WS_ID=$(echo "$OUT" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).workspaceId")
CASE_ID=$(echo "$OUT" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).caseId")
TITLE=$(echo "$OUT" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).title")
echo "case=$CASE_ID ($TITLE)"

echo "== API stalled-cases =="
curl -s -H "Authorization: Bearer $LEX_N8N_SERVICE_TOKEN" \
  "http://127.0.0.1:3000/api/integrations/justos/stalled-cases?limit=3" | head -c 180
echo

echo "== n8n secretary.configure =="
curl -s -X POST "$LEX_N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-lex-n8n-secret: $LEX_N8N_WEBHOOK_SECRET" \
  -d "{\"event\":\"secretary.configure\",\"caseId\":\"$CASE_ID\",\"workspaceId\":\"$WS_ID\",\"title\":\"$TITLE\",\"secretary\":{\"lawyerWhatsApp\":[\"$LAWYER_WA\"]}}"
echo

echo "== n8n intake.saved =="
curl -s -X POST "$LEX_N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-lex-n8n-secret: $LEX_N8N_WEBHOOK_SECRET" \
  -d "{\"event\":\"intake.saved\",\"caseId\":\"$CASE_ID\",\"workspaceId\":\"$WS_ID\",\"title\":\"$TITLE\",\"secretary\":{\"lawyerWhatsApp\":[\"$LAWYER_WA\"],\"preferences\":{\"clientOptOut\":true,\"lawyerOptOut\":false}}}"
echo

echo "== Lex emit =="
npx tsx scripts/test-justos-e2e.ts 2>&1 | tail -2

echo ""
echo "OK — http://127.0.0.1:5678 → Executions"
echo "Se cron ainda falha: reimporte workflows/n8n/lex-case-secretary.json no n8n"
