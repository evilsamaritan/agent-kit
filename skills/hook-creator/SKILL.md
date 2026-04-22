---
name: hook-creator
description: Design and validate Claude Code hooks (PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd, UserPromptSubmit, PreCompact, Notification, SubagentStop, TeammateIdle, TaskCompleted). Use when adding a hook, auditing existing hooks, troubleshooting a hook that did not fire or fired wrongly, designing quality gates for Agent Teams, or reviewing hook security. Provides static command analyzer and dry-run with synthetic payloads. Do NOT use to write settings.json directly (delegate writes to update-config skill) or to spawn agents (use team-orchestrator).
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, Skill
user-invocable: true
argument-hint: "[add|audit|troubleshoot] [event-name]"
---

# Hook Design + Validation

Hooks are the harness's automation surface — they execute shell commands at lifecycle events that Claude itself does NOT trigger. This skill teaches *which* event for *which* intent, validates command safety, and dry-runs with synthetic payloads. It does not write settings.json — that's `update-config`'s job.

**Hard rules:**
- This skill MUST run in the main conversation (no `context: fork`)
- Never write to `settings.json` / `settings.local.json` directly — delegate via Skill tool to `update-config`
- Run `scripts/validate-hook.sh` on every command before recommending it — static checks are advisory but catch ~80% of footguns
- Static checks are **advisory only** — every hook command must be reviewed manually for command-injection vectors
- Hook scope: prefer **project** (`.claude/settings.json`) over **user** unless it's truly global tooling
- Hooks run in user shell — they have full filesystem and network access. Treat every command as if it could `rm -rf ~`.

---

## Flow Selection

```
What does the user want?
├── Add a new hook ("run lint on save", "block commits with TODO", "notify when build done")
│   └── workflow: add-hook.md → event → matcher → command → scope → dry-run → delegate to update-config
│
├── Audit existing hooks ("review all my hooks", "are my hooks safe?")
│   └── workflow: audit-hooks.md → read settings.{json,local.json} → flag risks
│
└── Hook didn't fire / fired wrong ("my Stop hook isn't running", "PreToolUse fires too often")
    └── workflow: troubleshoot.md → symptom → cause mapping
```

→ Add hook: `workflows/add-hook.md`
→ Audit hooks: `workflows/audit-hooks.md`
→ Troubleshoot: `workflows/troubleshoot.md`

---

## Hook Catalog (decision tree)

```
What lifecycle moment?
├── BEFORE a tool call (block / mutate input)
│   └── PreToolUse — exit 2 blocks; matcher: tool name regex
│
├── AFTER a tool call (post-process / log)
│   └── PostToolUse — exit code ignored; matcher: tool name regex
│
├── BEFORE Claude responds to user input (mutate prompt / inject context)
│   └── UserPromptSubmit — stdin: user prompt; stdout appended to context
│
├── BEFORE auto-compaction (preserve / dump state)
│   └── PreCompact
│
├── WHEN session starts (load context, env)
│   └── SessionStart
│
├── WHEN session ends (cleanup, persist)
│   └── SessionEnd
│
├── WHEN main agent stops responding
│   └── Stop — exit 2 blocks stop with feedback
│
├── WHEN a subagent stops
│   └── SubagentStop
│
├── WHEN Claude shows a notification (toast / sound)
│   └── Notification — for desktop alerts
│
├── (Agent Teams) when a teammate becomes idle
│   └── TeammateIdle — exit 2 sends feedback, agent continues
│
└── (Agent Teams) when a task is marked completed
    └── TaskCompleted — exit 2 blocks completion (e.g. tests fail)
```

→ Full event/payload/exit-code table: `references/hooks-catalog.md`
→ Composition order across global/user/project/local: `references/execution-order.md`

---

## Critical Rules

### Scope choice

| Scope | File | When |
|-------|------|------|
| Global | `~/.claude/settings.json` | Cross-project tooling (e.g., personal lint preferences) |
| Project | `.claude/settings.json` | Team-shared automation (committed to repo) |
| Local | `.claude/settings.local.json` | Per-developer overrides (gitignored) |

