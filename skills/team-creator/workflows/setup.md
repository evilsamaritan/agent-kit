# Team Creator: Creation Prerequisites

This workflow checks dependencies needed to *create* a team configuration. For runtime prerequisites (Agent Teams, tmux, Claude CLI), see `/team-orchestrator setup`.

---

## Required tools

```bash
# JSON manipulation (used by validate-team.sh)
which jq || (
  echo "Install jq:";
  echo "  macOS:  brew install jq";
  echo "  Linux:  sudo apt install jq"
)

# Agents directory must exist
test -d agents/ && echo "OK: agents/ directory exists" || (
  echo "MISSING: agents/ directory — create it and populate via /agent-creator before composing a team"
)
```

---

## Verify scripts work

```bash
delegate to /agent-creator for any agent that does not yet exist in agents/
bash skills/team-creator/scripts/validate-team.sh --help 2>&1 | head -3
bash skills/team-creator/scripts/check-agents.sh --help 2>&1 | head -3
```

If any script fails with "command not found", verify executable bit:
```bash
chmod +x skills/team-creator/scripts/*.sh
```

---

## Plugin schema version

Teams are versioned alongside the plugin. Check current schema version:

```bash
jq -r '.version' .claude-plugin/plugin.json
```

Saved teams under `.claude/teams/<name>/team.json` reference this version. On version mismatch at runtime, `validate-team.sh` will guide you through migration. See `references/migrations.md` for details.
