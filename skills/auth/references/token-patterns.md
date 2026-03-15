# Token Patterns

JWT best practices, refresh token rotation, storage strategies, revocation patterns, WebAuthn credential storage, and SAML assertion handling.

## Contents

- [JWT Structure and Signing](#jwt-structure-and-signing)
- [JWT Validation Implementation](#jwt-validation-implementation)
- [JWK Rotation](#jwk-rotation)
- [Refresh Token Rotation](#refresh-token-rotation)
- [Token Revocation](#token-revocation)
- [Token Storage Strategies](#token-storage-strategies)
- [WebAuthn Credential Storage](#webauthn-credential-storage)
- [SAML Assertion Handling](#saml-assertion-handling)
- [API Key Patterns](#api-key-patterns)
- [Session Token Patterns](#session-token-patterns)

---

## JWT Structure and Signing

### Algorithm Selection

| Algorithm | Type | Key | Use When |
|-----------|------|-----|----------|
| RS256 | Asymmetric | RSA 2048+ | Default choice, wide support |
| ES256 | Asymmetric | P-256 curve | Smaller tokens, faster verification |
| EdDSA | Asymmetric | Ed25519 | Best performance, growing support |
| HS256 | Symmetric | Shared secret | Single-service only, never distributed |

**Rule:** Use asymmetric signing (RS256 or ES256) for any system with multiple services. Publish public keys via JWKS endpoint.

### Standard Claims

```json
{
  "iss": "https://auth.example.com",      // Issuer -- who created this token
  "sub": "user_abc123",                    // Subject -- who this token is about
  "aud": "https://api.example.com",        // Audience -- who should accept this token
  "exp": 1700000000,                       // Expiration -- UNIX timestamp
  "iat": 1699996400,                       // Issued at -- UNIX timestamp
  "nbf": 1699996400,                       // Not before -- UNIX timestamp
  "jti": "unique-token-id-xyz",           // JWT ID -- unique identifier for this token
  "scope": "read write",                   // Scopes -- space-separated permissions
  "roles": ["admin", "editor"]            // Custom claim -- application roles
}
```

### Token Lifetime Guidelines

| Token Type | Lifetime | Rationale |
|-----------|----------|-----------|
| Access token | 5-15 minutes | Short blast radius on theft |
| ID token | 5-15 minutes | Same as access token |
| Refresh token | 7-30 days | Longer for UX, shorter for security |
| Refresh token (mobile) | 90 days | Mobile apps need longer sessions |
| API key | 90-365 days | Rotate on schedule, revoke on compromise |

---

## JWT Validation Implementation

### Validation Middleware (Node.js)

```javascript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  cache: true, cacheMaxAge: 600000, rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function validateJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const token = authHeader.slice(7);
  jwt.verify(token, getKey, {
    issuer: 'https://auth.example.com',
    audience: 'https://api.example.com',
    algorithms: ['RS256'],     // Explicitly whitelist algorithms
    clockTolerance: 30,        // 30 second clock skew tolerance
  }, (err, decoded) => {
    if (err) {
      const status = err.name === 'TokenExpiredError' ? 401 : 403;
      return res.status(status).json({ error: err.message });
    }
    req.user = decoded;
    next();
  });
}
```

### Validation Checklist

1. Parse header -- extract `alg` and `kid`
2. Reject `alg: "none"` -- always require a valid algorithm
3. Fetch public key by `kid` from JWKS (cached)
4. Verify signature using the public key
5. Check `exp` > now (with clock skew tolerance of 30-60s)
6. Check `nbf` <= now (if present)
7. Check `iss` matches expected issuer exactly
8. Check `aud` contains your service identifier
9. Check required scopes/roles for the specific endpoint
10. Extract `sub` for user identification

---

## JWK Rotation

### Rotation Strategy

```
1. Generate new key pair (kid = "key-2025-03")
2. Add new public key to JWKS endpoint (both old and new keys present)
3. Wait for JWKS cache TTL to expire across all services (~2x cache TTL)
4. Start signing new tokens with the new key
5. Wait for all old tokens to expire (max access token lifetime)
6. Remove old public key from JWKS endpoint
```

**Timeline:** With 10min JWKS cache and 15min access tokens, minimum rotation window is ~40 minutes. Use 24hr window for safety.

### JWKS Endpoint Format

Standard JSON Web Key Set at `/.well-known/jwks.json`: array of `keys` objects with `kty`, `kid`, `use: "sig"`, `alg`, and key-specific fields (`n`+`e` for RSA, `x`+`y` for EC). Include both current and previous keys during rotation overlap.

---

## Refresh Token Rotation

### Database Schema

```sql
CREATE TABLE refresh_tokens (
  token_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     BYTEA NOT NULL UNIQUE,          -- SHA-256 hash of the token
  family_id      UUID NOT NULL,                   -- groups all tokens in a rotation chain
  user_id        UUID NOT NULL REFERENCES users(id),
  client_id      TEXT NOT NULL,
  scopes         TEXT[],
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ,                     -- NULL = active
  replaced_by    UUID REFERENCES refresh_tokens(token_id)  -- chain tracking
);

CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
```

### Rotation Logic

```python
def rotate_refresh_token(old_token_value):
    old_hash = sha256(old_token_value)
    old_token = db.find_by_hash(old_hash)

    if old_token is None:
        raise InvalidTokenError("Token not found")

    if old_token.revoked_at is not None:
        # REUSE DETECTED -- revoke entire family
        db.revoke_family(old_token.family_id)
        alert_security_team(old_token.user_id, "refresh_token_reuse")
        raise SecurityError("Token reuse detected, family revoked")

    if old_token.expires_at < now():
        raise ExpiredTokenError("Refresh token expired")

    # Generate new token pair
    new_refresh_value = generate_secure_random(32)
    new_token = RefreshToken(
        token_hash=sha256(new_refresh_value),
        family_id=old_token.family_id,    # same family
        user_id=old_token.user_id,
        client_id=old_token.client_id,
        scopes=old_token.scopes,
        expires_at=now() + REFRESH_TOKEN_LIFETIME,
    )

    # Revoke old, insert new (atomic transaction)
    with db.transaction():
        db.revoke(old_token.token_id, replaced_by=new_token.token_id)
        db.insert(new_token)

    access_token = generate_access_token(old_token.user_id, old_token.scopes)

    return access_token, new_refresh_value
```

### Grace Period

Allow the old refresh token to work for 15-30s after rotation to handle network retries. If the revoked token is used within the grace period, return the same replacement tokens. Outside the grace period, treat as reuse and revoke the entire token family.

---

## Token Revocation

### Strategies

| Strategy | Latency | Complexity | Use When |
|----------|---------|-----------|----------|
| Short-lived tokens (no revocation) | Token lifetime | None | Access tokens < 5min |
| Token blocklist (Redis) | Near-instant | Low | Need immediate revocation |
| Token versioning (DB) | Per-request check | Medium | User-level revocation (logout all) |
| Event-driven invalidation | Seconds | High | Distributed systems |

### Redis Blocklist

```python
def revoke_token(token_jti, expires_at):
    ttl = expires_at - now()
    if ttl > 0:
        redis.setex(f"revoked:{token_jti}", ttl, "1")

def is_revoked(token_jti):
    return redis.exists(f"revoked:{token_jti}")
```

Key insight: blocklist entries only need to live until the token's natural expiration. Use Redis TTL to auto-cleanup.

### Logout All Devices

```sql
-- Add token_version to users table
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;

-- On "logout all devices": increment version
UPDATE users SET token_version = token_version + 1 WHERE id = $user_id;

-- Include version in JWT claims, validate on each request
-- If jwt.token_version != user.token_version -> reject
```

---

## Token Storage Strategies

| Platform | Access Token | Refresh Token |
|----------|-------------|---------------|
| Server-rendered web | Server-side session (Redis/DB) | Server-side session; `httpOnly+Secure+SameSite=Lax` cookie |
| SPA | In-memory (closure/module scope) | `httpOnly+Secure+SameSite=Strict` cookie via BFF |
| Mobile | Keychain (iOS) / Keystore (Android) | Keychain / Keystore |

### Backend-for-Frontend (BFF) Pattern

BFF stores tokens server-side, sets httpOnly session cookie to browser, proxies API calls with access token. Most secure for SPAs: tokens never reach the browser.

---

## WebAuthn Credential Storage

### Database Schema

```sql
CREATE TABLE webauthn_credentials (
  credential_id     BYTEA PRIMARY KEY,          -- raw credential ID from authenticator
  user_id           UUID NOT NULL REFERENCES users(id),
  public_key        BYTEA NOT NULL,             -- COSE-encoded public key
  public_key_alg    INTEGER NOT NULL,           -- COSE algorithm identifier (-7=ES256, -257=RS256)
  sign_count        BIGINT NOT NULL DEFAULT 0,  -- signature counter for clone detection
  transports        TEXT[],                     -- ['internal', 'hybrid', 'usb', 'ble', 'nfc']
  is_discoverable   BOOLEAN NOT NULL DEFAULT FALSE,  -- resident key / passkey
  aaguid            BYTEA,                      -- authenticator model identifier
  device_name       TEXT,                       -- user-friendly label ("MacBook Touch ID")
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ                 -- NULL = active
);

CREATE INDEX idx_webauthn_user ON webauthn_credentials(user_id);
```

### Registration and Authentication Flow

Use a WebAuthn library (`py_webauthn`, `@simplewebauthn/server`) -- never implement crypto directly.

**Registration:** `generate_registration_options` (with challenge, rp_id, user_id, exclude existing creds) -> client creates credential -> `verify_registration_response` (validate challenge, origin, rp_id) -> store credential_id, public_key, sign_count.

**Authentication:** `generate_authentication_options` (with challenge, allowed credentials or empty for passkey autofill) -> client signs challenge -> `verify_authentication_response` (validate challenge, origin, rp_id, sign_count) -> update sign_count and last_used_at.

### Sign Count and Clone Detection

| Scenario | Action |
|----------|--------|
| `received > stored` | OK, update stored count |
| `received <= stored` (stored > 0) | Alert: possible cloned authenticator |
| `received == 0` | Counters not supported (cloud-synced passkeys: iCloud, Google) -- ignore |

### Credential Management Rules

Allow multiple credentials per user (platform + roaming). Display with device name, type, last used. Revoke by setting `revoked_at` (don't delete -- audit trail). Require minimum 2 credentials or recovery codes before passkey-only auth. Re-authenticate before adding/removing credentials (step-up auth).

---

## SAML Assertion Handling

### Validation Checklist

Use a vetted SAML library (`onelogin-saml2`, `saml2-js`) -- never hand-parse XML signatures.

1. **XML signature** -- verify using IdP's X.509 certificate from metadata
2. **Issuer** -- must match expected IdP entity ID
3. **Destination** -- must match your ACS URL exactly
4. **Audience** -- must contain your SP entity ID
5. **Time validity** -- `NotBefore` <= now <= `NotOnOrAfter` (with 60-120s clock skew)
6. **InResponseTo** -- must match your original `AuthnRequest` ID
7. **Replay prevention** -- cache assertion IDs with TTL, reject duplicates
8. **Status code** -- must be `urn:oasis:names:tc:SAML:2.0:status:Success`

### Security Hardening

Set `strict: True`, `wantAssertionsSigned: True`, `wantMessagesSigned: True`, `rejectDeprecatedAlgorithm: True` (reject SHA-1), `authnRequestsSigned: True`.

### XML Security Pitfalls

| Attack | Prevention |
|--------|------------|
| XML Signature Wrapping | Use vetted SAML library; never hand-parse signatures |
| XXE | Disable DTD processing and external entities |
| Certificate Substitution | Validate against pre-configured IdP cert, ignore in-response certs |
| Replay Attack | Cache assertion IDs with TTL, reject duplicates |

### SAML-to-OIDC Bridge

For greenfield apps needing enterprise SAML: use Auth0/Keycloak as a bridge. Your app only implements OIDC; the bridge handles SAML complexity. Add new enterprise IdPs by configuring the bridge, not changing app code.

---

## API Key Patterns

### Key Generation and Storage

```python
import hashlib, secrets

def generate_api_key(prefix="sk_live"):
    raw_key = secrets.token_urlsafe(32)
    full_key = f"{prefix}_{raw_key}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()

    # Store hash + metadata, NEVER the raw key
    db.insert_api_key(
        key_hash=key_hash,
        prefix=prefix,
        last_four=raw_key[-4:],      # for display: sk_live_****abcd
        scopes=["read"],
        expires_at=now() + timedelta(days=90),
    )

    # Return raw key to user ONCE -- they must save it
    return full_key

def validate_api_key(provided_key):
    key_hash = hashlib.sha256(provided_key.encode()).hexdigest()
    api_key = db.find_by_hash(key_hash)

    if not api_key or api_key.revoked or api_key.expires_at < now():
        return None
    return api_key
```

---

## Session Token Patterns

### Secure Session Cookie Settings

| Setting | Value | Why |
|---------|-------|-----|
| `name` | `__Host-session` | `__Host-` prefix enforces Secure + no Domain |
| `httpOnly` | `true` | No JavaScript access |
| `secure` | `true` | HTTPS only |
| `sameSite` | `lax` | CSRF protection |
| `maxAge` | 24h | Session duration |
| `store` | Redis/DB | Server-side storage |

**Session fixation prevention:** Always call `req.session.regenerate()` after authentication state changes (login, privilege escalation).
