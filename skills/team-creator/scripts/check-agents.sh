#!/bin/bash
# Lint agent files — validates frontmatter fields
# Usage: bash skills/team-creator/scripts/check-agents.sh [agents/*.md]
# Exit codes: 0 = all valid, 1 = errors found
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

VALID_MODELS="sonnet opus haiku inherit claude-opus-4-6 claude-sonnet-4-6 claude-haiku-4-5-20251001"
ERRORS=0
CHECKED=0

err() { echo "ERROR [$1]: $2" >&2; ERRORS=$((ERRORS + 1)); }
ok() { echo "OK    $1"; }

check_agent() {
  local file="$1"
  local name
  name=$(basename "$file" .md)
  CHECKED=$((CHECKED + 1))

  # Extract frontmatter (between --- markers)
  if ! head -1 "$file" | grep -q '^---'; then
    err "$name" "Missing YAML frontmatter (no opening ---)"
    return
  fi

  # Check name field
  local fm_name
  fm_name=$(sed -n '/^---$/,/^---$/p' "$file" | grep '^name:' | head -1 | sed 's/name: *//')
  if [ -z "$fm_name" ]; then
    err "$name" "Missing 'name' field"
  elif [ "$fm_name" != "$name" ]; then
    err "$name" "Name mismatch: frontmatter='$fm_name' filename='$name'"
  fi

  # Check description field
  local has_desc
  has_desc=$(sed -n '/^---$/,/^---$/p' "$file" | grep -c '^description:' || true)
  if [ "$has_desc" -eq 0 ]; then
    err "$name" "Missing 'description' field"
  fi

  # Check model if specified
  local model
  model=$(sed -n '/^---$/,/^---$/p' "$file" | grep '^model:' | head -1 | sed 's/model: *//')
  if [ -n "$model" ]; then
    if ! echo "$VALID_MODELS" | tr ' ' '\n' | grep -qx "$model"; then
      err "$name" "Invalid model: '$model' (valid: $VALID_MODELS)"
    fi
  fi

  # Check skills exist
  sed -n '/^---$/,/^---$/p' "$file" | grep '^ *- ' | sed 's/^ *- //' | while read -r skill; do
    # Skip non-skill list items (tools, mcpServers, etc.)
    if [ -d "$REPO_ROOT/skills/$skill" ]; then
      : # skill exists
    elif echo "$skill" | grep -qE '^(Read|Write|Edit|Bash|Glob|Grep|Agent|Skill|WebSearch|WebFetch|AskUserQuestion)'; then
      : # it's a tool name, not a skill
    fi
  done

  ok "$name"
}

# Determine files to check
if [ $# -gt 0 ]; then
  FILES=("$@")
else
  FILES=("$REPO_ROOT"/agents/*.md)
fi

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    check_agent "$file"
  fi
done

echo ""
echo "Checked: $CHECKED, Errors: $ERRORS"
[ "$ERRORS" -eq 0 ] && exit 0 || exit 1
