# Team Orchestration Workflow

## Step 1: Discover Available Resources

### 1a. Load saved teams
```
Read .claude/teams.json (if exists)
→ Parse team definitions: name, agents, flow, description
```

### 1b. Discover agents
```
Glob agents/*.md → for each file:
  - Parse YAML frontmatter: name, description, skills, model, tools
  - Classify: built-in role agent vs custom specialist agent
  - Custom = has specific skills[] combination (e.g., skills: [frontend, react, html-css])
  - Role = has single role skill (e.g., skills: [frontend])
```

### 1c. Load built-in catalog
```
Read references/team-catalog.md → pre-defined team compositions
```

---

## Step 2: Resolve Team Composition

Based on user input, follow one of six paths:

### Path 0: Single Agent

User wants one specialist: "run security on src/auth/", "review with architect":

1. Identify the agent from the request (match by name, role, or domain)
2. If ambiguous, check `agents/*.md` for the best match
3. Spawn via Agent tool with `subagent_type: "<agent-name>"`
4. Return result — no team synthesis needed

### Path 0b: Multi-Instance (same agent × N)

User wants multiple copies of the same agent: "run 3 qa agents on different modules":

1. Identify the agent type and the number of instances
2. Parse individual scopes/prompts from the request
3. Spawn all instances in parallel with `run_in_background: true`
4. Each gets its own prompt with specific scope
5. Wait for all → aggregate results

```
Agent tool calls (parallel):
  subagent_type: "qa", prompt: "Review tests in api/", run_in_background: true
  subagent_type: "qa", prompt: "Review tests in web/", run_in_background: true
  subagent_type: "qa", prompt: "Review tests in workers/", run_in_background: true
```

### Path A: Named Team

User said `/team-creator review` or `/team-creator my-fullstack`:

1. Search `.claude/teams.json` for exact name match
2. If not found, search `references/team-catalog.md` for built-in match
3. If not found, treat as task description (Path B)
4. Display team composition to user, ask for confirmation

### Path B: Task-Based Composition

User described a task: `/team-creator implement OAuth with social login`:

1. Analyze the task — identify needed specializations:
   - What domains? (frontend, backend, security, infra...)
   - What depth? (architecture review, implementation, testing...)
   - Any specific tech? (React, Node, PostgreSQL...)

2. Match agents to specializations:
   ```
   For each needed specialization:
   ├── Custom agent with matching skills in frontmatter? → prefer custom
   └── No custom match → use default role agent
   ```

3. Determine flow:
   - Tasks with dependencies → sequential pipeline
   - Independent tasks → parallel (if setup allows)
   - Mixed → pipeline with parallel stages

4. Present proposed team to user:
   ```
   Proposed team for "implement OAuth":
   1. architect — design auth flow (sequential)
   2. backend + frontend — implement (parallel)
   3. security — review auth implementation (sequential)
   4. qa — write tests (sequential)

   Agents: architect, backend, frontend, security, qa
   Flow: pipeline (1 → 2∥ → 3 → 4)

   Confirm? Modify? Save for reuse?
   ```

5. If user confirms and wants to save → write to `.claude/teams.json`

### Path C: Ad-hoc Spawn

User wants custom parallel agents: "spawn 3 agents: one for X, one for Y, one for Z":

1. Parse individual agent assignments from user description
2. For each assignment:
   - Match to best available agent (custom or role)
   - Or use `general-purpose` if no specific agent needed
   - Capture the individual prompt/task
3. All agents run in parallel — no pipeline structure
4. Skip to Step 3 (Mode Select) with mode forced to "parallel"

### Path D: Explicit Agent List

User listed specific agents: "use architect, qa, and security":

1. Verify each agent exists in `agents/*.md`
2. Ask user for execution flow (sequential or parallel)
3. Proceed to Step 3

---

## Step 3: Select Execution Mode

### Pipeline Mode (default)

Use when:
- Tasks have dependencies (output of one feeds into next)
- Agent teams experimental flag is not available
- User prefers simplicity

Execution:
```
For each stage in pipeline:
  1. Build agent prompt:
     - Stage task description
     - Context from previous stages (compressed):
       "Previous findings: [3-5 bullet points + file paths]"
     - Target files/scope

  2. Spawn agent:
     - Sequential stage: Agent tool, wait for result
     - Parallel stage: Agent tool with run_in_background: true

  3. Capture output:
     - Extract key findings (decisions, issues, files changed)
     - Compress to 3-5 bullet points for next stage
     - Preserve file paths and line numbers

  4. If parallel stages: wait for all to complete, merge findings
```

