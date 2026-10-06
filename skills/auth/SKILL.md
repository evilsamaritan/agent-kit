---
name: auth
description: "Implement authentication and authorization. Use for login, passwords and password reset, sessions, OAuth/OIDC, JWT validation, refresh tokens, passkeys, MFA, SSO/SAML, API keys, roles, permissions, policies, multi-tenant access, and object-level access checks."
---

# Auth

## Scope and boundaries

**Owns:** proving who the caller is (authentication), deciding what the caller may do (authorization), and the credentials, tokens, and sessions in between.

**Defers:** generic input trust, secrets management, and OWASP categories → `security`; cookie, CORS, and CSP mechanics → `web`; where auth middleware sits in the pipeline → `backend`; security schemes in the OpenAPI contract → `api-design`; regulatory requirements (MFA mandates, audit) → `compliance`.

## Core rules

1. **Deny by default.** No route, field, message, or job is reachable until a rule allows it.
2. **Check the object, not only the route.** "Can this caller act on *this* record?" — owner, tenant, relationship. Route-level role checks alone are the most common authorization bug (IDOR / BOLA).
3. **Authorize in the domain or service layer**, the one place every entry point (HTTP, GraphQL, queue, job, admin tool) passes through. Middleware is a coarse gate on top.
4. **Pin token validation.** Accepted algorithms and key types come from configuration, never from the token's `alg` header; check `iss`, `aud`, `exp`, and the token type.
5. **Invalid or expired credentials → 401 with `WWW-Authenticate`; valid credentials without permission → 403.** Error bodies are generic; detail goes to logs.
6. **Store verifiers, not secrets.** Passwords as slow memory-hard hashes; API keys, refresh tokens, reset tokens, and recovery codes as hashes.
7. **Never merge identities on an unverified email.** Linking a social login to an existing account by unverified email enables pre-account takeover.

---

## Authentication Method Decision Tree

```
Is a human involved?
├─ NO → Client Credentials (machine-to-machine)
│  └─ Token theft is a concern? → sender-constrained tokens (mTLS or DPoP)
└─ YES → Who verifies the user's credentials?
   ├─ An identity provider (own or external) → OIDC Authorization Code + PKCE
   │  ├─ No browser on the device (TV, CLI) → Device Authorization flow
   │  ├─ Native app → system browser + PKCE, never an embedded web view
   │  └─ Enterprise IdP speaks only SAML → SP-initiated SAML, or a SAML-to-OIDC bridge
   └─ This application stores the credentials → verify here, then issue a session
      ├─ Passkeys (WebAuthn) as primary; magic link or email code as fallback
      └─ Passwords → hashing and throttling rules below, plus MFA
MFA method? → WebAuthn > TOTP > push with number matching > email OTP > SMS (last resort)
```

## Browser apps — where tokens live

```
Does the app have (or can it add) a server component on the same site?
├─ yes → Backend-for-frontend (BFF): the server holds tokens and gives the browser an
│        httpOnly, Secure, SameSite session cookie. Default choice.
│        Cookie auth needs CSRF protection: SameSite plus a CSRF token or Origin check
│        on state-changing requests.
└─ no → SPA talks to the token endpoint directly (fallback):
         access token in memory only; refresh token rotated on every use with reuse
         detection, bound by DPoP where the server supports it; never localStorage.
```

