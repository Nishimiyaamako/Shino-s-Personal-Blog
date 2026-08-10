#!/usr/bin/env bash
# gen-file-index.sh — 生成根 llms.txt 文件系统索引（幂等）。
#
# 输入：git -C <repo> ls-files '*.md'
# 排除：AGENTS.md、llms.txt 自身、.omo/**、.opencode/**、.trellis/**
#       （与 KB include 集一致：docs/** 入索引）
# 对每个文件提取 frontmatter type:/updated: 与首个 `# ` 标题；
# 无 frontmatter 的文件降级用标题行。
# 输出：根 llms.txt（# <仓库名> + 一行简介 + ## 文档目录 + 逐行条目，按路径排序）。
# 注意：llms.txt 为生成产物，禁止手改；由 .githooks/pre-commit 钩子自动调用。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# 遍历被 git 跟踪的 .md 文件，过滤排除集
while IFS= read -r file; do
  # 跳过工作区已不存在的文件（已删除但未提交）
  [[ -f "$REPO_ROOT/$file" ]] || continue
  # 提取 frontmatter 元数据与标题；无 frontmatter 时降级为标题行
  awk -v f="$file" '
    BEGIN { in_fm = 0; type = ""; updated = ""; title = "" }
    NR == 1 && $0 == "---" { in_fm = 1; next }
    in_fm && $0 == "---" { in_fm = 0; next }
    in_fm {
      if (type == "" && $0 ~ /^type:[[:space:]]*/) { sub(/^type:[[:space:]]*/, "", $0); type = $0; next }
      if (updated == "" && $0 ~ /^updated:[[:space:]]*/) { sub(/^updated:[[:space:]]*/, "", $0); updated = $0; next }
      next
    }
    title == "" && $0 ~ /^# / { sub(/^# /, "", $0); title = $0; exit }
    END {
      if (title == "") title = f
      if (type != "" && updated != "")
        printf "%s\t[%s|%s] %s — %s\n", f, type, updated, f, title
      else
        printf "%s\t%s — %s\n", f, f, title
    }
  ' "$REPO_ROOT/$file" >> "$tmp"
done < <(git -C "$REPO_ROOT" ls-files '*.md' \
  | grep -vE '^(AGENTS\.md|llms\.txt|\.omo/|\.opencode/|\.trellis/)')

{
  printf '# Shino-s-Personal-Blog\n\n'
  printf 'Shino s Blog 全栈个人博客项目文件系统索引，由 pre-commit 钩子自动重生成，禁止手改。\n\n'
  printf '## 文档目录\n\n'
  LC_ALL=C sort -k1,1 "$tmp" | cut -f2-
} > "$REPO_ROOT/llms.txt"

printf 'llms.txt generated: %s\n' "$REPO_ROOT/llms.txt" >&2
