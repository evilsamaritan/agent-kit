# Workflow: Optimize Skill Description

Description is the **portable** trigger that determines whether a skill loads when relevant — or stays silent when not. Claude Code can add `when_to_use` and `paths`, but the base description must route correctly in Codex and other Agent Skills runtimes.

This workflow runs static trigger-fraction tests on a skill's description: a list of synthetic queries that *should* trigger the skill, and a list that *should not*. Confirms description quality before committing.

The fixture is the deterministic regression baseline. When the target runtimes and models are available, supplement it with an A/B evaluation using the same queries; do not replace the stable fixture with ad-hoc impressions.

---

## Step 1: Identify the target

User says "improve the description for X" or this workflow is chained from `improve.md`. Either way, read the current description from frontmatter:

```bash
head -10 skills/<name>/SKILL.md | sed -n '/^description:/p'
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

Save the fixture as `skills/<name>/references/trigger-fixture.json` and link it from SKILL.md:

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

## Step 3: Classification pass

For each query, classify whether the current portable description should route to the skill. Record the rationale so another reviewer can reproduce borderline decisions.

For each query, mark:
- ✓ TP (true positive) — should trigger AND description matches
- ✗ FN (false negative) — should trigger BUT description doesn't surface relevant terms
- ✓ TN (true negative) — should not trigger AND description correctly doesn't match
- ✗ FP (false positive) — should not trigger BUT description matches (steals from sibling)

Tally:
- Recall = TP / (TP + FN) — how many real triggers we catch
- Specificity = TN / (TN + FP) — how many false triggers we reject

Baseline goal: **≥80% recall AND ≥80% specificity**, with no high-cost false positive that steals a clearly owned sibling task. Tighten thresholds when the skill has enough real examples.

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

## Step 5: Verify and document

After acceptance:
1. Update the description in `SKILL.md`
2. Keep the fixture at `references/trigger-fixture.json` for future regression checks
3. If target runtimes are available, run the same fixture against the before/after descriptions and record model/runtime, recall, specificity, and any task-level regressions
4. Summarize the measured change in the final report or commit message

---

## When to skip this workflow

- Brand-new skill with no users yet — defer optimization until real triggering data accumulates
- Skill has very narrow domain (only 1–2 trigger phrases possible) — manual review is sufficient
- Skill is being deprecated — don't waste effort

---

## What this workflow does NOT do

The fixture does not by itself prove live runtime selection or task quality. It complements, rather than replaces, model/runtime A/B tests and real trace analysis when those are available.
