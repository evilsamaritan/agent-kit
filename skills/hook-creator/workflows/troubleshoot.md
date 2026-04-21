# Workflow: Troubleshoot a Hook

Symptom → cause mapping for hooks that don't fire, fire wrong, or block unexpectedly.

---

## Symptom: Hook doesn't fire at all

1. **Wrong file?** Run `list-hooks.sh` — confirm the hook appears at the expected scope.
2. **Scope precedence?** A higher-precedence scope (project > user > global) may have a hook on the same event with no matcher — its empty matcher swallows everything.
3. **Matcher mismatch?** PreToolUse/PostToolUse matchers are regex on tool name. `Edit` matches `Edit`; `edit` does not (case-sensitive).
4. **Wrong event?** UserPromptSubmit fires on USER input — Claude's responses don't trigger it. Stop fires when Claude finishes a turn — not when subagents finish (use SubagentStop).
5. **Settings.json invalid JSON?** `jq empty .claude/settings.json` — if it errors, the whole file is ignored.
6. **Wrong path in command?** Try the exact command in your shell — if it fails there, it'll fail in the hook.

---

## Symptom: Hook fires too often

1. **Empty matcher on tool-call hooks?** Add a regex: `"matcher": "Edit|Write"`.
2. **Multiple scopes?** Same event configured globally + project = double execution. Use `list-hooks.sh`.
3. **Hook spawning a tool that re-fires the hook?** Classic loop: PostToolUse on Edit runs a script that uses Edit. Add a guard env var or restrict matcher.

---

## Symptom: Hook fires but doesn't block

1. **Wrong exit code?** Block requires exit `2`. Exit `1` is treated as error and logged but does not block.
2. **Wrong event?** Only specific events block on exit 2: PreToolUse, Stop, SubagentStop, UserPromptSubmit, PreCompact, TeammateIdle, TaskCompleted. PostToolUse exit code is ignored — you can't undo a tool call after it ran.
3. **Stderr empty?** When blocking, write your reason to stderr. Without stderr, Claude has nothing to act on.

---

## Symptom: Hook hangs the harness

1. **No timeout?** Wrap with `timeout 10 ./script.sh`.
2. **Waiting on stdin?** The hook receives JSON on stdin — if your script reads stdin then waits on user input, it hangs. Read once, parse, exit.
3. **Background job not detached?** Use `nohup ... &` if you really need a background task — but better to delegate to a real queue.

---

## Symptom: "Permission denied" running hook

```bash
chmod +x .claude/scripts/<your-script>.sh
```

Or invoke via interpreter explicitly: `"command": "bash .claude/scripts/foo.sh"`.

---

## Symptom: Hook works locally, fails in CI / for teammate

1. **Hardcoded paths?** Use `${CLAUDE_PROJECT_DIR}` or relative paths.
2. **Tool not installed?** Add `command -v <tool> >/dev/null || exit 0` early — degrade gracefully.
3. **Env var not set?** `${VAR:-default}` and document the requirement in `.env.example`.
4. **Wrong scope?** A local-only hook (`settings.local.json`) won't ship to teammates. Move to project scope.

---

## Last-resort: trace what actually runs

Add a debug echo at the start of your hook command:

```bash
"command": "{ echo \"hook fired: $(date)\" >> /tmp/hook.log; original-command; }"
```

Then trigger the event and tail `/tmp/hook.log`. Remove debug line after diagnosis.
