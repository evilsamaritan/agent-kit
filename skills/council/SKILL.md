---
name: council
description: "Analyze a consequential decision through five independent advisor lenses, anonymized peer review, and a chair's verdict with one next step. Use when asked to council a decision, convene the council, or get a council verdict, or for созови совет, on a choice with real trade-offs. Do NOT use for ordinary advice, factual questions, or reviewing code and diffs (agent-orchestrator, development)."
allowed-tools: Read, Glob
user-invocable: true
argument-hint: "[question or decision]"
metadata:
  source: https://github.com/tenfoldmarc/llm-council-skill
---

# Council

Pressure-test one decision: five advisors with deliberately clashing thinking styles answer independently, five reviewers judge the anonymized answers, and a chair delivers a verdict and exactly one next step — not "it depends".

## Critical rules

1. **Only for decisions with real stakes and real trade-offs.** One right answer, a creation task, or a summary: answer directly. A council costs eleven delegated runs.
2. **Independence first.** Advisors run in parallel through the host's native delegation and never see each other's answers. Mechanics per host: `agent-orchestrator` [runtime-adapters.md](../agent-orchestrator/references/runtime-adapters.md). Without delegation, run each lens as a separate pass and say in the report that independence was reduced.
3. **Anonymize before peer review** with a fresh random mapping to letters A–E; reviewers judge arguments, not lenses. The chair sees names.
4. **No hedging in advisors, no smoothing in synthesis.** Balance comes from the set of lenses; clashes are reported as information. The chair may side with a minority and says so.
5. **One clarifying question at most**, only when the decision itself is unclear; then proceed with stated assumptions.
6. **Both artifacts every time:** an HTML report built from the fixed template, never hand-authored, and a Markdown transcript.
7. **Do not steer.** The framed question carries context, stakes, and constraints, not your opinion.

## Flow selection

| Situation | Route |
|---|---|
| A decision worth a council | [run.md](workflows/run.md) — frame, convene, review, synthesize, write artifacts |
| Trivial, factual, or creation request | answer directly; say why no council is needed |
| Several reviewers over a diff or code | `agent-orchestrator` (independent reviews) or `development` (critique) |
| The decision is structural | run the council, and give advisors the facts from `architecture` analysis in the framed question |

Good council questions: "Buy a hosted search service or build on our database's full-text search?", "Split billing out of the monolith this quarter or harden the module boundary first?", "Adopt a new frontend framework for the rewrite or migrate incrementally?", "Launch the paid tier now or after the reliability work?", "Move the on-call rotation to the product teams?"

## Quick reference

```text
1. Frame      scan context, write a neutral framed question
2. Convene    5 advisors in parallel, one lens each, 150-300 words
3. Review     anonymize A-E, 5 reviewers in parallel, under 200 words
4. Synthesize one chair: agrees, clashes, blind spots, recommendation, first step
5. Write      council-report-<timestamp>.html + council-transcript-<timestamp>.md
```

Lenses and their tensions: Contrarian vs Expansionist (downside vs upside), First Principles vs Executor (rethink vs ship), Outsider against everyone (curse of knowledge). The lineup is fixed: [advisors.md](references/advisors.md).

## Validation

- Five advisor answers, five reviews, one chair verdict with the five fixed headers and a single first step.
- The HTML report has no `{{` placeholder left and all model output escaped; the transcript reveals the A–E mapping.
- Report both file paths; do not open them automatically.

## References

- [run.md](workflows/run.md) — the procedure, step by step
- [advisors.md](references/advisors.md) — the five lenses, sample outputs, why the lineup is fixed
- [prompts.md](references/prompts.md) — advisor, reviewer, and chair prompt templates
- [report.md](references/report.md) — placeholder table, escaping, transcript format
- [assets/report-template.html](assets/report-template.html) — the fixed report template

Source note: adapted from the LLM Council method (several models answer, review each other anonymously, a chair synthesizes) and the community skill in `metadata.source`; here the models are replaced by lenses.
