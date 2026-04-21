#!/bin/bash
# Lint agent files — validates frontmatter fields and preloaded skills
# Usage: bash skills/team-creator/scripts/check-agents.sh [agents/*.md]
# Exit codes: 0 = all valid, 1 = errors found
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

VALID_MODELS="sonnet opus haiku inherit claude-opus-4-7 claude-opus-4-6 claude-sonnet-4-6 claude-haiku-4-5-20251001"
ERRORS=0
CHECKED=0

err() { echo "ERROR [$1]: $2" >&2; ERRORS=$((ERRORS + 1)); }
ok()  { echo "OK    $1"; }

# Extract a single-line frontmatter field value (e.g. `name: foo` → `foo`)
fm_field() {
  local file="$1" field="$2"
  awk -v f="$field" '
    BEGIN { in_fm=0 }
    /^---[[:space:]]*$/ { in_fm = !in_fm; next }
    in_fm && $1 == f":" { sub(/^[^:]*:[[:space:]]*/, ""); print; exit }
  ' "$file"
}

# Extract preloaded skills list — supports both inline `skills: [a, b]` and block form
fm_skills() {
  local file="$1"
  awk '
    BEGIN { in_fm=0; in_list=0 }
    /^---[[:space:]]*$/ { in_fm = !in_fm; in_list=0; next }
    !in_fm { next }
    /^skills:[[:space:]]*\[/ {
      line = $0
      sub(/^skills:[[:space:]]*\[/, "", line)
      sub(/\].*$/, "", line)
      gsub(/[[:space:]]/, "", line)
      n = split(line, items, ",")
      for (i=1; i<=n; i++) if (items[i] != "") print items[i]
      in_list = 0
      next
    }
    /^skills:[[:space:]]*$/ { in_list = 1; next }
    in_list && /^[[:space:]]*-[[:space:]]/ {
      item = $0
      sub(/^[[:space:]]*-[[:space:]]*/, "", item)
      gsub(/[[:space:]]/, "", item)
      if (item != "") print item
      next
    }
    in_list && /^[^[:space:]-]/ { in_list = 0 }
  ' "$file"
}

check_agent() {
  local file="$1"
  local name
  name=$(basename "$file" .md)
  CHECKED=$((CHECKED + 1))

  if ! head -1 "$file" | grep -q '^---'; then
    err "$name" "Missing YAML frontmatter (no opening ---)"
    return
  fi

  local fm_name
  fm_name=$(fm_field "$file" "name")
  if [ -z "$fm_name" ]; then
    err "$name" "Missing 'name' field"
  elif [ "$fm_name" != "$name" ]; then
    err "$name" "Name mismatch: frontmatter='$fm_name' filename='$name'"
  fi

  local description
  description=$(fm_field "$file" "description")
  if [ -z "$description" ]; then
    err "$name" "Missing 'description' field"
  fi

  local model
  model=$(fm_field "$file" "model")
  if [ -n "$model" ]; then
    if ! echo "$VALID_MODELS" | tr ' ' '\n' | grep -qx "$model"; then
      err "$name" "Invalid model: '$model' (valid: $VALID_MODELS)"
    fi
  fi

  local skill missing=0
  while IFS= read -r skill; do
    [ -z "$skill" ] && continue
    if [ ! -d "$REPO_ROOT/skills/$skill" ]; then
      err "$name" "Preloaded skill not found: skills/$skill"
      missing=$((missing + 1))
    fi
  done < <(fm_skills "$file")

  if [ "$missing" -eq 0 ] && [ -n "$fm_name" ] && [ "$fm_name" = "$name" ] && [ -n "$description" ]; then
    ok "$name"
  fi
}

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
