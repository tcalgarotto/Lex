#!/usr/bin/env bash
# Teste JustOS: local (baseline) + Lex online (Vercel) + n8n→online.
#
# Uso:
#   ./scripts/test-justos-online.sh              # local + checagem online
#   LEX_API_BASE_URL=https://lex-navy.vercel.app ./scripts/test-justos-online.sh --online-callbacks
#   JUSTOS_TEST_LAWYER_WA=5547... ./scripts/test-justos-online.sh --full
#
set -euo pipefail

LEX_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$LEX_ROOT"
CREDS="${SOLD_CREDENTIALS:-$HOME/local-ai-control/config/sold-credentials.env}"

set -a
source .env 2>/dev/null || true
source .env.local 2>/dev/null || true
[[ -f "$CREDS" ]] && source "$CREDS"
set +a

LEX_ONLINE="${LEX_ONLINE_URL:-https://lex-navy.vercel.app}"
LEX_LOCAL="${LEX_LOCAL_URL:-http://127.0.0.1:3000}"
CASE_ID="${CASE_ID:-cmp1w8i6w0005wmjf4x71phag}"
WS_ID="${WS_ID:-cmov676gj0000wm6kx7l7pm4c}"
MODE_ONLINE_CB=false
MODE_FULL=false

for arg in "$@"; do
  case "$arg" in
    --online-callbacks) MODE_ONLINE_CB=true ;;
    --full) MODE_FULL=true ;;
  esac
done

PASS=0
FAIL=0
WARN=0

