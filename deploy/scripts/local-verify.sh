#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_LOG="${BACKEND_LOG:-/tmp/pb-backend-dev.log}"
FRONTEND_LOG="${FRONTEND_LOG:-/tmp/pb-frontend-dev.log}"
NGINX_CONF="${NGINX_CONF:-/tmp/pb-local-nginx.conf}"

BLOG_HOST="${BLOG_HOST:-blog.localhost}"

BACKEND_PID=""
FRONTEND_PID=""
NGINX_PID=""
STARTED_BACKEND=0
STARTED_FRONTEND=0
STARTED_NGINX=0

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  if [ "$STARTED_NGINX" -eq 1 ] && [ -n "$NGINX_PID" ]; then
    kill "$NGINX_PID" >/dev/null 2>&1 || true
  fi

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
USE_PROXY=0
TEST_BASE="http://127.0.0.1:5173"

if command -v nginx >/dev/null 2>&1; then
  cat >"$NGINX_CONF" <<EOF2
daemon off;
events { worker_connections 1024; }
http {
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
}
EOF2

  if nginx -c "$NGINX_CONF" -t >/dev/null 2>&1; then
    nginx -c "$NGINX_CONF" &
    NGINX_PID=$!
    STARTED_NGINX=1

    if wait_http "http://$BLOG_HOST/" 30; then
      USE_PROXY=1
      TEST_BASE="http://$BLOG_HOST"
      echo "Local Nginx proxy started on $BLOG_HOST"
    else
      echo "WARN: Nginx proxy failed to respond, falling back to direct localhost:5173" >&2
      kill "$NGINX_PID" >/dev/null 2>&1 || true
      STARTED_NGINX=0
    fi
  else
    echo "WARN: Nginx config test failed, falling back to direct localhost:5173" >&2
  fi
else
  echo "WARN: nginx not found, skipping local proxy. Tests will run against localhost:5173 directly." >&2
  echo "To enable domain-based testing, install nginx or add '127.0.0.1 $BLOG_HOST' to /etc/hosts and use a local proxy." >&2
fi

echo "[5/7] Route Chain"
root_headers="$(curl -sSI "$TEST_BASE/" | tr -d '\r')"
admin_login_headers="$(curl -sSI "$TEST_BASE/admin/login" | tr -d '\r')"

# Show root and admin route status lines for quick diagnosis
echo "$root_headers" | sed -n '1p'
echo "$admin_login_headers" | sed -n '1p'

site_health="$(curl -sS "$TEST_BASE/api/health")"
direct_health="$(curl -sS "http://127.0.0.1:3001/api/health")"

echo "$site_health"
echo "$direct_health"

echo "$site_health" | grep -q '"ok":true'
echo "$direct_health" | grep -q '"ok":true'

echo "[6/7] Functional Acceptance"
assert_status_200 "/posts" "$TEST_BASE/posts"
assert_status_200 "/tags" "$TEST_BASE/tags"
assert_status_200 "/archive" "$TEST_BASE/archive"
assert_status_200 "/admin/login" "$TEST_BASE/admin/login"
assert_status_200 "/uploads/images/steam-bugs-linux.webp" "$TEST_BASE/uploads/images/steam-bugs-linux.webp"

login_response="$(
  curl -sS -X POST "$TEST_BASE/api/admin/auth/login" \
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
