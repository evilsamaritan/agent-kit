---
name: compliance
description: "Assess privacy, data-protection, and audit obligations. Use for GDPR and UK GDPR, CCPA/CPRA, ePrivacy cookies and consent, PII, retention and erasure, data residency, EU AI Act risk classification, COPPA, and SOC2 evidence."
user-invocable: true
---

# Compliance: Privacy and Regulatory Engineering

Turns legal obligations into engineering requirements: what to collect, on what basis, how long to keep it, how to prove it. This is engineering guidance, not legal advice; confirm interpretation with counsel for the jurisdiction. Dates, fines, and regime status change: check [enforcement-trends.md](references/enforcement-trends.md) and the regulation's current status before stating a deadline. No calendar dates are stated in this file.

## Scope and boundaries

**Owns:** privacy engineering (lawful basis, consent, data subject rights, retention, erasure, transfers), PII classification, audit-evidence design, EU AI Act classification and obligations at the engineering level, children's data.

**Does not own:**
- Security controls and audits → `security`
- Auth design → `auth`
- Payment card scope reduction, SAQ choice, cardholder-data controls → `payments`
- Log redaction mechanics → `observability` (the redaction rule is defined there)
- Schema, retention jobs, and encryption at rest → `database`

## Which framework applies?

```
What are you processing, and where?
├── Personal data of people in the EU/EEA → GDPR (+ EU AI Act if AI is involved)
├── Personal data of people in the UK → UK GDPR (+ Data Protection Act)
├── Residents of US states with privacy laws → CCPA/CPRA and other state laws
├── Cookies, trackers, or electronic marketing in the EU/UK → ePrivacy rules (consent before non-essential storage or access)
├── AI system placed on or used in the EU market → EU AI Act risk classification
├── Health records (US) → HIPAA: identify it, involve a specialist; engineering controls overlap with `security`
├── Payment card data → PCI-DSS (scope reduction, SAQ choice, CDE controls, dated levels: `payments`, references/regulatory-and-rails.md)
├── Children's data → COPPA (US, under 13); GDPR parental consent (EU, age threshold varies by member state)
├── B2B trust certification → SOC2 (see below)
├── Cross-border transfers → GDPR Chapter V (and local rules)
└── Several jurisdictions → layer the frameworks; the strictest applicable rule sets the design
```

Frameworks stack: a healthcare AI system with EU data must satisfy GDPR, the AI Act, and HIPAA together.

## GDPR

### Lawful basis

```
Processing personal data?
├── Person explicitly agreed → Consent (freely given, specific, informed, revocable)
├── Needed to deliver a contract → Contract (only what the service requires)
├── Required by law → Legal obligation
├── Protecting someone's life → Vital interests (rare)
├── Public authority task → Public task
└── Business has a legitimate need → Legitimate interest
    └── Document the balancing test. If the person's rights outweigh the need, you cannot rely
        on this basis: choose another valid basis or do not process. Consent is not an automatic fallback.
```

Document the basis for every data field and purpose.

### Special-category data (Art. 9)

Health, biometric and genetic data, racial or ethnic origin, political or religious belief, union membership, sex life or orientation. Processing is prohibited unless an Art. 9 condition applies (for example explicit consent), in addition to an Art. 6 basis. Treat as Critical in PII classification.

### DPIA, records, processors, DPO

- **DPIA (Art. 35)** is required for processing likely to be high risk: systematic profiling with significant effects, large-scale special-category data, large-scale monitoring of public areas, and new technology with high impact. Do it before launch; template in the AI Act reference.
- **Records of processing (Art. 30):** purposes, data categories, recipients, transfers, retention, security measures. Keep them current; exemptions for small organizations are narrow.
- **Processors:** every vendor that processes personal data on your behalf needs a data processing agreement (Art. 28), a security review, and a place in the records. Sub-processor changes need notice.
- **DPO:** required for public bodies and for core activities involving large-scale monitoring or special-category data; otherwise optional but useful.

### Data subject rights

Respond within **one month**, extendable by two further months for complex or numerous requests, with notice. Verify the requester's identity before disclosing or erasing anything.

| Right | Implementation |
|-------|---------------|
| Access (Art. 15) | Export the person's data in a readable form |
| Rectification (Art. 16) | Let users correct data |
| Erasure (Art. 17) | Delete or anonymize across all systems, unless an exception applies (legal obligation, legal claims) |
| Restriction (Art. 18) | Stop processing, keep stored |
| Portability (Art. 20) | Machine-readable export of data provided by the person |
| Objection (Art. 21) | Stop processing for direct marketing without delay |
| Automated decisions (Art. 22) | Human review and the ability to contest significant automated decisions |

### Breach notification

- Supervisory authority within 72 hours of becoming aware (Art. 33), unless unlikely to result in risk.
- Affected persons without undue delay if high risk (Art. 34).
- Document every breach, including unreported ones.

## EU AI Act

Phased obligations by category. Dates and the current status of any postponement: [enforcement-trends.md](references/enforcement-trends.md) and [ai-act-compliance.md](references/ai-act-compliance.md).

