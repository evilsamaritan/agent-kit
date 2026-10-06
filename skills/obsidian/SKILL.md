---
name: obsidian
description: "Configure Obsidian vault behavior. Use for excluded files, Graph view groups and filters, Bases, Canvas, and what belongs in a committed .obsidian folder versus Git ignore. Not for note content, writing style, or knowledge schemas."
user-invocable: true
---

# Obsidian

Treat Obsidian as an interface and projection layer over portable files. Markdown notes, their properties, and their meaningful links remain canonical.

## Core concepts

Separate three concerns before editing:

| Concern | Owner |
|---|---|
| What notes mean: property names and values, link rules, note types | The vault's own documented conventions, if any |
| Obsidian behavior and visualization | This skill |
| Publication, history, and ignored files | Git and repository policy |

Obsidian settings may visualize a convention the vault already has, but must not create a second, implicit ontology through folders, tags, Graph groups, or Base views. Works for any vault style: engineering docs, personal notes, a team wiki.

## Decision points

Pick the mechanism by the need:

1. Navigation between ideas: meaningful `[[wikilinks]]` and index notes (maps of content).
2. Filtering, grouping, sorting, or a working list (open tasks, notes by status): a native Base over properties the vault already uses.
3. Neighborhood or whole-vault exploration: Local or Global Graph.
4. A deliberately arranged spatial explanation: Canvas.
5. A workflow core Obsidian cannot express: evaluate a community plugin and ask before adding it.

If the task changes what notes mean (property vocabulary, relationship semantics, note types), follow the vault's documented conventions first. If none are documented, propose a minimal schema (a few properties, their allowed values, the link rule) and ask before changing metadata. Implement the decision in Obsidian only after it is settled.

## Hard rules

- Read the repository's instruction file (if any), `.obsidian/`, `.gitignore`, and the vault's metadata and linking rules before changing anything.
- Prefer core features. Add community plugins only with explicit user approval.
- Preserve unknown configuration keys unless the change requires replacing them.
- Commit only portable shared behavior. Keep workspace layouts, caches, trash, credentials, account data, and absolute local paths untracked.
- Do not configure Obsidian Sync, Publish, or another remote service without an explicit request.
- Re-read configuration after editing; an open Obsidian instance may rewrite settings concurrently.

## Repository and exclusion boundaries

`.gitignore` controls what Git publishes. It does not control Obsidian Search, Graph view, Unlinked Mentions, Quick Switcher, or link suggestions.

When content should be absent or de-emphasized in those surfaces, also configure **Excluded files** (Files and links settings, Manage). Excluded files are hidden in Search, Graph view, and Unlinked Mentions, and less noticeable in Quick Switcher and link suggestions. In vaults the patterns appear as a `userIgnoreFilters` array in `.obsidian/app.json`; that key and the file layout of `.obsidian/` are not part of Obsidian's documented interface, so read the vault's own files before editing and keep unknown keys.

Verify Git and Obsidian independently:

1. Git does not track or stage private or temporary paths (`git status`, `git check-ignore -v <path>`).
2. Obsidian's excluded patterns cover the intended paths (`userIgnoreFilters` in `.obsidian/app.json`).
3. The exclusion does not hide material needed for normal work.

## Graph design

- Derive edges from meaningful `[[wikilinks]]`; never add decorative links to shape the graph.
- Filter templates, attachments, raw imports, and administrative files when they obscure the content network.
- Build color groups from stable properties or tags the vault documents, not filename conventions or accidental folder placement.
- Keep the palette distinguishable in light and dark themes and the number of groups small.
- Use arrows only when link direction carries meaning.
- Local Graph for a neighborhood; Global Graph for overview and diagnostics.
- Keep a deterministic check for orphan notes and unresolved links even when the presentation graph hides them.

## Bases and Canvas

Bases are projections over file and note properties. They may expose working lists such as open questions, notes by status, or sources per project, but must not hold unique state absent from the notes.

- Reuse documented properties and values; filter out templates and administrative files.
- Keep a small number of task-oriented views, grouped and sorted only where that helps scanning or action.
- A `.base` file is YAML; the core Bases plugin must be enabled.

Use Canvas for curated spatial composition, not as the only place where a claim, decision, or relationship exists. Link Canvas nodes back to notes.

## Anti-Patterns

- **Decorative links** — links added to make the graph look connected.
- **Folder as ontology** — meaning carried by folder placement or filename patterns that no property or link states.
- **Unique state in a view** — a fact that exists only in a Base filter or a Canvas card.
- **Hidden schema** — Graph groups or Base filters that assume properties the vault never documented.
- **Committed workspace** — `workspace.json`, cache, or machine-specific paths in version control.
- **Plugin by default** — a community plugin added where a core feature or plain Markdown would do.

## Validation

1. Parse every edited JSON file (`node -e "JSON.parse(require('fs').readFileSync('.obsidian/graph.json','utf8'))"`) and each `.base` file as YAML.
2. Check `.obsidian/core-plugins.json` enables every core plugin the configuration needs.
3. Confirm each Graph group query matches property names and values that exist in the notes (search for them).
4. List orphan notes and unresolved links (Obsidian's unresolved-links view, or a script over `[[...]]` targets), excluding paths in `userIgnoreFilters`.
5. Confirm `git status` shows no workspace or machine-specific files.
6. Open a fresh clone and confirm that attachments, symlinks, and embedded links resolve.
7. Report mechanical changes separately from content changes.

## Related Knowledge

- `documentation` for durable human-facing project documentation.
