#!/usr/bin/env bash
# Expose local CalBot (wrangler dev) for Telegram webhook testing.
# Telegram requires HTTPS; ngrok provides a public HTTPS URL.
#
# Prerequisite: ngrok requires a free account and authtoken.
#   Sign up: https://dashboard.ngrok.com/signup
#   Then:    ngrok config add-authtoken <your-token>
#   Token:   https://dashboard.ngrok.com/get-started/your-authtoken
#
# Usage:
#   1. In one terminal: pnpm dev   (wrangler dev --remote, port 8787)
#   2. In another:     ./scripts/ngrok-dev.sh
#   3. Set webhook:     curl -X POST "https://your-worker.workers.dev/admin/telegram-set-webhook" \
#                        -H "Authorization: Bearer $ADMIN_SECRET" \
#                        -H "Content-Type: application/json" \
#                        -d "{\"baseUrl\": \"https://YOUR_NGROK_URL\"}"
#
# For local-only: after ngrok starts, call your *deployed* worker's /admin/telegram-set-webhook
# with baseUrl set to the ngrok URL so Telegram sends updates to ngrok -> your local dev server.

set -e
PORT="${PORT:-8787}"
if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok not found. Install from https://ngrok.com/download or: brew install ngrok"
  exit 1
fi
if ! ngrok config check >/dev/null 2>&1; then
  echo "ngrok is not configured. You need a free account and authtoken:"
  echo "  1. Sign up: https://dashboard.ngrok.com/signup"
  echo "  2. Get token: https://dashboard.ngrok.com/get-started/your-authtoken"
  echo "  3. Run: ngrok config add-authtoken <your-token>"
  echo ""
  exit 1
fi
echo "Starting ngrok on port $PORT (override with PORT=9999 ./scripts/ngrok-dev.sh)"
echo ""
ngrok http "$PORT"
