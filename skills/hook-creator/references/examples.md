# Hook Examples

Real-world hook configurations. Copy, adapt, validate before deploying.

---

## 1. Block edits to package.json without confirmation

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/guard-package-json.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/guard-package-json.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[[ "$file" == */package.json ]] || exit 0
echo "Edit to package.json blocked — confirm with user before making dependency changes" >&2
exit 2
```

---

## 2. Run linter after every code edit

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "timeout 30 .claude/hooks/lint.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/lint.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx) timeout 20 npx eslint --fix "$file" || true ;;
  *.py)                  timeout 20 ruff check --fix "$file" || true ;;
  *.go)                  timeout 20 gofmt -w "$file" || true ;;
esac
```

PostToolUse exit codes are ignored, so we use `|| true` to keep noise out of logs.

---

## 3. Block Stop until tests pass

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "timeout 120 .claude/hooks/require-tests.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/require-tests.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
input=$(cat)

# If Stop is already being blocked by another hook, don't double-block
active=$(echo "$input" | jq -r '.stop_hook_active // false')
[ "$active" = "true" ] && exit 0

if ! timeout 100 npm test --silent 2>&1 | tail -20; then
  echo "Tests failing — please fix before stopping" >&2
  exit 2
fi
exit 0
```

The `stop_hook_active` check prevents infinite loops when the hook itself causes the agent to keep working.

---

## 4. Inject project context on every user message

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/inject-context.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/inject-context.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
# Stdin is the user prompt; we don't need it
cat > /dev/null

# Stdout is appended to context
echo "=== current branch ==="
git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(not a git repo)"

echo "=== recent commits ==="
git -C "${CLAUDE_PROJECT_DIR:-.}" log --oneline -5 2>/dev/null || true
```

---

## 5. Audit every Bash command

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/audit-bash.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/audit-bash.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

# Forbidden patterns — block
for pat in 'rm -rf /' 'rm -rf ~' 'curl.*\| *sh' '> /dev/sda' ':() *{ *:|: *}'; do
  if echo "$cmd" | grep -qE "$pat"; then
    echo "Bash command matches forbidden pattern: $pat" >&2
    exit 2
  fi
done

# Log all commands to a project audit file
mkdir -p "${CLAUDE_PROJECT_DIR}/.claude/audit"
echo "$(date -Iseconds) | $cmd" >> "${CLAUDE_PROJECT_DIR}/.claude/audit/bash.log"

exit 0
```

---

## 6. Dump conversation state before compaction

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/dump-state.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/dump-state.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
input=$(cat)
transcript=$(echo "$input" | jq -r '.transcript_path // empty')
session=$(echo "$input" | jq -r '.session_id // empty')

[ -z "$transcript" ] && exit 0

dest="${CLAUDE_PROJECT_DIR}/.claude/snapshots/${session}-$(date +%s).json"
mkdir -p "$(dirname "$dest")"
cp "$transcript" "$dest"

# stdout is added to context — give Claude a heads-up
echo "[snapshot saved to $dest]"
exit 0
```

---

## 7. Agent Teams: TaskCompleted gate

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "timeout 60 .claude/hooks/validate-task.sh"
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/validate-task.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

# Run quick checks — lint, typecheck — before accepting a teammate's task done
fail=0

if ! timeout 20 npx eslint --max-warnings 0 . 2>&1 | tail -10; then
  echo "Lint failures detected — task cannot complete" >&2
  fail=1
fi

if ! timeout 30 npx tsc --noEmit 2>&1 | tail -10; then
  echo "Type errors detected — task cannot complete" >&2
  fail=1
fi

[ "$fail" -eq 0 ] && exit 0 || exit 2
```

---

## 8. Notification → desktop sound on long tasks

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

macOS-only. On Linux, use `paplay` or `aplay`. Wrap in `|| true` so missing audio never breaks the hook.