### Builder-Validator Mode

Use when implementation quality is critical. Split agents by permission:

```
For each component/module:
  1. Builder agent (tools: Write, Edit, Bash) — implements the feature
  2. Validator agent (tools: Read, Grep, Glob ONLY) — reviews the code
     - Cannot edit — forced to surface issues as findings
     - Creates tasks back to builder if issues found
  3. Repeat until validator approves
```

Builder-Validator pairs can run in pipeline:
```
architect (plan) → builder-1 (implement) → validator-1 (review) → builder-1 (fix) → qa (test)
```

### Parallel Mode (Agent Teams + tmux)

Use when:
- Tasks are independent or loosely coupled
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set
- tmux is available
- User explicitly requests parallel execution

Prerequisite check:
```
Bash: scripts/check-env.sh
If any prerequisite missing → Read workflows/setup.md, guide user
```

Execution:
```
1. Determine tmux layout based on team size
   → Read references/tmux-layouts.md

2. For worktree-isolated parallel work:
   Each agent gets its own branch:
   claude --worktree agent-task-name --tmux

3. For Agent Teams mode:
   a. Compose task list with dependency DAG (tasks can block other tasks)
   b. Lead enters delegate mode (Shift+Tab) — coordination only, no code edits
   c. Teammates claim tasks, work independently, message each other
   d. Task list navigation: Ctrl+T
   e. Cycle between teammates: Shift+Down

4. Quality hooks (recommended):
   Configure in .claude/settings.json or settings.local.json:
   {
     "hooks": {
       "TeammateIdle": [{ "command": "./scripts/run-tests.sh" }],
       "TaskCompleted": [{ "command": "./scripts/validate-task.sh" }]
     }
   }
   - TeammateIdle: exit code 2 = send feedback, agent continues
   - TaskCompleted: exit code 2 = block completion, agent must fix

5. Shared task list across sessions:
   Set CLAUDE_CODE_TASK_LIST_ID for multiple sessions to share one task list
```

---

## Step 4: Execute

### Pipeline execution template

```
Stage 1: {agent-name} ({role})
  Prompt: "{task_description}. Target: {scope/files}"
  → Output: {compressed_findings}

Stage 2: {agent-name} ({role})
  Prompt: "{task_description}. Context from previous stage: {stage1_findings}"
  → Output: {compressed_findings}

[... continue for all stages ...]
```

### Parallel execution template

```
All agents start simultaneously:
  Agent 1: {name} — "{individual_prompt}"
  Agent 2: {name} — "{individual_prompt}"
  Agent 3: {name} — "{individual_prompt}"

Wait for all → aggregate results
```

---

## Step 5: Synthesize Results

After all agents complete:

1. Collect outputs from all stages/agents
2. Group findings by category (architecture, security, tests, implementation)
3. Present unified summary:
   ```
   ## Team Results: {team-name}

   ### Completed stages
   - [agent] — {what was done, key outcomes}

   ### Key findings
   - {finding 1 with file references}
   - {finding 2}

   ### Files modified/reviewed
   - {file list}

   ### Action items (if any)
   - {remaining work}
   ```

---

## Step 6: Persist (Optional)

If team was composed ad-hoc (Path B or C) and worked well:

1. Ask user: "Save this team composition for future use?"
2. If yes, ask for team name
3. Write to `.claude/teams.json`:

```json
{
  "teams": {
    "{team-name}": {
      "agents": ["{agent-1}", "{agent-2}", ...],
      "flow": "sequential|pipeline|parallel",
      "description": "{what this team does}",
      "stages": [
        { "agent": "{name}", "role": "{description}", "parallel": false },
        { "agent": "{name}", "role": "{description}", "parallel": true },
        ...
      ]
    }
  }
}
```

4. Confirm: "Team '{name}' saved. Use with `/team-creator {name}` next time."

---

## Context Compression Rules

When passing output between pipeline stages, compress to:

**Format:**
```
Previous stage ({agent-name}) findings:
- {finding 1} (see {file}:{line})
- {finding 2} (see {file}:{line})
- {finding 3}
Key decisions: {any architectural/design decisions made}
Files touched: {comma-separated list}
```

**Rules:**
- Maximum 5 bullet points per stage
- Always include file paths with line numbers
- Include decisions that constrain subsequent stages
- Omit implementation details unless next stage needs them
- Never pass raw code blocks between stages
