# OAuth2 & OIDC Patterns

Practical patterns for implementing OAuth2 and OpenID Connect flows.

## Contents

- [Authorization Code + PKCE Flow](#authorization-code--pkce-flow)
- [Client Credentials Flow](#client-credentials-flow)
- [Device Authorization Flow](#device-authorization-flow)
- [OIDC Discovery and Configuration](#oidc-discovery-and-configuration)
- [Callback Handling](#callback-handling)
- [Refreshing Tokens in Browser Apps](#refreshing-tokens-in-browser-apps)
- [DPoP](#dpop)
- [Security Considerations](#security-considerations)
- [Standards Status](#standards-status)

---

## Authorization Code + PKCE Flow

The recommended flow for SPAs, mobile apps, and any public client.

```
1. Client generates code_verifier (random 43-128 chars)
2. Client computes code_challenge = BASE64URL(SHA256(code_verifier))
3. Client redirects to:
   GET /authorize?
     response_type=code&
     client_id=CLIENT_ID&
     redirect_uri=https://app.example.com/callback&
     scope=openid profile email&
     state=RANDOM_STATE&
     nonce=RANDOM_NONCE&
     code_challenge=CODE_CHALLENGE&
     code_challenge_method=S256

4. User authenticates and consents
5. Provider redirects to callback with code:
   GET /callback?code=AUTH_CODE&state=RANDOM_STATE

6. Client exchanges code for tokens:
   POST /token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code&
   code=AUTH_CODE&
   redirect_uri=https://app.example.com/callback&
   client_id=CLIENT_ID&
   code_verifier=CODE_VERIFIER

7. Provider returns:
   { "access_token": "...", "id_token": "...", "refresh_token": "...",
     "token_type": "Bearer", "expires_in": 3600 }
```

**Critical checks:**
- Validate `state` matches what you sent (prevents CSRF)
- Verify `id_token` signature, iss, aud, exp, nonce
- Store tokens server-side (BFF) or, for a SPA without a BFF, the access token in memory only

---

## Client Credentials Flow

Machine-to-machine authentication without user involvement.

```
POST /token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic BASE64(client_id:client_secret)

grant_type=client_credentials&
scope=api.read api.write
```

**When to use:** service-to-service calls, cron jobs, backend integrations.

**Security:**
- Rotate client secrets on a schedule (90 days recommended)
- Use mTLS client authentication for highest security
- Scope tokens to minimum required permissions
- Monitor for unusual access patterns

---

## Device Authorization Flow

For devices without a browser (smart TVs, CLI tools, IoT).

```
1. Device requests authorization:
   POST /device/code
   client_id=DEVICE_CLIENT_ID&scope=openid profile

2. Provider returns:
   { "device_code": "...", "user_code": "WDJB-MJHT",
     "verification_uri": "https://auth.example.com/device",
     "expires_in": 900, "interval": 5 }

3. Device displays: "Go to https://auth.example.com/device and enter code WDJB-MJHT"

4. Device polls token endpoint every `interval` seconds:
   POST /token
   grant_type=urn:ietf:params:oauth:grant-type:device_code&
   device_code=DEVICE_CODE&client_id=DEVICE_CLIENT_ID

5. Responses during polling:
   - { "error": "authorization_pending" }  -> keep polling
   - { "error": "slow_down" }              -> increase interval by 5s
   - { "error": "expired_token" }          -> restart flow
   - { "access_token": "...", ... }        -> success
```

---

## OIDC Discovery and Configuration

Every OIDC provider exposes a discovery document:

```
GET /.well-known/openid-configuration

{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "userinfo_endpoint": "https://auth.example.com/userinfo",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "scopes_supported": ["openid", "profile", "email"],
  "response_types_supported": ["code"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "subject_types_supported": ["public"]
}
```

**Cache this document** (typically 24hr TTL). Fetch JWKS from `jwks_uri` and cache with rotation awareness.

Read every endpoint (`authorization_endpoint`, `token_endpoint`, `jwks_uri`, `end_session_endpoint`) from the discovery document; never hard-code them per provider. Some providers implement plain OAuth 2.0 without OIDC (no ID token, no discovery): there, identity comes from a provider API call with the access token, and the stable key is the provider's numeric user id, not the email.

---

## Callback Handling

```javascript
// Confidential client (server or BFF) — Express-style example
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const pending = req.session.oauth;                 // { state, nonce, codeVerifier, returnTo }
  delete req.session.oauth;                          // single use

  if (!pending || typeof state !== 'string' || !constantTimeEqual(state, pending.state)) {
    return res.status(400).send('Invalid login attempt');
  }

  const tokens = await exchangeCode({                // token_endpoint from discovery
    code, redirectUri: REDIRECT_URI, codeVerifier: pending.codeVerifier,
    clientAuth: CLIENT_AUTH,                         // client secret, private_key_jwt, or mTLS
  });

  const claims = await verifyIdToken(tokens.id_token, {
    issuer: ISSUER, audience: CLIENT_ID, nonce: pending.nonce,   // signature, iss, aud, exp, nonce
  });

  await regenerateSession(req);                      // new session id: prevents session fixation
  req.session.userKey = `${claims.iss}|${claims.sub}`;
  req.session.tokens = { access: tokens.access_token, refresh: tokens.refresh_token };
  res.redirect(safeReturnPath(pending.returnTo));    // only same-site relative paths
});
```

---

## Refreshing Tokens in Browser Apps

- **With a BFF (default):** the BFF refreshes server-side when the access token is near expiry; the browser only sees its session cookie. No refresh token or access token in JavaScript.
- **SPA without a BFF (fallback):** the access token stays in memory; the refresh token is rotated on every use with reuse detection and should be sender-constrained (DPoP) where the authorization server supports it. It is never written to web storage. Hidden-iframe silent renew (`prompt=none`) depends on third-party cookies and fails in browsers that block them.

---

## DPoP

Sender-constrains tokens (RFC 9449): the client holds a key pair and proves possession on each request.

```
Token request:  POST /token        + DPoP: <proof JWT: jti, htm, htu, iat, public key in header>
API call:       GET /resource      + Authorization: DPoP <access token> + DPoP: <fresh proof with ath = hash(access token)>
```

- Fresh proof per request (unique `jti`), bound to method (`htm`) and URL (`htu`).
- The server verifies the proof signature, checks `jti` replay within a window, `iat` freshness, and that the key thumbprint matches the token's `cnf.jkt`.
- Servers may require a server-provided `nonce` in proofs; clients retry with the `DPoP-Nonce` they receive.
- mTLS-bound tokens (RFC 8705) are the alternative for confidential clients that already use client certificates.

---

## Security Considerations

### State Parameter
- Must be cryptographically random, at least 32 bytes
- Bind to the user's session (store in session before redirect)
- Validate exact match on callback
- Prevents CSRF attacks against the OAuth flow

### Redirect URI Validation
- Register exact redirect URIs with the provider -- no wildcards
- Validate redirect URI on callback matches registered URI
- Never allow open redirects in callback handlers

### PKCE Best Practices
- `code_verifier`: 43-128 characters, unreserved URI characters
- Always use S256 method (not plain)
- Generate fresh verifier for every authorization request
- Store verifier in session or secure memory, not in URL

### Nonce (OIDC)
- Include `nonce` parameter in authorization request
- Verify `nonce` claim in returned ID token matches
- Prevents ID token replay attacks

### Token Storage Security
| Storage | XSS Safe | CSRF Safe | Recommendation |
|---------|----------|-----------|----------------|
| httpOnly cookie | Yes | No (need SameSite) | Best for web apps |
| In-memory variable | Partly (XSS can still use it while the page runs) | Yes | SPA fallback for access tokens |
| localStorage | No | Yes | Never for tokens |
| sessionStorage | No | Yes | Never for tokens |

Default for browser apps: a BFF holding tokens server-side and an httpOnly + Secure + SameSite session cookie. Without a BFF: see [Refreshing Tokens in Browser Apps](#refreshing-tokens-in-browser-apps).

### State and Nonce Comparison
Compare `state` in constant time and delete it from the session after one use; verify `nonce` inside the validated ID token.

---

## Standards Status

- **RFC 9700** (BCP 240, January 2025) — OAuth 2.0 Security Best Current Practice: resource owner password grant MUST NOT be used, implicit grant SHOULD NOT be used, PKCE required for public clients; the baseline for new work.
- **OAuth 2.1** — an Internet-Draft, not an RFC (draft-ietf-oauth-v2-1, revision 16 in September 2026); it consolidates RFC 6749, PKCE, native and browser app guidance, RFC 9700, and bearer token usage. Many identity providers already enforce its requirements.
- **FAPI 2.0** Security Profile (final, February 2025) — requires sender-constrained access tokens via mTLS or DPoP, PAR (authorization requests without it are rejected), and PKCE with `S256` for high-assurance APIs.
- **FedCM** (browser-mediated federated sign-in) — experimental and implemented in Chromium-based browsers only (Chrome/Edge 108+); Firefox and Safari do not ship it. Use it as an enhancement where an IdP offers it; keep the redirect-based OIDC flow as the path that works everywhere.
- **Naming:** Azure AD is now Microsoft Entra ID.
