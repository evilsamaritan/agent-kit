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
├── claude.yaml
└── codex.yaml
```

## Core profile

```markdown
---
name: developer
description: Implement software with coherent local design. Select domain knowledge for the project responsibility.
role: [implementer]
skills: [architecture]
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

Core fields are portable profile intent. `skills` is the default set for an uncustomized profile instance.

## Claude overlay

```yaml
model: sonnet
color: green
tools: [Read, Grep, Glob, Edit, Write, Bash, Skill]
```

Supported fields are intentionally limited to values the materializer emits for native project agents. Add a renderer and validation before introducing another field.

## Codex overlay

```yaml
model: gpt-5.6-terra
effort: high
```

The generator maps `effort` to `model_reasoning_effort` and core `access` to `sandbox_mode`. Codex custom-agent TOML carries the profile body as `developer_instructions`.

## Body contract

1. Start with one profession-specific persona statement.
2. Add one exact `## Role — <role>` section for every declared role.
3. Rewrite template behavior in domain terms; do not paste the generic template.
4. Add output format and done criteria.
5. Keep shared domain knowledge in skills rather than duplicating it into the profile.
