# Flow 1: Create Skill

## Step 1: Classify Skill Type

Before gathering requirements, determine the skill's taxonomy class:

1. **Mode**: kit authoring (inside the Agent Kit repository) or project skill (see SKILL.md Critical Rule 1). The mode decides the target directory and the validation.
2. **Class**: broad / specialized / regulatory knowledge, or meta. If the request is behavioral role content, route to `agent-creator` and its role-templates instead of creating a skill.

Classification decision tree:
```
Is this primarily behavioral guidance for a profession or worker?
├── Yes → route to agent-creator / role-template; do not create a skill
└── No
    Does it create or manage other skills/agents?
    ├── Yes → meta
    └── No → knowledge
        How wide is the domain?
        ├── Multiple technologies/vendors → broad (agnostic in SKILL.md)
        ├── Regulatory/compliance → regulatory (evergreen core, volatile in refs)
        └── Language, framework, platform technology, or narrow sub-domain → specialized
```

The class picks the structure template in `references/skill-template.md` ("Structure Templates by Class") and the agnostic rule in SKILL.md's Classes table.

## Step 2: Gather Requirements

Ask the user (or extract from context):

- **What should the skill do?** — specific capability
- **What triggers it?** — user phrases that should activate it

If the user gave a clear description, skip asking and proceed.

## Step 3: Plan Content and Structure

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

## Step 4: Load Best Practices

Read `references/best-practices.md` from skill base directory.

## Step 5: Choose Name

Pick a name; offer two or three alternatives only when the choice is unclear.

Naming rules:
- Lowercase, hyphens only (no consecutive hyphens, must not start/end with hyphen), max 64 characters
- Knowledge skills are named by domain (`caching`, `release-engineering`); procedural skills may be verb-led (`create-migration`)
- Prefix a domain only to disambiguate (`api-add-endpoint` beside `cli-add-command`)
- Match the names already in the target skill directory

Use a valid name the user supplied.

## Step 6: Write Description

Draft the description with the formula and rules in `references/best-practices.md` ("Description Writing Guide").

Use the draft directly when it faithfully reflects the request. Ask only when sibling boundaries or intended triggers remain ambiguous.

## Step 7: Generate SKILL.md

Load `references/skill-template.md` from skill base directory.

Select the structure template matching the class from Step 1 ("Structure Templates by Class").

Fill in the template:
1. Frontmatter: portable `name` + `description`; omit `allowed-tools` unless a reviewed one-turn permission grant is necessary
2. Content sections based on the classification and plan from Step 3
3. For skills with procedures: numbered steps, imperative tone
4. For skills with reference material: tables, decision trees, advisory tone
5. Validation section
6. References section (link to workflows/ and references/)
7. **Code naming patterns**: use rule + examples format (see best-practices "Code Pattern Notation"), not `<Placeholder>` templates

Create the skill directory chosen by the mode (kit: `skills/<skill-name>/`; project: the host's project skill directory) with only the subdirectories the plan needs, then write `SKILL.md` there.

## Step 8: Generate Supporting Files

Based on the plan from Step 3, create supporting files:

1. **workflows/*.md** -- detailed step-by-step procedures
2. **references/*.md** -- knowledge, API docs, decision trees
3. **scripts/*.sh** -- executable validation or generation scripts
4. **assets/** -- template files for output (not loaded into context)

For skills with multiple independent procedures: each procedure is a separate file in `workflows/`, and SKILL.md acts as a router between them.

## Step 9: Verify Access

Verify the source exists in the mode's directory (`test -f <skill-dir>/SKILL.md`). In the kit, the Claude, Codex, and Kimi manifests already expose `skills/`, so no mirror is needed; in a project, the host discovers its own project skill directory.

After creation, chain to Flow 2 automatically and fix any safe in-scope issues before reporting completion.
