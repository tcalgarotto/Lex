#!/usr/bin/env bash
# Sincroniza vars JustOS entre sold-credentials.env e Lex .env.local (idempotente).
set -euo pipefail

LEX_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CREDS="${SOLD_CREDENTIALS:-$HOME/local-ai-control/config/sold-credentials.env}"
ENV_LOCAL="$LEX_ROOT/.env.local"

if [[ ! -f "$CREDS" ]]; then
  echo "Arquivo não encontrado: $CREDS" >&2
  exit 1
fi

read_creds_var() {
  local key="$1"
  grep -E "^${key}=" "$CREDS" 2>/dev/null | head -1 | sed "s/^${key}=//" | tr -d '\r' || true
}

# Asaas usa `$` no valor — não dar source nessas linhas
CREDS_FILTERED="$(mktemp)"
grep -vE '^ASAAS_' "$CREDS" > "$CREDS_FILTERED"
# shellcheck disable=SC1090
source "$CREDS_FILTERED"
rm -f "$CREDS_FILTERED"

ASAAS_API_SANDBOX="$(read_creds_var ASAAS_API_SANDBOX)"

SERVICE_TOKEN="${LEX_N8N_SERVICE_TOKEN:-}"
if [[ -z "$SERVICE_TOKEN" ]]; then
  SERVICE_TOKEN="$(openssl rand -hex 32)"
  printf '\nLEX_N8N_SERVICE_TOKEN=%s\n' "$SERVICE_TOKEN" >> "$CREDS"
  echo "Adicionado LEX_N8N_SERVICE_TOKEN em $CREDS"
fi

WEBHOOK_SECRET="${LEX_N8N_WEBHOOK_SECRET:-${N8N_WEBHOOK_SECRET:-}}"
WEBHOOK_URL="${JUSTOS_N8N_WEBHOOK_URL:-${LEX_N8N_WEBHOOK_URL:-http://127.0.0.1:5678/webhook/justos-case-secretary}}"

touch "$ENV_LOCAL"
upsert() {
  local key="$1" val="$2"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$ENV_LOCAL" ]]; then
    grep -v "^${key}=" "$ENV_LOCAL" > "$tmp" || true
  fi
  if [[ "$val" == *'$'* ]] || [[ "$val" == *' '* ]] || [[ "$val" == *'"'* ]]; then
    printf '%s="%s"\n' "$key" "$val" >> "$tmp"
  else
    printf '%s=%s\n' "$key" "$val" >> "$tmp"
  fi
  mv "$tmp" "$ENV_LOCAL"
}

upsert LEX_N8N_WEBHOOK_URL "$WEBHOOK_URL"
upsert LEX_N8N_WEBHOOK_SECRET "$WEBHOOK_SECRET"
upsert LEX_N8N_SERVICE_TOKEN "$SERVICE_TOKEN"
upsert JUSTOS_N8N_WEBHOOK_URL "$WEBHOOK_URL"
upsert JUSTOS_N8N_WEBHOOK_SECRET "$WEBHOOK_SECRET"
upsert JUSTOS_N8N_SERVICE_TOKEN "$SERVICE_TOKEN"
upsert JUSTOS_DEV_EMIT "${JUSTOS_DEV_EMIT:-false}"
upsert JUSTOS_USE_LEGACY_BRIDGE "${JUSTOS_USE_LEGACY_BRIDGE:-false}"
upsert JUSTOS_CRM_ENABLE_WA_SEND "${JUSTOS_CRM_ENABLE_WA_SEND:-false}"

# Asaas Sandbox (sold-credentials: ASAAS_API_SANDBOX)
if [[ -n "$ASAAS_API_SANDBOX" ]]; then
  # Chave começa com $ — escapar para dotenv/Next não expandirem como variável
  ASAAS_KEY_ESCAPED="${ASAAS_API_SANDBOX//\$/\\$}"
  upsert ASAAS_API_KEY "$ASAAS_KEY_ESCAPED"
  upsert ASAAS_API_BASE_URL "https://api-sandbox.asaas.com"
fi
ASAAS_WH="$(read_creds_var ASAAS_WEBHOOK_TOKEN)"
if [[ -n "$ASAAS_WH" ]]; then
  upsert ASAAS_WEBHOOK_TOKEN "$ASAAS_WH"
fi

echo "OK: $ENV_LOCAL atualizado (JUSTOS_* + ASAAS sandbox + fallback LEX_*)."
echo "Recrie o container n8n se alterou sold-credentials: cd ~/local-ai-control/services/n8n && docker compose up -d --force-recreate n8n"
