---
name: email
description: Build email systems — authentication (SPF/DKIM/DMARC/ARC/BIMI), deliverability, templates, bulk sender compliance. Use when setting up email auth, building templates, managing transactional vs marketing email, or meeting bulk sender rules. Do NOT use for real-time notifications (use realtime) or message queues (use message-queues).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Email — Delivery & Authentication Specialist

**Critical rules:** Never mix transactional and marketing on the same domain/IP. Always send email from background jobs, never inline. Both SPF AND DKIM must pass for bulk sender compliance.

---

## Email Authentication Stack

```
SPF   — "Who CAN send for this domain?"
         DNS TXT: v=spf1 include:_spf.provider.com -all
         Verifies sending server IP is authorized

DKIM  — "Was this email tampered with?"
         DNS TXT: selector._domainkey.example.com
         Cryptographic signature on email headers/body

DMARC — "What to do with failures?"
         DNS TXT: _dmarc.example.com
         v=DMARC1; p=reject; rua=mailto:dmarc@example.com
         Policy: none → quarantine → reject (gradual rollout)

ARC   — "Preserve auth through forwarding"
         Authenticated Received Chain (RFC 8617)
         Saves SPF/DKIM/DMARC results when email is forwarded
         Solves: mailing lists, auto-forwarding, relays breaking auth

BIMI  — "Show my brand logo in inbox"
         DNS TXT: default._bimi.example.com
         v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/cert.pem
         Requires DMARC at p=quarantine or p=reject (pct=100)
```

**Setup order:** SPF first → DKIM → DMARC (start `p=none`) → enforce DMARC → BIMI last.

### ARC — When Forwarding Breaks Authentication

ARC preserves authentication results across forwarding hops. Three header sets per hop:
- **ARC-Authentication-Results** — stores SPF/DKIM/DMARC results from previous server
- **ARC-Message-Signature** — signs message content (like DKIM)
- **ARC-Seal** — cryptographic seal ensuring previous ARC headers are untampered

If you run mailing lists or forwarding services → implement ARC. If you only send direct → ARC is handled by intermediaries, no action needed.

### BIMI Certificate Types

| Type | Requirement | Gmail | Apple Mail | Yahoo |
|------|-------------|-------|------------|-------|
| VMC | Registered trademark | Logo + blue checkmark | Logo (via Business Register) | Logo |
| CMC | 1 year public logo usage | Logo only (no checkmark) | Not yet supported | Logo |

VMC issuers: DigiCert, GlobalSign. Logo must be SVG Tiny PS format (square, no scripts, no transparency).

---

## Bulk Sender Compliance

Google, Yahoo, and Microsoft enforce authentication for senders of 5,000+ emails/day. Non-compliant mail is permanently rejected (not just filtered to spam).

| Requirement | Google | Yahoo | Microsoft |
|-------------|--------|-------|-----------|
| SPF | Required | Required | Required |
| DKIM | Required (both, not either/or) | Required | Required |
| DMARC | Required (`p=none` minimum) | Required | Required (`p=none` minimum) |
| One-click unsubscribe | Required (`List-Unsubscribe-Post`) | Required | Recommended |
| Spam complaint rate | < 0.3% (target < 0.1%) | < 0.3% | Low (unspecified) |
| Non-compliance | Permanent rejection | Delivery failure | Immediate rejection |
| TLS | Required | Required | Required |
| Valid PTR records | Required | Recommended | Recommended |

**Critical:** Both SPF and DKIM must pass AND align with the From domain. SPF-only or DKIM-only is insufficient.

---

## Transactional vs Marketing

| Aspect | Transactional | Marketing |
|--------|---------------|-----------|
| Purpose | Triggered by user action | Promotional, bulk |
| Examples | Password reset, receipt | Newsletter, promo |
| Sending domain | transactional.example.com | marketing.example.com |
| Unsubscribe | Not required (service emails) | Required (CAN-SPAM/GDPR) |
| Reputation impact | Low risk (expected by user) | High risk (spam complaints) |
| Send via | Dedicated IP or shared pool | Separate IP/subdomain |

**Critical rule:** Never mix transactional and marketing on the same domain/IP.

---

## Template Technology Decision

```
If team uses React → component-based framework (type-safe, reusable, preview)
If team uses Tailwind → Tailwind-to-email framework (familiar utilities, build step)
If no framework preference → MJML (simple markup, responsive by default)
If no build step allowed → provider-native templates (Handlebars/Liquid — vendor lock-in)
If maximum control needed → hand-coded HTML tables (most work, most control)
```

All approaches compile to inline-CSS HTML tables for client compatibility. Choose based on team familiarity, not feature lists.

---

## Deliverability Checklist

