---
name: auth
description: Implement authentication and authorization patterns. Use when building OAuth2/OIDC flows, JWT validation, passkeys/WebAuthn, session management, MFA, RBAC/ABAC, SAML SSO, or API key auth. Do NOT use for network security or encryption primitives.
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Auth Knowledge

## Authentication Method Decision Tree

```
Is a human involved?
├─ NO → Client Credentials (machine-to-machine)
│  └─ Need sender-constrained tokens? → Add DPoP (RFC 9449)
└─ YES → What environment?
   ├─ No browser (TV, CLI, IoT) → Device Authorization Flow
   ├─ Native app (mobile/desktop) → Authorization Code + PKCE via system browser
   └─ Has browser → What auth method?
      ├─ Passwordless → Passkeys/WebAuthn (primary) or Magic Link (fallback)
      ├─ Federated SSO → What protocol does the IdP support?
      │  ├─ OIDC → Authorization Code + PKCE
      │  ├─ SAML → SP-initiated flow (prefer SAML-to-OIDC bridge if greenfield)
      │  ├─ Both → Prefer OIDC; use SAML only for legacy enterprise IdPs
      │  └─ Browser-based → Consider FedCM for third-party cookie-free federation
      └─ Password-based → Authorization Code + PKCE with MFA enforcement
         └─ MFA method? → WebAuthn > TOTP > Push > Email OTP > SMS (last resort)
```

---

## OAuth 2.1 Changes (draft-ietf-oauth-v2-1)

OAuth 2.1 consolidates OAuth 2.0 security best practices into a single spec. Not yet finalized as RFC, but changes are already industry-standard.

**Removed:** Implicit grant (`response_type=token`), Resource Owner Password Credentials (ROPC) grant.

**Mandatory:** PKCE required for ALL clients (public AND confidential). Exact redirect URI string matching (no wildcards). Access tokens MUST NOT appear in query strings -- use Authorization header or POST body only.

---

## OAuth2 Grant Types

| Grant Type | Use Case | Client Type |
|-----------|----------|-------------|
| Authorization Code + PKCE | All clients (OAuth 2.1 default) | Public and Confidential |
| Client Credentials | Machine-to-machine, service accounts | Confidential |
| Device Authorization | TVs, CLI tools, IoT (no browser) | Public |

---

## DPoP (Demonstrating Proof of Possession — RFC 9449)

Sender-constrains tokens to prevent theft and replay. The client generates a key pair, includes a DPoP proof JWT in requests. The authorization server binds tokens to that public key.

```
Token request:  POST /token + DPoP: <proof-jwt containing jti, htm, htu, iat, public key>
API call:       GET /resource + Authorization: DPoP <access-token> + DPoP: <proof-jwt for this request>
```

**When to use:** Public clients (SPAs, mobile), high-security APIs, anywhere bearer tokens are insufficient. Required by FAPI 2.0.

**Key rules:** Fresh proof per request (unique `jti`). Bind to HTTP method (`htm`) and URL (`htu`). Server validates proof signature, checks `jti` uniqueness, confirms token binding via `cnf.jkt` claim.

---

## FedCM (Federated Credential Management API)

Browser API for federated login without third-party cookies. Replaces redirect-based flows with a browser-mediated identity dialog.

```
Identity provider exposes:  /.well-known/web-identity  +  /fedcm/config.json  +  /fedcm/accounts  +  /fedcm/token
Client calls:               navigator.credentials.get({ identity: { providers: [{ configURL, clientId }] } })
```

**Status:** Shipped in Chromium browsers. Google mandates FedCM for Sign-In/One Tap. Firefox and Safari support is incomplete -- check current browser compatibility.

**When to use:** Web apps using federated identity where third-party cookie deprecation breaks existing flows. Not a replacement for OIDC -- works alongside it as the browser transport layer.

---

## OIDC Essentials

- **ID Token**: JWT proving user identity -- consumed by the client, never sent to APIs
- **Access Token**: authorizes API requests -- opaque or JWT, validated by resource server
- **Discovery**: `/.well-known/openid-configuration` exposes all endpoints and supported features
- **Userinfo**: `/userinfo` endpoint returns claims about the authenticated user
- **Standard claims**: `sub`, `email`, `name`, `picture`, `email_verified`

---

## Passkeys / WebAuthn

Phishing-resistant, public-key authentication. Private key stays on user's device; server stores only the public key and credential ID.

**Credential types:**
- **Discoverable (resident)** -- stored in authenticator; enables username-less login and Conditional UI autofill
- **Non-discoverable (server-side)** -- encrypted credential ID stored on server; authenticator holds only the master key