| Risk level | Examples | Requirements |
|------------|----------|-------------|
| Unacceptable | Social scoring, manipulative AI, untargeted facial scraping, emotion recognition at work or school | Banned |
| High-risk | Hiring, credit scoring, education grading, biometrics, critical infrastructure, law enforcement | Risk management, data governance, documentation, logging, human oversight, accuracy and robustness, conformity assessment, registration |
| Limited risk | Chatbots, synthetic-content generators | Transparency to users: disclose AI interaction, mark synthetic content (Art. 50) |
| Minimal risk | Spam filters, game AI | No specific obligations |

Transparency has two parts: Art. 13 requires providers of high-risk systems to give deployers usable instructions; Art. 50 requires telling people they are interacting with AI and labelling synthetic content.

## PII classification

| Level | Data types | Handling |
|-------|-----------|----------|
| Critical | National IDs, payment cards, health, biometric, special-category | Encrypt at rest and in transit, never in logs, restrict and audit all access |
| High | Email, phone, full name plus address, date of birth | Encrypt at rest, pseudonymize where possible, access controls |
| Medium | IP address, device ID, cookie ID | Minimize retention, anonymize in analytics |
| Low | Aggregates, anonymous IDs | Standard handling |

## Cross-border transfers

```
Moving personal data out of its origin jurisdiction?
├── Within the same regime (for example EU/EEA) → no transfer restriction
├── Destination has an adequacy decision → permitted; check the decision's scope and current status
├── Otherwise a transfer mechanism is needed:
│   ├── Standard Contractual Clauses + transfer impact assessment
│   ├── Binding Corporate Rules (intra-group)
│   ├── Explicit consent (narrow, last resort)
│   └── Art. 49 derogations (necessity, public interest)
└── Local data-localization or export-restriction law → map and apply it
```

Know where data is stored, processed, and who can access it under local law. Current adequacy list and national export rules change: see enforcement-trends.

## Privacy by design

Minimization, purpose limitation, storage limitation, pseudonymization, strict defaults, transparency without dark patterns.

## Audit trail design

Immutable (append-only), complete (who, what, when, where, why), tamper-evident, searchable, and retained longer than the data it audits. Keep personal data out of the immutable log (pseudonymous actor IDs, or per-subject keys that can be destroyed on erasure). Field list and patterns: [compliance-patterns.md](references/compliance-patterns.md).

## Consent

Granular per purpose; rejecting as easy as accepting; revocable; versioned against the policy shown; evidenced by an append-only record of each decision. For cookies and trackers, the stored decision must gate loading client-side before any non-essential tracker runs. Event model: [compliance-patterns.md](references/compliance-patterns.md).

## Children's privacy

- **COPPA (US):** verifiable parental consent for under 13, separate parental consent before disclosing a child's data to third parties (for example for advertising), apart from consent for the core service; amended Rule details in enforcement-trends.
- **GDPR (EU):** age of digital consent set by member states; parental consent below it; child-friendly notices.
- If a service could attract children, design age-gating and parental controls from the start.

## SOC2

An attestation report from an independent auditor on controls against the Trust Services Criteria; it is not a law or a certificate. Engineering work is evidence: access control and reviews, change management, monitoring, incident response, availability. Evidence table: [compliance-patterns.md](references/compliance-patterns.md).

## Context Adaptation

- **Frontend:** consent UI with equal reject and accept, privacy dashboard, consent-gated tracking, AI disclosure, age-gating.
- **Backend:** retention automation, data export and erasure APIs with identity verification, breach workflow with the 72-hour clock, AI system logging.
- **Infrastructure:** region-pinned storage, transfer-mechanism enforcement, encryption.
- **ML/AI:** risk classification, DPIA, training-data documentation, human oversight, model documentation.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| PII in plaintext logs | Violation and breach risk | Redaction rule in `observability` |
| No retention policy | Data grows forever, erasure impossible | Define periods per applicable law; automate |
| All-or-nothing consent | Consent must be granular | One decision per purpose |
| Cookie wall | Consent must be freely given | Full access regardless of choice, where required |
| Audit logs in mutable storage | Tampering risk | Append-only |
| Data without a recorded lawful basis | Violation from day one | Basis per field and purpose |
| Legitimate interest as a fallback for failed consent | Basis cannot be swapped after the fact | Choose the basis before collecting |
| Erasure that ignores backups, processors, and search indexes | Incomplete erasure, no evidence | Per-system erasure checklist with status |
| Deploying AI without classification | Obligations missed | Classify before deploy |
| Assuming one jurisdiction | Transfer and local obligations missed | Map data flows |
| Compliance as a one-time project | Rules and enforcement change | Continuous review, evidence-based |

## Related Knowledge

- `security` — controls, audits, secrets
- `auth` — authentication that underpins access controls
- `database` — retention jobs, encryption, audit schema
- `observability` — log redaction and telemetry retention
- `payments` — PCI scope reduction and SAQ; dated levels, current SAQ A eligibility, and PSD3/PSR status in payments/references/regulatory-and-rails.md

## References

- [compliance-patterns.md](references/compliance-patterns.md) — audit-event fields, consent event model, erasure checklist, retention table, export, SOC2 evidence
- [ai-act-compliance.md](references/ai-act-compliance.md) — EU AI Act classification, requirements, conformity, DPIA template
- [enforcement-trends.md](references/enforcement-trends.md) — volatile dates, fines, regime status (check and update)
