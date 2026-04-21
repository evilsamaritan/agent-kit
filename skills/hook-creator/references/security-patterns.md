# Hook Security Patterns

Hooks run in your shell with your privileges. A bad hook can read SSH keys, exfiltrate secrets, delete files, or backdoor your environment. Treat every hook command like a security boundary.

---

## Threat model

Hook payloads on stdin are **partially trusted**:
- `session_id`, `transcript_path`, `cwd` — set by the harness, trusted
- `tool_input.*` fields — derived from Claude's output, **untrusted** (could be prompt-injected)
- `prompt` (UserPromptSubmit) — **untrusted** user input

If a hook command interpolates any untrusted field into a shell, it has command injection.

---

## Forbidden patterns

### 1. Direct interpolation of payload fields

```bash
# DANGER
"command": "echo $CLAUDE_TOOL_INPUT | grep 'pattern'"

# Why: $CLAUDE_TOOL_INPUT may contain $(rm -rf ~) — shell evaluates it
```

```bash
# SAFE
"command": "jq -r '.tool_input.file_path // empty' | xargs -I{} test -f {}"

# jq parses JSON, output is plain text, xargs handles quoting
```

### 2. eval / bash -c "$VAR"

```bash
# DANGER
eval "$user_provided"
bash -c "$payload"

# SAFE — never use these. Period.
```

### 3. curl | sh

```bash
# DANGER
curl https://example.com/install.sh | sh

# Why: network MITM, supply chain compromise, you can't audit what runs
```

### 4. Unquoted variable expansion

```bash
# DANGER
file=$(jq -r '.tool_input.file_path' <<< "$input")
cat $file   # word-splits on spaces, glob-expands

# SAFE
cat "$file"
```

### 5. Network calls in tight loops

```bash
# DANGER (and slow)
"command": "curl -X POST https://logging.example.com -d $(jq '.')"

# Why: latency on every tool call, exfiltration risk, breaks offline work
```

---

## Required patterns

### Always use timeout

```bash
"command": "timeout 10 ./scripts/check.sh"
```

A hook that hangs blocks the entire harness. 10–30s is reasonable for most checks.

### Always parse JSON via jq

```bash
input=$(cat)

tool=$(echo "$input" | jq -r '.tool_name // empty')
[ -z "$tool" ] && exit 0  # gracefully skip if missing

file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
```

### Allowlist tool names / file paths

```bash
case "$tool" in
  Edit|Write|NotebookEdit) ;;
  *) exit 0 ;;  # not our concern
esac
```

### Use ${CLAUDE_PROJECT_DIR}

Don't hardcode `/Users/me/project/...`. Use the env var the harness provides:

```bash
"command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/lint.sh"
```

### Echo decisions to stderr

```bash
if ! lint_passed; then
  echo "Lint failed — see ${log_file}" >&2
  exit 2
fi
```

Without stderr, Claude can't act on a block.

### Fail closed for security-critical hooks

```bash
# If we can't verify, refuse — don't pass
if ! command -v gitleaks >/dev/null; then
  echo "gitleaks not installed — refusing edit (security policy)" >&2
  exit 2
fi
```

---

## Privilege minimization

Hooks inherit your shell's full permissions. Reduce blast radius:

- Run heavy logic in a dedicated hook script under `.claude/hooks/` (not inline in settings.json)
- Set restrictive shebang: `#!/usr/bin/env bash` with `set -euo pipefail`
- Validate all inputs at the top of the script
- No filesystem writes outside `${CLAUDE_PROJECT_DIR}` unless explicitly needed
- No network calls unless explicitly needed (and document why)

---

## Red flags during audit

- Any hook command containing `eval`, `curl`, `wget`, `bash -c`, `sh -c`, backticks
- Unquoted `$VAR`, `${VAR}` in commands that shell-execute
- Hardcoded paths to home directory, SSH dirs, credential files
- Network calls in PreToolUse / PostToolUse (latency + exfiltration)
- Hook commands longer than ~80 chars (probably should be a script)
- Same command in multiple scopes (duplicate execution, unclear which wins)
- No timeout wrapper

---

## Safe template for new hooks

```bash
#!/usr/bin/env bash
set -euo pipefail

# Read payload
input=$(cat)

# Extract fields safely
tool=$(echo "$input" | jq -r '.tool_name // empty')
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Allowlist
case "$tool" in
  Edit|Write|NotebookEdit) ;;
  *) exit 0 ;;
esac

# Validate file path is within project
case "$file" in
  "$CLAUDE_PROJECT_DIR"/*) ;;
  *) exit 0 ;;  # outside project, skip
esac

# Do the actual check (with timeout if external command)
if ! timeout 10 ./scripts/your-check.sh "$file"; then
  echo "Check failed for $file — see logs" >&2
  exit 2
fi

exit 0
```
