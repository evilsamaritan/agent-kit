# tmux Layouts for Agent Teams

## Layout Principles

- **Lead pane** (left) = 50% width — orchestrator or main session
- **Agent panes** (right) = 50% width, split into 2 columns
- Agents distribute proportionally within columns
- Columns fill top-to-bottom, left-to-right

---

## Layout: 2 Agents

```
┌──────────────────┬──────────────────┐
│                  │                  │
│                  │                  │
│      LEAD        │     agent-1      │
│                  │                  │
│                  │                  │
└──────────────────┴──────────────────┘
         50%                50%
```

```bash
tmux new-session -d -s team -x 200 -y 50
tmux split-window -h -t team
# Pane 0: lead, Pane 1: agent-1
```

---

## Layout: 3 Agents

```
┌──────────────────┬──────────────────┐
│                  │     agent-1      │
│                  ├──────────────────┤
│      LEAD        │     agent-2      │
│                  ├──────────────────┤
│                  │     agent-3      │
└──────────────────┴──────────────────┘
         50%              50%
```

```bash
tmux new-session -d -s team -x 200 -y 50
tmux split-window -h -t team
tmux split-window -v -t team:0.1
tmux split-window -v -t team:0.2
# Pane 0: lead, Panes 1-3: agents
```

---

## Layout: 4 Agents (2x2 grid)

```
┌──────────────────┬─────────┬─────────┐
│                  │ agent-1 │ agent-3  │
│      LEAD        ├─────────┼─────────┤
│                  │ agent-2 │ agent-4  │
└──────────────────┴─────────┴─────────┘
         50%          25%       25%
```

```bash
tmux new-session -d -s team -x 200 -y 50
tmux split-window -h -t team -p 50
tmux split-window -h -t team:0.1 -p 50
tmux split-window -v -t team:0.1
tmux split-window -v -t team:0.3
# Pane 0: lead, Panes 1-4: agents in 2x2
```

---

## Layout: 5-6 Agents (2x3 grid)

```
┌──────────────────┬─────────┬─────────┐
│                  │ agent-1 │ agent-4  │
│                  ├─────────┼─────────┤
│      LEAD        │ agent-2 │ agent-5  │
│                  ├─────────┼─────────┤
│                  │ agent-3 │ agent-6  │
└──────────────────┴─────────┴─────────┘
         50%          25%       25%
```

```bash
tmux new-session -d -s team -x 200 -y 50
tmux split-window -h -t team -p 50
tmux split-window -h -t team:0.1 -p 50
# Left column
tmux split-window -v -t team:0.1
tmux split-window -v -t team:0.2
# Right column
tmux split-window -v -t team:0.3
tmux split-window -v -t team:0.4
```

---

## Sending Commands to Panes

After creating layout, send claude commands to each pane:

```bash
# Lead pane (0) — user's main session or orchestrator
tmux send-keys -t team:0.0 'claude' Enter

# Agent panes — each gets its own claude session with agent
tmux send-keys -t team:0.1 'claude --agent architect "Design auth system"' Enter
tmux send-keys -t team:0.2 'claude --agent backend "Implement auth API"' Enter
tmux send-keys -t team:0.3 'claude --agent frontend "Implement login UI"' Enter
tmux send-keys -t team:0.4 'claude --agent qa "Write auth tests"' Enter
```

---

## Attaching to Session

```bash
tmux attach -t team
```

**Navigation:**
- `Ctrl+B, o` — cycle through panes
- `Ctrl+B, arrow` — move to adjacent pane
- `Ctrl+B, z` — zoom into current pane (toggle)
- `Ctrl+B, q` — show pane numbers

---

## Cleanup

```bash
tmux kill-session -t team
```

---

## Native Agent Teams Mode

If using Claude Code's built-in Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), the tmux layout is handled automatically when `teammateMode: "tmux"` is set in settings.

The layouts above are for manual orchestration (Approach C: ad-hoc spawn) where each pane runs an independent `claude` session.
