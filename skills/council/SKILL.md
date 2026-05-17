---
name: council
description: "Run a question, idea, or decision through a council of 5 AI advisors who independently analyze it, peer-review each other anonymously, and synthesize a final verdict. Adapted from Karpathy's LLM Council methodology. MANDATORY TRIGGERS: 'council this', 'run the council', 'war room this', 'pressure-test this', 'stress-test this', 'debate this'. STRONG TRIGGERS (when paired with a real tradeoff): 'should I X or Y', 'which option', 'what would you do', 'is this the right move', 'validate this', 'get multiple perspectives', 'I can't decide', 'I'm torn between'. Do NOT trigger on simple yes/no questions, factual lookups, creation tasks ('write me a tweet'), or casual 'should I' without stakes. DO trigger when the user presents a genuine decision with stakes, multiple options, and context that suggests they want it pressure-tested from multiple angles."
allowed-tools: Read, Write, Glob, Bash, Agent, AskUserQuestion
user-invocable: true
argument-hint: "<question or decision>"
metadata:
  author: tenfoldmarc
  source: https://github.com/tenfoldmarc/llm-council-skill
  methodology: Andrej Karpathy — LLM Council
---

# LLM Council

Pressure-test a decision by running it through 5 independent advisors with deliberately clashing thinking styles, then a peer-review round, then a chairman synthesis. The output is a clear verdict plus a single concrete next step — not "it depends".

Adapted from Andrej Karpathy's LLM Council. Karpathy dispatches one query to multiple models and has them peer-review each other; we do the same inside Claude Code with sub-agents that wear different thinking lenses instead of using different model providers.

---

## Mental model

One advisor is one perspective. Five advisors with deliberate tensions are a stress test. Peer review then surfaces the blind spots no single advisor caught. The chairman doesn't average — they pick the argument that survives scrutiny, even if it's the minority view.

**Three natural tensions:**

- Contrarian vs Expansionist — downside vs upside
- First Principles vs Executor — rethink everything vs ship Monday morning
- Outsider sits in the middle, catching the curse of knowledge everyone else has

→ Advisor identities, thinking styles, why these five: [references/advisors.md](references/advisors.md)

---

## When to run the council

The council is for decisions where being wrong is expensive and where multiple framings genuinely add value.

**Good council questions:**
- "Should I launch a $97 workshop or a $497 course?"
- "Which of these 3 positioning angles is strongest?"
- "I'm thinking of pivoting from X to Y. Am I crazy?"
- "Here's my landing page copy. What's weak?"
- "Should I hire a VA or build an automation first?"

**Bad council questions** (refuse or just answer directly):
- Factual lookups with one right answer
- Creation tasks ("write me a tweet")
- Processing tasks ("summarize this article")
- Trivial yes/no with no real tradeoff

If the user already knows the answer and wants validation, the council will likely tell them things they don't want to hear. That's the point — don't soften it.

---

## Flow

```
1. Frame the question  →  scan workspace context + reframe neutrally
2. Convene the council →  spawn 5 advisors in parallel (single message)
3. Peer review         →  anonymize A-E, spawn 5 reviewers in parallel
4. Chairman synthesis  →  one agent gets everything, produces verdict
5. Generate artifacts  →  HTML report + Markdown transcript
```

Each step is mandatory. Skipping peer review reduces the council to "ask 5 times" — the whole point is the second round catching what individual advisors missed.

---

## Step 1: Frame the question

Before framing, do a quick context scan (max ~30 seconds) so advisors have grounded context instead of generic takes.

**Scan for:**
- `CLAUDE.md` / `claude.md` in cwd or workspace root (business context, constraints, voice)
- Any `memory/` folder (audience profiles, past decisions, business details)
- Files the user explicitly referenced or attached
- Past `council-transcript-*.md` in the same folder (avoid re-counciling identical ground)
- Topic-specific files (pricing question → revenue data; copy question → past launches; etc.)

Use `Glob` + targeted `Read`. Don't load everything — pick the 2-3 files that materially change the advice.

**Then reframe the question.** The framed question is what all five advisors receive verbatim. It must include:

1. The core decision or question
2. Key context from the user's message
3. Key context from workspace files (business stage, audience, constraints, past results, relevant numbers)
4. What's at stake — why this decision matters

Don't add your own opinion. Don't steer it. But do make sure every advisor has enough to give a *specific* answer rather than generic strategy talk.

If the question is too vague ("council this: my business"), ask exactly **one** clarifying question via `AskUserQuestion`, then proceed. Don't interrogate.

Save the framed question — it goes into the transcript and every sub-agent prompt.

---

## Step 2: Convene the council (parallel spawn)

Spawn all 5 advisors in a **single message** with 5 `Agent` tool calls. Sequential spawning wastes time and lets later advisors implicitly anchor on earlier ones.

For each advisor use:
- `subagent_type: general-purpose`
- A focused prompt with their identity + thinking style + the framed question + instruction to lean fully into their angle (no hedging, no balance — that's the chairman's job)
- Target output: 150-300 words per advisor

