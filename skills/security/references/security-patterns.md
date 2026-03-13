# Security Patterns Reference

Domain knowledge for application security review. Stack-agnostic patterns and severity classification.

## Contents

- [Severity Classification](#severity-classification)
- [Secrets Management Patterns](#secrets-management-patterns)
- [Authentication Patterns](#authentication-patterns)
- [Authorization Patterns](#authorization-patterns)
- [Input Validation Patterns](#input-validation-patterns)
- [API Security Patterns](#api-security-patterns)
- [Supply Chain Security](#supply-chain-security)
- [Zero Trust Patterns](#zero-trust-patterns)
- [Common Anti-Patterns](#common-anti-patterns)

---

## Severity Classification

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
| Base64 of `AKIA` prefix | AWS access key | Any file |
| `-----BEGIN.*PRIVATE KEY` | Exposed private key | Any file |

---

## Authentication Patterns

### Token-based auth (JWT, opaque tokens)
- Validate signature on every request (do not trust payload without verification)
- Check expiry (`exp` claim) — reject expired tokens
- Verify issuer (`iss`) and audience (`aud`) claims
- Use short-lived access tokens (5-15 min) + refresh tokens
- Store refresh tokens server-side or in HttpOnly cookies

### OAuth2 / OIDC
- Authorization Code flow with PKCE for public clients (SPAs, mobile)
- Client Credentials flow for service-to-service
- Validate ID tokens: signature, issuer, audience, nonce, expiry
- Token introspection for opaque tokens
- Revocation endpoint for logout

### API key auth
- Transmit via header (not query parameter — query params appear in logs)
- Hash keys at rest (store hash, compare hash on request)
- Scope keys to specific permissions/resources
- Support multiple active keys for rotation
- Rate limit per key

### Session management
- HttpOnly, Secure, SameSite=Strict (or Lax) flags on session cookies
- Regenerate session ID after authentication
- Absolute and idle timeout
- Server-side session invalidation on logout

### Constant-time comparison
Timing attacks extract secrets character-by-character. Use language-specific constant-time functions:
- Node.js: `crypto.timingSafeEqual()`
- Python: `hmac.compare_digest()`
- Go: `subtle.ConstantTimeCompare()`
- Rust: `constant_time_eq` crate
- Java: `MessageDigest.isEqual()`

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
Validate at every point where data crosses a trust boundary:
- External client to API server
- API server to internal service
- Message queue producer to consumer
- File upload to processing pipeline
- User input to database query

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
- Production: explicit origin allowlist (never `*` with credentials)
- Restrict allowed methods and headers
- Set `Access-Control-Max-Age` to reduce preflight requests
- Credentials: only when needed, with explicit origins

### Security headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Script/style/connect sources | Prevent XSS, data injection |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` or `SAMEORIGIN` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer leakage |
| `Permissions-Policy` | Feature restrictions | Disable unused browser APIs |

### API gateway security
- Centralized auth validation at the gateway
- Rate limiting and throttling at edge
- Request/response schema validation
- IP allowlisting for admin APIs
- mTLS between gateway and backend services

---

## Supply Chain Security

### Dependency auditing
- Run vulnerability scanner in CI (blocks on critical/high CVE)
- Review new dependencies before adding (maintainer, license, size, transitive deps)
- Prefer well-maintained packages with security policies
- Audit lockfile changes in code review

### Lockfile integrity
- Commit lockfiles to version control
- Verify lockfile hashes match registry (detects tampering)
- Use `--frozen-lockfile` / `--locked` in CI (no silent updates)

### SBOM (Software Bill of Materials)
- Generate SBOM for production artifacts (CycloneDX or SPDX format)
- Include in release artifacts
- Track with dependency-track or similar

### Build provenance
- Sigstore/cosign for container image signing
- Reproducible builds where feasible
- Verify provenance of base images

---

## Zero Trust Patterns

### Core principles
1. Never trust, always verify — authenticate every request regardless of network location
2. Least privilege — grant minimal permissions for the task
3. Assume breach — design as if the attacker is already inside the network

### Implementation patterns
- mTLS between all services (not just edge)
- Short-lived credentials (hours, not months)
- Per-request authorization (not "once authenticated, always authorized")
- Network segmentation: services only reach what they need
- Encrypted data at rest and in transit
- Audit log every access decision

### Service-to-service auth
- Service mesh with automatic mTLS (Istio, Linkerd)
- JWT with service identity claims
- SPIFFE/SPIRE for workload identity
- No shared secrets between services — use PKI

---

## Common Anti-Patterns

| Anti-pattern | Risk | Correct approach |
|-------------|------|-----------------|
| Secrets in source code | Credential leak via git history | Environment variables or secret manager |
| `SELECT *` in queries | Mass assignment, data leakage | Explicit field selection |
| Wildcard CORS (`*`) | Cross-origin attacks | Explicit origin allowlist |
| Error messages with stack traces | Information disclosure | Generic errors to clients, detailed logs server-side |
| Rolling your own crypto | Cryptographic weakness | Use established libraries (libsodium, OpenSSL) |
| JWT with `alg: none` | Auth bypass | Always validate algorithm, reject `none` |
| Storing passwords as MD5/SHA1 | Rainbow table attacks | bcrypt/scrypt/argon2 with salt |
| Disabling TLS verification | MITM attacks | Fix certificates, do not bypass |
| Global admin API keys | Blast radius of compromise | Scoped, rotatable, per-service keys |
| Trusting client-side validation | Bypass via direct API calls | Server-side validation is the authority |
