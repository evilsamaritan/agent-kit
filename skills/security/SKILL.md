---
name: security
description: Application security patterns — OWASP Top 10, input validation, output encoding, secrets management, secure coding, supply chain, AI/LLM security. Use when auditing code for security issues, reviewing auth flows at the code level, hardening against OWASP risks, assessing supply-chain risk, or evaluating AI/LLM-specific threats. Do NOT use for compliance frameworks (use compliance), infrastructure security (use networking/kubernetes), or authentication protocols (use auth).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch, Edit, Write, Bash
user-invocable: true
---

# Application Security

Secure coding, code-level threat patterns, and audit rubrics. Vendor-neutral. This skill carries **what to check for and why**; the *how to audit* workflow lives in the `reviewer` role-template.

## Scope and boundaries

**This skill covers:**
- OWASP Top 10 as an audit rubric
- Input validation, output encoding, canonicalization
- Injection classes: SQL, NoSQL, command, LDAP, template, prompt
- AuthN/AuthZ code-level review (handoff to `auth` for protocol design)
- Secrets handling in code and config
- Supply chain: dependency risk, lockfile integrity, SBOM, signing
- AI/LLM-specific risks: prompt injection, data exfiltration, unsafe tool use
- Secure defaults: cookies, CORS, CSP, headers

**This skill does not cover:**
- Regulatory frameworks (GDPR, PCI, SOC2) → `compliance`
- Auth protocol design (OAuth, OIDC, SAML) → `auth`
- Network-level TLS, firewalls, mesh → `networking`
- Container image hardening → `docker`
- K8s RBAC / NetworkPolicy / Pod Security → `kubernetes`
- Payment-specific PCI flows → `payments`

## Audit rubric — OWASP-aligned

When auditing code, walk these categories. Each finding: location, severity, fix.

1. **Broken access control** — missing authz checks, IDOR (Insecure Direct Object Reference), privilege escalation via hidden parameters.
2. **Cryptographic failures** — weak algorithms (MD5, SHA-1 for integrity, DES), hardcoded keys, predictable IVs, plaintext secrets at rest.
3. **Injection** — SQL/NoSQL/command/template/LDAP. Check every boundary between untrusted input and a query / shell / template.
4. **Insecure design** — missing rate limits on abuse-prone endpoints, no lockout on repeated failed auth, trust boundaries not documented.
5. **Security misconfiguration** — debug endpoints in prod, default passwords, verbose error pages, missing security headers.
6. **Vulnerable components** — outdated dependencies with known CVEs, unmaintained packages.
7. **Auth failures** — session fixation, missing CSRF, token in URL, predictable tokens, long session lifetime with no rotation.
8. **Data integrity failures** — unsigned updates, deserialization of untrusted data, trust-on-first-use.
9. **Logging/monitoring failures** — missing audit trail on security events, sensitive data in logs, no alerts on suspicious patterns.
10. **SSRF** — server fetches URLs from user input without allowlist; internal metadata endpoints reachable.

## Input validation

- **Validate at the boundary.** Untrusted input = anything from outside the process (HTTP body, query, headers, file contents, env vars set by user).
- **Allowlist, not denylist.** Specify what's allowed; reject everything else. Denylists miss cases.
- **Canonicalize before validating.** `../` in paths, mixed-case SQL keywords, Unicode normalization — all bypass naive filters.
- **Validate shape, not type.** `email: string` is a type; `email: matches RFC 5322, max 254 chars` is a shape.

## Output encoding

- **Context-specific encoding.** HTML-escape for HTML, URL-escape for URLs, shell-escape for shell. A single "sanitize()" is a smell.
- **Parameterized queries, always.** String concatenation into SQL is malpractice even if "the input is safe".
- **Safe-by-default templates.** Templating engines should escape by default; opt in to raw output at the call site, not globally.

## Secrets management

- **Never commit secrets to a repo.** Even in `.env` or in test fixtures.
- **Short-lived > long-lived.** Rotating tokens, workload identity, signed short-lived JWTs instead of static API keys.
- **Scope-minimum.** A token that can do everything is a token that will be stolen and misused.
- **Audit secret access.** Who / when / from where — logged centrally.
- **Revoke on leak immediately.** Don't wait to "check if it matters".

## Supply chain

- **Lockfile committed** — `package-lock.json` / `pnpm-lock.yaml` / `go.sum` / `Cargo.lock`. Regenerate from a clean slate periodically.
- **Dependency review on every PR.** New dep = review maintainer / activity / download trend / license. Not all packages deserve trust.
- **SBOM generated at build time.** Know what shipped, per version.
- **Signed artifacts.** Releases verified before deploy.
- **Pin CI actions by SHA** — see `ci-cd`.

## AI / LLM security

Threats that are specific to AI-backed systems:

- **Prompt injection** — user input that hijacks the model's instructions. Treat model output as untrusted when it informs actions.
- **Data exfiltration via tool use** — a compromised prompt asks the model to leak data by encoding it in a "harmless" tool call (image URL, search query).
- **Unsafe tool exposure** — giving an LLM access to a tool that can delete, pay, or email without human gates on destructive actions.
- **Retrieval poisoning** — malicious content in the knowledge base ends up in a retrieval-augmented context.
- **Over-reliance on the model** — treating LLM output as authoritative for security decisions (e.g., "is this input safe?"). Use deterministic checks.

Defences:
- Isolate model output from tool-calling authority. Never let the user's text reach destructive tools without a verification layer.
- Scope tools minimally. An LLM doesn't need `rm -rf`.
- Log every tool call. Audit like a privileged operation.

## Secure defaults — checklist

- HTTPS everywhere; redirect HTTP to HTTPS.
- HSTS with `includeSubDomains` on the canonical domain.
- Cookies: `Secure`, `HttpOnly`, `SameSite=Lax` (or `Strict`), path scoped.
- CSP configured; not `unsafe-inline` / `unsafe-eval` in prod.
- CORS allowlist, not `*` with credentials.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## Context adaptation

**As reviewer (auditing):** this is your primary skill. Walk the OWASP rubric; output file:line findings with severity.

**As implementer (building):** apply secure defaults early. Retrofitting security is expensive; baking it in is cheap.

**As architect (designing):** threat model at the decision phase. Data classification, trust boundaries, and attack surface are architectural concerns.

**As operator (running):** secrets rotation, log scrubbing, incident response for security events are operational tasks. Security incidents follow the `reliability` incident playbook with an extra notification track.

## Anti-patterns

- **"We'll add security later."** Retrofitting means painful migrations and years of legacy gaps.
- **Custom crypto.** Writing AES in application code, rolling own hash, custom JWT parsing. Use vetted libraries.
- **"Our users are trusted."** All inputs are untrusted until proven otherwise. Internal doesn't mean safe.
- **Security by obscurity** — hiding an admin endpoint at `/hidden-admin-xyz`. It will be found.
- **Alert fatigue on vulnerability scans.** 200 medium-severity CVEs = no one reads them = the critical one is missed.
- **Dependency pinning without review.** Locking to a specific version that has a known CVE because "it works".

## Related Knowledge

- `auth` — authentication and authorization protocols
- `compliance` — regulatory frameworks (GDPR, SOC2, PCI)
- `networking` — TLS, mTLS, DNS, firewalls
- `docker` — container image hardening
- `kubernetes` — cluster-level RBAC, NetworkPolicy
- `payments` — PCI-specific flows
- `ci-cd` — supply chain in CI

## References

- [security-patterns.md](references/security-patterns.md) — code-level patterns and anti-patterns
- [ai-security.md](references/ai-security.md) — AI/LLM threats and defences
