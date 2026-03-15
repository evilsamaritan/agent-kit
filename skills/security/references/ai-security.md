# AI/LLM Security Reference

Security patterns for applications that integrate AI models, LLM APIs, RAG pipelines, or autonomous agents.

## Contents

- [OWASP Top 10 for LLM Applications](#owasp-top-10-for-llm-applications)
- [Prompt Injection Prevention](#prompt-injection-prevention)
- [Output Handling](#output-handling)
- [Agentic Application Security](#agentic-application-security)
- [RAG Security](#rag-security)
- [Data Protection](#data-protection)

---

## OWASP Top 10 for LLM Applications

| # | Risk | What to check | Mitigation |
|---|------|---------------|------------|
| LLM01 | **Prompt Injection** | Can external content override system instructions? | Separate instructions from data, input filtering, output validation |
| LLM02 | **Sensitive Information Disclosure** | Can the model leak PII, system prompts, or training data? | Output filtering, PII scrubbing, prompt isolation |
| LLM03 | **Supply Chain** | Are model sources, plugins, training data trusted? | Verify model provenance, audit plugins, pin model versions |
| LLM04 | **Data and Model Poisoning** | Can training/fine-tuning data be tampered with? | Data validation, provenance tracking, anomaly detection |
| LLM05 | **Improper Output Handling** | Is LLM output passed unsanitized to interpreters? | Validate and sanitize all LLM output before use in code, queries, or rendering |
| LLM06 | **Excessive Agency** | Can the model take destructive actions without oversight? | Least-privilege tool access, human-in-the-loop for destructive ops |
| LLM07 | **System Prompt Leakage** | Can users extract system instructions? | Do not rely on prompt secrecy for security, defense-in-depth |
| LLM08 | **Vector/Embedding Weaknesses** | Can embeddings be manipulated or poisoned? | Access control on vector stores, input validation before embedding |
| LLM09 | **Misinformation** | Does the application present hallucinations as fact? | Grounding with retrieval, confidence scoring, citation requirements |
| LLM10 | **Unbounded Consumption** | Can a user trigger excessive token/compute usage? | Token limits, rate limiting, cost budgets per request |

---

## Prompt Injection Prevention

### Direct injection
User crafts input that overrides system instructions.

**Mitigations:**
1. Never concatenate untrusted input directly into system prompts
2. Use structured message formats that separate roles (system, user, assistant)
3. Validate and sanitize user input before passing to the model
4. Apply output validation — do not trust LLM decisions for security-critical logic

### Indirect injection
Malicious instructions embedded in external data the LLM processes (emails, documents, web pages, database records).

**Mitigations:**
1. Treat all retrieved content as untrusted data, not instructions
2. Summarize or transform retrieved content before including in prompts
3. Monitor for anomalous model behavior after processing external content
4. Implement content sandboxing — process external data in isolated contexts

### Detection signals
| Signal | Risk |
|--------|------|
| Input containing "ignore previous instructions" or similar overrides | Direct prompt injection attempt |
| Retrieved documents with instruction-like language targeting the model | Indirect injection via data source |
| Sudden behavioral changes after processing new data sources | Possible poisoned data source |
| Model attempting to call tools outside its normal pattern | Possible injection-driven excessive agency |

---

## Output Handling

LLM output is **untrusted input** from a security perspective. Never:
- Execute LLM-generated code without sandboxing and review
- Use LLM output in SQL queries without parameterization
- Render LLM output as HTML without sanitization
- Make authorization decisions based on LLM classification alone
- Pass LLM output to shell commands without validation

**Safe patterns:**
- Parse LLM output into structured data, validate the structure, then act on validated data
- Use allowlists for any LLM-selected actions or tool calls
- Apply the same input validation to LLM output as to user input
- Log all LLM-generated actions for audit

---

## Agentic Application Security

### Core risks (OWASP Agentic Top 10)
| Risk | Description | Mitigation |
|------|-------------|------------|
| Agent goal hijacking | Malicious input redirects agent objectives | Input validation, goal anchoring, behavioral monitoring |
| Excessive autonomy | Agent takes actions beyond intended scope | Least-agency principle, action budgets, human approval gates |
| Identity and privilege abuse | Agent acts with more privilege than needed | Per-tool permissions, scoped credentials, no shared admin tokens |
| Cascading failures | Error in one agent propagates through multi-agent system | Circuit breakers, isolated execution, rollback capabilities |
| Human-agent trust exploitation | Users over-trust agent outputs | Confidence indicators, mandatory review for high-impact actions |
| Rogue agents | Compromised or malfunctioning agents operating autonomously | Agent health monitoring, kill switches, behavioral anomaly detection |

### Design principles
1. **Least agency** — Grant minimum autonomy required for the task
2. **Scoped credentials** — Each tool gets its own minimal-privilege credential
3. **Human-in-the-loop** — Require approval for destructive, financial, or irreversible actions
4. **Audit trail** — Log every tool call, decision, and outcome
5. **Bounded execution** — Set token limits, time limits, and action count limits per agent run
6. **Isolation** — Run agents in sandboxed environments with no access to production secrets

---

## RAG Security

| Risk | Attack vector | Mitigation |
|------|--------------|------------|
| Data poisoning | Injecting malicious documents into the knowledge base | Validate and sanitize documents before indexing, track provenance |
| Prompt injection via retrieval | Adversarial content in retrieved chunks | Treat retrieved content as data not instructions, summarize before use |
| Information leakage | RAG exposing documents user should not access | Enforce access control at retrieval time, not just at indexing |
| Embedding manipulation | Crafted inputs that map to specific retrieval results | Monitor for anomalous retrieval patterns, rate limit indexing |

---

## Data Protection

### PII in LLM contexts
- Scrub PII before sending to external LLM APIs
- Apply data retention policies to conversation logs
- Never store raw prompts containing user PII without encryption
- Implement right-to-deletion for stored conversations
- Mask sensitive fields in logged prompts and completions

### Model access control
- Authenticate all API calls to model endpoints
- Rate limit per user/tenant to prevent abuse
- Separate model instances or endpoints for different data classification levels
- Audit log all model invocations with caller identity