ok() { echo "✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "✗ $1"; FAIL=$((FAIL + 1)); }
warn() { echo "⚠ $1"; WARN=$((WARN + 1)); }

need_token() {
  if [[ -z "${LEX_N8N_SERVICE_TOKEN:-}" ]]; then
    echo "LEX_N8N_SERVICE_TOKEN ausente — rode: ./scripts/setup-justos-env.sh" >&2
    exit 1
  fi
}

echo "========== JustOS — diagnóstico deploy =========="
echo "Lex online:  $LEX_ONLINE"
echo "Lex local:   $LEX_LOCAL"
echo "n8n webhook: ${LEX_N8N_WEBHOOK_URL:-<unset>}"
echo

need_token

echo "--- Fase A: serviços locais (baseline deploy) ---"
if curl -sf "$LEX_LOCAL/api/health" >/dev/null 2>&1; then ok "Lex local /api/health"; else warn "Lex local down (npm run dev -- --hostname 0.0.0.0)"; fi
if curl -sf http://127.0.0.1:5678/healthz >/dev/null 2>&1; then ok "n8n healthz"; else bad "n8n down"; fi

if curl -sf "$LEX_LOCAL/api/health" >/dev/null 2>&1; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $LEX_N8N_SERVICE_TOKEN" \
    "$LEX_LOCAL/api/cases/$CASE_ID/case-brain")
  [[ "$code" == "200" ]] && ok "local Bearer case-brain ($code)" || bad "local Bearer case-brain ($code)"
fi

echo
echo "--- Fase B: Lex online (Vercel) ---"
code=$(curl -s -o /dev/null -w '%{http_code}' "$LEX_ONLINE/api/health")
[[ "$code" == "200" ]] && ok "Lex online /api/health ($code)" || bad "Lex online health ($code)"

code=$(curl -s -o /tmp/jo-brain.json -w '%{http_code}' -H "Authorization: Bearer $LEX_N8N_SERVICE_TOKEN" \
  "$LEX_ONLINE/api/cases/$CASE_ID/case-brain")
if [[ "$code" == "200" ]]; then
  ok "Lex online Bearer case-brain ($code)"
elif [[ "$code" == "401" ]] && grep -q SESSION_REQUIRED /tmp/jo-brain.json 2>/dev/null; then
  bad "Lex online Bearer → 401 SESSION (falta LEX_N8N_SERVICE_TOKEN no Vercel ou deploy sem proxy JustOS)"
else
  bad "Lex online Bearer case-brain ($code) $(head -c 80 /tmp/jo-brain.json 2>/dev/null)"
fi

code=$(curl -s -o /tmp/jo-stalled.json -w '%{http_code}' -H "Authorization: Bearer $LEX_N8N_SERVICE_TOKEN" \
  "$LEX_ONLINE/api/integrations/justos/stalled-cases?limit=1")
if [[ "$code" == "200" ]]; then
  ok "Lex online stalled-cases ($code)"
elif [[ "$code" == "401" ]]; then
  bad "Lex online stalled-cases → 401 (mesma causa: env Vercel + deploy)"
else
  bad "Lex online stalled-cases ($code)"
fi

echo
echo "--- Fase C: n8n webhook (sempre local) ---"
if [[ -n "${LEX_N8N_WEBHOOK_URL:-}" && -n "${LEX_N8N_WEBHOOK_SECRET:-}" ]]; then
  code=$(curl -s -o /tmp/jo-wh.json -w '%{http_code}' -X POST "$LEX_N8N_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-lex-n8n-secret: $LEX_N8N_WEBHOOK_SECRET" \
    -d "{\"event\":\"intake.saved\",\"caseId\":\"$CASE_ID\",\"workspaceId\":\"$WS_ID\",\"title\":\"Online test\",\"secretary\":{\"preferences\":{\"clientOptOut\":true,\"lawyerOptOut\":true}}}")
  grep -q '"ok":true' /tmp/jo-wh.json 2>/dev/null && ok "n8n webhook ($code)" || bad "n8n webhook ($code)"
else
  bad "LEX_N8N_WEBHOOK_URL/SECRET ausentes"
fi

if [[ "$MODE_ONLINE_CB" == true ]]; then
  echo
  echo "--- Fase D: n8n → Lex ONLINE (callbacks) ---"
  export LEX_API_BASE_URL="$LEX_ONLINE"
  echo "LEX_API_BASE_URL=$LEX_API_BASE_URL (teste manual no container)"
  docker_out=$(docker exec n8n-n8n-1 wget -qO- --timeout=15 \
    --header="Authorization: Bearer $LEX_N8N_SERVICE_TOKEN" \
    "$LEX_ONLINE/api/cases/$CASE_ID/case-brain" 2>&1 || true)
  if [[ "$docker_out" == *"caseId"* ]]; then
    ok "n8n container → Lex online case-brain"
  else
    bad "n8n container → Lex online ($(echo "$docker_out" | head -c 120))"
    echo "  → Configure LEX_N8N_SERVICE_TOKEN no Vercel e redeploy antes deste teste."
  fi
fi

if [[ "$MODE_FULL" == true ]]; then
  echo
  echo "--- Fase E: suite local completa ---"
  bash scripts/test-justos-full.sh && ok "test-justos-full.sh" || bad "test-justos-full.sh"
fi

echo
echo "========== $PASS ok, $FAIL fail, $WARN warn =========="
echo
if [[ "$FAIL" -gt 0 ]]; then
  echo "Para Lex ONLINE funcionar (deploy final):"
  echo "  1. git push → Vercel (código JustOS + proxy.ts)"
  echo "  2. Vercel → Settings → Environment Variables (Production + Preview):"
  echo "       LEX_N8N_SERVICE_TOKEN=<mesmo valor local>"
  echo "       LEX_N8N_WEBHOOK_SECRET=<mesmo sold-credentials.env>"
  echo "       LEX_N8N_WEBHOOK_URL=<URL pública do n8n — ver abaixo>"
  echo "  3. Redeploy production"
  echo "  4. n8n: LEX_API_BASE_URL=$LEX_ONLINE em sold-credentials.env + docker compose up -d --force-recreate n8n"
  echo "  5. Re-teste: ./scripts/test-justos-online.sh --online-callbacks"
  echo
  echo "Lex → n8n (emit automático no site online):"
  echo "  Vercel não alcança 127.0.0.1:5678. Opções:"
  echo "  • Cloudflare Tunnel / ngrok na porta 5678 → LEX_N8N_WEBHOOK_URL=https://..."
  echo "  • n8n Cloud ou VPS com URL pública"
  echo "  • Dev: Lex local + mesmo Supabase (teste real de dados, n8n local)"
fi

[[ "$FAIL" -eq 0 ]]
