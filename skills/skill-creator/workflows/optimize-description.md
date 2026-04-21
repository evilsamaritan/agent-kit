# Workflow: Optimize Skill Description

Description is the **sole** trigger that determines whether a skill loads when relevant — or stays silent when not. A weak description makes a great skill invisible; an over-broad description steals triggers from siblings.

This workflow runs static trigger-fraction tests on a skill's description: a list of synthetic queries that *should* trigger the skill, and a list that *should not*. Confirms description quality before committing.

This is a static, deterministic check — no LLM grader. The richer LLM-judge / A-B / Eval modes from Anthropic skill-creator v2 are out of scope for this workflow (planned for a future iteration).

---

## Step 1: Identify the target

User says "improve the description for X" or this workflow is chained from `improve.md`. Either way, read the current description from frontmatter:

```bash
head -10 skills/<bucket>/<name>/SKILL.md | sed -n '/^description:/p'
```

---

## Step 2: Build a trigger fixture

Compose two lists of natural-language queries (8–12 each):

**Should trigger:** real-world phrases a user would say when they want this skill. Mix:
- Direct topic mentions ("how do I configure CORS?")
- Implicit task descriptions ("my fetch is being blocked by the browser")
- Tool/file mentions ("editing nginx.conf")
- Domain jargon

**Should NOT trigger:** look-alike queries that match adjacent skills:
- Same general area but different sub-skill ("write a vue component" should hit vue, not frontend)
- Overlapping keywords with different intent ("rate limit" → backend not security, depends on context)
- Generic phrases ("performance issue" alone — too vague)

Save the fixture as `skills/<bucket>/<name>/.trigger-fixture.json`:

```json
{
  "should_trigger": [
    "set up CORS for my SPA",
    "service worker not registering",
    "fetch failing with mode no-cors",
    "..."
  ],
  "should_not_trigger": [
    "write a React component",
    "design a database schema",
    "..."
  ]
}
```

---

## Step 3: Manual classification pass

For each query, predict whether the *current* description would trigger the skill. This is what the LLM-judge would do — but here we do it ourselves with the description fresh in mind.

For each query, mark:
- ✓ TP (true positive) — should trigger AND description matches
- ✗ FN (false negative) — should trigger BUT description doesn't surface relevant terms
- ✓ TN (true negative) — should not trigger AND description correctly doesn't match
- ✗ FP (false positive) — should not trigger BUT description matches (steals from sibling)

Tally:
- Recall = TP / (TP + FN) — how many real triggers we catch
- Specificity = TN / (TN + FP) — how many false triggers we reject

Goal: **>80% recall AND >80% specificity**. If either is below, iterate on description.

---

## Step 4: Iterate description

If recall is low (FNs):
- Add concrete trigger phrases the user actually says ("Use when …")
- Include tool/file/jargon mentions ("Triggers on cargo, tokio, …")
- Surface synonyms (e.g., add "QA" alongside "testing" — but only if NO test in fixture should silently fall to a sibling)

If specificity is low (FPs):
- Add **negative triggers** explicitly: "Do NOT use for X (use Y skill)"
- Narrow the scope description ("for X, but not Y or Z")
- Remove generic verbs that match too widely

Rerun Step 3 after each edit. Stop when both ≥80%.

---

## Step 5: Commit and document

After acceptance:
1. Update the description in `SKILL.md`
2. Keep the fixture file at `.trigger-fixture.json` for future regression checks
3. Note in commit message: "improve <name> description: recall +X%, specificity +Y%"

---

## When to skip this workflow

- Brand-new skill with no users yet — defer optimization until real triggering data accumulates
- Skill has very narrow domain (only 1–2 trigger phrases possible) — manual review is sufficient
- Skill is being deprecated — don't waste effort

---

## What this workflow does NOT do

This is a **static** check based on your judgment. It does not:
- Run an LLM-judge (Anthropic v2 Grader)
- A/B test two description versions (Anthropic v2 Comparator)
- Measure real triggering against past conversations (would require trace data)

Those remain on the roadmap. For now: deterministic, manual, repeatable — captured fixtures provide regression coverage.
