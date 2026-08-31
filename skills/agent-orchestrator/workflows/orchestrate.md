# Orchestrate Profession Agents

## Step 1: Read the task contract

Extract the required outcome, constraints, affected areas, write permissions, external actions, and acceptance evidence. Keep the user's wording for non-negotiable requirements.

## Step 2: Discover available agents

1. Inspect `.agent-kit/agents.json` when present.
2. Inspect the current runtime's native project-agent directory.
3. Match agents by description and configured skills, not by name alone.
4. If no project agent fits, read `../references/profile-catalog.md`, then load only the selected profile reference.
5. If the missing composition should persist beyond this task, invoke `agent-creator` before execution. Otherwise use the profile persona as an ephemeral fallback.
6. Check whether the current host's delegation tool can select the named agent and apply its config. A discovered file or mention without a named-agent selector is not sufficient.

## Step 3: Choose the workflow shape

Use the smallest shape that preserves correctness:

1. **Single** — one bounded domain and one deliverable.
2. **Pipeline** — later work depends on an earlier decision or artifact.
3. **Parallel** — assignments are independent and can be merged without hidden ordering.
4. **Builder-validator** — one agent changes artifacts and a separate agent evaluates them.
5. **Map-reduce review** — independent evidence gathering followed by one synthesis.

Read `../references/orchestration-patterns.md` only when the choice is not obvious.

## Step 4: Write assignments

For every agent, specify:

- concrete objective and explicit non-goals;
- inputs and relevant paths;
- whether it may edit;
- unique file ownership when parallel writes are allowed;
- expected result shape;
- commands, tests, or evidence required before completion;
- what to return to the main thread.

Do not ask two agents to solve the same problem unless independent judgment is the purpose.

## Step 5: Map onto the host runtime

Read `../references/runtime-adapters.md`, then use the native mechanism available in the current session. Prefer a named native project agent only when the host exposes a working selector. Otherwise pass the selected profile persona, exact project skills, model/effort defaults, and concrete task to a generic native subagent without inventing a permanent wrapper format.

## Step 6: Execute and coordinate

1. Start independent read-heavy agents in parallel.
2. Start writers in parallel only with disjoint ownership or native worktree isolation.
3. Do useful non-overlapping main-thread work while agents run.
4. Steer an agent when its scope changes; do not restart it merely to append a detail.
5. Wait only when the next stage depends on its result.
6. Pass pipeline handoffs as decisions, findings, file paths, and unresolved questions—not full transcripts.

## Step 7: Validate and synthesize

1. Check every assignment returned the promised evidence.
2. Resolve contradictions against repository state or primary documentation.
3. Run integration validation that individual agents could not prove independently.
4. Report one coherent outcome: what changed, what was verified, which professions were used, and what remains.
