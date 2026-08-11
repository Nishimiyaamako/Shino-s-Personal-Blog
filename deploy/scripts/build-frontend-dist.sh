#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
ARTIFACTS_DIR="$ROOT_DIR/deploy/artifacts"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="frontend-dist-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="$ARTIFACTS_DIR/$ARCHIVE_NAME"
LATEST_ARCHIVE_PATH="$ARTIFACTS_DIR/frontend-dist-latest.tar.gz"

mkdir -p "$ARTIFACTS_DIR"

cd "$FRONTEND_DIR"

if [ ! -d node_modules ]; then
  if command -v bun >/dev/null 2>&1; then
    BUN_INSTALL="${BUN_INSTALL:-/tmp/bun}" BUN_TMPDIR="${BUN_TMPDIR:-/tmp}" bun install --frozen-lockfile
  else
    npm ci
  fi
fi

if command -v bun >/dev/null 2>&1; then
  bun run build
else
  npm run build
fi

tar -C "$FRONTEND_DIR/dist" -czf "$ARCHIVE_PATH" .
cp "$ARCHIVE_PATH" "$LATEST_ARCHIVE_PATH"

echo "Build done: $ARCHIVE_PATH"
echo "Latest alias: $LATEST_ARCHIVE_PATH"
echo "Upload tip: 在服务器 /opt/shino-blog/frontend-dist 解压该归档（nginx root 指向该目录），确保 index.html 位于根目录。"
