---
name: compliance
description: Advise on regulatory compliance — GDPR, EU AI Act, SOC2, HIPAA, PCI-DSS, COPPA, data sovereignty, PII handling, audit trails, privacy by design. Use when implementing data protection, privacy controls, consent management, or cross-border transfers. Do NOT use for security (use security) or auth (use auth).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Compliance — Regulatory & Privacy Engineering

## Which Framework Applies?

```
What data are you processing?
├── Personal data of EU residents → GDPR (+ EU AI Act if AI involved)
├── AI system deployed in EU market → EU AI Act risk classification
├── Health records (US) → HIPAA
├── Payment card data → PCI-DSS
├── Children's data (US, under 13) → COPPA
├── Children's data (EU, varies by state) → GDPR with parental consent
├── B2B SaaS needing trust certification → SOC2
├── Cross-border data transfers → GDPR Ch. V + local sovereignty laws
└── Multiple jurisdictions → Layer frameworks (GDPR + AI Act + local law)
```

**Overlap rule:** frameworks stack — a healthcare AI system processing EU data must satisfy GDPR + EU AI Act + HIPAA simultaneously.

---

## GDPR

### Lawful Basis Decision Tree

```
Processing personal data?
├── User explicitly agreed → Consent (freely given, specific, revocable)
├── Fulfilling a contract → Contract (only what's necessary for the service)
├── Required by law → Legal obligation (tax records, fraud prevention)
├── Protecting someone's life → Vital interests (medical emergency, rare)
├── Public authority task → Public task (government bodies)
└── Business has legitimate need → Legitimate interest (must pass balancing test)
    └── Does user's right outweigh business need? → Use consent instead
```

### Data Subject Rights

| Right | Implementation | Deadline |
|-------|---------------|----------|
| Access (Art. 15) | Export all user data in machine-readable format | 30 days |
| Rectification (Art. 16) | Allow users to correct their data | 30 days |
| Erasure (Art. 17) | Delete all user data ("right to be forgotten") | 30 days |
| Portability (Art. 20) | Export in JSON/CSV, include derived data | 30 days |
| Restriction (Art. 18) | Stop processing, keep stored | 30 days |
| Objection (Art. 21) | Stop processing for direct marketing immediately | Immediate |

### Data Breach Notification

- **Supervisory authority:** within 72 hours of becoming aware (Art. 33)
- **Data subjects:** without undue delay if high risk to rights/freedoms (Art. 34)
- **Document all breaches** — even those not reported (accountability principle)

### Enforcement

Active and accelerating. See [enforcement-trends.md](references/enforcement-trends.md) for current figures.

---

## EU AI Act

Phased enforcement — prohibited practices first, then GPAI, then high-risk. See [enforcement-trends.md](references/enforcement-trends.md) for dates.

### Risk Classification

| Risk Level | Examples | Requirements |
|------------|----------|-------------|
| Unacceptable | Social scoring, manipulative AI, untargeted facial scraping, emotion recognition at work/school | Banned |
| High-risk | AI in hiring, credit scoring, medical devices, education grading, law enforcement | Conformity assessment, human oversight, transparency, data governance |
| Limited risk | Chatbots, deepfake generators | Transparency obligations (disclose AI use) |
| Minimal risk | Spam filters, AI in games | No specific obligations |

### High-Risk AI Compliance Checklist

- [ ] Risk management system documenting identified risks and mitigation
- [ ] Data governance: training data quality, bias testing, representativeness
- [ ] Technical documentation: architecture, performance metrics, limitations
- [ ] Record-keeping: automatic logging of system operation
- [ ] Human oversight: ability to intervene, override, or shut down
- [ ] Accuracy, robustness, cybersecurity measures
- [ ] Transparency: inform users they are interacting with AI
- [ ] Registration in EU database before market deployment

Deep dive: [ai-act-compliance.md](references/ai-act-compliance.md)

---

## PII Classification

| Level | Data Types | Handling |
|-------|-----------|----------|
| Critical | SSN, passport, payment cards, health records, biometric | Encrypt at rest + transit, mask in logs, restrict access, audit all access |
| High | Email, phone, full name + address, DOB | Encrypt at rest, pseudonymize where possible, access controls |
| Medium | IP address, device ID, cookie ID | Minimize retention, anonymize in analytics |
| Low | Aggregated stats, anonymous IDs | Standard handling, no special controls |

---

## Cross-Border Data Transfers

```
Transferring data outside origin jurisdiction?
├── EU → EU/EEA → No restriction
├── EU → Adequacy country (US DPF, UK, Japan, etc.) → Permitted under adequacy decision
├── EU → Non-adequate country → Need transfer mechanism:
│   ├── Standard Contractual Clauses (SCCs) + Transfer Impact Assessment
│   ├── Binding Corporate Rules (BCRs) for intra-group transfers
│   ├── Explicit consent (narrow, last resort)
│   └── Derogations (Art. 49) — contract necessity, public interest
├── US → Countries of concern → DOJ bulk data rule restricts sensitive data
└── China/Vietnam/India → Outbound → Local data localization requirements apply
```

