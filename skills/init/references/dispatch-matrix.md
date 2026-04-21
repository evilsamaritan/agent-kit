# Dispatch Matrix — Answer Combinations → Action Lists

Lookup table that maps user answers (project type × primary tasks × team size × gates × shortcuts) into concrete dispatch actions. Used by `workflows/bootstrap.md` Step 3.

This table is **suggestive, not exhaustive**. Always show the derived plan to the user and let them edit before dispatching.

---

## Base agents per project type

| Project type | Always include |
|--------------|----------------|
| Web app | architect (if 3+ team), frontend, backend (if API), testing |
| CLI tool | backend, testing, docs |
| Library | architect, testing, docs |
| Data pipeline | backend, database, observability, testing |
| Mixed | architect, then derive from primary tasks |

---

## Add agents per primary task

| Primary task | Add to base |
|--------------|-------------|
| Code review | + security |
| Security audits | + security (with workflow `audit`) |
| Refactor | + architect (if not present) |
| Documentation | + docs (if not present) |
| Operations / SRE | + sre, devops |

---

## Team size → composition

| Size | Action |
|------|--------|
| Single specialist | Pick the most relevant ONE role agent for primary task. Skip team-creator. |
| Pair | 2 role agents, no team config — caller spawns each as needed |
| 3–5 team | Create team via `team-creator` with `pipeline` flow as default |
| Agent Teams (experimental) | Create team with `swarm-review` or `pipeline-parallel`, run `/team-orchestrator setup` |

---

## Quality gates → hooks to add

| Gate level | Hooks |
|-----------|-------|
| None | (no hook actions) |
| Advisory | PostToolUse on Edit\|Write → lint, log only (`exit 0`) |
| Blocking | Stop → require tests pass (exit 2 if fail), PostToolUse on Edit\|Write → lint must pass, optional TaskCompleted gate for Agent Teams |

For each hook, dispatch to `hook-creator add ...` which then delegates write to `update-config`.

---

## Shortcuts → slash commands & schedules

| Shortcut request | Action |
|------------------|--------|
| Slash commands | For each common task ("review", "test", "audit"), add via `update-config add slash command /<name>` |
| Scheduled tasks | Use `schedule` skill (separate from this) — emit a note in the final report rather than dispatching |
| None | (no shortcut actions) |

---

## Resolution example

**Input:**
- Stack: Node + React + TypeScript + Vite
- Project type: web app
- Primary tasks: feature dev + code review
- Team size: 3–5
- Gates: blocking
- Shortcuts: slash commands

**Derived plan:**

```
1. agent-creator  → frontend-builder (skills: frontend, web, html, css, react)
2. agent-creator  → backend-builder  (skills: backend) [if API exists]
3. agent-creator  → testing-reviewer (skills: testing)
4. agent-creator  → security-reviewer (skills: security)  [code review primary task]
5. team-creator   → create team "dev" flow=pipeline agents=[frontend, backend, testing]
6. team-creator   → create team "review" flow=swarm-review agents=[security, testing, architect]
7. hook-creator   → Stop: timeout 60 npm test
8. hook-creator   → PostToolUse(Edit|Write): timeout 20 npm run lint:fix
9. update-config  → add slash command /review → /team-orchestrator review
10. update-config → add slash command /test → npm test
```

10 actions, single confirmation, dispatch in order.

---

## Conservative defaults

When in doubt, prefer:
- **Fewer agents** over more (start lean, user can add later via `/agent-creator`)
- **Pipeline flow** over experimental Agent Teams (mature, no setup)
- **Advisory gates** over blocking (don't surprise users with blocked commits)
- **No shortcuts** unless user explicitly asked (avoid clutter)

The user can always re-run `/init` later — idempotency means safe iteration.
