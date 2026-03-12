# Flow 3: Improve Agent

## Step 1: Identify Target Agent

Determine which agent to improve:

- **User specified a name** → use it
- **Ambiguous** → List available agents, use `AskUserQuestion`:
  ```bash
  ls agents/
  ```

## Step 2: Gather Feedback

Ask the user (or extract from context):

- **What's wrong?** — specific issues, complaints, or desired improvements
- **What should change?** — behavior, description, configuration

If the user gave clear feedback, skip asking and proceed.

## Step 3: Analyze Agent

Read the agent file and analyze against:

1. **Verification checklist** — read `references/verification-checklist.md` and run checks
2. **User feedback** — map complaints to specific sections
3. **Best practices** — compare against template patterns

Common improvement areas:
- **Description too vague** → Claude doesn't delegate correctly
- **System prompt too broad** → agent doesn't focus
- **Missing done criteria** → agent doesn't know when to stop
- **Wrong model** → too slow (opus) or not capable enough (haiku)
- **Missing skills** → could leverage existing skill instead of inline instructions

## Step 4: Propose Changes

Present proposed changes to user via `AskUserQuestion`:

For each change:
- What: the specific modification
- Why: how it improves the agent
- Before/After: show the diff

## Step 5: Apply Changes

Apply approved changes using `Edit` tool.

For significant rewrites, show the full new file for approval before writing.

## Step 6: Verify

After applying changes:
1. Run verification (chain to Flow 2)
2. If all CRITICAL pass: "Agent improved successfully."
3. If issues remain: list them for manual resolution