→ Full prompt template + advisor-specific instructions: [references/prompts.md](references/prompts.md#advisor-prompt)

Collect all 5 responses before moving to step 3.

---

## Step 3: Peer review (anonymized, parallel)

This is the step that separates the council from "ask 5 times". It's the core of Karpathy's insight.

1. Randomize a mapping `{A, B, C, D, E} → {advisors}`. Don't preserve advisor order — that creates positional bias.
2. Spawn 5 reviewer sub-agents in parallel (one message, 5 `Agent` calls).
3. Each reviewer sees all 5 anonymized responses and answers three questions:
   - Which response is strongest, and why?
   - Which response has the biggest blind spot, and what is it?
   - What did ALL five responses miss?

→ Full reviewer prompt template: [references/prompts.md](references/prompts.md#reviewer-prompt)

Keep the anonymization mapping — the transcript reveals it at the end so the user can trace which advisor said what.

---

## Step 4: Chairman synthesis

One sub-agent. It receives:

- The framed question
- All 5 advisor responses (de-anonymized — labeled by advisor name)
- All 5 peer reviews

The chairman produces the final verdict using this fixed structure:

1. **Where the council agrees** — convergence across independent advisors = high-confidence signals
2. **Where the council clashes** — genuine disagreements presented honestly, not smoothed over
3. **Blind spots the council caught** — things only the peer-review round surfaced
4. **The recommendation** — a clear, direct call. Not "it depends". The chairman *can* side with a minority advisor if the reasoning is strongest.
5. **The one thing to do first** — exactly one concrete next step. Not a list.

→ Full chairman prompt template + output schema: [references/prompts.md](references/prompts.md#chairman-prompt)

---

## Step 5: Generate artifacts

Every session produces two files in the current working directory:

```
council-report-<timestamp>.html       # visual briefing, what the user reads
council-transcript-<timestamp>.md     # full transcript, audit trail
```

Use ISO-style timestamps (`YYYYMMDD-HHMMSS`) so files sort chronologically.

**For the HTML report: do not hand-author.** Read `assets/report-template.html`, substitute the placeholders, write the result. The template is fixed by design — same look every session, no per-run redesign. HTML-escape all sub-agent output before substitution.

The transcript is plain Markdown — original question, framed question, all responses, all reviews with anonymization mapping revealed, full chairman synthesis verbatim.

→ Placeholder substitution table + escaping rules + transcript format: [references/report.md](references/report.md)

---

## Hard rules

- **Spawn advisors in parallel** — single message, 5 `Agent` tool calls. Same for the peer review round.
- **Anonymize before peer review** — randomize the mapping. If reviewers know which advisor said what, they'll defer to thinking styles instead of evaluating arguments on merit.
- **Chairman sees de-anonymized responses** — synthesis benefits from knowing which lens produced which argument.
- **The chairman can disagree with the majority.** 4-vs-1 doesn't decide it — argument strength does. Say so explicitly when overriding the majority.
- **Don't council trivial questions.** If there's one right answer, just answer it. The council burns 11 sub-agents — reserve it for decisions with real stakes.
- **No hedging in advisor responses.** Each advisor leans fully into their angle. Balance comes from the *set* of advisors, not from any individual.
- **Don't smooth over clashes in synthesis.** Present both sides and explain *why* reasonable advisors disagree. The clash is information.
- **Save both artifacts every time.** Transcript-only or HTML-only loses information the user may need later.
- **One clarifying question max.** If the framed question still isn't specific enough after one question, proceed with what you have.
- **Use the report template — don't hand-author HTML.** The HTML report is generated by reading `assets/report-template.html` and substituting placeholders. Do not write new CSS. Do not add dark mode, gradients, neon accents, emoji, JS, or external assets. If you find yourself drafting `<style>` blocks, you're off-pattern — read the template and substitute.

---

## Anti-patterns

| Don't | Why | Instead |
|-------|-----|---------|
| Spawn advisors sequentially | Wastes time; later advisors anchor on earlier ones | Single message, 5 parallel `Agent` calls |
| Skip the context scan | Advisors give generic strategy takes | 30s `Glob` + `Read` for `CLAUDE.md`, `memory/`, referenced files |
| Reveal advisor identity in peer review | Reviewers defer to lenses they trust | Anonymize as Response A-E with randomized mapping |
| Average the advisors in synthesis | Loses the signal of which argument actually wins | Chairman picks the strongest argument, names the dissent |
| Recommend a list of 10 next steps | User can't act on 10 things Monday morning | Exactly one "do this first" item |
| Council a factual question | Wastes 11 agent spawns on a one-shot answer | Just answer the question directly |
| Hedge advisor responses ("on the other hand…") | The whole point is the clash | Instruct each advisor to lean fully into their angle |
| Omit the HTML report | Most users scan, don't read transcripts | Always produce both artifacts |
| Dark theme / neon accents / gradients in the report | The artifact is a briefing memo; dark + flashy reads as a marketing page | Read `assets/report-template.html` and substitute placeholders — don't hand-author HTML |
| Hand-authoring HTML instead of using the template | Every session ends up with a different layout; user can't scan a series | Always read `assets/report-template.html` first; substitute, don't redesign |

---

## Related knowledge

- `team-orchestrator` — runs saved agent teams from `team.json`. Use it when you have a defined multi-agent workflow. Use *this* skill for ad-hoc decision pressure-testing where the advisor lineup is fixed (the five thinking lenses).
- `team-creator` — creates teams of named agents. The council does **not** create or persist any agent — it spawns ephemeral sub-agents with inline personas.
- `architecture` skill — when the decision is structural (DDD vs hexagonal, monolith vs microservices), pair the council with the architecture skill so the Executor and First Principles advisors have real patterns to anchor on.

---

## References

- [advisors.md](references/advisors.md) — The 5 advisor identities, thinking styles, and why these five
- [prompts.md](references/prompts.md) — Full prompt templates for advisor, reviewer, and chairman sub-agents
- [report.md](references/report.md) — Placeholder substitution table, HTML-escaping rules, transcript format
- [assets/report-template.html](assets/report-template.html) — The fixed HTML report template (read + substitute, do not hand-author)

Methodology by [Andrej Karpathy](https://x.com/karpathy). Original Claude Code skill by [@tenfoldmarc](https://github.com/tenfoldmarc/llm-council-skill).
