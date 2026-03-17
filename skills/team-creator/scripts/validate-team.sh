#!/bin/bash
# Validate team config — checks JSON structure, agent existence, flow validity
# Usage: bash skills/team-creator/scripts/validate-team.sh <team.json>
# Exit codes: 0 = valid, 1 = invalid, 2 = needs migration
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-team.json>" >&2
  exit 1
fi

TEAM_FILE="$1"
ERRORS=0

err() { echo "ERROR: $1" >&2; ERRORS=$((ERRORS + 1)); }
warn() { echo "WARN:  $1" >&2; }
ok() { echo "OK     $1"; }

# 1. File exists and is valid JSON
if [ ! -f "$TEAM_FILE" ]; then
  err "File not found: $TEAM_FILE"
  exit 1
fi

if ! jq empty "$TEAM_FILE" 2>/dev/null; then
  err "Invalid JSON: $TEAM_FILE"
  exit 1
fi
ok "Valid JSON"

# 2. Required fields
for field in version name agents flow; do
  if [ "$(jq -r ".$field // empty" "$TEAM_FILE")" = "" ]; then
    err "Missing required field: $field"
  fi
done

# 3. Version check against plugin version
PLUGIN_VERSION=""
if [ -f "$REPO_ROOT/.claude-plugin/plugin.json" ]; then
  PLUGIN_VERSION=$(jq -r '.version // empty' "$REPO_ROOT/.claude-plugin/plugin.json")
fi
TEAM_VERSION=$(jq -r '.version // empty' "$TEAM_FILE")

if [ -n "$PLUGIN_VERSION" ] && [ -n "$TEAM_VERSION" ] && [ "$TEAM_VERSION" != "$PLUGIN_VERSION" ]; then
  warn "Version mismatch: team=$TEAM_VERSION plugin=$PLUGIN_VERSION"
  warn "See skills/team-creator/references/migrations.md"
  # Don't exit yet — continue validation, report at end
fi

# 4. All agents exist as files
jq -r '.agents[]' "$TEAM_FILE" 2>/dev/null | while read -r agent; do
  if [ ! -f "$REPO_ROOT/agents/${agent}.md" ]; then
    err "Agent not found: agents/${agent}.md"
  else
    ok "Agent exists: $agent"
  fi
done

# 5. Flow type is known
KNOWN_FLOWS="pipeline pipeline-parallel builder-validator twin-review swarm-review devils-advocate fan-out diverge-converge purple-team custom"
FLOW_TYPE=$(jq -r '.flow.type // empty' "$TEAM_FILE")
if [ -n "$FLOW_TYPE" ]; then
  if echo "$KNOWN_FLOWS" | tr ' ' '\n' | grep -qx "$FLOW_TYPE"; then
    ok "Flow type: $FLOW_TYPE"
  else
    err "Unknown flow type: $FLOW_TYPE (known: $KNOWN_FLOWS)"
  fi
fi

# 6. Agents in stages exist in agents array
AGENTS_LIST=$(jq -r '.agents[]' "$TEAM_FILE" 2>/dev/null | sort)
jq -r '.flow.stages[]? | if .agent then .agent elif .agents then .agents[] else empty end' "$TEAM_FILE" 2>/dev/null | sort -u | while read -r stage_agent; do
  if ! echo "$AGENTS_LIST" | grep -qx "$stage_agent"; then
    err "Stage references agent '$stage_agent' not in agents array"
  fi
done

# 7. Report
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS error(s)" >&2
  exit 1
fi

if [ -n "$PLUGIN_VERSION" ] && [ -n "$TEAM_VERSION" ] && [ "$TEAM_VERSION" != "$PLUGIN_VERSION" ]; then
  echo "VALID but needs migration ($TEAM_VERSION → $PLUGIN_VERSION)"
  exit 2
fi

echo "VALID"
exit 0
