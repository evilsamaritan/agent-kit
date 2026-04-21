---
name: update-config
description: Configure the Claude Code harness by writing to settings.json — permissions allowlists, environment variables, hooks, slash-command registration. Use when the request is "allow this command", "move permission to user settings", "set DEBUG=true", "add a hook that runs on Stop", "whenever the model does X run Y". Owns all writes to ~/.claude/settings.json, .claude/settings.json, and .claude/settings.local.json. Do NOT use for hook design or validation (use hook-creator first), team config (use team-creator), or creating new agents/skills (use agent-creator/skill-creator).
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
argument-hint: "[allow|env|hook|slash] <value>"
---

# Update Config

`update-config` is the single writer of Claude Code harness settings. Every other meta-skill delegates here when it needs to change `settings.json`.

**Hard rules:**

- This skill runs in the main conversation (no `context: fork`) — it edits files the harness is actively reading.
- Always identify **scope** before writing: `user` (`~/.claude/settings.json`), `project` (`.claude/settings.json`, committed), `local` (`.claude/settings.local.json`, gitignored).
- Every write goes through `scripts/update-settings.sh` which merges via `jq`, validates JSON, and creates a `.bak` snapshot before overwriting.
- Never emit secrets to `project` scope — a committed repo is a leak vector. Secrets and personal tokens always go in `local`.
- For hooks: `hook-creator` designs and validates the command, `update-config` writes it. If a write arrives without prior validation, stop and run `hook-creator`'s `validate-hook.sh` first.
- Respect existing keys: merge, never overwrite top-level blocks (permissions, env, hooks, slashCommands).

---

## Scope Decision Tree

```
Who should see this change?
├── Just me, any project — global tooling preference, personal secret
│   └── user → ~/.claude/settings.json
│
├── The whole team on this repo — committed, consistent across devs
│   └── project → .claude/settings.json
│
└── Just my machine on this repo — secrets, per-dev overrides, experiments
    └── local → .claude/settings.local.json (gitignored)
```

When in doubt, ask. The wrong scope can leak secrets or override teammates' settings without them knowing.

---

## Supported Intents

| User says | Action | Script call |
|-----------|--------|-------------|
| "allow git status / npm install / bq …" | Add tool permission to allow list | `update-settings.sh <scope> allow <pattern>` |
| "don't ask about …", "auto-approve …" | Same — add to allow list | `update-settings.sh <scope> allow <pattern>` |
| "block / deny …" | Add to deny list | `update-settings.sh <scope> deny <pattern>` |
| "move permission X from project to user" | Move an entry between scopes | Two calls: add in target, remove from source |
| "set DEBUG=true", "export NODE_ENV=test" | Set env var | `update-settings.sh <scope> env DEBUG true` |
| "whenever the model stops, run X" | Register Stop hook | First `hook-creator`, then `update-settings.sh <scope> hook Stop <cmd>` |
| "before any Bash tool use, run X" | Register PreToolUse hook | Same — hook-creator validates first |
| "add slash command /foo" | Write `.claude/commands/foo.md` (or `~/.claude/commands/foo.md` for user scope) | `update-settings.sh <scope> slash /foo <body>` |
| "remove permission X" | Remove from allow/deny | `update-settings.sh <scope> remove-allow <pattern>` (or `remove-deny`) |
| "unset env X" | Remove env var | `update-settings.sh <scope> unset-env X` |
| "remove the Stop hook" | Remove hook entry | `update-settings.sh <scope> remove-hook Stop <cmd>` |

Every pattern is an exact string match. Glob-style patterns (`npm *`, `git *`) are stored verbatim — the harness handles matcher semantics.

---

## Flow

1. **Parse intent.** What is the user asking to add, move, or remove? If unclear, ask once with `AskUserQuestion`.
2. **Pick scope.** Use the decision tree. If the user says "global", that means `user`; "team"/"repo" means `project`; "just me on this repo" means `local`.
3. **For hooks specifically**: invoke `hook-creator` first to design + validate the command. Only write after validation passes.
4. **Dry-run.** Read the current file, show a 3-line diff preview of the merge result.
5. **Write.** Run `scripts/update-settings.sh` — it creates a `.bak`, merges via `jq`, validates, writes.
6. **Verify.** Re-read and confirm the value landed. Report the final path and what was added/removed.

---

## Critical Rules

- **Merge, never replace.** `jq '. * {...}'` preserves existing keys; overwrite-style writes lose user customisations.
- **Backup before write.** Every mutation produces `<file>.bak` in the same directory — the script enforces this for both settings.json and slash-command files.
- **Validate JSON after write.** If `jq empty` fails on the output, restore from `.bak` and surface the error.
- **`.gitignore` the local file.** If `.claude/settings.local.json` is about to be created, ensure `.gitignore` excludes it (the script checks and offers to add if missing).
- **Hooks arrive pre-validated.** This skill refuses to write a hook command that hasn't been through `hook-creator`'s validator — the audit log stays meaningful.
- **Hook schema matches the harness.** `.hooks.<event>` is always an array of `{matcher?, hooks:[{type:"command", command}]}` blocks. `matcher` is honoured by `PreToolUse`, `PostToolUse`, and `PermissionRequest`; for other events the script omits it. Duplicate commands are deduplicated across all blocks of the same event.
- **Slash commands are files, not a settings key.** `.claude/commands/<name>.md` (project) or `~/.claude/commands/<name>.md` (user). There is no `slashCommands` field in `settings.json` — writing one is a silent no-op on the harness.

---

## Anti-Patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Hand-edit `settings.json` with `Edit` tool | Loses merge logic, risks invalid JSON | Always go through `scripts/update-settings.sh` |
| Write secrets to `project` scope | Gets committed, visible on GitHub | Use `local`, add to `.gitignore` |
| Skip `hook-creator` for hook writes | Untested commands can wedge the harness | Validate first, then write |
| Write before reading | Lose existing user keys | Script reads → merges → writes |
| Same permission in multiple scopes | Confusing precedence, double-execution | Pick one scope; script warns on duplicates |

---

## Quick Reference

```bash
# Add a permission to project settings (committed)
bash skills/update-config/scripts/update-settings.sh project allow "Bash(npm install)"

# Set an env var locally (only my machine)
bash skills/update-config/scripts/update-settings.sh local env NODE_ENV development

# Register a Stop hook at user scope (after hook-creator validates)
bash skills/update-config/scripts/update-settings.sh user hook Stop "./scripts/notify.sh"

# Remove a permission
bash skills/update-config/scripts/update-settings.sh project remove-allow "Bash(npm install)"

# Show effective settings across scopes
bash skills/update-config/scripts/update-settings.sh show
```

→ Operations reference: `scripts/update-settings.sh --help`

---

## Related Knowledge

- `hook-creator` — designs + validates hook commands; delegates the write here
- `init` — project bootstrap; calls this skill to register default slash commands and quality hooks
- `team-orchestrator` — quality gates via `TeammateIdle`/`TaskCompleted` hooks go through this skill
