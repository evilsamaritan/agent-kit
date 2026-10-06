---
name: grill-me
description: "Interview the user about a plan, design, or idea until every decision is settled and nothing is silently assumed. Use for grill me, stress-test my plan, poke holes in this, interview me about this feature, or before building something new."
argument-hint: "[plan, idea, or decision]"
metadata:
  inspired-by: "grill-me by Matt Pocock (github.com/mattpocock/skills, MIT)"
---

# Grill Me

Turn a loose idea into decisions the user owns. The session asks, the user decides, and nothing is built until the user confirms the result. The output is shared understanding, not a document.

## Core concepts

- **Decision tree** — every decision opens the decisions that depend on it. "Who pays" comes before "which payment provider".
- **Frontier** — the questions whose prerequisites are already settled: everything that can be asked now without guessing an answer not yet given.
- **Round** — the whole frontier asked at once, numbered, each question with a recommended answer. Then wait.
- **Facts and decisions** — facts come from the repository, documentation, or a measurement, and finding them is the agent's job. Decisions belong to the user.

## Running a session

1. Restate the idea in one paragraph and say what the session should settle.
2. Build the first frontier. It usually covers goal and non-goals, who uses the result, how success is checked, and hard constraints.
3. Ask the round in this form:

   ```text
   Q1 — <title>: <question, with options when there are clear ones>
   → Recommended: <answer> — <one-line reason>

   Q2 — ...
   ```

4. After the answers, update the tree and recompute the frontier. A question whose premise is still open in this round waits for the next one.
5. When a question needs a fact, look it up — read the code, check the docs, or hand a read-only search to a subagent where the host supports it — and keep asking the rest of the frontier meanwhile. Only the questions downstream of that fact wait.
6. When a question cannot be settled by talking (it needs a prototype, a measurement, or someone else's input), stop that branch, propose the smallest experiment, and record it as open.
7. When the frontier is empty, summarize the decisions, the open items, and the assumptions that remain, and ask the user to confirm before anything is built.

## Decision points

For software work, these branches most often stay implicit:

- scope, non-goals, and the first slice worth building;
- who uses it and how success is checked;
- what will change later: which families of variants will grow and which are fixed — the change axes that `architecture` and `development` build on;
- who owns each piece of data and state, and how long it lives;
- behavior on failure, retry, and partial completion;
- compatibility with what exists, and the migration path;
- what must be decided now versus what can be reversed cheaply later.

## Hard rules

- One round is the whole frontier; never ask a question whose premise is still open.
- Every question carries a recommended answer and its reason.
- Never ask the user for a fact that can be looked up.
- The user decides. Do not answer for them, and do not treat silence as agreement.
- Change no files during the session unless the user asks.
- Do not start implementing until the user confirms the shared understanding.

## Anti-Patterns

- **Interrogation without recommendations** — the user does all the thinking; the session is slower than writing the plan alone.
- **One question at a time** when ten are independent, or **dependent questions in one round**, which forces guesses.
- **Passive agreement** — the user accepts every recommendation and leaves with the agent's plan. Name it, and ask for the user's own call on the two or three most consequential decisions.
- **Fact questions** — "which framework do you use?" when the manifest answers it.
- **No ending** — the session drifts into implementation without a summary and a confirmation.

## Related Knowledge

- `architecture` — design workflow, change axes, decision records once the decisions are made
- `development` — open versus closed families and the other choices implementers need settled
- `council` — independent advisors weighing one decision once the options are clear
- `agent-orchestrator` — delegating read-only fact-finding while the interview continues
