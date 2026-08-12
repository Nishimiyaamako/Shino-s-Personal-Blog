#!/usr/bin/env bash

# 线上冒烟：逐项 HTTP 状态码断言（弱响应即 FAIL）
# 用法：./deploy/scripts/online-smoke.sh <domain>
# 期望输出：ONLINE_SMOKE=PASS（exit 0）；任一 FAIL → ONLINE_SMOKE=FAIL（exit 1）

set -euo pipefail

DOMAIN="${1:-}"
UPLOAD_PROBE_FILE="${UPLOAD_PROBE_FILE:-steam-bugs-linux.webp}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>" >&2
  echo "Example: $0 blog.example.com" >&2
  echo "Env: UPLOAD_PROBE_FILE 覆盖探测文件名（默认 steam-bugs-linux.webp）" >&2
  exit 1
fi

fail=0

# check <name> <expected_status> <url>
# expected_status 支持空格分隔的集合，如 "200 404"
check() {
  local name="$1"
  local expected="$2"
  local url="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" || true)"

  local ok=0
  local exp
  for exp in $expected; do
    if [[ "$code" == "$exp" ]]; then
      ok=1
      break
    fi
  done

  if [[ "$ok" -eq 1 ]]; then
    echo "PASS: $name → $code (expected: $expected)"
  else
    echo "FAIL: $name → $code (expected: $expected) — $url"
    fail=1
  fi
}

echo "[1/6] root page"
check "root page" "200" "https://${DOMAIN}/"

echo "[2/6] admin login page"
check "admin login" "200" "https://${DOMAIN}/admin/login"

echo "[3/6] health"
check "health" "200" "https://${DOMAIN}/api/health"

echo "[4/6] blog route"
check "blog route" "200" "https://${DOMAIN}/blog"

echo "[5/6] legacy posts route (expect 301 → /blog)"
check "legacy /posts" "301 308" "https://${DOMAIN}/posts"

echo "[6/6] uploads probe"
# 200=文件存在；404=文件不存在但静态代理路径通（均视为代理工作正常）
check "uploads static" "200 404" "https://${DOMAIN}/uploads/images/${UPLOAD_PROBE_FILE}"

if [[ "$fail" -ne 0 ]]; then
  echo "ONLINE_SMOKE=FAIL"
  exit 1
fi

echo "ONLINE_SMOKE=PASS"
