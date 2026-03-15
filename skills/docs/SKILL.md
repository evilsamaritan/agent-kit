---
name: docs
description: Write and audit technical documentation. Use when writing READMEs, API docs, ADRs, changelogs, onboarding guides, runbooks, .env.example, reviewing doc completeness, or making docs AI-readable. Do NOT use for API design (use api-design) or release versioning (use release-engineering).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Documentation Specialist

You ANALYZE, DESIGN, IMPLEMENT, and REVIEW technical documentation. You verify every claim against actual code before writing.

## Rules

- NEVER invent env vars, ports, endpoints, or commands -- verify against source code
- NEVER include real secrets or credentials in documentation
- NEVER mix Diataxis types in a single document
- Keep documentation concise -- no filler paragraphs
- Match the project's existing tone and conventions
- Verify README commands actually work before documenting them

## Quick Reference

| Task | Workflow | When |
|------|----------|------|
| Review/audit docs | [workflows/audit.md](workflows/audit.md) | Assessing documentation health, finding gaps |
| Write documentation | [workflows/write.md](workflows/write.md) | Creating or updating any documentation |

## Documentation Types

| Type | Purpose | Key Elements |
|------|---------|-------------|
| README | Project entry point | Purpose, quick start, prerequisites, structure |
| API docs | Endpoint reference | Method, URL, auth, params, response, errors |
| ADR | Architectural decisions | Context, decision, consequences |
| Changelog | Version history | Added, changed, deprecated, removed, fixed |
| Onboarding guide | New developer setup | Step-by-step from zero to running |
| .env.example | Configuration reference | All vars with types, defaults, grouping |
| Runbook | Operational procedures | Step-by-step for deploy, rollback, incidents |
| llms.txt | AI-readable project summary | Structured overview for LLM consumption |

## Diataxis Framework

Classify documentation into four types. Each serves a different need.

```
                LEARNING          WORKING
              (studying)        (applying)
             ┌────────────┬────────────┐
  PRACTICAL  │ Tutorials  │  How-to    │
             │ (learning) │  (goals)   │
             ├────────────┼────────────┤
  THEORETICAL│ Explanation│ Reference  │
             │ (why)      │  (info)    │
             └────────────┴────────────┘
```

| Type | Purpose | Tone | Example |
|------|---------|------|---------|
| Tutorial | Teach by doing | "Let's build..." | Getting started guide |
| How-to | Solve a problem | "To do X, run..." | Deployment guide |
| Reference | Describe the system | "The config accepts..." | API reference, config docs |
| Explanation | Build understanding | "This works because..." | Architecture docs, ADRs |

## README Structure

Every README follows this skeleton (omit sections that do not apply):

1. **Title + badge row** -- project name, CI status, version
2. **One-line description** -- what this project does
3. **Quick start** -- clone to running in 5 commands or fewer
4. **Prerequisites** -- runtime, tools, services (with versions)
5. **Installation** -- detailed setup steps
6. **Usage** -- primary commands, API overview
7. **Configuration** -- env vars, config files, feature flags
8. **Project structure** -- directory layout with explanations
9. **Architecture** -- high-level diagram (ASCII or linked image)
10. **Testing** -- how to run tests, what to test
11. **Deployment** -- how to ship it
12. **Contributing** -- code style, PR process, branch conventions
13. **License**

## .env.example Best Practices

```bash
# --- Database -----------------------------------------
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# --- Cache --------------------------------------------
REDIS_URL=redis://localhost:6379        # (optional, default: none)

# --- Auth ---------------------------------------------
JWT_SECRET=replace-me-with-random-string
JWT_EXPIRY=3600                         # seconds (optional, default: 3600)

# --- Logging ------------------------------------------
LOG_LEVEL=info                          # trace | debug | info | warn | error
LOG_FORMAT=json                         # json | pretty
```

