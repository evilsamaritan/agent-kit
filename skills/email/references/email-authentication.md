# Email Authentication & Bulk Sender Compliance

Deep dive into email authentication protocols, BIMI implementation, and bulk sender requirements.

---

## DMARC Rollout Strategy

```
Week 1-2: p=none    (monitor only, collect reports via rua=)
Week 3-4: p=quarantine; pct=10  (quarantine 10% of failures)
Week 5-6: p=quarantine; pct=50  (increase to 50%)
Week 7-8: p=quarantine; pct=100 (all failures quarantined)
Week 9+:  p=reject; pct=100    (reject all failures — required for BIMI)
```

### DMARC Record Anatomy

```
v=DMARC1;              Required — version
p=reject;              Policy: none | quarantine | reject
sp=reject;             Subdomain policy (inherits p= if omitted)
rua=mailto:dmarc-agg@example.com;   Aggregate reports (daily XML)
ruf=mailto:dmarc-forensic@example.com;  Forensic reports (per-failure)
pct=100;               Percentage of mail to apply policy (default 100)
adkim=s;               DKIM alignment: s=strict, r=relaxed (default)
aspf=s;                SPF alignment: s=strict, r=relaxed (default)
```

### Alignment Explained

```
From: user@example.com
DKIM d=example.com           → aligned (strict or relaxed)
DKIM d=mail.example.com      → aligned (relaxed only)
DKIM d=otherdomain.com       → NOT aligned

SPF return-path: bounce@example.com    → aligned (strict or relaxed)
SPF return-path: bounce@mail.example.com → aligned (relaxed only)
```

**Critical:** Google requires DKIM alignment specifically for bulk senders. SPF alignment alone is not sufficient.

---

## BIMI Implementation

### Prerequisites Checklist

- [ ] DMARC at `p=quarantine` or `p=reject` with `pct=100`
- [ ] SPF and DKIM both passing and aligned
- [ ] Logo in SVG Tiny PS format (not standard SVG)
- [ ] VMC or CMC certificate from authorized CA
- [ ] Certificate and logo hosted via HTTPS

### DNS Record

```
default._bimi.example.com.  TXT  "v=BIMI1; l=https://example.com/brand/logo.svg; a=https://example.com/brand/cert.pem"
```

### SVG Tiny PS Requirements

- Must be SVG Tiny Portable/Secure profile
- Square aspect ratio (1:1)
- No scripts, external references, or interactivity
- Centered design that works at 16x16px through 128x128px
- Background color fills the entire viewBox (no transparency)

### Provider-Specific BIMI Support

| Provider | Certificate needed | Logo display | Checkmark |
|----------|-------------------|--------------|-----------|
| Gmail | VMC or CMC | Yes | VMC only (blue checkmark) |
| Yahoo | None (optional VMC) | Yes | No |
| Apple Mail | VMC (via Apple Business Register) | Yes | No |
| Fastmail | None | Yes | No |

---

## Bulk Sender Authentication Details

### Google (Gmail) Requirements

Enforcement started Feb 2024, tightened Nov 2025.

**All senders:**
- SPF or DKIM authentication
- Valid forward/reverse DNS (PTR records)
- TLS for transmitting email
- Spam rate < 0.3% in Postmaster Tools

**Bulk senders (5,000+ emails/day to Gmail):**
- SPF AND DKIM required (both, not either/or)
- DMARC with at least `p=none`
- DKIM alignment with From domain
- One-click unsubscribe via `List-Unsubscribe-Post` header
- Unsubscribe processed within 2 days

### Microsoft (Outlook) Requirements

Enforced May 2025. Immediate rejection for non-compliance.

- SPF must pass for sending domain
- DKIM must pass for sending domain
- DMARC at least `p=none`, aligned with SPF or DKIM
- Functional unsubscribe link
- Valid From/Reply-To addresses
- Applies to: outlook.com, hotmail.com, live.com

### Yahoo Requirements

Enforced Feb 2024.

- SPF or DKIM (both recommended)
- DMARC at least `p=none`
- One-click unsubscribe
- Spam complaint rate < 0.3%

---

## One-Click Unsubscribe Implementation

### Required Headers

```
List-Unsubscribe: <https://example.com/unsubscribe?id=TOKEN>, <mailto:unsubscribe@example.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

### Handler

```typescript
// POST /unsubscribe — handles one-click unsubscribe
async function handleOneClickUnsubscribe(req: Request) {
  // Verify the List-Unsubscribe=One-Click POST body
  if (req.body['List-Unsubscribe'] !== 'One-Click') {
    return { status: 400 };
  }

  const token = req.query.id;
  const subscription = await verifyUnsubscribeToken(token);

  if (subscription) {
    await unsubscribeUser(subscription.userId, subscription.listId);
    await auditLog('unsubscribe', { userId: subscription.userId, method: 'one-click' });
  }

  return { status: 200 }; // must return 200 even if token invalid
}
```

---

## Authentication Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| SPF softfail | Missing `include:` for sending provider | Add provider's SPF include to DNS |
| SPF permerror | > 10 DNS lookups in SPF chain | Flatten SPF record, reduce includes |
| DKIM fail | Key rotation without DNS update | Update DKIM DNS record with new public key |
| DMARC fail (alignment) | Return-path domain differs from From domain | Align bounce domain with From domain |
| Gmail rejecting bulk mail | Missing DKIM (SPF-only) | Add DKIM signing via provider |
| BIMI logo not showing | DMARC not at enforcement | Move DMARC to `p=quarantine` or `p=reject` |
| Emails going to spam | No authentication, high complaint rate | Fix auth, monitor complaint rate via Postmaster Tools |

### Useful Diagnostic Tools

```bash
# Check SPF record
dig TXT example.com | grep spf

# Check DKIM record
dig TXT selector._domainkey.example.com

# Check DMARC record
dig TXT _dmarc.example.com

# Check BIMI record
dig TXT default._bimi.example.com

# Check MX records
dig MX example.com
```

Online tools: Google Postmaster Tools, MXToolbox, mail-tester.com, DMARC Analyzer.

---

## ARC (Authenticated Received Chain)

RFC 8617. Preserves authentication results when email passes through intermediaries (mailing lists, forwarding services, relays).

### When You Need ARC

- You operate a mailing list that modifies messages (adds footer, changes subject)
- You run an email forwarding service
- You relay email through intermediary servers

If you only send direct email to recipients, ARC is handled by intermediaries — no action needed on your side.

### ARC Header Set (per hop)

```
ARC-Authentication-Results: i=1; mx.example.com;
    dkim=pass header.d=sender.com;
    spf=pass smtp.mailfrom=sender.com;
    dmarc=pass header.from=sender.com
ARC-Message-Signature: i=1; a=rsa-sha256; d=example.com; s=arc;
    h=from:to:subject:date; b=<signature>
ARC-Seal: i=1; a=rsa-sha256; d=example.com; s=arc;
    cv=none; b=<seal-signature>
```

`i=` is the instance number (increments per hop). `cv=` is chain validation: `none` (first hop), `pass`, or `fail`.

### How Receivers Use ARC

When a DMARC check fails, the receiving server checks the ARC chain:
1. Verify ARC-Seal signatures (chain integrity)
2. Check ARC-Authentication-Results from trusted intermediaries
3. If the original authentication passed and the chain is valid, override the DMARC failure

Google, Microsoft, and Yahoo all evaluate ARC chains when making delivery decisions.

### Diagnostic Commands

```bash
# Check if forwarded email has ARC headers
# Look for ARC-Seal, ARC-Message-Signature, ARC-Authentication-Results
# in the raw email headers (View Original in Gmail)
```
