#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${1:-backend/.env}"

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

check_path_like() {
  local key="$1"
  local value
  value="$(read_env "$key")"
  if [[ -z "$value" ]]; then
    echo "FAIL: $key is missing or empty"
    fail=1
    return
  fi

  if [[ "$value" != /* ]]; then
    echo "WARN: $key should use an absolute path in production: $value"
  else
    echo "PASS: $key uses absolute path"
  fi
}

echo "Checking backend env file: $ENV_FILE"

require_non_empty "NODE_ENV"
require_non_empty "PORT"
require_non_empty "DATABASE_PATH"
require_non_empty "UPLOADS_ROOT"
require_non_empty "ADMIN_USERNAME"
require_non_empty "ADMIN_PASSWORD"
require_non_empty "ADMIN_JWT_SECRET"

check_equals "NODE_ENV" "production"
check_not_default "ADMIN_PASSWORD" "admin123" "change-this-password"
check_not_default "ADMIN_JWT_SECRET" "change-this-secret-in-production" "change-this-jwt-secret"
check_path_like "DATABASE_PATH"
check_path_like "UPLOADS_ROOT"

if [[ "$fail" -ne 0 ]]; then
  echo "ENV_CHECK=FAIL"
  exit 1
fi

echo "ENV_CHECK=PASS"