**Default:** project. Use local only for secrets-bearing or developer-personal hooks.

### Exit-code semantics

- `0` — pass, continue normally
- `2` — block / send feedback (PreToolUse, Stop, TeammateIdle, TaskCompleted, etc.). stderr is shown to Claude as feedback.
- Other non-zero — error logged, hook treated as failed but does not block

### Matcher syntax

- Tool-name hooks (PreToolUse, PostToolUse) use `matcher` field — regex against tool name
- Empty matcher = matches all tools
- Multiple matchers in array = OR semantics

### Security

- **NEVER** use `eval`, `bash -c "$VAR"`, `curl | sh`, or unquoted variable expansion
- **ALWAYS** parse JSON via `jq`, never via shell string manipulation
- **ALWAYS** set timeout: `timeout 10 ./script.sh` — no hook should hang the harness
- **ALLOWLIST** binaries: `command -v <tool>` before invoking
- Treat `$CLAUDE_TOOL_INPUT` and all hook-provided env vars as untrusted user input

→ Full security patterns: `references/security-patterns.md`

---

## Validation Pipeline

Before recommending any hook command:

```bash
# Static analysis — warns on common footguns
bash skills/hook-creator/scripts/validate-hook.sh '<command>'

# Dry-run with synthetic payload — see what hook does without triggering real event
bash skills/hook-creator/scripts/dry-run-hook.sh PreToolUse '<command>' [fixture.json]

# List all currently effective hooks (across global/user/project/local)
bash skills/hook-creator/scripts/list-hooks.sh
```

The validator emits both WARNING and DANGER levels. DANGER is a hard stop — refuse to recommend the command.

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Write to settings.json directly | Schema drift, lost validation | Delegate via Skill tool to `update-config` |
| Use `bash -c "$CLAUDE_TOOL_INPUT"` | Command injection trivially | Parse JSON via jq, allowlist values |
| Hook with no timeout | Can hang the entire harness | Always wrap in `timeout 10 ...` |
| Block PreToolUse with exit 1 instead of 2 | Logged as error, doesn't block | Use exit 2 for intentional blocks |
| Empty matcher on PostToolUse for heavy script | Runs after EVERY tool call | Scope matcher to specific tools |
| Silent failures (no stderr) | User can't see why hook fired/blocked | Always echo decision to stderr on exit 2 |
| Hardcoded absolute paths | Breaks for other developers | Use `${CLAUDE_PROJECT_DIR}` / relative paths |
| Network calls in hook | Latency on every event, exfil risk | Local checks only |
| `git commit --no-verify` in PostToolUse | Defeats whole purpose | Don't — fix the underlying issue |
| Same hook in multiple scopes | Duplicate execution, confusing | Use `list-hooks.sh` to see effective set |

---

## Quick Reference

| Task | Resource |
|------|----------|
| Add a hook step-by-step | [workflows/add-hook.md](workflows/add-hook.md) |
| Audit existing hooks | [workflows/audit-hooks.md](workflows/audit-hooks.md) |
| Hook didn't fire | [workflows/troubleshoot.md](workflows/troubleshoot.md) |
| Event/payload/exit-code reference | [references/hooks-catalog.md](references/hooks-catalog.md) |
| Composition order across scopes | [references/execution-order.md](references/execution-order.md) |
| Security patterns and footguns | [references/security-patterns.md](references/security-patterns.md) |
| Real-world examples | [references/examples.md](references/examples.md) |
| Validate command safety | `bash scripts/validate-hook.sh` |
| Dry-run with synthetic payload | `bash scripts/dry-run-hook.sh` |
| List all effective hooks | `bash scripts/list-hooks.sh` |

---

## Related Knowledge

- `update-config` — actual write to settings.json (this skill delegates to it)
- `/team-orchestrator` — uses TeammateIdle / TaskCompleted hooks for quality gates
