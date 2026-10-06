# OWASP Top 10:2025 Audit Rubric

Edition: OWASP Top 10:2025, the current edition at top10.owasp.org (checked October 2026; category names and the 2021 mapping match the published list). This is the one file to update when OWASP publishes a new edition.

## Categories and what to check

| # | Category | What to check |
|---|----------|---------------|
| A01 | Broken Access Control | Missing authorization on routes and objects, IDOR, privilege escalation through hidden or mass-assigned parameters, CORS misuse, CSRF on state-changing requests. **Sub-check: SSRF**: server fetches a URL from user input without an allowlist, internal or metadata endpoints reachable. |
| A02 | Security Misconfiguration | Debug endpoints in production, default credentials, verbose errors, missing hardening, overly open cloud or container permissions, missing security headers. |
| A03 | Software Supply Chain Failures | Vulnerable or unmaintained dependencies, but also the build and distribution path: CI and build compromise, unpinned or unverified artifacts, install scripts, typosquatting, unsigned releases, missing provenance. |
| A04 | Cryptographic Failures | Weak or deprecated algorithms (MD5 and SHA-1 for integrity, DES), hardcoded keys, predictable IVs, plaintext secrets at rest, missing TLS. |
| A05 | Injection | SQL, NoSQL, command, template, LDAP, XSS. Check every boundary from untrusted input to a query, shell, template, or renderer. |
| A06 | Insecure Design | Missing rate limits on abuse-prone flows, no lockout, undocumented trust boundaries, business-logic abuse, no threat model. |
| A07 | Authentication Failures | Session fixation, tokens in URLs, predictable tokens, no session rotation, weak recovery flows, missing MFA where required. |
| A08 | Software or Data Integrity Failures | Unsigned updates, deserialization of untrusted data, trust in unverified plugins or CDN scripts, unauthenticated build inputs. |
| A09 | Security Logging and Alerting Failures | No audit trail of security events, secrets or personal data in logs, no alerting on suspicious patterns. |
| A10 | Mishandling of Exceptional Conditions | Fail-open on errors, error messages that leak internals, unhandled exceptions leaving inconsistent state, resource exhaustion on error paths, swallowed errors that skip a security check. |

## Mapping from OWASP Top 10:2021

| 2021 | 2025 |
|------|------|
| A01 Broken Access Control | A01 (now includes SSRF) |
| A02 Cryptographic Failures | A04 |
| A03 Injection | A05 |
| A04 Insecure Design | A06 |
| A05 Security Misconfiguration | A02 |
| A06 Vulnerable and Outdated Components | A03 Software Supply Chain Failures (broadened) |
| A07 Identification and Authentication Failures | A07 Authentication Failures |
| A08 Software and Data Integrity Failures | A08 |
| A09 Security Logging and Monitoring Failures | A09 Security Logging and Alerting Failures |
| A10 Server-Side Request Forgery | folded into A01 |
| (new) | A10 Mishandling of Exceptional Conditions |

When a report or tool cites a 2021 number, translate it with this table and name the edition in your own findings.
