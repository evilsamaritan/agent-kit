# Bootstrap Agent Kit in a Project

## Step 1: Detect current state

1. Check the stack signals in `../references/dispatch-matrix.md` and read the manifest or config file behind each one.
2. Read `.agent-kit/agents.json` when present.
3. List existing native agents in `.claude/agents/`, `.codex/agents/`, and `.kimi-code/agents/`.
4. Separate Agent Kit generated files from user-owned files by the generated marker.

## Step 2: Derive responsibilities

Map the project and request to recurring responsibilities rather than inventing a large permanent team. Typical responsibilities are implementation, architecture, testing, security review, operations, and documentation.

Take compositions from `../../agent-creator/references/project-agent-recipes.md` and add the skills the stack signals call for. One profile can produce several responsibility scopes, such as customer UI and admin UI; distinct descriptions explain those boundaries.

## Step 3: Resolve material choices

Infer routines from repository evidence. Ask only if unresolved:

- whether the project intentionally supports only one runtime;
- whether a proposed agent may edit/run commands or must stay read-only;
- whether a model override materially changes cost/capability;
- which service or package is primary in an ambiguous polyglot repository.

If the user has not decided what the agents should own, settle it with `grill-me` before Step 4.

## Step 4: Present one plan

Show a compact table:

| Agent | Profile | Exact skills | Access | Targets |
|-------|---------|--------------|--------|---------|

Mark preserved existing entries and generated files that will be updated or pruned. Do not ask once per agent.

## Step 5: Dispatch configuration

1. Invoke `skill-creator` first only for genuinely missing reusable knowledge.
2. Invoke `agent-creator` once with the complete create/update/delete set.
3. Have it update `.agent-kit/agents.json`, materialize the selected runtimes, and run `--check`.

Do not create a saved team or proprietary workflow. `agent-orchestrator` will assemble task-specific teams later from the available agents.

## Step 6: Report

Report:

- portable source: `.agent-kit/agents.json`;
- created/updated native Claude files;
- created/updated native Codex files;
- created/updated native Kimi files, when selected;
- whether a session restart is needed before Claude can select new agents;
- selected profiles and exact skills;
- validation commands and outcomes;
- preserved user-owned agents.

Leave ignore files alone: whether generated agents are committed is the project's choice.
