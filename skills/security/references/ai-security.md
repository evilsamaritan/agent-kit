# AI/LLM Security Reference

The lists below are the OWASP GenAI Security Project's published Top 10s: LLM Applications 2025 edition, and Agentic Applications for 2026 (published December 2025). Both were the current editions at genai.owasp.org in October 2026; check for a newer edition before citing numbers.

Security patterns for applications that integrate AI models, LLM APIs, RAG pipelines, or autonomous agents.

## Contents

- [OWASP Top 10 for LLM Applications](#owasp-top-10-for-llm-applications)
- [Prompt Injection and Containment](#prompt-injection-and-containment)
- [Output Handling](#output-handling)
- [Agentic Application Security](#agentic-application-security)
- [RAG Security](#rag-security)
- [Data Protection](#data-protection)

---

## OWASP Top 10 for LLM Applications

| # | Risk | What to check | Mitigation |
|---|------|---------------|------------|
| LLM01 | **Prompt Injection** | Can external content override system instructions? | Containment (below); separate instructions from data; filtering only as detection |
| LLM02 | **Sensitive Information Disclosure** | Can the model leak PII, system prompts, or training data? | Output filtering, PII scrubbing, prompt isolation |
| LLM03 | **Supply Chain** | Are model sources, plugins, training data trusted? | Verify model provenance, audit plugins, pin model versions |
| LLM04 | **Data and Model Poisoning** | Can training/fine-tuning data be tampered with? | Data validation, provenance tracking, anomaly detection |
| LLM05 | **Improper Output Handling** | Is LLM output passed unsanitized to interpreters? | Validate and sanitize all LLM output before use in code, queries, or rendering |
| LLM06 | **Excessive Agency** | Can the model take destructive actions without oversight? | Least-privilege tool access, human-in-the-loop for destructive ops |
| LLM07 | **System Prompt Leakage** | Can users extract system instructions? | Do not rely on prompt secrecy for security, defense-in-depth |
| LLM08 | **Vector and Embedding Weaknesses** | Can embeddings be manipulated or poisoned? | Access control on vector stores, input validation before embedding |
| LLM09 | **Misinformation** | Does the application present hallucinations as fact? | Grounding with retrieval, confidence scoring, citation requirements |
| LLM10 | **Unbounded Consumption** | Can a user trigger excessive token/compute usage? | Token limits, rate limiting, cost budgets per request |

---

## Prompt Injection and Containment

**Assume injection succeeds.** No input filter, summarizer, or instruction hierarchy reliably stops prompt injection, direct (a user's text overrides instructions) or indirect (instructions hidden in emails, documents, web pages, records, or tool results). Design so that a compromised context cannot do harm.

### Containment decision

A single context should not hold all three of:
1. **Untrusted content** (user input, retrieved or fetched data)
2. **Private data** (secrets, personal data, internal documents)
3. **An outbound channel** (network requests, email, rendering of URLs or images, writing to shared stores)

If an agent needs all three, split the work across contexts with a deterministic gate between them, or remove one capability.

### Controls that hold

1. **Deterministic authorization on every tool call**, enforced in code outside the model, against the end user's permissions and a per-tool allowlist.
2. **Per-tool, scoped credentials**, no shared admin tokens; short-lived where possible.
3. **Human approval for irreversible, financial, or externally visible actions.**
4. **Egress control**: restrict domains the agent can reach and block data-bearing URLs in rendered output.
5. **Structured interfaces**: parse model output into a schema, validate, then act on the validated data.
6. **Bounded execution**: token, time, and action limits per run; kill switch.
7. **Audit log** of every tool call, its inputs, outputs, and the identity it ran as.

### Detection and noise reduction (not prevention)

Input filtering, summarizing or transforming retrieved content, and monitoring for anomalous tool-call patterns reduce noise and surface attacks; none of them is a control. Treat a string match on "ignore previous instructions" as telemetry, never as protection.

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

OWASP Top 10 for Agentic Applications (2026), ASI01 to ASI10:

| ID | Risk |
|----|------|
| ASI01 | Agent Goal Hijack |
| ASI02 | Tool Misuse and Exploitation |
| ASI03 | Identity and Privilege Abuse |
| ASI04 | Agentic Supply Chain Vulnerabilities |
| ASI05 | Unexpected Code Execution (RCE) |
| ASI06 | Memory & Context Poisoning |
| ASI07 | Insecure Inter-Agent Communication |
| ASI08 | Cascading Failures |
| ASI09 | Human-Agent Trust Exploitation |
| ASI10 | Rogue Agents |

The containment decision and controls above address most of these: scoped credentials and deterministic authorization (ASI02, ASI03), egress control and approval gates (ASI01, ASI05), isolation of memory and inter-agent channels with authentication (ASI06, ASI07), pinned and verified tools, models, and plugins (ASI04), bounded execution and kill switches (ASI08, ASI10), and honest confidence and review steps for users (ASI09).

### Design principles

1. **Least agency** — the minimum autonomy the task needs.
2. **Scoped credentials** per tool.
3. **Human-in-the-loop** for destructive, financial, or irreversible actions.
4. **Audit trail** of every tool call, decision, and outcome.
5. **Bounded execution** — token, time, and action limits.
6. **Isolation** — sandboxed runs with no production secrets.

---

## RAG Security

| Risk | Attack vector | Mitigation |
|------|--------------|------------|
| Data poisoning | Injecting malicious documents into the knowledge base | Validate and sanitize documents before indexing, track provenance |
| Prompt injection via retrieval | Adversarial content in retrieved chunks | Treat retrieved content as untrusted data; apply containment, not just filtering |
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
