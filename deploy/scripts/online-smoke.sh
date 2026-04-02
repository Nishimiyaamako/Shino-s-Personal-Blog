#!/usr/bin/env bash

set -euo pipefail

DOMAIN="${1:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>" >&2
  echo "Example: $0 blog.example.com" >&2
  exit 1
fi

echo "[1/5] root page"
curl -sSI "https://${DOMAIN}/" | tr -d '\r' | sed -n '1,3p'

echo "[2/5] admin login page"
curl -sSI "https://${DOMAIN}/admin/login" | tr -d '\r' | sed -n '1,3p'

echo "[3/5] health"
curl -sS "https://${DOMAIN}/api/health"
echo

echo "[4/5] posts route"
curl -sSI "https://${DOMAIN}/posts" | tr -d '\r' | sed -n '1,3p'

echo "[5/5] uploads probe"
curl -sSI "https://${DOMAIN}/uploads/images/steam-bugs-linux.webp" | tr -d '\r' | sed -n '1,3p'

echo "ONLINE_SMOKE_DONE"