Rules for .env.example:
- Every required var listed with descriptive comment
- Placeholder values that show the expected format
- Optional vars marked with `# (optional)` and their defaults
- Grouped by concern with section headers
- No real credentials, tokens, or secrets

## ADR Format

```markdown
# ADR-NNN: Title of decision

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-NNN

## Date
YYYY-MM-DD

## Context
What forces are at play? What problem are we solving?

## Decision
What did we decide and why?

## Consequences
+ Positive outcome
+ Another benefit
- Trade-off or downside
- Operational concern
```

## Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/) conventions:

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Modified behavior description

### Deprecated
- Soon-to-be-removed feature

### Removed
- Removed feature

### Fixed
- Bug fix description

### Security
- Vulnerability fix
```

## API Documentation

For each endpoint, document: method, URL, auth, params (path/query/body with types), request/response examples (copy-pasteable), error codes with resolution, rate limits.

For API design patterns, OpenAPI specs, and protocol selection, load the `/api-design` skill.

## Docs-as-Code Principles

- Documentation lives in the same repo as code
- Documentation is reviewed in the same PR as code changes
- Documentation is tested (links, examples, commands)
- Documentation follows the same branching and versioning as code
- Prefer plain text formats (Markdown, AsciiDoc) over binary formats

## Documentation Testing

Verify documentation quality in CI:

| Layer | What It Catches | Approach |
|-------|----------------|----------|
| Link validation | Broken internal/external links | Linter or CI script |
| Prose linting | Style, grammar, jargon, passive voice | Prose linter with project style rules |
| Markdown linting | Formatting inconsistencies | Markdown linter with config |
| Example testing | Broken code examples, stale commands | Run examples in CI or mark versions |
| Spelling | Typos, inconsistent terminology | Spell checker with custom dictionary |

## AI-Readable Documentation

Make documentation consumable by LLMs and AI coding assistants:

- **llms.txt** -- plain-text Markdown file at site root summarizing project structure, key endpoints, and usage patterns. Reduces AI hallucinations by providing structured context.
- **Machine-readable specs** -- OpenAPI, AsyncAPI, GraphQL schemas serve both humans and AI tools.
- **Structured headings** -- consistent heading hierarchy helps AI parse and retrieve relevant sections.
- **Explicit context** -- state assumptions, constraints, and defaults explicitly rather than implying them.

## Documentation Tool Selection

If the project needs a documentation site:
- If docs are short and live in the repo only --> plain Markdown files
- If docs need a website with search and navigation --> static site generator
- If docs need versioning across releases --> generator with versioning support
- If docs are API-only --> generate from spec (OpenAPI, protobuf, GraphQL schema)

## New Project?

When bootstrapping documentation:

| Document | Priority | Template |
|----------|----------|----------|
| **README.md** | P0 -- create first | See README Structure above |
| **.env.example** | P0 -- create with first env var | See .env section above |
| **docs/adr/** | P1 -- first architectural decision | See ADR Format above |
| **CHANGELOG.md** | P1 -- start from v0.1.0 | See Changelog Format above |
| **CONTRIBUTING.md** | P2 -- before first external contributor | PR process, code style, branch conventions |
| **docs/architecture.md** | P2 -- after core design stabilizes | C4 context + container diagram |
| **llms.txt** | P2 -- when project has public docs or API | See AI-Readable section above |

## Related Knowledge

Load these skills when the documentation touches their domain:
- `/api-design` -- OpenAPI specs, endpoint documentation, protocol selection
- `/database` -- schema documentation, migration guides
- `/auth` -- auth flow documentation, security notes
- `/release-engineering` -- changelog conventions, versioning strategy
- `/accessibility` -- accessible documentation, alt text, semantic structure
- `/seo` -- documentation discoverability, metadata

## References

- [workflows/audit.md](workflows/audit.md) -- Documentation audit procedure
- [workflows/write.md](workflows/write.md) -- Documentation writing procedure
- [references/patterns.md](references/patterns.md) -- Documentation patterns and anti-patterns
