#!/bin/bash
# Scaffold agent files for a team — idempotent, skips existing files
# Usage: bash skills/team-creator/scripts/scaffold-team.sh <team-name> <role1> [role2...] [--skills skill1,skill2]
# Example: bash scripts/scaffold-team.sh poker-ui explorer implementer tester reviewer --skills frontend,react
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/agents"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <team-name> <role1> [role2...] [--skills skill1,skill2]" >&2
  exit 1
fi

TEAM="$1"; shift
ROLES=()
SKILLS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --skills) SKILLS="$2"; shift 2 ;;
    *) ROLES+=("$1"); shift ;;
  esac
done

if [ ${#ROLES[@]} -eq 0 ]; then
  echo "ERROR: At least one role required" >&2
  exit 1
fi

# Role → tools mapping
tools_for_role() {
  case "$1" in
    explorer|reviewer|validator|auditor)
      echo "[Read, Grep, Glob]" ;;
    implementer|builder|developer)
      echo "[Read, Grep, Glob, Edit, Write, Bash, Skill]" ;;
    tester)
      echo "[Read, Grep, Glob, Edit, Write, Bash]" ;;
    planner|aggregator)
      echo "[Read, Grep, Glob, Skill]" ;;
    *)
      echo "[Read, Grep, Glob, Edit, Write, Bash, Skill]" ;;
  esac
}

# Role → permission mode
permission_for_role() {
  case "$1" in
    explorer|reviewer|validator|auditor) echo "plan" ;;
    *) echo "acceptEdits" ;;
  esac
}

# Role → description
description_for_role() {
  local team="$1" role="$2"
  case "$role" in
    explorer) echo "Explore and analyze ${team} codebase. Read-only investigation, planning, and design." ;;
    implementer) echo "Implement features and changes for ${team}. Writes production code." ;;
    tester) echo "Write and run tests for ${team}. Creates test files only." ;;
    reviewer) echo "Review ${team} code for quality, correctness, and best practices. Read-only." ;;
    builder) echo "Implement and iterate on ${team} code. Works in builder-validator loop." ;;
    validator) echo "Validate ${team} code quality. Read-only, surfaces issues for builder to fix." ;;
    planner) echo "Plan and decompose ${team} tasks into work units." ;;
    aggregator) echo "Aggregate and synthesize results from parallel ${team} workers." ;;
    *) echo "Specialist agent for ${team} ${role} tasks." ;;
  esac
}

CREATED=0
SKIPPED=0

for role in "${ROLES[@]}"; do
  AGENT_NAME="${TEAM}-${role}"
  AGENT_FILE="$AGENTS_DIR/${AGENT_NAME}.md"

  if [ -f "$AGENT_FILE" ]; then
    echo "SKIP   $AGENT_NAME (already exists)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  TOOLS=$(tools_for_role "$role")
  PERM=$(permission_for_role "$role")
  DESC=$(description_for_role "$TEAM" "$role")

  # Build skills YAML
  SKILLS_YAML=""
  if [ -n "$SKILLS" ]; then
    SKILLS_YAML="skills:"
    IFS=',' read -ra SKILL_ARRAY <<< "$SKILLS"
    for skill in "${SKILL_ARRAY[@]}"; do
      SKILLS_YAML="${SKILLS_YAML}
  - ${skill}"
    done
  fi

  cat > "$AGENT_FILE" << AGENT
---
name: ${AGENT_NAME}
description: "${DESC}"
model: sonnet
tools: ${TOOLS}
permissionMode: ${PERM}
maxTurns: 20
${SKILLS_YAML}
---

You are the ${role} for the ${TEAM} team.

**Your job:** $(description_for_role "$TEAM" "$role")

**Rules:**
- Stay within your role — do not perform tasks outside your specialization
- Follow the team pipeline — your output feeds into the next stage
- Be thorough but concise in your findings/output
AGENT

  echo "CREATE $AGENT_NAME → $AGENT_FILE"
  CREATED=$((CREATED + 1))
done

echo ""
echo "Created: $CREATED, Skipped: $SKIPPED"

# Create team directory and config
TEAM_DIR="$REPO_ROOT/.claude/teams/${TEAM}"
TEAM_JSON="$TEAM_DIR/team.json"

if [ ! -f "$TEAM_JSON" ]; then
  mkdir -p "$TEAM_DIR"

  # Build agents JSON array
  AGENTS_JSON=$(printf '%s\n' "${ROLES[@]}" | sed "s/^/\"${TEAM}-/" | sed 's/$/"/' | paste -sd',' - | sed 's/^/[/' | sed 's/$/]/')

  # Get plugin version
  VERSION="1.1.0"
  if [ -f "$REPO_ROOT/.claude-plugin/plugin.json" ]; then
    VERSION=$(jq -r '.version // "1.1.0"' "$REPO_ROOT/.claude-plugin/plugin.json")
  fi

  cat > "$TEAM_JSON" << CONFIG
{
  "version": "${VERSION}",
  "name": "${TEAM}",
  "description": "${TEAM} development team",
  "created": "$(date +%Y-%m-%d)",
  "agents": ${AGENTS_JSON},
  "flow": {
    "type": "pipeline",
    "stages": []
  },
  "options": {
    "twin_review": false,
    "twin_models": [],
    "context_compression": true,
    "max_iterations": 1,
    "quality_gate": false
  }
}
CONFIG
  echo "CREATE team config → $TEAM_JSON"
  echo "NOTE:  Edit flow.stages in $TEAM_JSON to define your pipeline"
else
  echo "SKIP   team config (already exists)"
fi
