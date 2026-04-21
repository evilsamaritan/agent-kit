#!/usr/bin/env bash
# List all effective Claude Code hooks across all scopes.
# Usage: list-hooks.sh

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

scopes=(
  "global|$HOME/.claude/settings.json"
  "user|$HOME/.claude/settings.local.json"
  "project|$PROJECT_DIR/.claude/settings.json"
  "local|$PROJECT_DIR/.claude/settings.local.json"
)

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required. Install with: brew install jq | sudo apt install jq" >&2
  exit 1
fi

found_any=0

printf "%-8s %-18s %-20s %s\n" "SCOPE" "EVENT" "MATCHER" "COMMAND"
printf "%-8s %-18s %-20s %s\n" "-----" "-----" "-------" "-------"

for entry in "${scopes[@]}"; do
  scope="${entry%%|*}"
  file="${entry#*|}"

  [ -f "$file" ] || continue
  if ! jq empty "$file" 2>/dev/null; then
    echo "$(printf '%-8s' "$scope") (file exists but invalid JSON: $file)" >&2
    continue
  fi

  # Walk .hooks.<event>[].matcher and .hooks.<event>[].hooks[].command
  events=$(jq -r '.hooks // {} | keys[]?' "$file" 2>/dev/null || true)
  for event in $events; do
    n_blocks=$(jq -r ".hooks.\"$event\" | length" "$file")
    for ((i=0; i<n_blocks; i++)); do
      matcher=$(jq -r ".hooks.\"$event\"[$i].matcher // \"\"" "$file")
      [ -z "$matcher" ] && matcher="(any)"
      n_cmds=$(jq -r ".hooks.\"$event\"[$i].hooks // [] | length" "$file")
      for ((j=0; j<n_cmds; j++)); do
        cmd=$(jq -r ".hooks.\"$event\"[$i].hooks[$j].command // \"\"" "$file")
        # Truncate command for display
        if [ "${#cmd}" -gt 80 ]; then
          cmd="${cmd:0:77}..."
        fi
        printf "%-8s %-18s %-20s %s\n" "$scope" "$event" "$matcher" "$cmd"
        found_any=1
      done
    done
  done
done

if [ "$found_any" -eq 0 ]; then
  echo "" >&2
  echo "No hooks configured in any scope." >&2
fi

# Summary
echo "" >&2
echo "Files inspected:" >&2
for entry in "${scopes[@]}"; do
  scope="${entry%%|*}"
  file="${entry#*|}"
  if [ -f "$file" ]; then
    echo "  [$scope] $file" >&2
  else
    echo "  [$scope] $file (not present)" >&2
  fi
done
