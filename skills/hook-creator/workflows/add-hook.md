# Workflow: Add a Hook

End-to-end interactive flow for adding a single Claude Code hook safely.

---

## Step 1: Identify intent

Ask via AskUserQuestion if not clear from the request:

1. **What event?** (use the decision tree from SKILL.md or `references/hooks-catalog.md`)
2. **What command should run?** (one-liner or path to script)
3. **What scope?** (project / user / local) — default project

If user says "run X every time someone edits Y" → that's `PostToolUse` with matcher `Edit|Write`.
If user says "block commits if tests fail" → not a hook of Claude — that's a git pre-commit hook (different system).

---

## Step 2: Validate the command

```bash
bash skills/hook-creator/scripts/validate-hook.sh '<command>'
```

Read output carefully:
- WARNING items: review with the user, may be acceptable
- DANGER items: **refuse to proceed** — explain what would break and propose a safer alternative

Common DANGER patterns:
- Unquoted `$CLAUDE_TOOL_INPUT` interpolation
- `eval`, `curl | sh`, `bash -c "$VAR"`
- No timeout wrapping a long-running command
- Network calls in PreToolUse / PostToolUse (latency on every call)

---

## Step 3: Dry-run with a synthetic payload

```bash
bash skills/hook-creator/scripts/dry-run-hook.sh <event> '<command>' [fixture.json]
```

Show the user:
- What stdin the hook will receive
- What stdout/stderr the command produces
- Exit code and what Claude will do with it (block / pass / log)

If the dry-run produces unexpected output, iterate on the command before writing.

---

## Step 4: Pick scope and resolve conflicts

Run `bash skills/hook-creator/scripts/list-hooks.sh` to see currently effective hooks. Look for:
- Same event already configured at a higher-precedence scope (would shadow this one)
- Conflicting matchers that overlap with existing hooks

If there's overlap, ask the user explicitly: replace the existing hook, or add as additional matcher?

---

## Step 5: Delegate the write

**This skill never writes settings.json directly.** Use the Skill tool to invoke `update-config`:

```
Use Skill tool: skill="update-config", args="add hook for <event> matching <matcher>: <command> in <scope>"
```

Pass the validated, dry-run-tested command and explicit scope. Do NOT pass the user's original phrasing — pass the verified version.

---

## Step 6: Verify

After `update-config` writes the file:

```bash
bash skills/hook-creator/scripts/list-hooks.sh
```

Confirm the new hook appears at the expected scope with the expected matcher. If it doesn't, troubleshoot via `workflows/troubleshoot.md`.

---

## Step 7: Tell the user how to test it for real

Give a concrete command that will trigger the hook:
- PreToolUse on `Edit` → "make any single-line edit to a file"
- Stop → "ask me a simple question and I'll respond — Stop fires when I finish"
- TeammateIdle → "spawn a teammate via Agent Teams and wait until it goes idle"

If the hook is meant to block, also give a command that should be blocked, so the user sees both pass and block paths.
