# Credential Storage

Storing and checking credentials the application owns: passwords, reset and verification tokens, and linked identities. Hashing parameters follow the OWASP Password Storage Cheat Sheet and policy follows NIST SP 800-63B-4 (final, July 2025); both are revised over time, so re-read them when changing targets.

## Contents

- [Password Hashing](#password-hashing)
- [Password Policy](#password-policy)
- [Login Throttling and Enumeration](#login-throttling-and-enumeration)
- [Reset and Verification Tokens](#reset-and-verification-tokens)
- [Account Linking](#account-linking)
- [Migrating Legacy Hashes](#migrating-legacy-hashes)

---

## Password Hashing

| Algorithm | Minimum parameters (OWASP cheat sheet) | Notes |
|-----------|--------------------------------------------|-------|
| Argon2id | m = 19 MiB, t = 2, p = 1 (or more memory with fewer iterations) | Preferred |
| scrypt | N = 2^17 (128 MiB), r = 8, p = 1 | When Argon2id is unavailable |
| bcrypt | work factor ≥ 10 | Input truncated at 72 bytes; reject or pre-handle longer input deliberately |
| PBKDF2-HMAC-SHA256 | 600,000 iterations | When FIPS-140 validated implementations are required |

- Use the platform's maintained password-hashing library; it generates the salt and encodes algorithm and parameters into the stored string (`$argon2id$v=19$m=...`).
- Tune parameters so one hash takes a fraction of a second on production hardware; protect the login endpoint from being used to exhaust CPU or memory (throttling below).
- A pepper (server-side secret mixed in, kept outside the database) is optional defence in depth; plan its rotation before adopting it.
- Rehash on successful login when the stored parameters are below the current target.
- Compare with the library's verify function; never compare hash strings yourself.

---

## Password Policy

NIST SP 800-63B-4 direction:

- Minimum length 15 when the password is the only factor, 8 when used with MFA; permit at least 64 characters.
- Accept all printable characters, including spaces and Unicode (normalize consistently).
- No composition rules (digit, symbol, uppercase) and no forced periodic change; force a change only on evidence of compromise.
- Check new passwords against a blocklist of commonly used, expected, or compromised values (breach corpora, dictionary words, service name, username). A k-anonymity range API lets you check breach lists without sending the password.
- Allow password managers and autofill (required) and paste (recommended).

---

## Login Throttling and Enumeration

- Throttle per account (slows guessing against one user) and per source (slows spraying across many users); add progressive delays rather than hard lockouts that attackers can use to lock users out.
- Same response, status, and approximate timing for unknown user and wrong password; hash a dummy password when the user does not exist.
- Registration and reset: respond "if an account exists, we sent an email" in both cases; send the notice to the existing account instead of revealing it.
- Log failed attempts with the account identifier and source for detection; never log the submitted password.

---

## Reset and Verification Tokens

```
request reset(email):
  user = findByEmail(email)
  if user:
    token = random(32 bytes), urlsafe
    store { userId, tokenHash: sha256(token), expiresAt: now + 30 min, usedAt: null }
    email link containing token
  respond identically either way

complete reset(token, newPassword):
  row = UPDATE reset_tokens SET used_at = now()
        WHERE token_hash = sha256(token) AND used_at IS NULL AND expires_at > now()
        RETURNING user_id
  if no row → generic error
  set new password hash; revoke all sessions and refresh tokens; invalidate other reset tokens
  notify the user that the password changed
```

- Single-use is enforced by the conditional update, not by a read followed by a write.
- Email verification tokens follow the same shape; the email is not trusted (for login, linking, or authorization) until verified.
- Links point to your own fixed domain; never build them from the request's `Host` header.

---

## Account Linking

Pre-account takeover: an attacker registers with the victim's email (unverified) before the victim signs in with a social provider; automatic linking by email hands the attacker the account, or the reverse.

- Link a federated identity to an existing account only when both sides have verified the email and the user re-authenticates to the existing account.
- Trust an IdP's `email_verified` claim only from providers you have decided to trust for that domain.
- Key federated identities by `(issuer, sub)`, never by email; emails change and are reassigned.
- Unverified accounts expire, and registering over an unverified account resets its credentials.

---

## Migrating Legacy Hashes

1. Mark each stored hash with its algorithm.
2. On successful login with a legacy hash, rehash with the current algorithm and replace it.
3. For accounts that never log in, wrap the legacy hash (`argon2id(legacyHash)`) so weak hashes do not stay at rest, and verify by applying both steps.
4. After a set period, force a reset for remaining legacy accounts.
