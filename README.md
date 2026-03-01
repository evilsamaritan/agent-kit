# agent-kit

Production-grade agents and skills — domain expertise packaged as context, not code.

## Philosophy

**Context Engineering, not Prompt Engineering.** The performance of an AI agent depends on the entire information pipeline: system prompts, tool definitions, retrieved documents, conversation history. The context window is a finite shared resource — every token loaded competes with the user's actual work. In agent workflows, tool outputs alone consume ~84% of available tokens.

**Skills are the knowledge layer.** MCP servers provide tools (the kitchen); skills provide recipes. A skill covers a domain: the role of a specialist (security auditor, Rust architect) or deep knowledge of a technology (Playwright, Terraform). Skills are structured text that shape agent behavior through expertise, not through code.

**Progressive disclosure keeps context lean.** Information loads in three levels: YAML frontmatter (always in system prompt, triggers skill selection), SKILL.md body (loaded when skill is relevant), and linked files in workflows/ and references/ (loaded on demand). Every token must earn its place.

**Open standard.** Skills follow the [agentskills.io](https://agentskills.io) specification — they work across Claude Code, Cursor, Windsurf, and 30+ other tools. Claude-first by default; other agents may need adaptation.

## Architecture

```
skills/   → Domain knowledge (3 skills)
agents/   → Role personas that compose skills (2 agents)
.claude-plugin/  → Plugin packaging for distribution
```

| Directory | Contents |
|-----------|----------|
| `skills/<name>/` | SKILL.md + workflows/ + references/ + scripts/ |
| `agents/<name>.md` | YAML frontmatter + persona + workflow |
| `.claude-plugin/` | plugin.json, marketplace.json |
| `docs/` | Project documentation and roadmaps |

## Key Principles

- **Description is the sole trigger** — must answer WHAT + WHEN with phrases users would actually say
- **Progressive disclosure** — frontmatter → body → linked files (3 levels of context loading)
- **Context is finite** — tool outputs consume ~84% of tokens; budget every line
- **Code over language** — scripts are deterministic; natural language is not
- **Composability** — skills load simultaneously and must work alongside each other
- **Test triggering** — 90%+ coverage on relevant queries, zero false positives

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
- [verification-checklist.md](skills/skill-creator/references/verification-checklist.md) — 43-check quality validation

## Creating Agents

1. Define the role and domain expertise
2. Choose which skills to preload via `skills:` frontmatter
3. Set constraints — permission mode, allowed tools, max turns
4. Write persona with imperative tone, explicit deliverables, and completion criteria
5. Place in `agents/<agent-name>.md`

See [AGENTS.md](AGENTS.md) for full frontmatter reference and body structure.

## License

MIT
