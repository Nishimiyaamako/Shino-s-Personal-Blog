#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_LOG="${BACKEND_LOG:-/tmp/pb-backend-dev.log}"
FRONTEND_LOG="${FRONTEND_LOG:-/tmp/pb-frontend-dev.log}"
NGINX_CONF="${NGINX_CONF:-/tmp/pb-local-nginx.conf}"

BLOG_HOST="${BLOG_HOST:-blog.localhost}"
PROXY_NAME="${PROXY_NAME:-pb-local-proxy}"
PROXY_IMAGE="${PROXY_IMAGE:-nginx:1.27-alpine}"

BACKEND_PID=""
FRONTEND_PID=""
STARTED_BACKEND=0
STARTED_FRONTEND=0

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  docker rm -f "$PROXY_NAME" >/dev/null 2>&1 || true

  if [ "$STARTED_BACKEND" -eq 1 ] && [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  if [ "$STARTED_FRONTEND" -eq 1 ] && [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  wait >/dev/null 2>&1 || true
}

wait_http() {
  local url="$1"
  local max_attempts="${2:-60}"

  for _ in $(seq 1 "$max_attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  return 1
}

wait_http_head() {
  local url="$1"
  local max_attempts="${2:-60}"

  for _ in $(seq 1 "$max_attempts"); do
    if curl -fsSI "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  return 1
}

assert_status_200() {
  local label="$1"
  local url="$2"
  local status_line

  status_line="$(curl -sSI "$url" | tr -d '\r' | sed -n '1p')"
  echo "$label -> $status_line"

  if ! echo "$status_line" | grep -q ' 200 '; then
    echo "Expected HTTP 200: $url" >&2
    return 1
  fi
}

need_cmd bun
need_cmd node
need_cmd npm
need_cmd curl
need_cmd docker
need_cmd git

trap cleanup EXIT

echo "[1/7] Precheck"
cd "$ROOT_DIR"
bun --version
node --version
npm --version
git status --short

echo "[2/7] Backend"
if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
  echo "Reuse existing backend on :3001"
else
  (cd "$BACKEND_DIR" && bun run dev >"$BACKEND_LOG" 2>&1) &
  BACKEND_PID=$!
  STARTED_BACKEND=1

  if ! wait_http "http://127.0.0.1:3001/api/health"; then
    echo "Backend failed to become healthy." >&2
    tail -n 80 "$BACKEND_LOG" || true
    exit 1
  fi
fi

echo "[3/7] Frontend"
if curl -fsSI http://127.0.0.1:5173/ >/dev/null 2>&1; then
  echo "Reuse existing frontend on :5173"
else
  (cd "$FRONTEND_DIR" && bun run dev --host 127.0.0.1 --port 5173 >"$FRONTEND_LOG" 2>&1) &
  FRONTEND_PID=$!
  STARTED_FRONTEND=1

  if ! wait_http_head "http://127.0.0.1:5173/"; then
    echo "Frontend failed to become healthy." >&2
    tail -n 80 "$FRONTEND_LOG" || true
    exit 1
  fi
fi

echo "[4/7] Local Proxy"
cat >"$NGINX_CONF" <<EOF2
server {
  listen 80;
  server_name $BLOG_HOST;

  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF2

docker rm -f "$PROXY_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$PROXY_NAME" \
  --network host \
  -v "$NGINX_CONF:/etc/nginx/conf.d/default.conf:ro" \
  "$PROXY_IMAGE" >/dev/null

docker ps --filter "name=$PROXY_NAME" --format "proxy={{.Names}} status={{.Status}} net={{.Networks}}"

echo "[5/7] Route Chain"
root_headers="$(curl -sSI "http://$BLOG_HOST/" | tr -d '\r')"
admin_login_headers="$(curl -sSI "http://$BLOG_HOST/admin/login" | tr -d '\r')"

# Show root and admin route status lines for quick diagnosis
echo "$root_headers" | sed -n '1p'
echo "$admin_login_headers" | sed -n '1p'

site_health="$(curl -sS "http://$BLOG_HOST/api/health")"
direct_health="$(curl -sS "http://127.0.0.1:3001/api/health")"

echo "$site_health"
echo "$direct_health"

echo "$site_health" | grep -q '"ok":true'
echo "$direct_health" | grep -q '"ok":true'

echo "[6/7] Functional Acceptance"
assert_status_200 "/posts" "http://$BLOG_HOST/posts"
assert_status_200 "/tags" "http://$BLOG_HOST/tags"
assert_status_200 "/archive" "http://$BLOG_HOST/archive"
assert_status_200 "/admin/login" "http://$BLOG_HOST/admin/login"
assert_status_200 "/uploads/images/steam-bugs-linux.webp" "http://$BLOG_HOST/uploads/images/steam-bugs-linux.webp"

login_response="$(
  curl -sS -X POST "http://$BLOG_HOST/api/admin/auth/login" \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"admin123"}'
)"
echo "$login_response"
echo "$login_response" | grep -q '"token"'

echo "[7/7] Quality Gate"
cd "$BACKEND_DIR"
bun run typecheck
bun run test
bun run build

cd "$FRONTEND_DIR"
bun run typecheck
bun run build

echo "QUALITY_GATE=PASS"
echo "LOCAL_VERIFY=PASS"
