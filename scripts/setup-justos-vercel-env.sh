#!/usr/bin/env bash
# Imprime comandos para configurar JustOS no Vercel (não executa — evita expor secrets no log).
set -euo pipefail

CREDS="${SOLD_CREDENTIALS:-$HOME/local-ai-control/config/sold-credentials.env}"
[[ -f "$CREDS" ]] || { echo "Arquivo não encontrado: $CREDS" >&2; exit 1; }
# shellcheck disable=SC1090
source "$CREDS"

LEX_ONLINE="${LEX_ONLINE_URL:-https://lex-navy.vercel.app}"
TOKEN="${LEX_N8N_SERVICE_TOKEN:-}"
SECRET="${LEX_N8N_WEBHOOK_SECRET:-}"
WEBHOOK="${LEX_N8N_WEBHOOK_URL:-http://127.0.0.1:5678/webhook/lex-case-secretary}"

if [[ -z "$TOKEN" || -z "$SECRET" ]]; then
  echo "Rode primeiro: ./scripts/setup-justos-env.sh" >&2
  exit 1
fi

cat <<EOF
# JustOS — variáveis Vercel (Production + Preview)
# Projeto: lex-navy / tcalgarottos-projects/lex
# Painel: https://vercel.com → Project → Settings → Environment Variables

LEX_N8N_SERVICE_TOKEN=$TOKEN
LEX_N8N_WEBHOOK_SECRET=$SECRET
LEX_N8N_WEBHOOK_URL=$WEBHOOK

# ⚠ LEX_N8N_WEBHOOK_URL acima aponta para LOCAL.
# Para emit automático do Lex ONLINE → n8n, use URL pública, ex.:
#   LEX_N8N_WEBHOOK_URL=https://n8n.seudominio.com/webhook/lex-case-secretary
#   (Cloudflare Tunnel, ngrok, ou n8n em VPS)

# n8n (sold-credentials.env) — callbacks para Lex online:
LEX_API_BASE_URL=$LEX_ONLINE

# Depois de salvar no Vercel:
#   vercel --prod   (ou push na branch main)
#   ./scripts/test-justos-online.sh --online-callbacks

# Dev híbrido (dados reais Supabase, sem tunnel):
#   Lex local: npm run dev -- --hostname 0.0.0.0
#   LEX_API_BASE_URL=http://host.docker.internal:3000 no n8n
#   ./scripts/test-justos-full.sh
EOF
