#!/usr/bin/env bash
# Deploy SyncQuote to this VPS (Docker Compose + Caddy).
# Run from the repo root on the server:
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.production.example and fill secrets."
  exit 1
fi

# Fail fast on placeholder secrets
if grep -qE 'CHANGE_ME|sk_live_or_test|whsec_\.\.\.' "$ENV_FILE"; then
  echo "Replace CHANGE_ME / placeholder values in $ENV_FILE before deploying."
  exit 1
fi

echo "==> Pulling base images & building…"
"${COMPOSE[@]}" pull postgres redis caddy || true
"${COMPOSE[@]}" build --pull

echo "==> Starting stack…"
"${COMPOSE[@]}" up -d

echo "==> Status"
"${COMPOSE[@]}" ps

DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2- || true)"
DOMAIN="${DOMAIN:-syncquote.faizanmalik.me}"

echo ""
echo "Deployed. Point DNS A record for ${DOMAIN} to this VPS, then open:"
echo "  https://${DOMAIN}"
echo "Health: https://${DOMAIN}/api/v1/health/ping"
echo "Stripe webhook: https://${DOMAIN}/api/v1/webhooks/stripe"
