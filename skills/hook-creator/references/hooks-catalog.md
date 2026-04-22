# Hook Events — Full Catalog

| Event | Fires when | Stdin payload (JSON) | Exit 0 | Exit 2 | Other non-zero | Matcher |
|-------|-----------|----------------------|--------|--------|----------------|---------|
| **PreToolUse** | Before any tool call | `{tool_name, tool_input, session_id, transcript_path, cwd}` | Allow tool | **Block tool**, stderr → Claude as feedback | Logged as error, tool runs anyway | Regex on `tool_name` |
| **PostToolUse** | After tool call completes | `{tool_name, tool_input, tool_response, ...}` | No-op | Logged but tool already ran (cannot undo) | Logged as error | Regex on `tool_name` |
| **PermissionRequest** | When the harness asks the user to approve a tool call | `{tool_name, tool_input, session_id, ...}` | Allow default prompt | **Auto-decide** (stdout JSON / stderr feedback) | Logged as error, user prompted normally | Regex on `tool_name` |
| **UserPromptSubmit** | Before Claude processes user input | `{prompt, session_id, ...}` | Pass prompt as-is | **Block prompt**, stderr → Claude | Logged | None |
| **PreCompact** | Before context auto-compaction | `{session_id, transcript_path, ...}` | Allow compaction | **Block compaction**, stderr → Claude | Logged | None |
| **SessionStart** | When a session opens | `{session_id, source: "user" \| "agent" \| "resumption"}` | Stdout appended to context | Logged | Logged | None |
| **SessionEnd** | When a session closes | `{session_id, ...}` | No-op | Logged | Logged | None |
| **Stop** | When the main agent finishes a turn | `{session_id, transcript_path, stop_hook_active, ...}` | Allow stop | **Block stop** — Claude continues with stderr as feedback | Logged | None |
| **SubagentStop** | When a subagent finishes | `{session_id, subagent_type, ...}` | Allow stop | Block subagent stop | Logged | None |
| **Notification** | When Claude shows a desktop notification | `{message, session_id, ...}` | No-op | Logged | Logged | None |
| **TeammateIdle** | (Agent Teams) when a teammate has no active task | `{teammate_name, ...}` | No-op | **Send feedback to teammate**, agent continues working | Logged | None |
| **TaskCompleted** | (Agent Teams) when a task is marked done | `{task_id, agent, ...}` | Allow completion | **Block completion**, task stays in-progress | Logged | None |

---

## Stdin contract

Every hook receives JSON on stdin with at minimum:

```json
{
  "session_id": "...",
  "transcript_path": "...",
  "cwd": "..."
}
```

Tool-call hooks add `tool_name` (string) and `tool_input` (object). PostToolUse adds `tool_response` (object).

**Always parse via jq** — never do shell string-matching on the payload:

```bash
input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
```

---

## Stdout / stderr contract

- **Stdout** is captured and used by some events:
  - `UserPromptSubmit` → appended to the conversation context
  - `SessionStart` → appended to the conversation context
  - `PreToolUse` → can mutate `tool_input` (advanced — see Anthropic docs)
- **Stderr** is shown to Claude as feedback when exit code is 2 (for blocking events)
- For non-blocking events, both stdout and stderr go to logs only

---

## Common matcher recipes (PreToolUse / PostToolUse)

| Intent | Matcher |
|--------|---------|
| All tools | `""` (empty) or omit field |
| File-write tools only | `"Edit\|Write\|NotebookEdit"` |
| Bash only | `"Bash"` |
| Network-capable tools | `"WebFetch\|WebSearch"` |
| Subagent spawning | `"Agent"` |
| MCP tools (any server) | `"mcp__.*"` |
| MCP tools (specific server) | `"mcp__github__.*"` |

---

## settings.json shape

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "timeout 10 .claude/hooks/lint.sh" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "timeout 30 .claude/hooks/run-tests.sh" }
        ]
      }
    ]
  }
}
```

Each event maps to an array of `{matcher, hooks}` blocks. Multiple blocks for the same event run in order. Within a block, multiple hook entries also run in order.

---

## Lifecycle order summary

```
SessionStart
  ↓
UserPromptSubmit  (per user message)
  ↓
PreToolUse → tool runs → PostToolUse  (per tool call, can repeat)
  ↓
SubagentStop  (when subagents finish)
  ↓
Stop  (main agent done)
  ↓
PreCompact  (if context approaches limit)
  ↓
SessionEnd
```

Notification fires asynchronously, independent of the main flow.
