#!/usr/bin/env bash
# Validação completa JustOS + Lex + n8n
set -euo pipefail

LEX_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$LEX_ROOT"
set -a && source .env 2>/dev/null || true && source .env.local && set +a

CASE_ID="${CASE_ID:-cmp1w8i6w0005wmjf4x71phag}"
WS_ID="${WS_ID:-cmov676gj0000wm6kx7l7pm4c}"
PASS=0
FAIL=0

ok() { echo "✓ $1"; PASS=$((PASS+1)); }
bad() { echo "✗ $1"; FAIL=$((FAIL+1)); }

echo "========== JustOS E2E =========="

# 1 n8n up
if curl -sf http://127.0.0.1:5678/healthz >/dev/null 2>&1; then ok "n8n healthz"; else bad "n8n healthz"; fi

# 2 webhook auth
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$LEX_N8N_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -H "x-lex-n8n-secret: $LEX_N8N_WEBHOOK_SECRET" \
  -d "{\"event\":\"intake.saved\",\"caseId\":\"$CASE_ID\",\"workspaceId\":\"$WS_ID\",\"title\":\"E2E\",\"secretary\":{\"preferences\":{\"clientOptOut\":true,\"lawyerOptOut\":true}}}")
[[ "$code" == "200" ]] && ok "webhook lex-case-secretary ($code)" || bad "webhook ($code)"

# 3 Lex emit
emit_out=$(set -a && source .env.local && set +a && npx tsx scripts/test-justos-e2e.ts 2>&1 | tail -1)
[[ "$emit_out" == *"OK:"* ]] && ok "Lex emitLexJustosEvent → n8n" || bad "Lex emit ($emit_out)"

# 4 callback host
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $LEX_N8N_SERVICE_TOKEN" \
  "http://127.0.0.1:3000/api/cases/$CASE_ID/case-brain")
[[ "$code" == "200" ]] && ok "n8n→Lex GET case-brain host ($code)" || bad "case-brain host ($code)"

# 5 callback from docker (como o workflow n8n)
docker_out=$(docker exec n8n-n8n-1 wget -qO- --timeout=8 \
  --header="Authorization: Bearer $LEX_N8N_SERVICE_TOKEN" \
  "http://host.docker.internal:3000/api/cases/$CASE_ID/case-brain" 2>&1 || true)
[[ "$docker_out" == *"caseId"* ]] && ok "n8n container → Lex case-brain" || bad "docker→Lex ($docker_out)"

# 6 workflow node path: webhook draft.generated (dispara GET snapshot no workflow)
code=$(curl -s -o /tmp/e2e-wh.json -w '%{http_code}' -X POST "$LEX_N8N_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -H "x-lex-n8n-secret: $LEX_N8N_WEBHOOK_SECRET" \
  -d "{\"event\":\"draft.generated\",\"caseId\":\"$CASE_ID\",\"workspaceId\":\"$WS_ID\",\"title\":\"E2E draft\",\"secretary\":{\"preferences\":{\"clientOptOut\":true,\"lawyerOptOut\":true}},\"extras\":{\"draftVersion\":1}}")
grep -q '"ok":true' /tmp/e2e-wh.json 2>/dev/null && ok "workflow draft.generated ($code)" || bad "workflow draft ($code) $(cat /tmp/e2e-wh.json 2>/dev/null | head -c 80)"

echo "========== $PASS ok, $FAIL fail =========="
[[ "$FAIL" -eq 0 ]]