Server-rendered apps use a server-side session; mobile apps keep tokens in the platform keystore. Storage table and BFF details: [token-patterns.md](references/token-patterns.md#token-storage-strategies).

---

## Credentials You Store

- **Hash passwords** with a slow, salted password-hashing algorithm (memory-hard Argon2id preferred; scrypt or bcrypt where Argon2id is unavailable) using the library's current recommended parameters, and rehash on login when parameters change.
- **Accept long passphrases** (64+ characters), all printable characters; no composition rules or forced periodic rotation; reject passwords found in breach corpora.
- **Throttle by account and by source**; respond identically for "no such user" and "wrong password" on login, registration, and reset.
- **Reset and verification tokens** are random, single-use, short-lived, stored hashed, and invalidated when the password changes; resetting a password revokes existing sessions.
- **Re-authenticate** before changing email, password, MFA factors, or passkeys.

Parameters, reset flow, and account-linking rules: [credential-storage.md](references/credential-storage.md).

---

## Authorization

```
Does access depend on the resource's owner, tenant, sharing, or org hierarchy?
├─ yes → Do relationships chain (folder → document, org → team → project)?
│        ├─ yes → relationship-based access (ReBAC): tuples + a check API
│        └─ no → attribute or ownership checks in a policy function (ABAC)
└─ no → only on the caller's role → RBAC: roles map to permissions; code checks permissions, never role names
```

- Tenant scoping is enforced in the data access path (every query filtered by tenant), not only in handlers.
- Permission changes must reach long-lived sessions, tokens, and open connections: short token lifetimes, a version check, or explicit revocation.
- Cache decisions only with a key that includes the subject, the object, and a policy version.

Models, enforcement points, policy engines, and testing: [authorization-patterns.md](references/authorization-patterns.md).

---

## OAuth and OIDC Essentials

- **Baseline:** the OAuth security best current practice (RFC 9700). OAuth 2.1 consolidates it (draft status: oauth-patterns.md): no implicit or password grants, PKCE for all clients, exact redirect URI matching, no tokens in query strings.
- **Grants:** Authorization Code + PKCE (users), Client Credentials (services), Device Authorization (input-constrained devices), Token Exchange (delegation between services).
- **ID token** proves the login to the client and is never sent to APIs; **access token** authorizes API calls; validate `state`, `nonce`, and the ID token on every callback.
- **Discovery:** read endpoints and keys from `/.well-known/openid-configuration`; never hard-code them.
- **Sender-constrained tokens** (mTLS or DPoP) bind a token to a client key; high-assurance profiles such as FAPI 2.0 require one of them.

Flows, DPoP mechanics, callback handling, and standards status: [oauth-patterns.md](references/oauth-patterns.md).

---

## Tokens and Sessions

| Approach | Revocation | Scalability | State |
|----------|-----------|-------------|-------|
| Server-side session | Instant (delete from store) | Needs a shared store | Session store |
| Self-contained JWT only | Not before expiry without a blocklist | Stateless | None |
| Short JWT + rotated refresh token | Revoke the refresh family; access expires soon | Hybrid | Refresh tokens in DB |

**JWT validation checklist:** pin accepted algorithms and key type → select the key by `kid` from the issuer's JWKS → verify signature → check `exp`/`nbf` with small clock skew → `iss` exact match → `aud` contains this service → token type (`typ: at+jwt` for access tokens per RFC 9068) → required scopes or claims.

**Expiry:** sliding within an absolute maximum. The absolute limit is fixed when the session or refresh family starts and never extended.

**Refresh rotation:** each use returns a new refresh token and revokes the old one atomically; reuse of a revoked token outside a short grace window revokes the whole family. Implementation: [token-patterns.md](references/token-patterns.md#refresh-token-rotation).

**Sessions:** regenerate the session id on login and privilege change; `__Host-` cookie prefix, `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`.

---

## Passkeys / WebAuthn

Phishing-resistant public-key login: the private key stays on the authenticator; the server stores the public key and credential id.

- Use a maintained WebAuthn library; validate challenge, origin, and RP ID on every ceremony.
- Discoverable credentials enable username-less login and autofill (`autocomplete="username webauthn"` with conditional mediation).
- Synced passkeys report a sign counter of 0; skip clone detection for them.
- Allow several credentials per account and keep a recovery path (recovery codes or a second credential) before going passkey-only.

Storage schema and ceremonies: [token-patterns.md](references/token-patterns.md#webauthn-credential-storage).

---

## SAML

Enterprise SSO with legacy IdPs. Prefer SP-initiated flows; IdP-initiated flows have no request binding and need replay protection (`InResponseTo` absent, so cache assertion ids). Always use a vetted library with DTD processing disabled; never hand-parse XML signatures. A SAML-to-OIDC bridge (a broker IdP that accepts SAML and issues OIDC) keeps the app OIDC-only. Validation checklist: [token-patterns.md](references/token-patterns.md#saml-assertion-handling).

---

## MFA

| Method | Phishing-resistant | Notes |
|--------|--------------------|-------|
| WebAuthn / passkeys | Yes | Primary choice |
| TOTP | No | RFC 6238; 160-bit secret; allow one step of drift; block code reuse |
| Push | Partly | Require number matching against fatigue attacks |
| Email OTP | No | Fallback |
| SMS OTP | No | SIM-swap risk; last resort |

Enforce MFA on sensitive operations (password or email change, payout, role elevation), not only at login. Recovery codes: 8–10, single-use, hashed, shown once.

---

## API Keys

High-entropy random secret with a public prefix for identification and secret scanning; store a hash; show once; scope to permissions; expire and rotate; rate-limit per key; log only the prefix and last characters. Generation code: [token-patterns.md](references/token-patterns.md#api-key-patterns).

---

## Context Adaptation

**Frontend:** BFF first; no tokens in web storage; passkey autofill; handle 401 by re-authenticating, 403 by explaining missing access.

**Backend:** validation middleware for identity; authorization in services; tenant filters in data access; atomic refresh rotation.

**Security review:** object-level checks on every entry point, token validation pinning, credential storage, reset flow, account linking, session fixation, CSRF on cookie auth.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Route-only authorization | Any authenticated user reads any record by id | Object-level checks in the service layer |
| Checking role names in code | New roles require code changes; higher roles get locked out | Roles map to permissions; check permissions |
| Trusting the token's `alg` | Algorithm confusion, `none` | Pin accepted algorithms in configuration |
| 403 for an invalid token, with the library's message | Clients cannot tell "log in again" from "not allowed"; leaks detail | 401 + `WWW-Authenticate`, generic body |
| Fast hashes (SHA-256, MD5) for passwords | GPU cracking | Argon2id, scrypt, or bcrypt |
| Distinct "no such user" responses | Account enumeration | Identical responses and timing |
| Linking accounts by unverified email | Pre-account takeover | Link only verified identities, after re-authentication |
| Tokens in localStorage | XSS steals them | BFF cookie session, or in-memory access token |
| JWT as session with no revocation | Cannot log out or contain a breach | Short JWT + refresh family, or server sessions |
| Non-atomic refresh rotation | Concurrent refreshes mint two live tokens | Conditional update in one transaction |
| Symmetric signing shared across services | Every verifier can mint tokens | Asymmetric keys published via JWKS |
| Implicit or password grant | Token leakage; app sees credentials | Authorization Code + PKCE |
| Redirect URI wildcards | Open redirect → code theft | Exact string matching |
| SMS-only MFA | SIM swap | WebAuthn or TOTP primary |

---

## Related Knowledge

- `security` — input trust, secrets management, OWASP categories
- `web` — cookies, CORS, CSP, browser identity APIs
- `api-design` — security schemes in the OpenAPI contract, 401/403 semantics
- `backend` — where identity middleware sits in the pipeline
- `compliance` — MFA and audit requirements by regulation

## References

- [authorization-patterns.md](references/authorization-patterns.md) — RBAC, ABAC, ReBAC, tenancy, enforcement points, policy engines, testing
- [credential-storage.md](references/credential-storage.md) — password hashing parameters, breach checks, throttling, reset and verification flows, account linking
- [oauth-patterns.md](references/oauth-patterns.md) — OAuth/OIDC flows, DPoP, callback handling, standards status
- [token-patterns.md](references/token-patterns.md) — JWT validation, refresh rotation, revocation, storage, WebAuthn, SAML, API keys, session cookies