**Registration flow:** Server generates challenge + RP info -> `navigator.credentials.create()` -> authenticator creates key pair -> response (public key, credential ID, attestation) sent to server -> server validates origin, challenge, stores public key.

**Authentication flow:** Server generates challenge + allowed credential IDs -> `navigator.credentials.get()` -> authenticator signs challenge -> server verifies signature with stored public key.

**Conditional UI (passkey autofill):** Add `autocomplete="webauthn"` to username field. Browser suggests stored passkeys in the autofill dropdown -- one-tap login without a dedicated passkey button.

**Synced passkeys (multi-device credentials):** Cloud-synced via platform ecosystems (iCloud Keychain, Google Password Manager, Windows Hello). Eliminates single-device lock-in. Sign counter is always 0 for synced passkeys -- skip clone detection for these credentials.

**Platform vs roaming authenticators:** Platform authenticators are built into the device (Touch ID, Windows Hello). Roaming authenticators are external (YubiKey, phone as authenticator via caBLE/hybrid). Support both -- allow users to register multiple credentials.

---

## SAML

XML-based federation protocol. Primarily used for enterprise SSO with legacy identity providers.

**SP-initiated (recommended):** User accesses SP -> SP sends AuthnRequest to IdP -> user authenticates -> IdP POSTs signed SAML Response to SP's ACS URL -> SP validates assertion, creates session.

**IdP-initiated (use cautiously):** User logs into IdP portal -> selects app -> IdP POSTs unsolicited assertion to SP. Vulnerable to assertion replay -- no request-to-response binding. Mitigate with `InResponseTo` checks, short validity windows, and one-time assertion IDs.

**SAML-to-OIDC bridge:** For greenfield apps behind enterprise IdPs, use a bridge (Auth0, Keycloak, Azure AD) that accepts SAML from the IdP and exposes OIDC to your app. Your app speaks OIDC only; the bridge handles XML signatures and certificate management.

**Assertion validation checklist:** verify XML signature using IdP's X.509 certificate -> check `Issuer` matches expected IdP -> check `Audience` matches your SP entity ID -> check `NotBefore`/`NotOnOrAfter` (with clock skew tolerance) -> check `Recipient` matches your ACS URL -> check `InResponseTo` matches your request ID (SP-initiated) -> extract `NameID` and attributes -> prevent XXE by disabling DTD processing in XML parser.

---

## JWT Quick Reference

```
Header:    { "alg": "RS256", "kid": "key-id-123", "typ": "JWT" }
Payload:   { "sub": "user-id", "iss": "https://auth.example.com", "aud": "api.example.com",
             "exp": 1700000000, "iat": 1699996400, "scope": "read write" }
Signature: RSASHA256(base64url(header) + "." + base64url(payload), privateKey)
```

**Validation checklist:** verify signature with JWK -> check `exp` (with clock skew tolerance) -> check `iss` matches expected issuer -> check `aud` matches your service -> check `nbf` if present -> check required scopes/claims.

---

## Session Management

| Approach | Revocation | Scalability | Storage |
|----------|-----------|-------------|---------|
| Server-side sessions | Instant (delete from store) | Needs shared store | Redis, DB |
| JWT-only | Impossible without blocklist | Stateless | Client-side |
| JWT + refresh token | Revoke refresh, short-lived access | Hybrid | Refresh in DB |

**Expiry strategy:** Sliding expiry extends on activity (good for UX). Absolute expiry forces re-auth after fixed time (good for compliance). Use both: sliding within an absolute maximum.

---

## Refresh Token Rotation

1. Client sends refresh token to `/token` endpoint
2. Server issues NEW access token + NEW refresh token
3. Server invalidates the OLD refresh token
4. If old token is reused -> **revoke entire token family** (breach detected)
5. Grace period: allow old token for ~30s to handle network retries

---

## MFA Patterns

| Method | Security | UX | Phishing-resistant | Notes |
|--------|----------|-----|--------------------|-------|
| WebAuthn / Passkeys | Highest | Best | Yes | Origin-bound; primary choice for new apps |
| TOTP (authenticator app) | High | Moderate | No | RFC 6238, 30s window, min 160-bit secret |
| Push notification | High | Good | Partial | Requires companion app; vulnerable to fatigue attacks |
| Email OTP | Low-Medium | Easy | No | Better than SMS, still phishable |
| SMS OTP | Low | Easy | No | SIM swap vulnerable -- last resort only |

