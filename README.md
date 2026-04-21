# agent-kit

Production-grade agents and skills — domain expertise packaged as context, not code.

## Philosophy

**Context Engineering, not Prompt Engineering.** The performance of an AI agent depends on the entire information pipeline: system prompts, tool definitions, retrieved documents, conversation history. The context window is a finite shared resource — every token loaded competes with the user's actual work. In agent workflows, tool outputs alone consume ~84% of available tokens.

**Skills are the knowledge layer.** MCP servers provide tools (the kitchen); skills provide recipes. A skill covers a domain — deep knowledge of a technology (React, Kubernetes) or a cross-cutting concern (security, observability). Skills are structured text that shape agent behavior through expertise, not through code.

**Progressive disclosure keeps context lean.** Information loads in three levels: YAML frontmatter (always in system prompt, triggers skill selection), SKILL.md body (loaded when skill is relevant), and linked files in workflows/ and references/ (loaded on demand). Every token must earn its place.

**Open standard.** Skills follow the [agentskills.io](https://agentskills.io) specification — they work across Claude Code, Cursor, Windsurf, and 30+ other tools. Claude-first by default; other agents may need adaptation.

## Architecture

Agents are named after **professions**. Each profession is assembled from two ingredients:

- **Role-templates** — behavioral primitives ("how to think, how to structure work"). Live in `skills/agent-creator/templates/`. Copied into the agent body at creation time by the agent-creator meta skill.
- **Knowledge skills** — domain expertise. Either vendor-neutral (`database`, `caching`) or technology-specific (`react`, `rust`). Auto-triggered by the runtime or preloaded into agents via `skills:` in frontmatter.

**Meta skills** create and manage the rest (agents, skills, hooks, teams, project init).

```
skills/                            # flat — knowledge + meta, no subcategories
├── <knowledge-skill>/             # SKILL.md + references + workflows (optional)
└── agent-creator/
    ├── templates/                 # role-template assets (architect, implementer, reviewer, operator, writer)
    ├── SKILL.md
    └── workflows/

agents/                            # professions — architect, frontend, backend, devops, sre,
                                   # security, tester, designer, reviewer, writer
.claude-plugin/                    # plugin manifest
```

Role-templates are **not runtime skills** — the agent-creator inlines them into the agent body. Knowledge skills can live their own life and get picked up by Claude Code on trigger, or preloaded into agents deliberately.

## Key Principles

- **Description is the sole trigger** — must answer WHAT + WHEN with phrases users would actually say
- **Progressive disclosure** — frontmatter → body → linked files (3 levels of context loading)
- **Context is finite** — tool outputs consume ~84% of tokens; budget every line
- **Code over language** — scripts are deterministic; natural language is not
- **Composability** — skills load simultaneously and must work alongside each other
- **Test triggering** — 90%+ coverage on relevant queries, zero false positives
- **Teach patterns, not products** — SKILL.md teaches the pattern; reference files may use specific vendors as examples
- **Decision trees before vendor tables** — any skill comparing tools leads with a decision tree

## Installation

### As Plugin (full kit)

```bash
/plugin marketplace add evilsamaritan/agent-kit
/plugin install agent-kit@agent-kit
```

### Individual skills

```bash
npx skills add agent-kit/<skill-name>
```

### Browse available skills

```bash
npx skills find <query>
```

## Creating Skills

Use the built-in skill creator:

```
/agent-kit:skill-creator
```

Or describe what you need naturally — "create a skill for X" triggers the skill-creator automatically.

Key references:
- [best-practices.md](skills/skill-creator/references/best-practices.md) — authoring patterns and conventions
- [skill-template.md](skills/skill-creator/references/skill-template.md) — unified template with section guide
- [verification-checklist.md](skills/skill-creator/references/verification-checklist.md) — quality validation checklist

## Creating Agents

Use the agent-creator:

```
/agent-kit:agent-creator
```

The agent-creator assembles an agent by:
1. Picking one or more **role-templates** from `skills/agent-creator/templates/` — these define behavior and are inlined into the agent body.
2. Selecting **knowledge skills** to preload via `skills:` in frontmatter.
3. Writing a short **persona** line and domain-specific output / done criteria.
4. Setting constraints — permission mode, allowed tools, max turns.

See [AGENTS.md](AGENTS.md) for full frontmatter reference and body structure.

## License

MIT
