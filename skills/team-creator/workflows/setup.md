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

## Agent Teams Display Modes

Agent Teams support two display modes. The lead session spawns teammates automatically — no separate flag needed.

### In-process mode (default)

Teammates run inside the lead's process. Navigate with keyboard shortcuts:
- `Shift+Down` — cycle through teammates
- Type to message the active teammate
- `Ctrl+T` — view shared task list

Works everywhere, no tmux needed.

### Split panes mode (auto in tmux/iTerm2)

If Claude is started **inside** a tmux session or iTerm2, it auto-detects and creates split panes for each teammate. Each pane shows a separate teammate's output.

```bash
# Start tmux first, then launch Claude inside it
tmux new-session -s team
# Inside tmux:
claude
```

**Important:** Claude must be started inside tmux for split panes. Starting outside tmux and trying to switch does NOT work — tmux detection happens at startup.

### Environment setup

Add to `.claude/settings.local.json`:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or export in shell profile:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```
