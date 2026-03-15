# Workflow: Architecture Review

**Goal:** Produce a structured assessment of an existing architecture — identifying risks, tech debt, violated principles, and concrete improvement recommendations with priority.

**Output:** Findings report with severity levels, risk register, tech debt inventory, and a prioritized action list.

---

## Review Philosophy

- **Understand before judging.** Every design decision had a reason. Find it.
- **Distinguish debt from damage.** Debt is a known shortcut. Damage is a mistake. They require different responses.
- **Prioritize by risk, not by aesthetics.** A "messy" module with no users is lower priority than a clean module with a subtle race condition.
- **Give findings, not prescriptions.** Show what's wrong and why it's a problem; give options for fixing it, not just one way.
- **Separate what from should.** "This module has 12 outgoing dependencies" is a fact. "This is bad" requires a reason.

---

## Phase 1 — Gather Context

Before reviewing any code or diagrams, understand the system's environment:

**Questions to answer:**
1. What problem does this system solve? For whom?
2. What are the production metrics? (traffic, latency, error rate, uptime)
3. What are the active pain points? (what do engineers complain about? what slows deployments?)
4. What are the upcoming changes? (planned features, migrations, scale changes)
5. What was the original design intent? (find any architecture docs, ADRs, or original authors)
6. What does the team already know is wrong?

**Why this matters:** Reviewing architecture without knowing the system's history leads to findings the team already knows about, missing the real unknown risks, and recommending solutions that don't fit the team's constraints.

---

## Phase 2 — Assess Structural Health

Build or request a dependency map. If one doesn't exist, construct it from the codebase.

### Module / service dependency analysis

For each module or service, identify:
- Afferent coupling (Ca): how many other things depend on it?
- Efferent coupling (Ce): how many things does it depend on?
- Instability: Ce / (Ca + Ce) — 0 = stable, 1 = unstable

**Patterns that flag risk:**

| Pattern | Signal | Severity |
|---------|--------|----------|
| Circular dependencies | A → B → C → A | High |
| God module | Ca very high, Ce very high | High |
| Fragile module | Ce high, Ca low, unstable | Medium |
| Isolated module | Ca = 0, Ce = 0 | Low (potentially dead code) |
| Missing abstraction | Multiple modules duplicate logic | Medium |

### Layer violations
- Does presentation layer call data layer directly?
- Does domain logic depend on infrastructure (HTTP clients, DB drivers)?
- Does any module bypass the defined interface of another?

Layer violations are often the root cause of change-resistance in codebases.

### Data ownership
For each data entity, ask: who owns this?
- Multiple modules writing to the same table → ownership conflict → a change breaking multiple modules is likely
- No clear owner → data integrity is managed by convention, not structure → eventual inconsistency

---

## Phase 3 — Design Principles Audit

For each finding, cite the principle being violated and show a concrete example.  
Load `references/design-principles.md` for principle definitions.

### SOLID violations to look for:

**SRP violations (most common):**
- Class/module name contains "And" (e.g., `UserAuthAndNotification`)
- Module has 3+ reasons to change (test: "if X changes, does this module need to change?")
- God classes / god services with hundreds of methods

**OCP violations:**
- Adding a new variant requires modifying existing code (switch/if-else chains on type)
- New business rules require surgery in multiple places

**DIP violations:**
- High-level business logic directly instantiates low-level infrastructure (`new MySQLRepository()` inside a service)
- Business logic imports from infrastructure packages

**LSP violations:**
- Subclass throws exceptions the base doesn't declare
- Subclass has methods that do nothing or assert preconditions that narrow the base contract

**ISP violations:**
- Implementations of an interface leave many methods empty or throwing
- Callers use only 1–2 methods of a large interface they depend on

### Other principle violations:

**High coupling:**
- Changing module A requires changes in B, C, D → coupling is too high
- Integration tests failing from domain logic changes → coupling to infrastructure

**Low cohesion:**
- A module's methods share nothing except being in the same file
- Difficult to name the module with a single noun

---

## Phase 4 — Quality Attribute Assessment

Test the architecture against each NFR. If NFRs don't exist, that is itself a finding.

### Performance
- Is there caching for expensive repeated reads? Where?
- Are there N+1 query patterns (DB queries inside loops)?
- Are there unbounded queries that could fetch millions of rows?
- Is heavy work happening synchronously on the request path?

### Scalability
- What is the bottleneck at 10x current load?
- Are any components stateful in a way that prevents horizontal scaling?
- Is the database the scaling bottleneck? (usually yes — what is the mitigation plan?)

### Availability
- What is the SPOF (single point of failure)?
- Does the system degrade gracefully when a dependency is unavailable?
- Are there timeouts on all external calls?
- Are circuit breakers present for critical dependencies?

### Security
- Is input validated at system boundaries?
- Is principle of least privilege applied to service accounts and API tokens?
- Are secrets stored in code, config files, or environment variables? (all wrong)
- Is sensitive data encrypted at rest and in transit?

### Observability
- Can you tell from dashboards whether the system is healthy right now?
- Can you trace a failing request end-to-end?
- Are errors logged with enough context to diagnose without reproduction?

