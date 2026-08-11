#!/usr/bin/env bash

set -euo pipefail

DOMAIN="${1:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>" >&2
  echo "Example: $0 blog.example.com" >&2
  exit 1
fi

echo "[1/6] root page"
curl -sSI "https://${DOMAIN}/" | tr -d '\r' | sed -n '1,3p'

echo "[2/6] admin login page"
curl -sSI "https://${DOMAIN}/admin/login" | tr -d '\r' | sed -n '1,3p'

echo "[3/6] health"
curl -sS "https://${DOMAIN}/api/health"
echo

echo "[4/6] blog route"
curl -sSI "https://${DOMAIN}/blog" | tr -d '\r' | sed -n '1,3p'

echo "[5/6] legacy posts route (expect 301 → /blog)"
curl -sSI "https://${DOMAIN}/posts" | tr -d '\r' | sed -n '1,3p'

echo "[6/6] uploads probe"
curl -sSI "https://${DOMAIN}/uploads/images/steam-bugs-linux.webp" | tr -d '\r' | sed -n '1,3p'

echo "ONLINE_SMOKE_DONE"
