---
name: obsidian
description: Configure and maintain Obsidian vault mechanics, including portable settings, excluded paths, properties, Graph view filters and groups, Bases, Canvas, templates, and repository-safe validation. Use when changing Obsidian behavior or visualization. Do NOT use to decide what knowledge means, which claims are true, or how a domain ontology should work.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
user-invocable: true
---

# Obsidian

Treat Obsidian as an interface and projection layer over portable files. Markdown
notes, their properties, and their meaningful links remain canonical.

## Core concepts

Separate three concerns before editing:

| Concern | Owner |
|---|---|
| Meaning, evidence, ontology, note lifecycle | The project's knowledge or domain rules |
| Obsidian behavior and visualization | This skill |
| Publication, history, and ignored files | Git and repository policy |

Obsidian settings may visualize a semantic contract, but must not create a
second, implicit ontology through folders, tags, Graph groups, or Base views.

## Decision points

Use this order when selecting a mechanism:

1. If the need is navigation between ideas, use meaningful `[[wikilinks]]` and
   maps of content.
2. If the need is filtering, grouping, sorting, or an operational queue, use a
   native Base over documented properties.
3. If the need is neighborhood or whole-vault exploration, configure Local or
   Global Graph view.
4. If the need is a deliberately arranged spatial explanation, use Canvas.
5. If core Obsidian features cannot express the requested workflow, evaluate a
   community plugin and ask before adding it.

If the task changes note meaning, metadata vocabulary, epistemic status,
provenance, or relationship semantics, follow the project's knowledge skill or
schema first. Implement its decision in Obsidian only after the contract is
clear.

## Hard rules

- Read root `AGENTS.md` or `CLAUDE.md`, `.obsidian/`, `.gitignore`, and relevant
  metadata or linking rules before changing a vault.
- Prefer core Obsidian features. Add community plugins only with explicit user
  approval.
- Preserve unknown configuration keys unless the requested change requires
  replacing them.
- Commit only portable shared behavior. Keep workspace layouts, caches, trash,
  credentials, account data, and absolute local paths untracked.
- Do not configure Obsidian Sync, Publish, or another remote service without an
  explicit request.
- Re-read configuration after editing because an open Obsidian instance may
  rewrite settings concurrently.

## Repository and exclusion boundaries

`.gitignore` controls what Git publishes. It does not control Obsidian Search,
Graph view, Unlinked Mentions, Quick Switcher, or link suggestions.

When content should be absent or de-emphasized in those Obsidian surfaces, also
configure **Excluded files**. Obsidian stores these patterns in
`userIgnoreFilters` inside `.obsidian/app.json`.

Verify Git and Obsidian independently:

1. Confirm Git does not track or stage private or temporary paths.
2. Confirm Obsidian's excluded patterns cover the intended paths.
3. Confirm the exclusion does not hide material needed for normal knowledge
   work.

## Graph design

- Derive edges from meaningful `[[wikilinks]]`; never create decorative links
  merely to shape the graph.
- Filter raw inputs, templates, attachments, and administrative files when they
  obscure the content network.
- Build color groups from stable properties such as `type`, not filename
  conventions or accidental folder placement.
- Keep the palette distinguishable in light and dark themes and limit the number
  of groups.
- Use arrows only when link direction carries useful meaning.
- Use Local Graph for neighborhood exploration and Global Graph for overview and
  diagnostics.
- Keep deterministic orphan and unresolved-link audits even when the presentation
  graph hides those nodes.

## Bases and Canvas

Bases are projections over file and note properties. They may expose queues,
questions, sources, decisions, maturity, and coverage, but must not hold unique
state absent from the notes.

- Reuse documented properties and values.
- Filter templates, raw inputs, and administrative files.
- Keep a small number of task-oriented views.
- Group and sort only where it improves scanning or action.
- Validate `.base` files as YAML and confirm the core Bases plugin is enabled.

Use Canvas for curated spatial composition, not as the only place where a claim,
decision, or relationship exists. Link Canvas nodes back to canonical notes.

## Validation

Before finishing:

1. Parse every edited JSON and Base YAML file.
2. Confirm core plugins required by the configuration are enabled.
3. Confirm Graph group queries match existing property syntax and values.
4. Inspect unresolved links and orphan notes outside allowed staging areas.
5. Confirm workspace and machine-specific files remain untracked.
6. Verify symlinks and relative paths from the repository checkout.
7. Report mechanical changes separately from knowledge-content changes.

## Related Knowledge

- `documentation` for durable human-facing project documentation.
- A project-specific knowledge skill for note semantics, provenance, and
  epistemic lifecycle.
