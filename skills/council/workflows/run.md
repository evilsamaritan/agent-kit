# Run a Council

Five steps; none is optional. Skipping peer review reduces the council to asking five times.

## Contents

- [1. Frame the question](#1-frame-the-question)
- [2. Convene the advisors](#2-convene-the-advisors)
- [3. Peer review](#3-peer-review)
- [4. Chair synthesis](#4-chair-synthesis)
- [5. Write the artifacts](#5-write-the-artifacts)

## 1. Frame the question

1. Scan briefly for context that changes the advice; read the two or three files that matter, not everything:
   - the project's instruction files (`AGENTS.md`, `CLAUDE.md`, or the host's equivalent) and its README or design docs;
   - files the user referenced or attached;
   - data the question depends on (metrics, costs, incident history, prior decisions or ADRs);
   - earlier `council-transcript-*.md` files in the working directory, to avoid re-counciling settled ground.
2. If the decision itself is unclear, ask the user one clarifying question with the host's question mechanism, or in plain text. Then proceed with stated assumptions.
3. Write the framed question that every advisor receives verbatim:
   - the decision and the options on the table;
   - context from the user and from the files read;
   - constraints and relevant numbers;
   - what is at stake if the decision is wrong.
4. Keep it neutral: no recommendation, no leading wording. Record the files read for the transcript.

## 2. Convene the advisors

1. Fill the [advisor prompt](../references/prompts.md#advisor-prompt) once per lens from [advisors.md](../references/advisors.md).
2. Start all five in parallel through the host's native delegation ([runtime-adapters.md](../../agent-orchestrator/references/runtime-adapters.md)); a generic subagent is enough. Sequential runs let later advisors anchor on earlier ones.
3. Without delegation, run each lens as a separate pass in the main session, writing each answer before starting the next lens, and note the reduced independence in the transcript.
4. Collect all five answers before step 3.

## 3. Peer review

1. Shuffle the five answers into letters A–E with a fresh random mapping; never keep advisor order.
2. Fill the [reviewer prompt](../references/prompts.md#reviewer-prompt) with the anonymized answers.
3. Start five reviewers in parallel, the same way as step 2. Each names the strongest answer, the biggest blind spot, and what all five missed.
4. Keep the mapping for the transcript.

## 4. Chair synthesis

1. Fill the [chair prompt](../references/prompts.md#chair-prompt) with the framed question, the five answers labeled by lens, and the five reviews.
2. Run one delegated chair (or a fresh pass in the main session).
3. Check the output: the five fixed headers in order, a single item under "The One Thing to Do First", no advisor that does not exist. Re-prompt once if a check fails.

## 5. Write the artifacts

1. Take one timestamp (`YYYYMMDD-HHMMSS`) for both files; write them to the working directory unless the user named another place.
2. Read [report-template.html](../assets/report-template.html), replace every placeholder per the [substitution table](../references/report.md#substitution-table), HTML-escaping all model and user text first. Write `council-report-<timestamp>.html`.
3. Write `council-transcript-<timestamp>.md` in the [transcript format](../references/report.md#markdown-transcript).
4. Report both paths and the chair's recommendation and first step in chat. Do not open the files automatically.
