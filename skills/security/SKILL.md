---
name: security
description: "Assess and harden application security. Use for security audits and threat models, OWASP risks, input/output trust, secrets, secure coding, supply chain, SAST/DAST triage, and AI/LLM tool threats."
user-invocable: true
---

# Application Security

Code-level threats, audit rubric, and hardening. Vendor-neutral. This skill carries what to check for and why; the procedures are in [workflows/audit.md](workflows/audit.md) and [workflows/threat-model.md](workflows/threat-model.md).

## Scope and boundaries

**Owns:**
- Audit rubric (OWASP Top 10) and severity classification
- Input validation, output encoding, injection classes
- AuthN/AuthZ code-level review (protocol design → `auth`)
- Secrets handling in code and config
- Supply chain risk, SAST/DAST selection and triage, SBOM and provenance policy
- AI/LLM and agent threats

**Does not own:**
- Regulatory frameworks (GDPR, PCI, SOC2) → `compliance`
- Auth protocols (OAuth, OIDC, SAML) → `auth`
- Network TLS, firewalls, mesh, zero-trust model → `networking`
- Header, cookie, CORS, and CSP syntax and configuration → `web` (policy review stays here)
- Webhook signing and verification → `api-design` (references/rest-patterns.md#webhooks)
- Password hashing and credential storage → `auth` (references/credential-storage.md)
- Pipeline wiring for scanners and CI secrets → `ci-cd`
- Fuzzing and security regression tests → `testing`
- Container image hardening → `docker`; cluster RBAC and policies → `kubernetes`
- Payment-specific PCI flows → `payments`
- In-module code practice (where to validate inside a trusted module) → `development`

## Decision trees

### Which control for this input?

```
Untrusted data flows into...
├── a database query        → parameterized queries or typed builders
├── a shell or process      → no shell; argument arrays; allowlist the command
├── HTML in a browser       → context-specific output encoding, auto-escaping templates (CSP/headers → `web`)
├── a file path             → canonicalize, resolve against an allowed root, reject escapes
├── a URL the server fetches → allowlist hosts, block internal and metadata ranges, control redirects
├── a deserializer          → data-only format, schema validation, no object-graph deserialization
├── an LLM prompt or tool   → treat content as untrusted; deterministic authorization on actions (ai-security)
└── a record owned by someone else → object-level authorization on every access, not only authentication
```

### What kind of review is this?

```
├── Reviewing existing code or a change   → audit workflow (rubric, severity)
├── Designing a feature or system         → threat-model workflow, then controls above
├── Alert from a scanner                  → triage: reachability, exploitability, impact; then fix or accept
└── Suspected leak or incident            → revoke and rotate first; incident process in `reliability`
```

## Audit rubric

OWASP Top 10:2025 is the rubric. The edition list, mapping from older numbering, and what to check per category are in [owasp-top10.md](references/owasp-top10.md) (the one file to update when OWASP revises the list). Each finding records location, severity, and fix.

## Input validation

- **Validate at trust boundaries.** A trust boundary is a change in who controls the data: a different owner, tenant, or privilege level (internet to service, tenant A to tenant B, third-party callback, uploaded file, model output). Internal hops between components under the same control are not boundaries; inside a module, rely on the checked contract (see `development`).
- **Allowlist, not denylist.**
- **Canonicalize before validating**: paths, encodings, Unicode normalization.
- **Validate shape, not just type**: format, length, range, closed schema.
- **Schema validation at each real boundary**, reject unknown fields or strip them.

## Output encoding

- Context-specific encoding (HTML, URL, shell, SQL). One generic `sanitize()` is a smell.
- Parameterized queries, always.
- Auto-escaping templates; raw output opt-in at the call site.

## Secrets management

- Never commit secrets, including `.env` and test fixtures. Use secret scanning with push protection so a leak is blocked before it lands.
- Short-lived over long-lived: workload identity, rotating tokens.
- Least privilege per secret; log access centrally.
- Revoke on leak immediately, then investigate.
- Storage hierarchy, rotation, and detection signals: [security-patterns.md](references/security-patterns.md).

## Supply chain

Decide, in order:
1. **Control install-time code execution.** Disable or allowlist install and lifecycle scripts unless a package needs them.
2. **Delay adoption of very new releases** (a release-age cooldown) so malicious or broken versions are yanked before you pull them.
3. **Prefer packages with provenance** (trusted publishing, signed attestations), maintained, with few transitive dependencies; watch for typosquatted names. Popularity signals are easy to game.
4. **Lockfile committed, frozen installs in CI**; review lockfile diffs.
5. **Scan for secrets before push** and in CI history.
6. **Generate an SBOM and sign artifacts** at build; verify before deploy.

Signing, verification, and admission snippet, SAST/DAST roles, server hardening, and policy as code: [security-patterns.md](references/security-patterns.md#supply-chain-security). Build-system and CI hardening (pinning actions, runner isolation, token scope) is in `ci-cd`.

Scanner roles: **SAST** (static code analysis) finds code patterns early, with false positives to triage; **DAST** (running-app scanning) finds deployment and configuration issues; **dependency scanning** finds known CVEs. Triage by reachability and exploitability, not raw severity counts.

## AI / LLM security

Rule: content from outside the trust boundary (user input, retrieved documents, web pages, tool output, model output) is untrusted data, never instructions, and an injection can succeed. Limit what a compromised context can reach rather than trying to filter it away. Threat list, containment design, and checks: [ai-security.md](references/ai-security.md).

## Secure defaults checklist

This skill owns the policy and the review (per-response CSP nonce, never on cacheable HTML; `object-src` and `frame-ancestors`; `Vary: Origin` on dynamic CORS; HSTS `includeSubDomains` and `preload` preconditions: [security-patterns.md](references/security-patterns.md#security-headers)). Syntax and configuration are in `web` (headers, cookies, CORS, CSP) and `networking` (TLS):

- HTTPS everywhere with HSTS
- Session and auth cookies: `Secure`, `HttpOnly`, a `SameSite` policy
- CSP without `unsafe-inline` / `unsafe-eval` scripts
- CORS allowlist, never a wildcard with credentials
- `nosniff`, a referrer policy, a permissions policy

## Context Adaptation

- **Reviewing:** run the audit workflow; output file:line findings with severity.
- **Building:** apply the controls above early; retrofitting is expensive.
- **Designing:** run the threat-model workflow at the decision phase: data classification, trust boundaries, attack surface.
- **Operating:** secret rotation, log scrubbing (`observability`), and incident handling (`reliability`, with an extra notification track for security events).

## Anti-Patterns

- **"We'll add security later."**
- **Custom crypto**: own AES, own hash, own token parsing. Use vetted libraries.
- **"Our users are trusted."** Untrusted until validated at a real boundary.
- **Security by obscurity.**
- **Scanner alert fatigue**: hundreds of unranked medium findings hide the critical one.
- **Pinning to a vulnerable version** because "it works".
- **Using an LLM or other probabilistic check as the security control** for authorization or input safety.

## Related Knowledge

- `auth` — authentication and authorization protocols, credential storage
- `api-design` — webhook signing and verification
- `web` — headers, cookies, CORS, CSP
- `networking` — TLS, mTLS, segmentation, zero trust
- `compliance` — regulatory frameworks
- `architecture` — threat model at design time
- `file-storage` — upload threats: serving untrusted files (separate origin, `nosniff`, attachment for SVG/HTML), see file-storage/references/serving-untrusted-files.md)
- `ci-cd` — supply chain in pipelines, scanner wiring
- `testing` — fuzzing and security regression tests
- `development` — in-module validation and error handling practice
- `docker`, `kubernetes`, `payments` — domain-specific hardening

## References

- [owasp-top10.md](references/owasp-top10.md) — OWASP Top 10:2025 rubric, mapping from 2021
- [security-patterns.md](references/security-patterns.md) — severity classification, secrets, authorization review, validation patterns, rate limiting
- [ai-security.md](references/ai-security.md) — LLM and agent threats, containment, RAG, data protection
- [workflows/audit.md](workflows/audit.md) — audit procedure and report format
- [workflows/threat-model.md](workflows/threat-model.md) — threat-modelling procedure
