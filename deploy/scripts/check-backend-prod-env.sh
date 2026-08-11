#!/usr/bin/env bash

# 后端生产环境文件检查（Rust / Axum + Postgres 版）
# 用法：./deploy/scripts/check-backend-prod-env.sh /opt/shino-blog/env/backend.env
# 期望输出：ENV_CHECK=PASS（exit 0）；任一 FAIL → ENV_CHECK=FAIL（exit 1）

set -euo pipefail

ENV_FILE="${1:-backend/.env.example}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: env file not found: $ENV_FILE" >&2
  exit 1
fi

read_env() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return 0
  fi
  echo "${line#*=}"
}

fail=0

require_non_empty() {
  local key="$1"
  local value
  value="$(read_env "$key")"
  if [[ -z "$value" ]]; then
    echo "FAIL: $key is missing or empty"
    fail=1
  else
    echo "PASS: $key is set"
  fi
}

check_not_default() {
  local key="$1"
  shift
  local value
  value="$(read_env "$key")"

  if [[ -z "$value" ]]; then
    echo "FAIL: $key is missing or empty"
    fail=1
    return
  fi

  for bad in "$@"; do
    if [[ "$value" == "$bad" ]]; then
      echo "FAIL: $key uses insecure default value: $bad"
      fail=1
      return
    fi
  done

  echo "PASS: $key is not using default placeholder"
}

check_equals() {
  local key="$1"
  local expected="$2"
  local value
  value="$(read_env "$key")"

  if [[ "$value" != "$expected" ]]; then
    echo "WARN: $key is '$value' (recommended: $expected)"
  else
    echo "PASS: $key is $expected"
  fi
}

check_dir_exists() {
  local key="$1"
  local value
  value="$(read_env "$key")"
  if [[ -z "$value" ]]; then
    echo "FAIL: $key is missing or empty"
    fail=1
    return
  fi

  if [[ ! -d "$value" ]]; then
    echo "FAIL: $key directory does not exist: $value"
    fail=1
  else
    echo "PASS: $key directory exists: $value"
  fi
}

check_pg_connect() {
  local url
  url="$(read_env "DATABASE_URL")"
  if [[ -z "$url" ]]; then
    echo "FAIL: DATABASE_URL is missing or empty"
    fail=1
    return
  fi

  if [[ "$url" != postgres://* && "$url" != postgresql://* ]]; then
    echo "FAIL: DATABASE_URL should start with postgres:// or postgresql://"
    fail=1
    return
  fi

  # 可选连通性检查：pg_isready 仅检查本地 socket，psql 需解析连接串。
  # 服务器首次部署（PG 未装 psql 客户端）时自动降级为仅格式检查，不判 FAIL。
  if command -v psql >/dev/null 2>&1; then
    if PGCONNECT_TIMEOUT=5 psql "$url" -c 'SELECT 1' >/dev/null 2>&1; then
      echo "PASS: DATABASE_URL is reachable (psql SELECT 1)"
    else
      echo "WARN: DATABASE_URL not reachable from this host (psql failed); 若在服务器上执行请检查 PG 用户/网络/防火墙"
    fi
  elif command -v pg_isready >/dev/null 2>&1; then
    local host
    host="$(sed -E 's|^postgres(ql)?://[^@]*@([^:/]+).*|\2|' <<<"$url")"
    if pg_isready -h "$host" >/dev/null 2>&1; then
      echo "PASS: DATABASE_URL host is ready (pg_isready -h $host)"
    else
      echo "WARN: pg_isready -h $host failed; 请确认 PG 已启动"
    fi
  else
    echo "WARN: psql/pg_isready not found, skip connectivity check"
  fi
}

echo "Checking backend env file: $ENV_FILE"

require_non_empty "NODE_ENV"
require_non_empty "DATABASE_URL"
require_non_empty "UPLOADS_ROOT"
require_non_empty "ADMIN_USERNAME"
require_non_empty "ADMIN_PASSWORD"
require_non_empty "ADMIN_JWT_SECRET"

# PORT 可选：Rust 侧 config.rs 默认 3001，缺失时按默认值处理（仅提示）
if [[ -z "$(read_env "PORT")" ]]; then
  echo "WARN: PORT unset, backend will default to 3001 (nginx proxy_pass must match)"
else
  echo "PASS: PORT is set"
fi

check_equals "NODE_ENV" "production"
check_not_default "ADMIN_PASSWORD" "admin123" "change-this-password"
check_not_default "ADMIN_JWT_SECRET" "change-this-secret-in-production" "change-this-jwt-secret"
check_dir_exists "UPLOADS_ROOT"
check_pg_connect

if [[ "$fail" -ne 0 ]]; then
  echo "ENV_CHECK=FAIL"
  exit 1
fi

echo "ENV_CHECK=PASS"
