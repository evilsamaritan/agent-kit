# OAuth2 & OIDC Patterns

Practical patterns for implementing OAuth2 and OpenID Connect flows.

## Contents

- [Authorization Code + PKCE Flow](#authorization-code--pkce-flow)
- [Client Credentials Flow](#client-credentials-flow)
- [Device Authorization Flow](#device-authorization-flow)
- [OIDC Discovery and Configuration](#oidc-discovery-and-configuration)
- [Provider Setup Patterns](#provider-setup-patterns)
- [Token Exchange Patterns](#token-exchange-patterns)
- [Security Considerations](#security-considerations)

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
- Store tokens securely (httpOnly cookie or secure memory)

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

---

## Provider Setup Patterns

### Auth0
```
Domain:     https://YOUR_TENANT.auth0.com
Authorize:  https://YOUR_TENANT.auth0.com/authorize
Token:      https://YOUR_TENANT.auth0.com/oauth/token
JWKS:       https://YOUR_TENANT.auth0.com/.well-known/jwks.json
Audience:   https://api.example.com (custom API identifier)
```

### Google
```
Discovery:  https://accounts.google.com/.well-known/openid-configuration
Authorize:  https://accounts.google.com/o/oauth2/v2/auth
Token:      https://oauth2.googleapis.com/token
Scopes:     openid email profile
```

### GitHub (OAuth2, not OIDC)
```
Authorize:  https://github.com/login/oauth/authorize
Token:      https://github.com/login/oauth/access_token
User API:   https://api.github.com/user
Note:       Not OIDC-compliant, no ID token, no discovery
```

### Keycloak (self-hosted)
```
Discovery:  https://keycloak.example.com/realms/REALM/.well-known/openid-configuration
Authorize:  https://keycloak.example.com/realms/REALM/protocol/openid-connect/auth
Token:      https://keycloak.example.com/realms/REALM/protocol/openid-connect/token
```

---

## Token Exchange Patterns

### Silent Refresh (SPA)
```javascript
// Hidden iframe approach (being deprecated by browsers)
const iframe = document.createElement('iframe');
iframe.src = `${authUrl}/authorize?prompt=none&...`;

// Preferred: Refresh token rotation
async function refreshTokens() {
  const response = await fetch('/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: storedRefreshToken,
      client_id: CLIENT_ID,
    }),
  });
  const tokens = await response.json();
  // Store new access_token AND new refresh_token
  // Old refresh_token is now invalidated
}
```

### Backend Token Exchange
```javascript
// Exchange authorization code (Node.js / Express callback)
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. Validate state
  if (state !== req.session.oauthState) {
    return res.status(403).send('Invalid state');
  }

  // 2. Exchange code for tokens
  const tokenResponse = await fetch(`${ISSUER}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,       // confidential client
      code_verifier: req.session.codeVerifier, // if PKCE
    }),
  });

  const tokens = await tokenResponse.json();

  // 3. Validate ID token (verify signature, iss, aud, exp, nonce)
  const claims = await verifyIdToken(tokens.id_token);

  // 4. Create session
  req.session.userId = claims.sub;
  req.session.accessToken = tokens.access_token;
  req.session.refreshToken = tokens.refresh_token;

  res.redirect('/dashboard');
});
```

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
| In-memory variable | Yes | Yes | Best for SPAs (lost on refresh) |
| localStorage | No | Yes | Never for tokens |
| sessionStorage | No | Yes | Never for tokens |

Use httpOnly + Secure + SameSite=Lax cookies. For SPAs that need persistence across refreshes, use refresh token rotation with httpOnly cookie for the refresh token and in-memory for the access token.
