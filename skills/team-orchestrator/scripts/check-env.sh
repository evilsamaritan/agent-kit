#!/bin/bash
# Team Orchestration — Prerequisites Check
# Run: bash skills/team-creator/scripts/check-env.sh

echo "=== Team Orchestration Prerequisites ==="
echo ""

# Agent Teams experimental flag
if [ "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" = "1" ]; then
  echo "OK  Agent Teams: enabled"
else
  echo "--  Agent Teams: not enabled (parallel tmux mode unavailable)"
  echo "    Set: export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"
  echo "    Or add to .claude/settings.local.json: { \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }"
fi

# tmux
if command -v tmux &>/dev/null; then
  echo "OK  tmux: $(tmux -V)"
else
  echo "--  tmux: not found"
  echo "    Install: brew install tmux (macOS) or apt install tmux (Linux)"
fi

# claude CLI
if command -v claude &>/dev/null; then
  echo "OK  claude CLI: available"
else
  echo "--  claude CLI: not in PATH (ok if running inside Claude Code)"
fi

# Available agents
echo ""
agent_count=0
if [ -d "agents" ]; then
  agent_count=$(ls agents/*.md 2>/dev/null | wc -l | tr -d ' ')
fi
echo "Agents available: $agent_count"
if [ "$agent_count" -gt 0 ]; then
  ls agents/*.md 2>/dev/null | while read f; do
    name=$(basename "$f" .md)
    echo "  - $name"
  done
fi

# Saved teams
echo ""
saved_count=0
if [ -d ".claude/teams" ]; then
  saved_count=$(find .claude/teams -maxdepth 2 -name team.json -type f 2>/dev/null | wc -l | tr -d ' ')
fi
if [ "$saved_count" -gt 0 ]; then
  echo "Saved teams: $saved_count under .claude/teams/*/team.json"
  find .claude/teams -maxdepth 2 -name team.json -type f 2>/dev/null | while read f; do
    name=$(dirname "$f" | xargs basename)
    echo "  - $name"
  done
else
  echo "Saved teams: none (will use built-in catalog)"
fi

echo ""
echo "Pipeline mode: always available (no prerequisites)"
echo "Parallel mode: requires Agent Teams + tmux"