### Maintainability
- DORA metrics: how long does a deployment take? How often do deployments cause incidents?
- How long does it take an engineer unfamiliar with the system to make a change?
- Is there CI/CD? Are there automated tests?

Load `references/system-design.md` → resilience patterns section for reference.

---

## Phase 5 — Anti-Pattern Detection

Load `references/design-patterns.md` → anti-patterns section.

Check specifically for:

| Anti-pattern | How to spot it |
|-------------|----------------|
| God Object | One class with 1000+ lines, dozens of methods doing unrelated things |
| Anemic Domain Model | Domain objects are pure data bags; all logic is in service classes |
| Distributed Monolith | "Microservices" that deploy together and share a database |
| Big Ball of Mud | No visible module structure; circular dependencies everywhere |
| Spaghetti Code | Deep nesting, long methods, no obvious abstraction |
| Golden Hammer | Same technology applied to every problem regardless of fit |
| Premature Optimization | Complex caching/sharding with no measured bottleneck |
| Resume-Driven Architecture | Technology chosen for novelty rather than fit |

**Distributed Monolith** deserves special attention — it is the worst of both worlds:
- All the operational complexity of microservices
- None of the independent deployability benefits
- Signals: services that always deploy together, cross-service database joins, synchronous call chains through 5+ services

---

## Phase 6 — Tech Debt Classification

Classify each finding using this taxonomy:

**Architecture debt** (structural flaws that permeate the system):
- Wrong architecture style for the problem
- Persistent coupling violations
- Missing abstraction layers
- Ownership conflicts in data

**Design debt** (module/component level design issues):
- God classes
- Missing interfaces / hardcoded dependencies
- SOLID violations

**Code debt** (implementation level — lower priority in architecture review):
- Duplicated logic without shared abstraction
- Complex methods that should be split

**Operational debt** (infrastructure and process):
- Missing observability
- No automated testing
- Manual deployment steps

**Architecture debt is the highest priority** — it cannot be paid down incrementally without structural refactoring.

---

## Phase 7 — Risk Register

For each significant finding, produce a risk entry:

```
Risk: [Name]
Description: [What is the risk — concrete, specific]
Likelihood: [Low / Medium / High]
Impact: [Low / Medium / High]
Priority: [Critical / High / Medium / Low]  (= Likelihood × Impact)
Evidence: [What in the codebase or metrics supports this assessment]
Trigger: [Under what conditions does this become an incident]
Mitigation options:
  1. [Option A with trade-offs]
  2. [Option B with trade-offs]
Recommended: [Which option and why]
Effort: [Small / Medium / Large]
```

**Priority matrix:**

|  | Low Impact | High Impact |
|--|-----------|------------|
| **High Likelihood** | Medium | Critical |
| **Low Likelihood** | Low | High |

---

## Phase 8 — Findings Report Format

Structure the output as:

```
## Executive Summary
[3-5 sentences: what is the system, what is the overall health assessment, 
what are the top 2-3 concerns]

## Critical Findings
[Issues that pose immediate risk — data loss, security breach, outage]

## High Priority Findings
[Issues that will cause incidents or significantly slow development]

## Medium Priority Findings
[Tech debt that is costly but not immediately dangerous]

## Low Priority Findings
[Improvements worth making when opportunity arises]

## What Is Working Well
[Explicitly note what is sound — avoids the team feeling attacked]

## Recommended Action Plan
[Prioritized list with estimated effort]

## Open Questions
[Things you couldn't assess without more information]
```

### Severity labels (use exactly these):

- **[CRITICAL]** — safety, data integrity, security, or production stability at risk; address immediately
- **[HIGH]** — will cause significant pain soon; address this quarter
- **[MEDIUM]** — real debt; address within 6 months
- **[LOW]** — nice to improve; opportunistic

---

## Phase 9 — Prioritized Action Plan

For each recommendation, produce:

```
Action: [Verb phrase — what to do]
Addresses: [Which finding(s)]
Approach: [2-3 sentences on the approach]
Effort: [S/M/L — S=days, M=weeks, L=months]
Risk of change: [Low/Medium/High — how dangerous is the change?]
Recommended sequencing: [what must happen first]
```

**Sequencing principles:**
- Fix architecture debt before code debt — structural changes invalidate lower-level fixes
- Reduce coupling before adding features — new features cement bad structure
- Add observability first — you can't safely refactor what you can't observe
- Stabilize interfaces before changing implementations

---

## Checklist: Complete Review

- [ ] Context gathered (history, pain points, upcoming changes)
- [ ] Dependency map constructed
- [ ] Layer violations identified
- [ ] Data ownership assessed
- [ ] SOLID principles checked
- [ ] NFRs assessed (performance, scalability, availability, security, observability)
- [ ] Anti-patterns identified
- [ ] Tech debt classified by type
- [ ] Risk register produced with priority scores
- [ ] Findings report structured with severity levels
- [ ] "What works well" section included
- [ ] Action plan prioritized and sequenced

---

## References Used by This Workflow

- `references/design-principles.md` — SOLID, coupling/cohesion for violations
- `references/architecture-patterns.md` — pattern correctness assessment
- `references/design-patterns.md` — anti-pattern identification
- `references/system-design.md` — NFR assessment (resilience, scalability, caching)
- `references/adr-template.md` — if recommendations should be recorded as ADRs
