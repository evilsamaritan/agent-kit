# Workflow: Audit Existing Hooks

Review all configured hooks across all scopes. Find risks, duplicates, and dead hooks.

---

## Step 1: Enumerate

```bash
bash skills/hook-creator/scripts/list-hooks.sh
```

This prints the effective hook set with provenance: `[scope] event matcher → command`.

If the script isn't available, fall back to direct reads:

```bash
for f in ~/.claude/settings.json .claude/settings.json .claude/settings.local.json; do
  test -f "$f" && echo "=== $f ===" && jq '.hooks // {}' "$f"
done
```

---

## Step 2: Per-hook static analysis

For each hook command found, run:

```bash
bash skills/hook-creator/scripts/validate-hook.sh '<command>'
```

Categorize results:
- **PASS** — no issues found by static checks
- **WARNING** — review needed (e.g., long timeout, broad matcher, missing error handling)
- **DANGER** — must be fixed or removed (command injection vectors, unsafe `eval`, no timeout on long tasks)

---

## Step 3: Cross-scope conflicts

Look for events that have hooks at multiple scopes. Flag:
- Same event in user + project — project usually wins, user version may be dead
- Same matcher across scopes — duplicate execution
- Local-only hooks committed to git (anti-pattern — local should be gitignored)

---

## Step 4: Dead-hook detection

For each hook command, verify:
- Referenced scripts exist (`test -f <path>` or `command -v <bin>`)
- Referenced env vars are set somewhere
- Matcher targets a tool that's actually allowed

Hooks pointing at deleted scripts silently fail and pollute logs.

---

## Step 5: Report

Format the audit as a single table:

| Scope | Event | Matcher | Command (truncated) | Issues |
|-------|-------|---------|---------------------|--------|
| project | PreToolUse | Edit\|Write | `./scripts/lint.sh` | OK |
| user | Stop | * | `eval "$(...)"` | DANGER: eval injection |
| local | PostToolUse | * | `curl ...` | WARNING: network call on every tool |

Recommend specific fixes per row. For DANGER rows, propose the safer rewrite explicitly.

If the user confirms a fix, route the actual settings.json write through the `update-config` skill — never edit directly from this workflow.
