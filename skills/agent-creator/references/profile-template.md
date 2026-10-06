# Profession Profile Template

## Contents

- [Directory](#directory)
- [Core profile](#core-profile)
- [Claude overlay](#claude-overlay)
- [Codex overlay](#codex-overlay)
- [Body contract](#body-contract)

## Directory

```text
profiles/developer/
├── PROFILE.md
└── claude.yaml     # optional; also codex.yaml and kimi.yaml when they set something
```

## Core profile

```markdown
---
name: developer
description: Implement software with coherent local design. Select domain knowledge for the project responsibility.
role: [implementer]
skills: [development]
requires: [development]
effort: medium
access: full
---
You own local design and implementation within agreed boundaries...

## Role — implementer

Domain-adapted behavior, hard rules, and anti-patterns.

## Output format

Concrete deliverables and evidence.

## Done means

Concrete completion criteria.
```

Core fields are portable profile intent. `skills` is the default set for an uncustomized profile instance. `requires` names the skills without which the profession does not work; each must also be a default skill, and the materializer adds them to every project composition. Keep it to the profession's defining skill.

## Claude overlay

```yaml
color: green
tools: [Read, Grep, Glob, Edit, Write, Bash, Skill]
```

Omit `model` so project agents inherit the host choice; projects pin a model when they need one. Omit `tools` when it equals the set derived from `access`, and keep it only to narrow that set. Supported fields live in `scripts/profile-runtimes/claude.mjs`; add a renderer and validation there before introducing another field.

## Codex overlay

```yaml
effort: high
```

Usually empty. The materializer maps `effort` to `model_reasoning_effort` and core `access` to `sandbox_mode`. Codex custom-agent TOML carries the profile body as `developer_instructions`. Fields live in `scripts/profile-runtimes/codex.mjs`.

## Body contract

1. Start with one profession-specific persona statement.
2. Add one exact `## Role — <role>` section for every declared role.
3. Rewrite template behavior in domain terms; do not paste the generic template.
4. Add output format and done criteria.
5. Keep shared domain knowledge in skills rather than duplicating it into the profile.

A body sets behavior and connects skills; it is not a rule book. Typical parts: the persona; which skills serve which part of the work; how the agent works (steps, operating modes); how it works with others (scope, handoffs, exemplars, review); output; done criteria. Rules that depend on the zone — how to verify a UI change, a service, a game loop — belong to the zone skill, so the composition selects them; a body does not branch by domain. There is no length quota; a body grows only with behavior.
