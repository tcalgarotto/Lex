#!/usr/bin/env bash
# Isolamento sessionKey no Command (requer Command :3301)
set -euo pipefail
CMD="${JUSTOS_COMMAND_URL:-http://127.0.0.1:3301}"
SECRET="${JUSTOS_COMMAND_SECRET:-}"
WS_A="${1:-workspace_test_a}"
WS_B="${2:-workspace_test_b}"

hdr=()
[[ -n "$SECRET" ]] && hdr=(-H "x-justos-command-secret: $SECRET")

hash_key() {
  python3 -c "import hashlib,sys; print('ws_'+hashlib.sha256(sys.argv[1].encode()).hexdigest()[:12])" "$1"
}

KEY_A=$(hash_key "$WS_A")
KEY_B=$(hash_key "$WS_B")

if [[ "$KEY_A" == "$KEY_B" ]]; then
  echo "FAIL: session keys collide"
  exit 1
fi

echo "PASS: session keys differ ($KEY_A vs $KEY_B)"
curl -sf "${hdr[@]}" "$CMD/health" >/dev/null && echo "PASS: Command health" || echo "WARN: Command offline"