**MFA implementation requirements:**
- Enforce MFA on sensitive operations (not just login): password change, payment, role elevation
- Recovery codes: generate 8-10 single-use codes at MFA enrollment, hash before storage, show once
- Require re-enrollment (not just recovery) after all recovery codes are consumed
- Step-up authentication: trigger additional MFA for high-risk actions even within an active session

**Recommendation:** WebAuthn/passkeys as primary, TOTP as first fallback, SMS only as last resort. Regulatory trend: multiple countries eliminating SMS OTP for financial services.

**Adaptive authentication:** Evaluate risk signals (device fingerprint, IP geolocation, login velocity, impossible travel) to step up or step down MFA requirements dynamically. High-risk signals trigger additional factors; known devices on known networks may skip secondary prompts.

---

## RBAC vs ABAC

| Aspect | RBAC | ABAC |
|--------|------|------|
| Model | User -> Role -> Permissions | User attributes + resource attributes + context -> Policy |
| Complexity | Simple, static | Flexible, dynamic |
| Use when | Clear role hierarchy (admin, editor, viewer) | Fine-grained (own resources, time-based, geo-based) |
| Engines | Framework middleware | OPA, Cedar, Casbin |

---

## API Key Management

- Hash before storage (SHA-256+), prefix for identification (`sk_live_`, `sk_test_`, `pk_`)
- Scope to specific permissions, set expiration + rotation schedules
- Rate limit per key (not just per IP), log usage, redact values in logs (prefix + last 4 only)

---

## Context Adaptation

### Frontend
- Use Authorization Code + PKCE flow for SPAs
- Passkey registration/login with Conditional UI (`autocomplete="webauthn"`)
- Store tokens in httpOnly cookies (not localStorage) to prevent XSS theft
- Silent refresh via refresh token rotation (hidden iframe is deprecated)
- Show auth state in UI (logged in, session expiring, MFA required)

### Backend
- JWT validation middleware: verify signature, exp, iss, aud on every request
- WebAuthn challenge generation: cryptographically random, single-use, short-lived
- SAML: use a vetted library for XML signature validation -- never hand-parse
- Refresh rotation implementation: token family tracking, reuse detection
- RBAC enforcement middleware: role check after auth, before handler

### Security
- Threat model: token theft, session fixation, CSRF, replay, assertion wrapping
- Token lifetime policy: access tokens 5-15min, refresh tokens 7-30 days
- MFA coverage gaps: enforce MFA on sensitive operations, not just login
- Secret rotation: JWK rotation, client secret rotation, X.509 cert renewal
- Brute force protection: account lockout, progressive delays, CAPTCHA

---

## Related Knowledge

- `/security` — OWASP Top 10 (A07:2025 Authentication Failures), secrets management, zero trust
- `/compliance` — GDPR consent, SOC2 controls, HIPAA auth requirements, PCI DSS 4.0
- `/web` — CORS, CSP, cookies, FedCM browser API details
- `/api-design` — API authentication patterns, rate limiting per key

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| JWT as session (no revocation) | Cannot invalidate on logout/breach | Short-lived JWT + refresh token in DB |
| Tokens in localStorage | XSS can steal tokens | httpOnly cookies with SameSite |
| Long-lived access tokens (>1hr) | Extended blast radius on theft | 5-15 min access tokens + refresh rotation |
| Symmetric signing (HS256) distributed | Every service needs the secret | Asymmetric (RS256/ES256) with JWKS endpoint |
| SMS-only MFA | SIM swap attacks bypass it | WebAuthn/TOTP primary, SMS last resort |
| Hand-parsing SAML XML | XXE, signature wrapping attacks | Vetted SAML library with DTD disabled |
| Single passkey per account | Device loss = account lockout | Multiple credentials + recovery codes |
| Bearer tokens without sender binding | Stolen token = full access | Use DPoP (RFC 9449) for sender-constrained tokens |
| Implicit grant flow | Token leakage via URL fragment/history | Authorization Code + PKCE (OAuth 2.1) |
| ROPC grant (collecting passwords) | App sees raw credentials, no MFA | Authorization Code + PKCE via external browser |
| Redirect URI wildcards | Open redirect → token theft | Exact string matching (OAuth 2.1 mandate) |

---

## References

- [oauth-patterns.md](references/oauth-patterns.md) -- OAuth2/OIDC flows, provider setup, sequence diagrams
- [token-patterns.md](references/token-patterns.md) -- JWT, refresh rotation, storage, WebAuthn credentials, SAML assertions
