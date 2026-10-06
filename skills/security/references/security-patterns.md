# Security Patterns Reference

Code-review lens for application security: severity, secrets, authorization checks, validation, rate limiting, supply chain. Stack-agnostic. Authentication protocol design is in `auth`; zero-trust network design in `networking`; header and CORS mechanics in `web`.

## Contents

- [Severity Classification](#severity-classification)
- [Secrets Management Patterns](#secrets-management-patterns)
- [Authentication Review](#authentication-review)
- [Authorization Patterns](#authorization-patterns)
- [Input Validation Patterns](#input-validation-patterns)
- [API Security Patterns](#api-security-patterns)
- [Supply Chain Security](#supply-chain-security)

---

## Severity Classification

Severity follows exploitability, reachability, and impact. The classes are defaults; adjust for context (an unreachable path or a gated endpoint lowers them, an exposed one with sensitive data raises them).

```
CRITICAL — Direct compromise risk:
  - Leaked credential with write/admin permission
  - Auth bypass allowing unauthorized actions
  - SQL/command injection in production queries
  - Deserialization vulnerability with code execution
  - Hardcoded secrets in source code

HIGH — Indirect operational risk:
  - Missing auth on protected endpoint
  - Secrets in logs (exposure over time)
  - No rate limiting on write/auth endpoints
  - Missing input validation on trust boundary
  - Known critical CVE in dependency

MEDIUM — Best practice gap:
  - Non-constant-time auth comparison (timing attack)
  - Missing CORS restriction
  - No CSP headers
  - Overly permissive IAM roles
  - Missing HSTS

LOW — Improvement:
  - Verbose auth error messages
  - Missing non-critical security headers
  - No automated dependency scanning
  - Debug endpoints present (but gated)
```

---

## Secrets Management Patterns

### Storage hierarchy (most to least secure)
1. Hardware security module (HSM) / cloud KMS
2. Secret manager (Vault, AWS Secrets Manager, GCP Secret Manager)
3. Encrypted environment variables in CI/CD
4. `.env` file excluded from version control
5. Environment variables on host (acceptable for non-sensitive config)

### Rotation strategy
- Generate new credential alongside old
- Update consumers to accept both old and new
- Roll out new credential
- Revoke old credential after grace period
- Automate: never depend on manual rotation

### Detection patterns
| Signal | Risk | Where to check |
|--------|------|----------------|
| High-entropy strings in source | Hardcoded secret | `*.config`, `*.yaml`, `*.json`, `*.properties` |
| `Bearer ey...` in source | Hardcoded JWT | Any source file |
| `://user:pass@` in URLs | Embedded credentials | Config files, connection strings |
| Known provider key prefixes (for example a cloud access-key ID prefix) | Provider credential | Any file |
| `-----BEGIN.*PRIVATE KEY` | Exposed private key | Any file |

The control is a maintained secret scanner with push protection; use these signals only for manual review.

---

## Authentication Review

What to look for in a diff. Protocol design (OAuth, OIDC, sessions, MFA, passkeys) is in `auth`.

- Tokens: signature verified on every request; `exp`, `iss`, `aud` checked; no trusting payload before verification.
- API keys: sent in a header (not a query string, which lands in logs), stored hashed, scoped, rotatable, rate-limited per key.
- Sessions: new session ID after login, absolute and idle timeout, server-side invalidation on logout.
- Secret comparison is constant-time (`crypto.timingSafeEqual`, `hmac.compare_digest`, `subtle.ConstantTimeCompare`, or the language equivalent).

---

## Authorization Patterns

### Object-level authorization
- Verify resource ownership on every request (not just "is authenticated")
- Query: `WHERE resource.owner_id = current_user.id`
- Do not rely on client-supplied resource lists without server validation

### Function-level authorization
- Map actions to required roles/permissions
- Enforce at middleware/guard level, not inside business logic
- Deny by default: unauthenticated or unauthorized = reject

### Field-level authorization
- Explicit field selection in responses (allowlist, not blocklist)
- No mass assignment: validate which fields a client can write
- Separate DTOs/schemas for read vs. write operations

---

## Input Validation Patterns

### Trust boundary principle
A trust boundary is a change in who controls the data: a different owner, tenant, or privilege level. Validate and authorize where data crosses one:
- Internet client to API
- One tenant's data to another tenant's context
- Third-party callback, webhook, or partner API into your system
- Uploaded file into a processing pipeline
- Message queue consumers when producers belong to another trust domain (another team's or tenant's input)
- Model output into an interpreter

Hops between components under the same control are not boundaries; inside a module rely on the checked contract (see `development`). Use schema validation at each real boundary.

### Schema validation
- Define explicit schemas for all input structures
- Validate types, required fields, string lengths, numeric ranges, formats
- Reject unknown fields (closed schemas) or strip them
- Validate early, fail fast — do not process partially valid input
- Language examples: JSON Schema, Zod (TS), Pydantic (Python), serde (Rust), Bean Validation (Java)

### Injection prevention by type

| Injection type | Prevention |
|---------------|------------|
| SQL | Parameterized queries / prepared statements |
| NoSQL | Typed query builders, avoid `$where` or raw expressions |
| Command | Avoid shell execution; use typed APIs with argument arrays |
| LDAP | Escape special characters, parameterized filters |
| XSS | Output encoding, CSP, template auto-escaping |
| Path traversal | Normalize path, validate against allowed root, reject `..` |
| Template | Sandbox template engines, disable dangerous features |
| Deserialization | Validate before deserializing, use safe formats (JSON over serialized objects) |

---

## API Security Patterns

### Rate limiting strategy
| Endpoint type | Limit basis | Recommended approach |
|--------------|-------------|---------------------|
| Auth endpoints | Per IP | Strict: 5-10 attempts/min with exponential backoff |
| Public read APIs | Per IP or API key | Moderate: 100-1000 req/min |
| Authenticated write APIs | Per user/token | Based on plan/tier |
| Webhooks (inbound) | Per source | Verify signatures, moderate rate |

### CORS configuration
Mechanics are owned by `web`. Review check: explicit origin allowlist, never `*` with credentials.

### Security headers

Header syntax and values are owned by `web`; this skill owns the policy review. Checks:

- CSP: nonce generated per response and never on cacheable HTML (use hashes there); `object-src 'none'`; `frame-ancestors` set deliberately; rolled out in report-only first.
- CORS: explicit origin allowlist, never `*` with credentials; `Vary: Origin` when the allowed origin is chosen per request.
- HSTS: `includeSubDomains` only after every subdomain serves HTTPS; `preload` only after accepting that removal is slow.
- Present and matching `web`'s guidance: `nosniff`, referrer policy, permissions policy, cookie attributes.

### API gateway security
- Centralized auth validation at the gateway
- Rate limiting and throttling at edge
- Request/response schema validation
- IP allowlisting for admin APIs
- mTLS between gateway and backend services

---

## Supply Chain Security

Policy and decision list are in SKILL.md. Review checks:

- New or changed dependencies reviewed (maintainer, provenance, install scripts, transitive additions); lockfile diffs read.
- Frozen-lockfile installs in CI (`--frozen-lockfile`, `--locked`); lockfile hashes verified.
- Vulnerability scanner in CI with a triage rule (reachability, exploitability).
- SBOM (CycloneDX or SPDX) generated for production artifacts; artifacts signed (for example Sigstore) and verified before deploy; base image provenance checked.
- Secret scanning with push protection enabled.
- Provenance target: require SLSA Build Level 2 or higher for production artifacts (hosted build, signed provenance); raise it where the threat model demands. Wiring is in `ci-cd`.

### Signing and verification snippet

For `ci-cd`, `docker`, and `release-engineering` to point at: at build, generate the SBOM, sign the image by digest (keyless signing with the CI identity, for example `cosign sign <image>@<digest>`), and attach provenance and SBOM attestations. At deploy, verify the signature and provenance against the expected identity and builder before the artifact runs (`cosign verify`, `cosign verify-attestation`), and enforce the same check in an admission policy so unsigned or unverified images are rejected in the cluster. Pipeline wiring: `ci-cd`.

### SAST, DAST, and dependency scanning

- **SAST** in CI on every change; block on new high-confidence findings, track the rest. Tune rules to cut false positives.
- **DAST** against a running pre-production environment on a schedule or before release; needs a safe target and authenticated scans to reach real paths.
- **Dependency scanning** on every lockfile change and on a schedule, since new advisories appear for unchanged code.
- Triage by reachability, exploitability, and impact; every accepted finding has an owner and expiry. Fuzzing is owned by `testing`.

### Server hardening and policy as code

- Hosts: SSH keys only (no passwords, no root login), firewall default deny with only needed ports, unattended security updates, least-privilege service accounts, no shared admin credentials.
- Policy as code: express rules (no public buckets, required image signatures, no privileged containers, required resource limits) as versioned policy evaluated in CI and enforced at admission; violations fail the change, exceptions are explicit and time-boxed. Cluster policy mechanics: `kubernetes`.
