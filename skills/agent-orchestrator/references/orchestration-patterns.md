# Orchestration Patterns

## Contents

- [Single specialist](#single-specialist)
- [Pipeline](#pipeline)
- [Parallel specialists](#parallel-specialists)
- [Builder-validator](#builder-validator)
- [Map-reduce review](#map-reduce-review)
- [Failure handling](#failure-handling)

## Single specialist

Use when one profession owns the task and another context would add coordination cost without independent value.

```text
main → backend → main synthesis
```

## Pipeline

Use when each stage needs the previous stage's decision or artifact.

```text
architect → backend + frontend → tester → main synthesis
```

Pass only the contract needed by the next stage: decisions, interfaces, changed paths, known risks, and acceptance checks.

## Parallel specialists

Use when assignments have independent evidence or disjoint file ownership.

```text
                 ┌→ frontend ─┐
main contract ───┤            ├→ integration check
                 └→ backend ──┘
```

Parallel read work is usually safe. Parallel writes need separate paths or native worktrees.

## Builder-validator

Use when implementation needs independent judgment.

```text
builder → tests/build → validator → builder fix if needed → main
```

The validator should not silently repair the builder's work. It returns concrete findings and evidence so ownership stays clear.

## Map-reduce review

Use for broad audits with separable lenses such as correctness, security, tests, and maintainability.

```text
correctness ─┐
security ────┼→ synthesizer → ranked findings
tests ───────┤
maintenance ─┘
```

Keep reviewers independent until their findings return. The synthesizer removes duplicates and resolves contradictions against source evidence.

## Failure handling

| Failure | Response |
|---------|----------|
| Agent returns without evidence | Send a focused follow-up asking for the missing proof |
| Agent drifts outside scope | Steer it back with explicit non-goals |
| Two writers overlap | Stop one, serialize the work, or move it to an isolated worktree |
| Findings conflict | Recheck the cited source or assign a narrow tie-break review |
| Runtime lacks named custom agents | Use the bundled profile persona as an ephemeral prompt |
| Runtime lacks subagents | Execute the same staged plan in the main thread |
