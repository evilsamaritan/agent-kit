# Hook Execution Order

How Claude Code resolves hooks across scopes and within a single event.

---

## Scope precedence (loading order)

Hooks merge from multiple settings files in this order:

1. **Global**: `~/.claude/settings.json`
2. **User**: `~/.claude/settings.local.json` (rare)
3. **Project**: `${CLAUDE_PROJECT_DIR}/.claude/settings.json`
4. **Local**: `${CLAUDE_PROJECT_DIR}/.claude/settings.local.json` (gitignored)

For each event, the harness collects hooks from **all** scopes that have them. Project-scope hooks do **not** override global — they **add to** them. To suppress a global hook in a project, you have to know its content and explicitly remove it from the global file.

→ Use `bash skills/hook-creator/scripts/list-hooks.sh` to see the merged effective set.

---

## Per-event hook ordering

Within a single event, hooks run in the order they're encountered:

```
[global hooks for event]
  → [user hooks for event]
  → [project hooks for event]
  → [local hooks for event]
```

Within a single scope, the order is the array order in the JSON.

If any hook returns exit code 2 on a blocking event (PreToolUse, Stop, etc.), the harness short-circuits — remaining hooks are NOT run.

---

## Tool-call lifecycle

```
User asks Claude to do X
      ↓
Claude decides to call tool T
      ↓
PreToolUse hooks fire (matcher checked per hook)
      ├── Any hook exits 2 → tool BLOCKED, stderr → Claude
      └── All hooks exit 0 → continue
      ↓
Tool T executes
      ↓
PostToolUse hooks fire
      └── Exit codes IGNORED (tool already ran)
      ↓
Claude continues with tool result
```

---

## Stop / SubagentStop lifecycle

```
Agent finishes generating its turn
      ↓
SubagentStop (if it was a subagent) OR Stop (if main agent)
      ├── Any hook exits 2 → STOP BLOCKED, stderr → agent as feedback
      │     Agent receives feedback and continues working
      └── All hooks exit 0 → agent stops, control returns to user
```

This is the mechanism for "don't stop until tests pass" — a Stop hook that runs the test suite and exits 2 if it fails.

---

## UserPromptSubmit lifecycle

```
User types message and submits
      ↓
UserPromptSubmit hooks fire
      ├── Any hook exits 2 → PROMPT BLOCKED, stderr → user
      └── All hooks exit 0 → continue
      ↓
Hook stdout (if any) is appended to the conversation context
      ↓
Claude processes the user message + appended context
```

Use this to inject project context, redact secrets from prompts, or block prompts that match forbidden patterns.

---

## Compaction lifecycle

```
Conversation approaches context limit
      ↓
PreCompact hooks fire
      ├── Any hook exits 2 → COMPACTION BLOCKED, stderr → Claude
      └── All hooks exit 0 → compaction proceeds
      ↓
Harness compacts older messages
```

Use PreCompact to dump important state to disk before it's summarized away.

---

## Session lifecycle

```
Claude Code starts (or session resumes)
      ↓
SessionStart hooks fire (source: "user" | "agent" | "resumption")
      └── Stdout appended to system context
      ↓
[normal conversation flow with tool calls]
      ↓
Session closes
      ↓
SessionEnd hooks fire
      └── Exit codes ignored
```

---

## Agent Teams hooks

```
Lead spawns teammate T
      ↓
T works on tasks until idle
      ↓
TeammateIdle hooks fire
      ├── Any hook exits 2 → feedback sent to T, T continues
      └── All hooks exit 0 → T waits for next task
      ↓
T marks a task as completed
      ↓
TaskCompleted hooks fire
      ├── Any hook exits 2 → completion BLOCKED, task stays in-progress
      └── All hooks exit 0 → task marked done
```

These are the mechanisms for quality gates ("don't claim a task is done if tests fail", "don't go idle if there are unaddressed review comments").

---

## Composition examples

### Same matcher, different scopes

Global has:
```json
{"PreToolUse": [{"matcher": "Bash", "hooks": [{"command": "audit-bash.sh"}]}]}
```

Project adds:
```json
{"PreToolUse": [{"matcher": "Bash", "hooks": [{"command": "project-bash-check.sh"}]}]}
```

Both run on every Bash call: `audit-bash.sh` then `project-bash-check.sh`.

### Conflicting blocks

Global has:
```json
{"PreToolUse": [{"matcher": "Bash", "hooks": [{"command": "block-rm.sh"}]}]}
```

Project has:
```json
{"PreToolUse": [{"matcher": "Bash", "hooks": [{"command": "fast-allow.sh"}]}]}
```

If `block-rm.sh` exits 2 first, `fast-allow.sh` never runs.

### Suppressing a global hook in one project

There is no built-in "negate" for hooks. Either:
- Edit the global file to make the hook conditional on cwd
- Move the hook from global to user/project scope where you can manage it explicitly
