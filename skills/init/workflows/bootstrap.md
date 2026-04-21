# Workflow: Bootstrap

End-to-end project initialization in 6 steps. The skill never writes files itself — it delegates every action to another meta-skill via the Skill tool.

---

## Step 1: Detect stack

Run heuristics from `workflows/detect-stack.md`:

```bash
# Quick scan
ls package.json go.mod pyproject.toml Cargo.toml 2>/dev/null
glob '*.csproj' '*.gemspec' 'pom.xml' 'build.gradle*'
```

Compose a one-line summary of detected stack: "Node + TypeScript + React + Vite".

If detection finds nothing or is ambiguous, mark stack as **unknown** and rely on user answers in Step 2.

---

## Step 2: Ask 5 questions

Use AskUserQuestion with these exact questions (single message, all 5 at once):

1. **Project type** — web app / CLI tool / library / data pipeline / mixed
2. **Primary tasks** *(multi-select)* — feature development / code review / security audits / refactoring / documentation
3. **Team size** — single specialist agent / pair (2 agents) / small team (3–5 agents) / experimental Agent Teams mode
4. **Quality gates** — none / advisory (warnings only) / blocking (hooks fail the action)
5. **Shortcuts** *(multi-select)* — custom slash commands / scheduled tasks / none

If the user invoked with a recipe name (`/init small-react-app`), skip questions and use the preset from `references/recipes.md`. Always show the resolved answers in Step 3 so the user can correct them.

---

## Step 3: Derive plan

Look up `references/dispatch-matrix.md` for each combination of (project type × primary tasks × team size). Build a list of actions:

```
PLAN
─────────────────────────────────────────
1. [agent-creator]  Create agent: frontend-builder (skills: frontend, react)        [new]
2. [agent-creator]  Create agent: testing-reviewer (skills: testing)                [new]
3. [team-creator]   Create team: dev-team (flow: pipeline-parallel)                 [new]
4. [hook-creator]   Add Stop hook: timeout 60 npm test                              [new]
5. [hook-creator]   Add PostToolUse hook on Edit|Write: lint                        [new]
6. [update-config]  Add /review slash command                                       [new]
─────────────────────────────────────────
6 actions to perform.
```

Mark items with `[exists]` if the target file/config is already present. Default behavior for `[exists]` is **skip** — but the user can mark them for overwrite in the next step.

---

## Step 4: Single confirmation

Show the full plan + ask:

```
Proceed with this plan?
  [yes]    — execute all new items, skip exists
  [overwrite all]  — execute new + replace exists
  [edit]   — let me uncheck specific items
  [no]     — abort, no changes made
```

If user picks **edit**, present items as a checklist via AskUserQuestion (multi-select). Recompute the plan from the unchecked set.

If user picks **no**, exit cleanly. No partial state.

---

## Step 5: Dispatch in order

For each action in the confirmed plan, invoke the target meta-skill via the Skill tool:

```
For action in plan:
  skill = action.target_meta_skill
  args = action.args

  result = invoke Skill(skill=skill, args=args)

  if result.failed:
    ask user: retry / skip / abort
    handle accordingly

  record outcome
```

Important: **Skill tool runs the target in the main conversation**. Do NOT spawn via Agent. The four meta-skills (agent-creator, skill-creator, team-creator, hook-creator) and update-config all expect main-conversation execution.

---

## Step 6: Final report

After all dispatches complete, show:

```
BOOTSTRAP COMPLETE
─────────────────────────────────────────
Created:
  ✓ 2 agents in agents/
  ✓ 1 team in .claude/teams/dev-team/
  ✓ 2 hooks in .claude/settings.json
  ✓ 1 slash command in .claude/settings.json

Skipped (already existed):
  - agents/architect.md

Failed:
  ✗ /review slash command — settings.json not writable

Next steps:
  1. Test the team:  /team-orchestrator dev-team
  2. Verify hooks:   bash skills/hook-creator/scripts/list-hooks.sh
  3. Try shortcut:   /review
```

If anything failed, link the user to the relevant troubleshoot workflow (e.g., `hook-creator/workflows/troubleshoot.md` for hook failures).
