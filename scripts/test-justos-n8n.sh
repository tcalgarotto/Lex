#!/usr/bin/env bash
# Testes leves JustOS ↔ n8n (sem subir Next.js).
set -euo pipefail

N8N_BASE="${N8N_BASE:-http://127.0.0.1:5678}"
SECRET_FILE="${SECRET_FILE:-$HOME/local-ai-control/config/sold-credentials.env}"

if [[ -f "$SECRET_FILE" ]]; then
  # shellcheck disable=SC1090
  source <(grep -E '^(LEX_N8N_WEBHOOK_SECRET|N8N_WEBHOOK_SECRET)=' "$SECRET_FILE" | head -1)
  SECRET="${LEX_N8N_WEBHOOK_SECRET:-${N8N_WEBHOOK_SECRET:-}}"
fi
SECRET="${LEX_N8N_WEBHOOK_SECRET:-${SECRET:-}}"

echo "== 1) n8n vivo? =="
curl -sf -o /dev/null -w "HTTP %{http_code}\n" "$N8N_BASE/healthz" || curl -sf -o /dev/null -w "HTTP %{http_code}\n" "$N8N_BASE/" || echo "n8n não responde em $N8N_BASE"

echo "== 2) Webhook Lex (só rota, sem secret) =="
curl -s -o /dev/null -w "lex-case-secretary: HTTP %{http_code}\n" \
  -X POST "$N8N_BASE/webhook/lex-case-secretary" \
  -H "Content-Type: application/json" \
  -d '{"event":"draft.generated","caseId":"test-case","workspaceId":"test-ws","title":"Teste JustOS"}'

if [[ -n "${SECRET:-}" ]]; then
  echo "== 3) Webhook Lex com secret =="
  curl -s -w "\nHTTP %{http_code}\n" \
    -X POST "$N8N_BASE/webhook/lex-case-secretary" \
    -H "Content-Type: application/json" \
    -H "x-lex-n8n-secret: $SECRET" \
    -d '{
      "event": "draft.generated",
      "caseId": "00000000-0000-4000-8000-000000000099",
      "workspaceId": "00000000-0000-4000-8000-000000000001",
      "title": "Caso teste JustOS (script)",
      "secretary": {
        "lawyerWhatsApp": [],
        "clientWhatsApp": null,
        "preferences": { "clientOptOut": true, "lawyerOptOut": true }
      }
    }'
else
  echo "== 3) Pulado: defina LEX_N8N_WEBHOOK_SECRET em sold-credentials.env =="
fi

echo "== 4) SOLD events (referência) =="
curl -s -o /dev/null -w "sold-events: HTTP %{http_code}\n" \
  -X POST "$N8N_BASE/webhook/sold-events" \
  -H "Content-Type: application/json" \
  -d '{"event":"ping"}' || true

if [[ -f "$SECRET_FILE" ]]; then
  # shellcheck disable=SC1090
  source <(grep '^LEX_N8N_SERVICE_TOKEN=' "$SECRET_FILE" 2>/dev/null || true)
fi
SERVICE="${LEX_N8N_SERVICE_TOKEN:-}"
if [[ -n "$SERVICE" ]]; then
  echo "== 5) Callback Lex case-brain (requer next dev :3000) =="
  curl -s -o /dev/null -w "case-brain: HTTP %{http_code}\n" \
    -H "Authorization: Bearer $SERVICE" \
    "http://127.0.0.1:3000/api/cases/00000000-0000-4000-8000-000000000099/case-brain" || true
fi

echo "Próximo: abrir $N8N_BASE → Executions e ver se o passo 3 criou execução."
