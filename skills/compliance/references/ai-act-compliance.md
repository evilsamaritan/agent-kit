# EU AI Act Compliance — Implementation Guide

Deep dive into EU AI Act requirements, risk classification, conformity assessment, and GDPR intersection.

## Contents

- [Risk Classification Decision Tree](#risk-classification-decision-tree)
- [Annex III High-Risk Categories](#annex-iii-high-risk-categories)
- [High-Risk AI System Requirements](#high-risk-ai-system-requirements)
- [GDPR and AI Act Intersection](#gdpr-and-ai-act-intersection)
- [Conformity Assessment Process](#conformity-assessment-process)
- [DPIA Template for AI Systems](#dpia-template-for-ai-systems)
- [Implementation Timeline for Teams](#implementation-timeline-for-teams)

---

## Risk Classification Decision Tree

```
Is the AI system on the Prohibited list (Art. 5)?
├── Yes → BANNED (social scoring, manipulative AI, untargeted facial scraping,
│         emotion recognition in workplace/education, real-time remote biometric ID)
│         Enforced: Feb 2, 2025
└── No → Is it a General-Purpose AI model (GPAI)?
    ├── Yes → GPAI obligations apply (Art. 51-56)
    │         Enforced: Aug 2, 2025
    │         - Technical documentation
    │         - Comply with Copyright Directive
    │         - Publish training data summary
    │         - Systemic risk models: additional safety evaluations
    └── No → Is it in Annex III (high-risk categories)?
        ├── Yes → HIGH-RISK requirements (Art. 6-49)
        │         Enforced: Aug 2, 2026
        │         Full conformity assessment required
        └── No → Does it interact with people or generate content?
            ├── Yes → LIMITED RISK — transparency obligations only
            │         Disclose AI use to users, label AI-generated content
            └── No → MINIMAL RISK — no obligations
```

---

## Annex III High-Risk Categories

| Category | Examples | Impact |
|----------|----------|--------|
| Biometric identification | Facial recognition, fingerprint matching | Employment, access control |
| Critical infrastructure | Energy grid management, water systems, traffic | Safety-critical operations |
| Education | Automated grading, student assessment, admissions | Life-impacting decisions |
| Employment | CV screening, interview scoring, promotion decisions | Hiring fairness |
| Essential services | Credit scoring, insurance pricing, social benefits | Financial access |
| Law enforcement | Predictive policing, evidence analysis, risk assessment | Civil liberties |
| Migration/border | Visa processing, asylum assessment | Human rights |
| Justice | Sentencing recommendations, parole decisions | Liberty |

---

## High-Risk AI System Requirements

### 1. Risk Management System (Art. 9)

```
Document throughout AI system lifecycle:
├── Identified risks (foreseeable misuse, bias, failure modes)
├── Risk estimation (likelihood × severity)
├── Risk mitigation measures
├── Residual risk assessment
└── Post-market monitoring plan
```

### 2. Data Governance (Art. 10)

```typescript
interface TrainingDataDocumentation {
  provenance: {
    sources: string[];             // where data came from
    collectionMethod: string;      // how data was gathered
    consentBasis: string;          // GDPR lawful basis for personal data
  };
  quality: {
    completeness: number;          // coverage assessment
    accuracy: number;              // error rate
    labelQuality: string;         // annotation methodology
  };
  bias: {
    protectedAttributes: string[]; // gender, ethnicity, age, disability
    biasMetrics: Record<string, number>; // disparate impact ratios
    mitigationSteps: string[];     // what was done to reduce bias
  };
  representativeness: {
    targetPopulation: string;      // who the system will be used on
    coverage: string;              // how well training data represents target
    gaps: string[];                // known representation gaps
  };
}
```

### 3. Technical Documentation (Art. 11)

Required documentation for each high-risk AI system:

- System description: intended purpose, capabilities, limitations
- Development process: design choices, training methodology, validation
- Performance metrics: accuracy, precision, recall, fairness metrics per subgroup
- Hardware and software requirements
- Risk management documentation
- Change log: all significant modifications post-deployment

### 4. Record-Keeping / Logging (Art. 12)

```typescript
interface AISystemLog {
  timestamp: string;            // ISO 8601
  systemId: string;             // unique identifier for the AI system
  version: string;              // model version
  inputSummary: string;         // anonymized input description (NOT raw PII)
  outputDecision: string;       // what the system decided/recommended
  confidenceScore: number;      // model confidence
  humanOverride?: {
    overridden: boolean;
    reason: string;
    overriddenBy: string;       // actor ID
  };
  processingDuration: number;   // milliseconds
}

// Retention: logs must be kept for the system's lifecycle + reasonable period
// Align with GDPR data minimization — log decision metadata, not raw personal data
```

### 5. Human Oversight (Art. 14)

Design systems so that humans can:

- **Understand** outputs (explainability, confidence scores)
- **Monitor** operation (dashboards, anomaly detection)
- **Intervene** in real-time (override buttons, kill switches)
- **Decide not to use** the system (manual fallback path)
- **Override** individual decisions (appeal mechanism)

```
Oversight tiers by risk severity:
├── Tier 1 (advisory): AI recommends, human decides (hiring, credit)
├── Tier 2 (monitored): AI decides, human reviews sample (content moderation)
├── Tier 3 (override): AI decides, human can override individual cases
└── Tier 4 (kill switch): Human can shut down system entirely
```

### 6. Transparency (Art. 13)

Users must be informed:
- That they are interacting with an AI system
- The system's capabilities and limitations
- The level of accuracy and potential error rates
- Any circumstances that may affect performance
- Contact information for the provider

---

## GDPR and AI Act Intersection

### Key Overlaps

| Topic | GDPR requirement | AI Act requirement | Resolution |
|-------|-----------------|-------------------|------------|
| Lawful basis | Required for any personal data processing | N/A (AI Act does not replace GDPR) | Both apply simultaneously |
| DPIA | Required for high-risk processing (Art. 35) | Conformity assessment required | DPIA can feed into conformity assessment |
| Automated decisions | Right to explanation (Art. 22) | Transparency + human oversight | AI Act adds operational requirements |
| Data minimization | Collect only what's needed | Training data must be relevant, representative | Tension: bias testing may require protected attributes |
| Right to object | Can refuse automated processing | Human oversight must allow override | Complementary — both enable human control |

### EDPB Guidance (April 2025)

- LLMs rarely achieve anonymization standards
- Deploying third-party LLMs requires legitimate interest assessment
- Training on personal data requires explicit lawful basis
- AI-generated outputs containing personal data are subject to GDPR

---

## Conformity Assessment Process

```
1. CLASSIFY
   └── Determine risk category (Annex III check)

2. COMPLY
   ├── Implement all Art. 6-15 requirements
   ├── Establish quality management system
   └── Complete technical documentation

3. ASSESS
   ├── Self-assessment (most Annex III categories)
   └── Third-party assessment (biometric systems, critical infrastructure)

4. REGISTER
   └── Register in EU AI database BEFORE market deployment

5. DECLARE
   └── Issue EU Declaration of Conformity
   └── Affix CE marking

6. MONITOR
   ├── Post-market surveillance plan
   ├── Serious incident reporting (within 15 days)
   └── Periodic reassessment on significant changes
```

---

## DPIA Template for AI Systems

```markdown
## Data Protection Impact Assessment — [System Name]

### 1. Processing Description
- Purpose: [Why is personal data being processed?]
- Data categories: [What personal data is involved?]
- Data subjects: [Whose data?]
- Lawful basis: [Consent / Contract / Legitimate interest]

### 2. Necessity and Proportionality
- Is AI processing necessary for the stated purpose?
- Could the purpose be achieved with less data?
- How is data minimization applied in training?

### 3. Risk Assessment
| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| Biased outcomes | [H/M/L] | [H/M/L] | [Bias testing, fairness metrics] |
| Data breach | [H/M/L] | [H/M/L] | [Encryption, access controls] |
| Incorrect decisions | [H/M/L] | [H/M/L] | [Human oversight, appeal process] |
| Re-identification | [H/M/L] | [H/M/L] | [Pseudonymization, k-anonymity] |

### 4. Safeguards
- Technical measures: [encryption, access controls, logging]
- Organizational measures: [training, policies, DPO review]
- Human oversight: [oversight tier, override mechanism]
- Data subject rights: [how rights are exercised for AI decisions]

### 5. DPO / Supervisory Authority Consultation
- DPO opinion: [date, recommendation]
- Prior consultation needed? [If high residual risk after mitigation]
```

---

## Implementation Timeline for Teams

| When | Action |
|------|--------|
| Now | Inventory all AI/ML systems, classify risk levels |
| Now | Ensure GDPR compliance for all AI data processing |
| Now | Remove any prohibited AI practices |
| Q2 2026 | Complete conformity assessment for high-risk systems |
| Q2 2026 | Prepare technical documentation and register in EU database |
| Aug 2026 | High-risk compliance deadline (unless extended to Dec 2027) |
| Ongoing | Post-market monitoring, incident reporting, periodic reassessment |
