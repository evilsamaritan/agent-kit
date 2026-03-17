# Create Team Workflow

Interactive workflow for creating a reusable multi-agent team. Triggered by "create a team for X".

---

## Step 1: Understand the Project

**Goal:** Identify project domain, tech stack, and team name prefix.

1. If the user already described the project, extract domain from their request
2. Otherwise, ask:
   ```
   AskUserQuestion: What project or domain is this team for? (e.g., "React dashboard", "Go microservice", "full-stack e-commerce")
   ```
3. Scan codebase to detect tech stack:
   ```
   Glob: package.json, go.mod, Cargo.toml, pyproject.toml, build.gradle*, pom.xml, mix.exs
   Glob: **/*.ts, **/*.tsx, **/*.go, **/*.rs, **/*.py, **/*.java, **/*.kt
   ```
   - Languages: check file extensions and build configs
   - Frameworks: check dependencies (React, Vue, Next.js, Express, FastAPI, etc.)
   - Package managers: npm/yarn/pnpm, cargo, pip/poetry, go modules
4. Derive team name prefix — lowercase, hyphens only:
   - From user input: "React dashboard" → `react-dashboard`
   - From repo name if user doesn't specify
   - Confirm with user if ambiguous

**Output:** `team-name`, detected tech stack, relevant skills list.

---

## Step 2: Choose Flow Type

Present all 10 flow types grouped by category. Use AskUserQuestion.

```
AskUserQuestion: Which flow type fits your team?

**Development flows:**
  A) pipeline             — Sequential stages, output feeds forward (architect → build → test)
  B) pipeline-parallel    — Pipeline with parallel middle stages (plan → frontend ∥ backend → test)
  C) builder-validator    — Build/review loop with asymmetric permissions until approved

**Review flows:**
  D) twin-review          — Two reviewers (same or cross-model), compare findings
  E) swarm-review         — N reviewers in parallel, each owns one dimension
  F) devils-advocate      — One agent builds the case, another attacks it

**Research flows:**
  G) fan-out              — Same question to N agents, aggregate answers
  H) diverge-converge     — Independent exploration, then synthesis

**Security flows:**
  I) purple-team          — Red team attacks, blue team defends, findings merged

**Other:**
  J) custom               — Define your own stages and routing

Pick a letter (or ask me to explain any flow in detail):
```

If user asks for details → load `references/flow-catalog.md` (if exists) or explain the selected flow inline.

If user is unsure, recommend based on their goal:
- "build a feature" → B (pipeline-parallel)
- "review code" → D or E
- "security audit" → I (purple-team)
- "implement with quality" → C (builder-validator)

---

## Step 3: Configure Agents

For each role needed by the chosen flow, configure an agent.

### 3a. Determine roles from flow type

| Flow | Typical roles |
|------|---------------|
| pipeline | planner, implementer, tester |
| pipeline-parallel | planner, implementer ×2+, tester |
| builder-validator | builder, validator |
| twin-review | reviewer ×2 |
| swarm-review | reviewer ×N (each with a dimension) |
| devils-advocate | builder, reviewer |
| fan-out | explorer ×N |
| diverge-converge | explorer ×N, aggregator |
| purple-team | explorer (red), explorer (blue) |
| custom | user-defined |

### 3b. Check for existing agents

```
Glob: agents/<team-name>-*.md
```

For each existing agent:
```
AskUserQuestion: Agent '<team-name>-<role>' already exists. Reuse it or recreate?
  1) Reuse as-is
  2) Recreate (overwrites)
```

### 3c. Configure new agents

For each new agent, apply role archetype defaults:

| Archetype | tools | permissionMode |
|-----------|-------|----------------|
| explorer, reviewer, validator | [Read, Grep, Glob] | plan |
| implementer, builder | [Read, Grep, Glob, Edit, Write, Bash, Skill] | acceptEdits |
| tester | [Read, Grep, Glob, Edit, Write, Bash] | acceptEdits |
| planner, aggregator | [Read, Grep, Glob, Skill] | plan |

Assign skills based on detected tech stack:
- Frontend detected → add `frontend` skill (+ `react`, `vue`, etc. if detected)
- Backend detected → add `backend` skill (+ language skill)
- Security flow → add `security`, `auth` skills
- QA roles → add `qa` skill

### 3d. Create agents

