# Flow 1: Create Skill

## Step 1: Gather Requirements

Ask the user (or extract from context):

- **What should the skill do?** — specific capability
- **What triggers it?** — user phrases that should activate it

If the user gave a clear description, skip asking and proceed.

## Step 2: Plan Content and Structure

Before writing anything, analyze the skill's content and decide how to organize it using progressive disclosure:

**What content will the skill have?**

| Content type | Placement | Signal |
|-------------|-----------|--------|
| Overview, quick reference, routing | SKILL.md | Needed for every invocation |
| Step-by-step procedures | `workflows/` | Can be followed independently |
| Knowledge, docs, templates | `references/` | Consulted conditionally |
| Executable code | `scripts/` | Run on demand |
| Output files (templates, images) | `assets/` | Copied, never loaded into context |

**Determine tone** based on content:

- Procedures with numbered steps → **imperative** ("Do X. Then do Y. Verify Z.")
- Reference material, decision trees → **advisory** ("When X, consider Y. Prefer Z because [reason].")
- Mix → **structured with adaptation** ("Do X. Adapt Y based on [context]. Verify Z.")

Write down the planned file list. This avoids retrofitting structure later.

## Step 3: Load Best Practices

Read `references/best-practices.md` from skill base directory.

## Step 4: Choose Name

Generate 3 name candidates ranked best to worst. Each with a 1-line description.

Naming rules:
- Lowercase, hyphens only
- Max 64 characters
- Verb-led when possible (e.g., `create-migration`, `deploy-service`)
- Namespace by domain if ambiguous (e.g., `kotlin-be-create-dao`, `frontend-add-page`)
- Match existing patterns in `skills/`

Present via `AskUserQuestion` with 3 options. The user can also enter their own name.

Proceed only after confirmation.

## Step 5: Write Description

Draft the description following the formula in imperative/infinitive form:

```
<Verb> <what it does>. Use when <trigger phrases>.
```

Rules:
- Single line, max 1024 chars
- Start with a verb (Create, Run, Add, Write, Configure, etc.)
- Include "Use when" with trigger phrases — exact words users would say
- Be specific — mention technologies, patterns, file types

Present to user for approval. Iterate if needed.

## Step 6: Generate SKILL.md

Load `references/skill-template.md` from skill base directory.

Fill in the template:
1. Frontmatter: `name`, `description`, `internal: true`, `allowed-tools` (scope to needed tools)
2. Content sections based on the plan from Step 2
3. For skills with procedures: numbered steps, imperative tone
4. For skills with reference material: tables, decision trees, advisory tone
5. Validation section
6. References section (link to workflows/ and references/)
7. **Code naming patterns**: If the skill teaches naming conventions, use rule + examples format (e.g., `onSelectLoadDetailsEpic`), not `<Placeholder>` templates. See best-practices.md "Code Pattern Notation".

Create directory and write file:
```bash
mkdir -p skills/<skill-name>
mkdir -p skills/<skill-name>/workflows    # if workflows planned
mkdir -p skills/<skill-name>/references   # if references planned
mkdir -p skills/<skill-name>/scripts      # if scripts planned
mkdir -p skills/<skill-name>/assets        # if assets planned
```

Write `SKILL.md` to `skills/<skill-name>/SKILL.md`.

## Step 7: Generate Supporting Files

Based on the plan from Step 2, create supporting files:

1. **workflows/*.md** — detailed step-by-step procedures
2. **references/*.md** — knowledge, API docs, decision trees
3. **scripts/*.sh** — executable validation or generation scripts
4. **assets/** — template files for output (not loaded into context)

For skills with multiple independent procedures: each procedure is a separate file in `workflows/`, and SKILL.md acts as a router between them.

## Step 8: Verify Access

**IMPORTANT**: All files must be written to `skills/<skill-name>/`, NOT `.claude/skills/`.

The repo uses symlinks (`.claude/skills` → `../skills/`), so no installation step is needed. Verify the skill is accessible:

```bash
ls .claude/skills/<skill-name>/SKILL.md
```

After creation, offer:
> "Skill created. Want me to run verification to check quality?"

If yes → chain to Flow 2 with the just-created skill.
