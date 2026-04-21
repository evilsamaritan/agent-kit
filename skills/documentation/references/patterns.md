# Documentation Patterns and Anti-Patterns

## Contents

- [Good Patterns](#good-patterns)
- [Anti-Patterns](#anti-patterns)
- [Configuration Documentation Patterns](#configuration-documentation-patterns)
- [AI-Readable Documentation Patterns](#ai-readable-documentation-patterns)

---

## Good Patterns

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| Docs-as-code | Docs in same repo, reviewed in same PR | Always |
| Single source of truth | One canonical location per fact | When info is duplicated |
| Progressive disclosure | Overview first, details on demand | Long documents, complex systems |
| Copy-paste ready | Examples work as-is (except secrets) | Code examples, commands |
| Generated docs | Auto-generate from source (spec, doc comments) | API reference, library docs |
| Versioned docs | Docs match the code version they describe | Libraries with multiple versions |
| Linked not copied | Link to source of truth instead of copying | Cross-referencing between docs |
| Owned docs | Every document has a clear owner or team | Always -- unowned docs rot |
| Tested docs | Links, examples, and commands verified in CI | Projects with CI pipelines |
| Explicit defaults | State default values and assumptions, never imply | Configuration, API parameters |

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Tribal knowledge | Undocumented decisions and processes | Write ADRs and runbooks |
| Copy-paste drift | Same info in multiple places diverges | Single source of truth with links |
| Outdated screenshots | Images go stale faster than text | ASCII diagrams or generated images |
| Wall of text | Unstructured prose is unscannable | Headers, tables, code blocks |
| Aspirational docs | Describes desired state, not actual | Document current reality, note planned changes |
| Version-locked examples | Examples break with updates | Test examples in CI or mark versions explicitly |
| Jargon without definition | New readers cannot follow | Define terms on first use or add glossary |
| Empty template sections | Placeholder sections with no content | Remove sections that do not apply |
| Orphaned docs | Docs exist but nothing links to them | Add to navigation, TOC, or delete |
| Unowned docs | No person or team responsible for accuracy | Assign ownership per document or section |
| Write-once docs | Created at launch, never updated | Review docs in same PR as code changes |
| Mixed Diataxis types | Tutorial that stops for reference tables | Split into separate documents by type |

---

## Configuration Documentation Patterns

### Environment Variables

For each env var, document:

| Field | Example |
|-------|---------|
| Name | `DATABASE_URL` |
| Required? | Yes |
| Type/format | PostgreSQL connection string |
| Default | None (must be set) |
| Example value | `postgresql://user:pass@localhost:5432/myapp` |
| Description | Primary database connection |

### Feature Flags

Document each flag with: name, default, behavior when enabled, behavior when disabled.

### Config Files

For YAML/TOML/JSON config, provide an annotated example showing all options with comments explaining each field, valid values, and defaults.

---

## AI-Readable Documentation Patterns

### llms.txt Structure

Place at site root. Markdown format with:
1. Project name and one-line description
2. Key concepts and terminology
3. Directory/module structure overview
4. API endpoints or CLI commands summary
5. Links to detailed documentation sections

### Patterns for AI Consumption

| Pattern | Why It Helps AI | Example |
|---------|----------------|---------|
| Explicit headings | Enables section-level retrieval | `## Authentication` not `## Getting Started (continued)` |
| Structured parameters | Parseable by code generation tools | Tables with name, type, required, default columns |
| Concrete examples | Reduces hallucination in generated code | Real curl commands, not pseudocode |
| Consistent terminology | Prevents AI from inventing synonyms | Always "endpoint" not sometimes "route" |
| Machine-readable specs | Direct consumption by AI tools | OpenAPI, AsyncAPI, protobuf, GraphQL schema |
