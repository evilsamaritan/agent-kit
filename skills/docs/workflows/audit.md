# Documentation Audit Workflow

Step-by-step procedure for auditing project documentation.

## Step 1: Discover Project Structure

1. Run `ls` at the project root to identify project type (monorepo, single service, library, CLI tool)
2. Glob for documentation files: `**/*.md`, `**/.env.example`, `**/openapi.*`, `**/asyncapi.*`
3. Identify services, packages, libraries, and their boundaries
4. Note the primary language, framework, and build tools

## Step 2: Inventory Existing Documentation

Build a map of what exists:

| Location | Type | Exists? |
|----------|------|---------|
| Root README.md | Project overview | ? |
| Per-service/package README.md | Component docs | ? |
| .env.example files | Configuration reference | ? |
| API docs (OpenAPI, AsyncAPI, inline) | API reference | ? |
| Architecture docs (diagrams, ADRs) | Design records | ? |
| CONTRIBUTING.md | Contributor guide | ? |
| CHANGELOG.md | Version history | ? |
| Onboarding/setup guide | Developer guide | ? |

## Step 3: Audit Completeness

### Root README

- [ ] Project purpose clear in first paragraph
- [ ] Quick start section (clone to running in 5 commands or fewer)
- [ ] Prerequisites listed with versions
- [ ] Architecture overview (diagram or description)
- [ ] Configuration documented
- [ ] Project structure explained
- [ ] Testing instructions
- [ ] Links to sub-component docs (if monorepo)

### Per-Component Docs

- [ ] Each service/package has README with purpose, config, usage
- [ ] .env.example complete for every service that uses env vars
- [ ] All env vars documented (type, default, required/optional)

### API Documentation

- [ ] Every endpoint documented (method, URL, auth, params, response)
- [ ] Request/response examples provided
- [ ] Error codes listed with meanings
- [ ] Machine-readable spec exists or can be generated (OpenAPI, AsyncAPI, GraphQL schema)

### Architecture

- [ ] Service/component communication described
- [ ] Data flow documented
- [ ] Key architectural decisions recorded (ADRs)
- [ ] Database schema documented (if applicable)

### AI Readability

- [ ] llms.txt exists (if project has public docs or API)
- [ ] Headings are descriptive and hierarchical (not "Part 2" or "Continued")
- [ ] Parameters documented in structured format (tables with type, required, default)
- [ ] Consistent terminology throughout (no synonym drift)

## Step 4: Verify Accuracy

- [ ] README commands actually work (check against package.json, Makefile, or equivalent)
- [ ] .env.example vars match what code actually reads (grep for env var access patterns)
- [ ] API docs match actual endpoint implementations
- [ ] Architecture diagrams reflect current code
- [ ] Port numbers, URLs, and paths in docs are correct

## Step 5: Produce Report

```markdown
## Documentation Assessment

### Summary
[2-3 sentences: documentation health, critical gaps]

### Documentation Inventory
| Location | Type | Exists? | Accurate? | Complete? |
|----------|------|---------|-----------|-----------|

### .env.example Audit
| Service | Vars in Code | Vars in .env.example | Missing |
|---------|-------------|---------------------|---------|

### API Documentation Status
| Endpoint | Documented? | Examples? | Errors Listed? |
|----------|-------------|-----------|----------------|

### Findings
| # | Area | Severity | Finding | Location | Recommendation |
|---|------|----------|---------|----------|----------------|

### Documentation Plan
| Priority | Document | Audience | Effort |
|----------|---------|----------|--------|

### Recommendations
1. [Priority order -- what to write first]
```

## Documentation Priority (Universal)

```
Must-have (before production):
  1. .env.example -- complete, accurate, grouped
  2. Quick start -- new developer can run in 15 minutes
  3. API reference -- all endpoints documented
  4. Architecture overview -- how components connect

Should-have (before scaling team):
  5. ADRs -- why decisions were made
  6. Onboarding guide -- detailed developer setup
  7. Database/data model docs
  8. Deployment guide

Nice-to-have:
  9. Machine-readable API spec (OpenAPI/AsyncAPI)
  10. Contributing guide
  11. Changelog
  12. Troubleshooting FAQ
```
