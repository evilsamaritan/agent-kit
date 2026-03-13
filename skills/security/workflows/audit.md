# Security Audit Workflow

Step-by-step procedure for a comprehensive security review. Adapt to the project's tech stack — do not assume any specific language or framework.

---

## Phase 1: Threat Model

1. Discover the tech stack: language, framework, database, message broker, deployment target
2. Identify all attack surfaces:
   - Public-facing services (APIs, webhooks, web UIs, WebSocket endpoints)
   - Credential stores (API keys, database connections, signing keys)
   - Database access (connection strings, query patterns, ORM usage)
   - Message queues/event systems (producer/consumer auth, message integrity)
   - Web frontends (XSS, CSRF, auth bypass, client-side secrets)
   - Environment configuration (secrets exposure, default values)
   - Third-party integrations (OAuth providers, payment, external APIs)
3. Map data flows: where sensitive data enters, moves through, and exits the system
4. Identify trust boundaries: where validated data crosses into unvalidated territory

## Phase 2: Secret Scan

1. Search source code for credential patterns:
   - Grep for: `API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, `CREDENTIAL`, `CONNECTION_STRING`
   - Check for high-entropy strings in source files (base64-encoded keys, hex strings)
   - Check for hardcoded URLs with embedded credentials
2. Verify secret hygiene:
   - [ ] No secrets in source code
   - [ ] Example/template env file exists with placeholder values
   - [ ] `.gitignore` excludes secret files (`.env`, `*.pem`, `*.key`)
   - [ ] Pre-commit secret scanning configured (gitleaks, trufflehog, or equivalent)
   - [ ] CI pipeline includes secret scanning step
   - [ ] No secrets in log output (search structured log calls and print statements)
   - [ ] No secrets in event/message payloads
   - [ ] No secrets in error responses or stack traces
   - [ ] No secrets in URL query parameters

## Phase 3: Auth Audit

1. Map all authentication mechanisms:
   - [ ] All protected routes have auth middleware/guards
   - [ ] Token/credential comparison uses constant-time functions
   - [ ] Session management is secure (HttpOnly, Secure, SameSite flags on cookies)
   - [ ] OAuth2/OIDC: tokens validated, issuer verified, scopes checked
   - [ ] API keys: transmitted via headers (not query params), rotatable
2. Verify authorization:
   - [ ] Resource ownership verified on every object-level access
   - [ ] Role-based access enforced on privileged actions
   - [ ] No auth bypass via HTTP method override or path manipulation
   - [ ] API error responses do not leak auth implementation details
   - [ ] Failed auth attempts are logged with source identity

## Phase 4: Input Validation Audit

1. Check every entry point:
   - [ ] HTTP request bodies validated against a schema before processing
   - [ ] Query parameters and path parameters validated (types, ranges, formats)
   - [ ] Message queue consumers validate payloads before processing
   - [ ] File uploads: type-checked, size-limited, stored outside webroot
2. Check injection prevention:
   - [ ] Database queries use parameterized statements (no string interpolation)
   - [ ] No dynamic code execution (eval, exec, deserialization-to-execution)
   - [ ] OS command execution uses safe APIs (no shell interpolation)
   - [ ] Template rendering uses auto-escaping
   - [ ] Path operations prevent traversal (normalize, validate against allowed roots)
3. Check output encoding:
   - [ ] HTTP responses set appropriate Content-Type
   - [ ] User-generated content is encoded/escaped before rendering
   - [ ] CSP headers configured to prevent inline script execution

## Phase 5: Infrastructure & Supply Chain

1. Check security headers and configuration:
   - [ ] CORS restricted to known origins (not wildcard in production)
   - [ ] CSP configured (script-src, style-src, connect-src scoped)
   - [ ] HSTS enabled with appropriate max-age
   - [ ] X-Content-Type-Options: nosniff
   - [ ] X-Frame-Options or CSP frame-ancestors set
   - [ ] No debug mode or verbose errors in production config
   - [ ] Request size limits configured
2. Check dependency security:
   - [ ] Dependency lockfile committed and hash-verified
   - [ ] Vulnerability scanning in CI (npm audit, pip-audit, cargo-audit, govulncheck, etc.)
   - [ ] No dependencies with known critical vulnerabilities
   - [ ] Transitive dependencies reviewed for high-risk packages
3. Check deployment security:
   - [ ] Container images use minimal base (no full OS images)
   - [ ] Services run as non-root user
   - [ ] Network policies restrict inter-service communication
   - [ ] Secrets injected at runtime (not baked into images)

## Phase 6: Report

Produce a structured security assessment:

```
## Security Assessment

### Summary
[2-3 sentences: overall security posture, critical gaps, tech stack]

### Threat Model
| Surface | Protection | Gaps |
|---------|-----------|------|

### Secret Scan Results
| Category | Status | Details |
|----------|--------|---------|
| Source code | | |
| Git history | | |
| Log output | | |
| Event payloads | | |
| Error responses | | |

### Auth Matrix
| Endpoint/Service | Auth Method | Validated? | Issues |
|-----------------|-------------|------------|--------|

### Input Validation Matrix
| Entry Point | Validation | Schema | Issues |
|------------|-----------|--------|--------|

### OWASP API Top 10 Assessment
| # | Risk | Status | Notes |
|---|------|--------|-------|

### Supply Chain
| Check | Status | Details |
|-------|--------|---------|
| Lockfile committed | | |
| Vulnerability scanning | | |
| Known vulnerabilities | | |

### Findings
| # | Area | Severity | Finding | File:Line | Recommendation |
|---|------|----------|---------|-----------|----------------|

### Recommendations
1. [Priority order — most critical first]
```