**Data sovereignty principle:** understand where data is stored, processed, and who can access it under local law.

---

## Privacy by Design Principles

1. **Data minimization** — collect only what you need
2. **Purpose limitation** — use data only for stated purpose
3. **Storage limitation** — delete when no longer needed
4. **Pseudonymization** — replace identifiers where possible
5. **Default privacy** — strictest settings by default
6. **Transparency** — clear privacy notices, no dark patterns

---

## Audit Trail Design Principles

- **Immutable** — append-only, no updates or deletes
- **Complete** — who, what, when, where, why
- **Tamper-evident** — hash chains or write-once storage
- **Searchable** — indexed by actor, resource, action, timestamp
- **Retained** — beyond the data it audits (audit logs outlive deleted data)

---

## Consent Management

- **Granular** — separate consent per purpose (analytics, marketing, personalization)
- **Symmetric** — reject must be as easy as accept (no dark patterns)
- **Revocable** — users can withdraw consent at any time
- **Versioned** — track which privacy policy version was consented to
- **Evidenced** — store timestamp, IP, user agent, policy version

---

## Children's Privacy

- **COPPA (US):** parental consent required for children under 13. Separate consent for advertising vs. core service. Age verification for mixed-audience sites.
- **GDPR (EU):** member states set age of consent between 13-16. Parental consent below threshold. Clear, child-friendly privacy notices.
- **Design principle:** if your service could attract children, build age-gating and parental controls from day one.

---

## Context Adaptation

### Frontend
- Cookie consent: granular (necessary, analytics, marketing), one-click reject equal to accept
- Privacy controls dashboard (manage consents, download data, delete account)
- Consent-gated tracking (load analytics only after consent)
- AI disclosure: inform users when interacting with AI systems
- Age-gating UI for services that may attract children

### Backend
- PII masking in logs (redact email, phone, names)
- Data retention policy automation (scheduled deletion jobs)
- Audit logging middleware (capture all state changes)
- Data export/deletion APIs (GDPR subject access requests)
- Data breach notification workflow (72-hour timer)
- AI system logging: automatic record-keeping for high-risk AI systems

### Infrastructure
- Data residency controls (region-pinned storage for sovereignty)
- Cross-border transfer mechanism enforcement (SCCs, adequacy checks)
- Encryption requirements (at rest: AES-256, in transit: TLS 1.2+)

### ML/AI
- AI Act risk classification for any AI/ML system
- DPIA for high-risk AI processing
- Training data documentation: provenance, quality, bias assessment
- Human oversight mechanisms: confidence thresholds, escalation paths
- Model card / transparency documentation

---

## Related Knowledge

- **security** skill — application security audits, threat modeling, secrets management, OWASP Top 10
- **auth** skill — OAuth2/OIDC, JWT, session management, MFA — authentication controls that underpin compliance requirements
- **database** skill — data retention automation, encryption at rest, audit log schema design

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Logging PII in plaintext | Compliance violation, data breach risk | Mask/redact PII in all log output |
| No data retention policy | Data grows forever, impossible to comply with erasure | Define retention periods, automate deletion |
| All-or-nothing consent | GDPR requires granular consent per purpose | Separate consent for analytics, marketing, etc. |
| Cookie wall (reject = no access) | GDPR: consent must be freely given | Allow full access regardless of consent choice |
| Audit logs in mutable storage | Tampering risk, fails compliance audit | Append-only store (write-once storage) |
| Storing data without lawful basis | GDPR violation from day one | Document lawful basis for every data field |
| Deploying AI without risk assessment | EU AI Act violation for high-risk systems | Classify risk level, document, assess before deploy |
| Assuming one jurisdiction | Cross-border transfers trigger additional obligations | Map data flows, apply transfer mechanisms |
| Treating compliance as one-time | Regulations evolve, enforcement intensifies | Continuous monitoring, periodic reassessment |

---

## References

- [compliance-patterns.md](references/compliance-patterns.md) — GDPR implementation (data export, erasure, consent management), SOC2 evidence collection, PII detection patterns, audit trail architecture, data retention automation
- [ai-act-compliance.md](references/ai-act-compliance.md) — EU AI Act risk classification details, conformity assessment process, DPIA templates, AI transparency requirements, GDPR-AI Act intersection
- [enforcement-trends.md](references/enforcement-trends.md) — Volatile enforcement data: GDPR fine amounts, EU AI Act enforcement dates, regulatory trends, cross-border transfer developments (update periodically)

Load references when you need implementation code for audit trails, data export, consent management, or AI compliance.
