# Documentation Writing Workflow

Step-by-step procedure for creating or updating documentation.

## Step 1: Understand the Target

1. Identify what documentation is needed (README, API docs, ADR, changelog, onboarding guide, .env.example)
2. Identify the audience (developers, operators, API consumers, new team members)
3. Classify by Diataxis type: tutorial, how-to, reference, or explanation
4. If unclear, ask the user what they need documented and for whom

## Step 2: Gather Context from Code

1. Read relevant source files to understand current behavior
2. Grep for configuration patterns (env var access, config files, feature flags)
3. Check existing documentation for content to preserve or update
4. Identify commands, scripts, and entry points (package.json, Makefile, Cargo.toml, pyproject.toml, or equivalent)
5. Note dependencies, prerequisites, and required services

## Step 3: Draft the Documentation

Apply the appropriate structure based on document type:

### README
Follow the README Structure from SKILL.md. Omit sections that do not apply.

### API Documentation
For each endpoint:
1. Method and URL pattern
2. Authentication requirements
3. Request parameters with types and constraints
4. Request body schema (if applicable)
5. Response schema with status codes
6. Error responses with meanings
7. Copy-pasteable example (curl, httpie, or language-specific)

### ADR
Follow the ADR Format from SKILL.md. Fill in all sections.

### Changelog
Follow Keep a Changelog format from SKILL.md. Categorize entries correctly.

### .env.example
Follow the .env.example Best Practices from SKILL.md.

### Onboarding Guide
1. Prerequisites with exact versions
2. Clone and install steps
3. Infrastructure setup (Docker, databases, services)
4. Configuration steps (copy .env.example, fill values)
5. Build and run steps
6. Verification steps (health checks, test commands)
7. Common issues and solutions

## Step 4: Verify Every Claim

Before finalizing, verify:
1. Every command runs successfully (or note if you cannot verify)
2. Every env var exists in the codebase
3. Every file path referenced exists
4. Every endpoint documented matches an actual route
5. Port numbers, URLs, and defaults are accurate

## Step 5: Write the Files

1. Show the user a preview of generated content before writing
2. Write files to the appropriate locations
3. Update any cross-references (links between docs, table of contents)

## Writing Principles

- **Accuracy over completeness** -- never document what you cannot verify
- **Concrete over abstract** -- show actual commands, real config values (except secrets)
- **Scannable** -- headers, tables, code blocks. Avoid walls of text.
- **Maintained** -- prefer patterns that stay accurate as code changes (generated docs, links to source)
- **Tested** -- if a README says "run X", that command must work
