# Pre-defined Team Compositions

## Review Team

**Use when:** Code review, PR review, architecture assessment.

**Agents:** architect → security → qa
**Flow:** Sequential (each builds on previous findings)

### Stage 1: architect
- **Role:** Architecture and design review
- **Skills:** architect
- **Prompt template:** "Review architecture patterns, coupling, cohesion, SOLID principles, and design decisions in {target}. Identify structural issues, suggest improvements."
- **Pass to next:** architectural findings, design issues, file locations, dependency concerns

### Stage 2: security
- **Role:** Security vulnerability scan
- **Skills:** security, auth
- **Prompt template:** "Review for OWASP top 10, auth issues, injection vectors, secrets exposure in {target}. Architecture review found: {prev_summary}"
- **Pass to next:** security findings with severity ratings, affected files

### Stage 3: qa
- **Role:** Test coverage and quality audit
- **Skills:** qa
- **Prompt template:** "Audit test coverage, mock boundaries, flaky tests, edge cases in {target}. Architecture issues: {stage1_summary}. Security issues: {stage2_summary}"
- **Output:** Unified review report with all findings prioritized

---

## Implementation Team

**Use when:** Building a new feature that spans multiple domains.

**Agents:** architect → (frontend ∥ backend) → qa
**Flow:** Pipeline with parallel middle stage

### Stage 1: architect
- **Role:** Design the implementation approach
- **Skills:** architect
- **Prompt template:** "Design the implementation for: {task}. Define API contracts, component structure, data flow. Output a clear plan for frontend and backend teams."
- **Pass to next:** implementation plan, API contracts, component specs

### Stage 2a: frontend (parallel)
- **Role:** Implement UI components
- **Skills:** frontend (+ react/vue if detected)
- **Prompt template:** "Implement the frontend for: {task}. Follow this design: {stage1_plan}. API contracts: {api_spec}"

### Stage 2b: backend (parallel)
- **Role:** Implement API/services
- **Skills:** backend (+ javascript/rust/kotlin if detected)
- **Prompt template:** "Implement the backend for: {task}. Follow this design: {stage1_plan}. API contracts: {api_spec}"

### Stage 3: qa
- **Role:** Write tests for the implementation
- **Skills:** qa
- **Prompt template:** "Write tests for the new implementation of {task}. Frontend changes: {stage2a_files}. Backend changes: {stage2b_files}."
- **Output:** Test files, coverage report

---

## Full Audit Team

**Use when:** Comprehensive project health check.

**Agents:** cto → security → sre → qa
**Flow:** Sequential (holistic → specific)

### Stage 1: cto
- **Role:** Holistic technical health review
- **Skills:** cto
- **Prompt template:** "Audit the overall technical health of this project: architecture, dependencies, code quality, engineering practices."
- **Pass to next:** high-level findings, areas of concern, priority focus areas

### Stage 2: security
- **Role:** Security deep-dive on flagged areas
- **Skills:** security, auth, compliance
- **Prompt template:** "Deep security audit. CTO flagged these areas: {stage1_concerns}. Focus on: auth flows, secrets, input validation, dependency vulnerabilities."

### Stage 3: sre
- **Role:** Reliability and operations review
- **Skills:** sre, observability
- **Prompt template:** "Review reliability: health checks, graceful shutdown, error handling, observability. CTO concerns: {stage1_concerns}"

### Stage 4: qa
- **Role:** Test infrastructure audit
- **Skills:** qa
- **Prompt template:** "Audit test suite: coverage gaps, flaky tests, mock quality. Previous reviews found: {combined_summary}"
- **Output:** Comprehensive audit report

---

## Security Audit Team

**Use when:** Security-focused review with infrastructure perspective.

**Agents:** security → sre → devops
**Flow:** Sequential

### Stage 1: security — Application security (OWASP, auth, input validation)
### Stage 2: sre — Operational security (health checks, secrets in runtime, logging sensitive data)
### Stage 3: devops — Infrastructure security (container security, CI secrets, OIDC, supply chain)

---

## Frontend Team

**Use when:** UI work that needs testing.

**Agents:** frontend → qa
**Flow:** Pipeline

### Stage 1: frontend — Implement UI changes
### Stage 2: qa — Write component tests, visual regression tests

---

## Backend Team

**Use when:** API/service work with testing and security.

**Agents:** backend → qa → security
**Flow:** Pipeline

### Stage 1: backend — Implement service/API changes
### Stage 2: qa — Write unit and integration tests
### Stage 3: security — Review for vulnerabilities in new code

---

## AI Feature Team

**Use when:** AI/ML feature development.

**Agents:** ai-engineer → architect → qa
**Flow:** Pipeline

### Stage 1: ai-engineer — Implement AI feature (LLM integration, prompts, evaluation)
### Stage 2: architect — Review architecture (guardrails, fallbacks, cost, latency)
### Stage 3: qa — Write tests (unit, integration, eval harness)
