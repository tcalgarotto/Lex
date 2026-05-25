#!/usr/bin/env bash
# Sobe o sidecar WhatsApp (:3301). Requer OpenClaw bridge em :3310 (opcional mas necessário para QR real).
set -euo pipefail

LEX_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CMD_DIR="$(cd "$LEX_ROOT/../../local-ai-control/services/justos-command" && pwd)"

export JUSTOS_COMMAND_PORT="${JUSTOS_COMMAND_PORT:-3301}"
export JUSTOS_API_BASE_URL="${JUSTOS_API_BASE_URL:-http://127.0.0.1:3000}"
export OPENCLAW_BRIDGE_URL="${OPENCLAW_BRIDGE_URL:-http://127.0.0.1:3310}"
export JUSTOS_OPENCLAW_MODE="${JUSTOS_OPENCLAW_MODE:-dev-single}"

if [[ -f "$LEX_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(JUSTOS_COMMAND_|JUSTOS_OPENCLAW_|OPENCLAW_BRIDGE|OPENCLAW_ENTRY)' "$LEX_ROOT/.env.local" 2>/dev/null | sed 's/^/export /') || true
  set +a
fi

echo "[justos-command] dir=$CMD_DIR port=$JUSTOS_COMMAND_PORT bridge=$OPENCLAW_BRIDGE_URL mode=$JUSTOS_OPENCLAW_MODE"

if curl -sf "http://127.0.0.1:${JUSTOS_COMMAND_PORT}/health" >/dev/null 2>&1; then
  echo "[justos-command] Já em execução na porta ${JUSTOS_COMMAND_PORT} (health OK). Não inicie outra instância."
  exit 0
fi

exec node "$CMD_DIR/index.js"
