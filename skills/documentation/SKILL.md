---
name: documentation
description: "Write or review technical documents: pick the document type, structure it for its reader, keep it true. Use for READMEs, tutorials, how-tos, references, Markdown plans, onboarding guides, documenting an agreed design, ADR placement, changelog wording, and docs-as-code. Do NOT use for deciding architecture (architecture) or API contracts (api-design)."
user-invocable: true
---

# Technical Documentation

Choose the document type, write it for one reader and one task, and keep it true as the code changes. Vendor-neutral. Neighbouring skills own the content of several document kinds; this skill owns their form, placement, and writing quality.

## Scope and boundaries

**This skill covers:**
- Document type selection (Diátaxis modes plus plans, READMEs, onboarding)
- Writing for the reader — structure, wording, examples that run
- README conventions by project type
- Placement, linking, and lifecycle of ADRs and other repository docs
- Changelog wording quality
- Configuration documentation (`.env.example`, config files, flags)
- Docs-as-code practices

**Owned elsewhere — point there:**

| Content | Owner |
|---|---|
| Whether to record a decision, its technical content, the ADR template | `architecture` ([adr-template.md](../architecture/references/adr-template.md)) |
| API schemas, OpenAPI, GraphQL | `api-design`, `graphql` |
| How changelog entries are produced (changesets, generated notes), versioning (wording quality of changelog entries and migration guides stays in documentation) | `release-engineering` |
| Runbook template tied to alerts | `observability` ([alerting-patterns.md](../observability/references/alerting-patterns.md#runbook-structure)); incident practice in `reliability` |
| `llms.txt` and public-docs findability | `seo` |
| Descriptions of LLM-callable tools and skills | `skill-creator` |
| Diagram notation and source | `diagrams` |
| Accessibility of the published docs | `accessibility` |

## Decision tree — which document

```text
Who reads it, and what are they doing?
├─ learning, new to the system ............ Tutorial: one guaranteed path, no branches
├─ has a goal, knows the basics ........... How-to: goal in the title, steps, assumes context
├─ looking up an exact fact ................ Reference: complete, terse, generated where possible
├─ building understanding of why ......... Explanation: prose, trade-offs, diagrams
├─ deciding or executing upcoming work ... Plan: goal, scope, steps with owners and checks, open questions
├─ arriving at the repository ............ README: by project type (below)
├─ joining the team or codebase .......... Onboarding: a tutorial to the first change, then links to how-tos and references
├─ recording a consequential decision .... ADR: content from `architecture`; placement below
├─ on call for an alert .................. Runbook: template in `observability`; lives next to the alert config
└─ upgrading between versions ............ Changelog entry or migration guide (how-to)
```

**Rule:** name the type of every document you write. If you cannot, the document mixes types; split it.

## Writing for the reader

1. **Name the reader and the task** before writing. Everything that does not serve that task moves elsewhere or goes.
2. **Lead with the answer.** The first paragraph states what the reader gets or must do; background follows.
3. **One term, one meaning.** Use the project's and the industry's terms; define a new one once.
4. **Examples run.** Commands and code copy-paste into working results, except for marked secrets.
5. **State defaults and assumptions** explicitly; never imply them.
6. **Plain voice.** No marketing adjectives ("seamless", "powerful"); say what it does.

## README conventions — by project type

| Type | Contents, in order |
|---|---|
| Library | what it does (one sentence); install and a runnable snippet; links to reference, migration guides; license and support |
| Service | what it serves; run locally and run tests; architecture pointer (ADR or diagram); deploy, monitor, debug; on-call link |
| Monorepo | packages with one line each; workspace bootstrap; conventions (branching, commits, CI); per-package READMEs for depth |
| CLI tool | what it does; install and one example; command reference generated from `--help`; configuration (env vars, files) |

## ADR placement

Keep ADRs where the project already keeps them. When none exists, use a `docs/adr/` directory beside the system they govern, one record per file, numbered as in the template (`ADR-NNN`). Never delete a record: when superseded, update its status and link both ways. Technical content, scope, and template: `architecture`.

## Changelog wording

`release-engineering` decides how entries are produced — changesets, generated release notes, or a maintained file. Whatever the source, entries and migration guides meet these rules:

- **Describe the user-visible effect**, not the commit: "Fixed crash when a list has exactly 100 items", not `fix: off-by-one`.
- **Flag breaking changes prominently** with the migration step, not inside a generic "Changed" list.
- **Never rewrite released sections**; corrections go into a new entry.
- **Link the change** (PR or issue) so a reader can find the detail.

## Configuration documentation

A complete `.env.example` or config reference:
- lists **every** setting the app reads, grouped (database, cache, auth, external services);
- gives each a one-line purpose, required or optional, default, and an example value;
- marks secrets with a placeholder — never a real value;
- matches runtime: if the app fails without `FOO`, `FOO` is documented.

Field table and config-file patterns: [patterns.md](references/patterns.md#configuration-documentation-patterns).

## Docs-as-code

- Docs live in the repository, next to the code they describe, and change in the same PR as that code.
- CI checks links, anchors, and runnable examples; a broken doc fails the build.
- Reference docs are generated from the source of truth (schema, doc comments, `--help`) instead of copied.
- Published docs are rebuilt on merge, searchable, and versioned with the code.

## Context adaptation

**As writer:** pick the type from the decision tree, apply the writing rules, check every example runs.

**As implementer (shipping a feature):** docs are part of "done": README or how-to update, a changelog entry in the project's format, configuration docs when a setting changes.

**As reviewer:** check type purity (no tutorial that stops for reference tables), that examples run, that docs changed with the code, and that configuration docs match runtime.

**As architect:** `architecture` decides what is recorded and why; this skill places, links, and maintains it.

**As operator:** a paging alert needs a runbook before it pages; template in `observability`.

## Anti-patterns

- **Aspirational documentation** — describing the system as it should be, not as it is.
- **README novella** — a 500-line README with everything. Split by reader and type.
- **Updated in code, not in docs** — a renamed option still documented under the old name. Fix: docs change in the same PR; stale docs are caught by review and by link and example checks, not by a hand-edited date.
- **Code examples that don't run** — a doc is broken if its code block does not copy-paste into working code.
- **Tutorial with branching paths** — "on macOS do X, else Y" is two tutorials.
- **Docs of docs** — pages about where documentation lives, with no information of their own.
- **Copied reference** — hand-copied parameters or endpoints that drift from the source; generate or link instead.

## Related Knowledge

- `architecture` — decision content, ADR template, and the design an architecture doc describes
- `diagrams` — notation, source, and compilation for diagrams inside documents; this skill decides where the diagram goes and what the surrounding text says
- `playground` — a separate explorable web page built from the document and its diagram sources
- `api-design` — API reference docs describe contracts defined there
- `release-engineering` — changelog production, versioning, release notes cadence
- `observability`, `reliability` — runbooks, alerts, incident practice
- `seo` — findability of public docs, `llms.txt`
- `skill-creator` — descriptions and triggers for skills and LLM-callable tools
- `accessibility` — accessible published docs (alt text, heading structure, contrast)

## References

- [patterns.md](references/patterns.md) — documentation patterns and anti-patterns tables, configuration documentation (env vars, flags, config files), docs that machines and AI tools read well
