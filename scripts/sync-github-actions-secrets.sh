#!/usr/bin/env bash
# Sincroniza secrets do workflow post-release-monitor a partir de .env local + Vercel CLI.
# Uso: ./scripts/sync-github-actions-secrets.sh
# Requer: gh auth login, .env na raiz, jq, login Vercel CLI (auth.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "Arquivo .env não encontrado em $ROOT" >&2
  exit 1
fi

get_env() {
  local key="$1"
  local line val
  line=$(grep -E "^${key}=" .env 2>/dev/null | tail -1) || return 1
  val="${line#*=}"
  val="${val%$'\r'}"
  val="${val#\"}"; val="${val%\"}"
  val="${val#\'}"; val="${val%\'}"
  printf '%s' "$val"
}

set_secret() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "SKIP $name (vazio)"
    return 0
  fi
  printf '%s' "$value" | gh secret set "$name"
  echo "SET $name"
}

VERCEL_AUTH="${HOME}/.local/share/com.vercel.cli/auth.json"
[ -f "$VERCEL_AUTH" ] || VERCEL_AUTH="${HOME}/.config/com.vercel.cli/auth.json"
if [ ! -f "$VERCEL_AUTH" ]; then
  echo "Vercel CLI auth não encontrado; VERCEL_TOKEN não será definido." >&2
fi

if [ -f "$VERCEL_AUTH" ]; then
  set_secret VERCEL_TOKEN "$(jq -r '.token' "$VERCEL_AUTH")"
fi
if [ -f .vercel/project.json ]; then
  set_secret VERCEL_ORG_ID "$(jq -r '.orgId' .vercel/project.json)"
  set_secret VERCEL_PROJECT_ID "$(jq -r '.projectId' .vercel/project.json)"
fi

for key in \
  SENTRY_AUTH_TOKEN \
  LANGFUSE_PUBLIC_KEY LANGFUSE_SECRET_KEY LANGFUSE_HOST \
  DATABASE_URL DIRECT_URL \
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
  DEEPSEEK_API_KEY \
  SUPABASE_TEST_USER_A_EMAIL SUPABASE_TEST_USER_A_PASSWORD \
  SUPABASE_TEST_USER_B_EMAIL SUPABASE_TEST_USER_B_PASSWORD
do
  set_secret "$key" "$(get_env "$key" || true)"
done

set_secret SENTRY_ORG "lotys"
set_secret SENTRY_PROJECT "lex"

echo "---"
gh secret list
