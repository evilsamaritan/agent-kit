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
      // Every failed validation (expired, bad signature, wrong audience) is 401 — RFC 6750
      log.info({ reason: err.name, requestId: req.id }, 'token rejected');
      res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
      return res.status(401).json({ error: 'invalid_token' });   // generic body, no library message
    }
    req.user = decoded;
    next();
  });
}
// 403 (with error="insufficient_scope") is returned later, by the authorization check.
```

The sample uses one Node library as an example; the same options exist in every JOSE library.

### Validation Checklist

1. Pin the accepted algorithms and key type in configuration; reject any token whose `alg` is not on the list (including `none`) -- never let the header choose
2. Select the key by `kid` from the issuer's JWKS (cached; refetch once on unknown `kid`, rate-limited)
3. Verify the signature
4. Check `exp` > now and `nbf` <= now, with 30-60s clock skew
5. Check `iss` matches the expected issuer exactly
6. Check `aud` contains this service's identifier
7. Check the token type: access tokens in the RFC 9068 profile carry `typ: at+jwt`; never accept an ID token as an access token
8. Check required scopes or claims for the operation
9. Use `sub` (with `iss`) as the caller identity

---

## JWK Rotation

### Rotation Strategy

```
1. Generate a new key pair with a new unique `kid`
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
  token_id          UUID PRIMARY KEY,
  token_hash        BYTEA NOT NULL UNIQUE,          -- SHA-256 of the token value
  family_id         UUID NOT NULL,                  -- one login = one family
  family_expires_at TIMESTAMPTZ NOT NULL,           -- absolute limit, fixed at login, never extended
  user_id           UUID NOT NULL REFERENCES users(id),
  client_id         TEXT NOT NULL,
  scopes            TEXT[] NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,           -- idle limit for this token
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,                    -- NULL = active
  replaced_by       UUID REFERENCES refresh_tokens(token_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);
```

### Rotation Logic

```python
GRACE = timedelta(seconds=20)

def rotate_refresh_token(presented: str):
    presented_hash = sha256(presented)
    reuse_detected = False
    with db.transaction():
        old = db.one("SELECT * FROM refresh_tokens WHERE token_hash = %s FOR UPDATE", presented_hash)
        if old is None:
            raise InvalidGrant()

        if old.revoked_at is not None:
            # Retry of a request that already rotated: within the grace window, hand back the
            # successor issued for it (re-issue a value for that same row, or return a cached response)
            if old.replaced_by and now() - old.revoked_at <= GRACE:
                return reissue_successor(old.replaced_by)
            db.execute("UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = %s AND revoked_at IS NULL", old.family_id)
            reuse_detected = True          # leave the block normally so the revocation commits
        elif old.expires_at <= now() or old.family_expires_at <= now():
            raise InvalidGrant()           # nothing written, so the rollback loses nothing
        else:
            new_value = random_token(32)
            new_id = uuid4()
            db.execute(
                "INSERT INTO refresh_tokens (token_id, token_hash, family_id, family_expires_at, user_id, client_id, scopes, expires_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                new_id, sha256(new_value), old.family_id, old.family_expires_at,
                old.user_id, old.client_id, old.scopes,
                min(now() + IDLE_LIFETIME, old.family_expires_at),     # sliding, capped by the absolute limit
            )
            updated = db.execute(
                "UPDATE refresh_tokens SET revoked_at = now(), replaced_by = %s WHERE token_id = %s AND revoked_at IS NULL",
                new_id, old.token_id,
            )
            if updated.rowcount != 1:
                raise ConcurrentRotation()   # transaction rolls back; caller retries once

    if reuse_detected:
        security_event(old.user_id, "refresh_token_reuse")
        raise InvalidGrant()

    return issue_access_token(old.user_id, old.scopes), new_value
```

- The row lock (or the conditional `UPDATE ... WHERE revoked_at IS NULL` checked for one affected row) makes two concurrent refreshes produce one winner.
- The successor is inserted before the old row points to it, so the foreign key holds (and the constraint is deferred as a second guard).
- `family_expires_at` is copied, never recomputed: rotation slides the idle limit but not the absolute one.
- The family revocation must commit: raising inside the transaction rolls it back and leaves the stolen family active. Record the outcome, leave the block, then report and reject.

### Grace Period

A client that lost the response to a successful refresh retries with the old token. Within a short window (15-30s) after rotation, treat that as a retry and return the successor issued for it; because only hashes are stored, either cache the successful response for the window, keyed by the old token hash, or mint a new value for the successor row. Outside the window, reuse means theft: revoke the family.

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
| Browser app with a BFF (default) | Held by the BFF server | Held by the BFF server; browser gets only a session cookie |
| SPA without a BFF (fallback) | In memory only | Rotated on every use with reuse detection; sender-constrained (DPoP) where supported; never web storage |
| Mobile | Keychain (iOS) / Keystore (Android) | Keychain / Keystore |

### Backend-for-Frontend (BFF) Pattern

The BFF runs the OAuth flow as a confidential client, keeps tokens server-side, gives the browser an `__Host-` httpOnly session cookie, and proxies API calls with the access token. Tokens never reach the browser, so XSS cannot exfiltrate them (it can still act within the session while the page is open). Cookie auth requires CSRF protection: `SameSite` plus a CSRF token or an `Origin` check on state-changing requests.

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

For greenfield apps needing enterprise SAML: put a broker IdP (hosted or self-hosted) in front that accepts SAML and issues OIDC. The app implements only OIDC; new enterprise IdPs are configured in the broker, not in app code.

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
| `sameSite` | `lax` (or `strict`) | Reduces CSRF; still add a CSRF token or Origin check for state-changing requests |
| `maxAge` | 24h | Session duration |
| `store` | Redis/DB | Server-side storage |

**Session fixation prevention:** Always call `req.session.regenerate()` after authentication state changes (login, privilege escalation).
