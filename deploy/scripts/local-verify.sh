#!/usr/bin/env bash

# 本地质量门（Rust 后端版）：
#   cargo fmt --check / clippy --all-targets -- -D warnings / test --all-targets
#   前端 build + 自检 grep 命令
#   旧 Bun 后端 typecheck/test（bun 存在时执行，缺失则跳过并提示——迁移窗口期环境自适应）
# 用法：./deploy/scripts/local-verify.sh
# 期望输出：QUALITY_GATE=PASS / LOCAL_VERIFY=PASS（任一失败 exit 非 0）

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUST_DIR="$ROOT_DIR/backend/rust"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd cargo
need_cmd git

echo "[1/6] Rust format check"
cd "$RUST_DIR"
cargo fmt --check

echo "[2/6] Rust clippy (all targets, warnings as errors)"
cargo clippy --all-targets -- -D warnings

echo "[3/6] Rust tests (all targets)"
cargo test --all-targets

echo "[4/6] Frontend build"
cd "$FRONTEND_DIR"
if command -v bun >/dev/null 2>&1; then
  bun run build
elif command -v npm >/dev/null 2>&1; then
  npm run build
else
  echo "Neither bun nor npm found; skipping frontend build" >&2
  exit 1
fi

echo "[5/6] Legacy Bun backend checks (if toolchain available)"
if command -v bun >/dev/null 2>&1; then
  cd "$BACKEND_DIR"
  bun run typecheck
  bun run test
else
  echo "SKIP: bun not installed; skipped legacy Bun backend typecheck/test (Rust 迁移窗口期)"
fi

echo "[6/6] Self-check greps"
cd "$ROOT_DIR"
echo "--- 待核验标记（期望为空） ---"
grep -rn '⚠ 待核验' . --include='*.md' || true
echo "--- 凭据扫描（期望仅键名与 <凭据位置> 占位） ---"
grep -rnE '(password|passwd|api[_-]?key|token|secret|private[_-]?key)[[:space:]]*[:=]' . --include='*.md' || true
echo "--- hooksPath（期望 .githooks） ---"
git config core.hooksPath

echo "QUALITY_GATE=PASS"
echo "LOCAL_VERIFY=PASS"