- [ ] SPF, DKIM, and DMARC configured and passing
- [ ] DMARC at `p=quarantine` or `p=reject` (not just `p=none`)
- [ ] Separate domains for transactional vs marketing
- [ ] One-click unsubscribe header (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`)
- [ ] IP warm-up plan (start low, ramp over 2-4 weeks)
- [ ] Bounce handling (remove hard bounces immediately)
- [ ] Complaint feedback loop (auto-unsubscribe on complaint)
- [ ] Spam complaint rate monitored (target < 0.1%)
- [ ] List hygiene (remove inactive subscribers)
- [ ] Plain text fallback for every HTML email
- [ ] BIMI record with VMC or CMC (optional, brand visibility)
- [ ] Accessibility: alt text, semantic HTML, 16px+ font, 4.5:1 contrast
- [ ] Dark mode tested (images, logos, buttons visible on dark backgrounds)
- [ ] Test with spam score checker before launch

---

## Email Accessibility

European Accessibility Act (EAA, effective June 2025) requires accessible emails for B2C businesses serving EU customers. WCAG 2.1 Level AA applies.

| Requirement | Rule | Implementation |
|-------------|------|----------------|
| Font size | Body text >= 16px | Inline `font-size: 16px` minimum |
| Color contrast | 4.5:1 for body, 3:1 for large text | Test both light and dark mode |
| Alt text | Every image has descriptive alt | `alt=""` for decorative images only |
| Semantic structure | Proper heading hierarchy | Use `<h1>`-`<h3>`, not styled `<p>` |
| Link clarity | Links describe destination | "Reset password" not "Click here" |
| Dark mode | Support `prefers-color-scheme` | Test inverted colors, provide fallbacks |
| Language | Declare `lang` attribute | `<html lang="en">` on root element |
| Table layout | Role="presentation" on layout tables | Prevents screen readers reading as data |

**Dark mode:** Use `@media (prefers-color-scheme: dark)` with soft dark backgrounds (#121212, not #000000). Test that logos and images remain visible on dark backgrounds — add white padding or use transparent PNGs with light borders.

---

## Testing Strategy

| Category | Purpose | Stage |
|----------|---------|-------|
| Local SMTP capture | Catch all emails locally (no real sends) | Development |
| Disposable inbox | Throwaway SMTP inbox for quick tests | Development |
| Rendering preview | Cross-client rendering comparison | Pre-production |
| Spam score checker | Authentication and content score | Pre-production |
| Provider sandbox | API testing without sending | Integration |
| DMARC report analyzer | Monitor authentication results | Production |
| Accessibility checker | Contrast, alt text, semantic HTML audit | Pre-production |

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Sending from main thread | Blocks request, no retry on failure | Background job queue with retry |
| No bounce handling | Damaged sender reputation, ISP blocking | Process bounces, remove hard bounces |
| Shared domain for transactional + marketing | Marketing complaints degrade transactional delivery | Separate subdomains |
| SPF without DKIM | Fails Google/Microsoft bulk sender rules | Configure both SPF and DKIM |
| DMARC stuck at `p=none` | Provides no protection, no BIMI eligibility | Graduate to `p=quarantine` then `p=reject` |
| No `List-Unsubscribe` header | Blocks delivery at Google/Yahoo | Add one-click unsubscribe header |
| HTML-only without text fallback | Spam filters flag, accessibility failure | Always include text/plain part |
| No dark mode support | Broken images, unreadable text for 80%+ of mobile users | Add `prefers-color-scheme: dark` styles |
| Images without alt text | Screen reader users get no content, EAA non-compliance | Add descriptive alt text to all content images |
| No ARC on forwarding/mailing list | Forwarded emails fail DMARC, get rejected | Implement ARC signing on intermediary servers |

---

## Context Adaptation

### Backend
- Background email sending via job queue (never inline in request handler)
- Idempotency keys to prevent duplicate sends
- Webhook processing for bounces, complaints, delivery events
- Template rendering as a service (compile once, send many)

### Frontend / Templates
- Semantic HTML with role="presentation" on layout tables
- Dark mode support via `prefers-color-scheme` media query
- Alt text on all content images, `alt=""` on decorative images
- Minimum 16px body font, 4.5:1 contrast ratio
- Test across clients: Gmail, Outlook, Apple Mail, Yahoo, mobile

### Compliance
- CAN-SPAM: physical address in footer, unsubscribe link, honor opt-outs within 10 days
- GDPR: consent required for marketing email, record consent timestamp and source
- CASL (Canada): express consent required, implied consent expires after 2 years
- EAA (EU, June 2025): accessible emails required for B2C serving EU customers (WCAG 2.1 AA)
- Unsubscribe mechanisms must be functional and easy to use

---

## Related Knowledge

- **background-jobs** — email sending via job queues, retry strategies, dead letter handling
- **compliance** — GDPR consent for marketing email, CAN-SPAM, EAA accessibility, data retention
- **networking** — DNS record configuration (SPF, DKIM, DMARC, BIMI TXT records)
- **accessibility** — WCAG 2.1 AA for email templates, screen reader testing, contrast ratios
- **html-css** — email template markup, dark mode CSS, inline styles

---

## References

- [email-patterns.md](references/email-patterns.md) — Provider SDK setup, React Email templates, DNS configuration, bounce handling, background send patterns, IP warm-up
- [email-authentication.md](references/email-authentication.md) — DMARC rollout strategy, BIMI implementation, ARC forwarding, bulk sender compliance details, authentication troubleshooting

Load references when you need provider SDK code, DNS record examples, or authentication deep dives.
