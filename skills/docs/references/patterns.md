# Documentation Patterns and Anti-Patterns

## Contents

- [Good Patterns](#good-patterns)
- [Anti-Patterns](#anti-patterns)
- [Framework-Specific API Doc Generation](#framework-specific-api-doc-generation)
- [Configuration Documentation Patterns](#configuration-documentation-patterns)

---

## Good Patterns

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| Docs-as-code | Docs in same repo, reviewed in same PR | Always |
| Single source of truth | One canonical location per fact | When info is duplicated |
| Progressive disclosure | Overview first, details on demand | Long documents, complex systems |
| Copy-paste ready | Examples work as-is (except secrets) | Code examples, commands |
| Generated docs | Auto-generate from source (OpenAPI, typedoc, rustdoc) | API reference, library docs |
| Versioned docs | Docs match the code version they describe | Libraries with multiple versions |
| Linked not copied | Link to source of truth instead of copying | Cross-referencing between docs |

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

---

## Framework-Specific API Doc Generation

| Language/Framework | Tool | Output |
|-------------------|------|--------|
| Any REST API | OpenAPI / Swagger | JSON/YAML spec, Swagger UI |
| Event-driven / messaging | AsyncAPI | Spec for event schemas, channels |
| GraphQL | Introspection + GraphQL Docs | Schema reference |
| gRPC / Protobuf | protoc-gen-doc | HTML/Markdown from .proto |
| TypeScript | TypeDoc | HTML/Markdown from TSDoc comments |
| Rust | rustdoc (cargo doc) | HTML from doc comments |
| Python | Sphinx / mkdocstrings | HTML from docstrings |
| Go | godoc / pkgsite | HTML from doc comments |
| Java/Kotlin | Javadoc / Dokka | HTML from doc comments |

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
