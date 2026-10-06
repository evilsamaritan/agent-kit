# The Five Advisors

Each advisor is a thinking *style*, not a job title or persona. The lineup is fixed because the five styles create deliberate tensions that surface different failure modes.

The sample outputs below all answer one decision: *"Should we split billing out of our monolith into its own service this quarter? Two teams change it, deploys are coupled, and an invoicing bug last month blocked an unrelated release."*

---

## 1. The Contrarian

Actively looks for what's wrong, what's missing, what will fail. Assumes the idea has a fatal flaw and tries to find it. If everything looks solid, digs deeper.

The Contrarian is not a pessimist — they're the friend who saves you from a bad deal by asking the questions you're avoiding. Their best output names a specific failure mode, not a vague "this might not work".

**Strong Contrarian output:** "Billing shares the customer and order tables inside one transaction today. A service split turns every invoice into a distributed write; you will need an outbox, reconciliation, and a migration of live payment state — in one quarter, while both teams keep shipping. The blocked release was a deploy-coupling problem, and a network boundary is the most expensive way to fix it."

**Weak Contrarian output:** "There are some risks to consider here."

---

## 2. The First Principles Thinker

Ignores the surface question and asks "what are we actually trying to solve?" Strips away assumptions. Rebuilds the problem from the ground up.

Sometimes the most valuable council output is the First Principles Thinker saying "you're asking the wrong question entirely." They reframe before answering.

**Strong First Principles output:** "What is the actual problem: independent deploys, team ownership, or billing correctness? Each has a different cheapest fix. Independent deploys need release decoupling, not a process boundary. Ownership needs one team owning billing's module and contract. Correctness needs tests at that contract. Only if all three point the same way is a service the answer."

**Weak First Principles output:** "Let's think about this carefully."

---

## 3. The Expansionist

Looks for upside everyone else is missing. What could be bigger? What adjacent opportunity is hiding? What's being undervalued?

The Expansionist doesn't care about risk — that's the Contrarian's job. They care about what happens if this works *better* than expected.

**Strong Expansionist output:** "A billing boundary with a clean contract is the foundation for usage-based pricing, a second payment provider, and partner invoicing — three items on next year's roadmap. Done well, the split also gives finance an auditable ledger they have asked for twice. The upside is bigger than faster deploys."

**Weak Expansionist output:** "There's a lot of potential here."

---

## 4. The Outsider

Has zero context about the user, the field, or the history. Responds purely to what's in front of them.

The Outsider is the most underrated advisor. Experts develop blind spots; the Outsider catches the curse of knowledge — things obvious to the user but confusing to everyone else.

**Strong Outsider output:** "I can't tell from this what a customer would notice. If the answer is 'nothing, unless it goes wrong', then the plan is all risk to customers and all benefit to the teams. Say what changes for the people who pay you — fewer billing errors, faster fixes — or the company will not understand why a quarter went into it."

**Weak Outsider output:** "Maybe make it clearer for outsiders."

---

## 5. The Executor

Only cares about one thing: can this actually be done, and what's the fastest path? Ignores theory, strategy, and big-picture thinking.

The Executor looks at every idea through "what do you do Monday morning?" If an idea sounds brilliant but has no clear first step, the Executor will say so.

**Strong Executor output:** "Monday: draw billing's current inbound calls and table access from the code. Week two: put every call behind one module contract inside the monolith and make billing's tables private to it. If that takes more than a month, the service split would have taken a year. If it goes smoothly, extraction becomes a deploy change."

**Weak Executor output:** "Just start small and iterate."

---

## Why these five

The lineup creates three natural tensions that surface different failure modes:

| Tension | Catches |
|---------|---------|
| Contrarian vs Expansionist | Asymmetric risk/reward — is the downside larger than the upside? |
| First Principles vs Executor | Wrong-problem framing — are we solving the right thing, or just doing something? |
| Outsider vs everyone else | Curse of knowledge — would someone outside the team understand why this matters? |

If a council session always produces a unanimous verdict, the tensions aren't working — the framed question is probably too narrow or the advisors aren't leaning fully into their angles. Re-frame and re-run rather than trusting easy consensus.

---

## Not changing the lineup

The five-advisor lineup is fixed by design. Don't:

- Swap in domain experts ("the security advisor", "the finance advisor") — that defeats the cross-lens stress test; give domain facts to every advisor through the framed question instead
- Add a sixth advisor — five is enough for tensions, more is noise
- Skip an advisor that "doesn't seem relevant" — the Outsider is *especially* valuable when you think they're not relevant; that's exactly when curse of knowledge bites
