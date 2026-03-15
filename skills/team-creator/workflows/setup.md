# Team Setup: Parallel Mode Prerequisites

This workflow checks and configures prerequisites for parallel team execution (Agent Teams + tmux).

Pipeline mode (sequential subagents) requires NO setup and works everywhere.

---

## Step 1: Run Prerequisite Check

```bash
bash skills/team-creator/scripts/check-env.sh
```

Review output. If everything is OK, parallel mode is ready.

---

## Step 2: Fix Missing Prerequisites

### Agent Teams experimental flag

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is not set:

**Option A — Shell profile (persistent):**
```bash
echo 'export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1' >> ~/.zshrc
source ~/.zshrc
```

**Option B — Project settings (project-scoped):**
Add to `.claude/settings.local.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Option B is preferred for portability — team members get the setting from the project.

### tmux

If tmux is not installed:

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux

# Verify
tmux -V
```

### Claude CLI

If `claude` CLI is not available, it should be installed globally:
```bash
npm install -g @anthropic-ai/claude-code
```

---

## Step 3: Verify

Run the check again:
```bash
bash skills/team-creator/scripts/check-env.sh
```

All items should show OK. If Claude CLI is missing but you're running inside Claude Code already, the parallel mode will use internal Agent tool instead of CLI — this is fine for pipeline mode.

---

## Step 4: Test tmux Integration

Quick test that tmux sessions work:
```bash
tmux new-session -d -s test-team
tmux list-sessions
tmux kill-session -t test-team
```

If this works, parallel mode with tmux panes is ready.

---

## Teammate Mode Configuration

For Agent Teams with tmux panes, Claude Code supports native `teammateMode`:

Add to `.claude/settings.local.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
```

This automatically creates split panes for each teammate in a tmux session.