For each agent, either:
- **Scaffold script** (fast, template-based):
  ```bash
  bash skills/team-creator/scripts/scaffold-team.sh <team-name> <role1> <role2> --skills <skill1>,<skill2>
  ```
- **Agent-creator** (richer, interactive): invoke `/agent-creator` for complex roles that need custom personas

Use scaffold for standard archetypes, agent-creator for specialized roles.

---

## Step 4: Additional Options

Present configuration options via AskUserQuestion:

```
AskUserQuestion: Configure team options for '<team-name>':

1. Twin reviewers?
   a) No (single reviewer per stage)
   b) Same-model twins (two reviewers, same model)
   c) Cross-model (opus + sonnet for diverse perspectives)
   d) Cross-role (e.g., security + architecture reviewing same code)

2. Quality gates?
   a) Blocking — agents cannot complete until hooks pass
   b) Advisory — hook failures logged but don't block
   c) None

3. Context compression between stages?
   a) Yes — compress to 3-5 findings + file paths (recommended)
   b) No — pass full output (risk: context bloat)

4. Max iterations for loops? (builder-validator only)
   → Default: 3. Enter a number or press enter for default.

5. Require human approval before implementation?
   a) Yes — pause after planning stage for user review
   b) No — run full pipeline automatically

Enter your choices (e.g., "1a 2a 3a 4:3 5b") or press enter for defaults:
```

**Defaults:** 1a, 2c, 3a, 4:3, 5b

---

## Step 5: Generate

### 5a. Create agent files

Run scaffold script or agent-creator for each agent that doesn't exist yet (from Step 3).

### 5b. Create team config

Write `.claude/teams/<team-name>/team.json`:

```json
{
  "version": "<from .claude-plugin/plugin.json>",
  "name": "<team-name>",
  "description": "<user-provided or generated>",
  "created": "<YYYY-MM-DD>",
  "agents": ["<team-name>-<role1>", "<team-name>-<role2>"],
  "flow": {
    "type": "<chosen-flow>",
    "stages": [
      { "agent": "<team-name>-<role1>", "role": "<description>", "parallel": false },
      { "agent": "<team-name>-<role2>", "role": "<description>", "parallel": false }
    ]
  },
  "options": {
    "twin_review": false,
    "twin_models": [],
    "context_compression": true,
    "max_iterations": 3,
    "quality_gate": false,
    "human_approval": false
  }
}
```

### 5c. Validate

```bash
bash skills/team-creator/scripts/validate-team.sh .claude/teams/<team-name>/team.json
```

Fix any errors before proceeding.

### 5d. Report

Present summary:

```
Team '<team-name>' created successfully.

Flow: <flow-type>
Agents:
  - <team-name>-<role1> → agents/<team-name>-<role1>.md
  - <team-name>-<role2> → agents/<team-name>-<role2>.md

Config: .claude/teams/<team-name>/team.json

Options:
  Twin review: <setting>
  Quality gates: <setting>
  Context compression: <setting>
  Max iterations: <N>
  Human approval: <setting>
```

### 5e. Offer next steps

```
AskUserQuestion: What next?
  1) Run this team now on a task
  2) Customize agent personas (opens agent files for editing)
  3) Done — I'll use '/team-creator <team-name>' later
```

---

## Reconfigure

Triggered by "reconfigure <team-name>" or "update <team-name> team".

1. Load existing config:
   ```
   Read: .claude/teams/<team-name>/team.json
   ```
   If not found → error: "Team '<team-name>' not found. Use 'create a team' first."

2. Show current configuration:
   ```
   Current team '<team-name>':
     Flow: <type>
     Agents: <list>
     Options: <summary>
   ```

3. Ask what to change:
   ```
   AskUserQuestion: What would you like to change?
     1) Flow type
     2) Team options (twins, quality gates, compression, iterations)
     3) Add/remove agents
     4) Everything — full reconfiguration
   ```

4. Apply changes:
   - Flow type change → update `flow.type` and `flow.stages` in team.json
   - Options change → re-run Step 4 options menu
   - Agent changes → add new agents (scaffold/agent-creator), remove from team.json
   - Existing agent files are NOT deleted or modified — only team.json references change

5. Re-validate:
   ```bash
   bash skills/team-creator/scripts/validate-team.sh .claude/teams/<team-name>/team.json
   ```

6. Confirm: "Team '<team-name>' reconfigured. Run with `/team-creator <team-name>`."
