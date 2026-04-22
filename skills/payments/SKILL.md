---
name: payments
description: Architect payment processing systems. Use when implementing payment lifecycle, webhooks, subscriptions, provider selection, PCI compliance, orchestration, or refunds. Do NOT use for general security (use security) or compliance frameworks (use compliance).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Payments — Payment Processing Architecture

## Hard Rules

- NEVER trust client-side payment confirmation. Always fulfill orders via server-side webhook/notification.
- NEVER process raw card numbers server-side. Use provider-hosted tokenization (SAQ A).
- ALWAYS use idempotency keys on every payment mutation (charge, refund, capture).
- ALWAYS verify webhook signatures before processing events.
- ALWAYS calculate prices server-side. Never accept amounts from the client.
- ALWAYS store monetary amounts as integers in smallest currency unit (cents, yen).

---

## Payment Lifecycle

```
tokenize → authorize → capture → settle → reconcile → refund
```

| Stage | What happens | Who owns it |
|-------|-------------|-------------|
| **Tokenize** | Card/account data replaced with opaque token | Provider SDK (client-side) |
| **Authorize** | Issuer approves amount, places hold on funds | Gateway → card network → issuer |
| **Capture** | Merchant claims authorized funds (immediate or delayed) | Merchant backend → gateway |
| **Settle** | Funds transfer from issuer → acquirer → merchant | Acquirer / processor |
| **Reconcile** | Match provider records against local ledger | Merchant (daily batch job) |
| **Refund** | Reverse full or partial capture back to customer | Merchant backend → gateway → issuer |

---

## Choosing a payment path

Pick path by business need, not by provider brand:

- **One-time card checkout, global** → Card processor with hosted fields (keeps PCI scope low).
- **Subscriptions** → Platform with native billing + invoicing + dunning.
- **Marketplace / payouts to merchants** → Platform with Connect / multi-party flows.
- **Regional coverage (LATAM / APAC / India)** → Local aggregator or orchestrator (see `references/provider-comparison.md`).
- **SaaS, merchant-of-record needed** → MoR providers handle sales tax globally.
- **Crypto / stablecoins** → On-chain processor.

For concrete provider short-lists per path, see [provider-comparison.md](references/provider-comparison.md).

---

## Payment Orchestration

```
When do you need orchestration?
├── Single provider, single region → Direct integration (no orchestrator)
├── 2+ providers OR multi-region OR high volume?
│   ├── Want to build in-house? → Provider adapter pattern (see references/)
│   └── Want managed solution? → Orchestration platform
└── Need smart routing + cascading failover? → Orchestration layer required
```

**Orchestration layer** sits between your application and multiple PSPs:
- **Smart routing** — selects optimal provider per transaction based on cost, geography, currency, card BIN, and real-time success rates
- **Cascading failover** — if primary PSP declines/errors, automatically retries through secondary/tertiary provider without restarting user flow
- **Unified reporting** — single API, single reconciliation pipeline across all providers
- **A/B testing** — route traffic splits to compare provider performance

Implement via provider adapter pattern (in-house) or dedicated orchestration platforms for complex multi-PSP setups.

---

## SCA and 3DS2

**SCA (Strong Customer Authentication)** — required by PSD2 (EU/UK) for most online card payments. Two of: knowledge (PIN), possession (device), inherence (biometric).

**3DS2 (EMV 3DS)** — technical protocol that carries SCA. Default path: frictionless flow when issuer's risk engine approves; challenge flow otherwise.

Key rules:
- **Never bypass 3DS2 on EU/UK cards** unless a valid SCA exemption applies (low-value ≤€30, TRA — transaction risk analysis, MIT — merchant-initiated, corporate cards). Exemptions must be passed explicitly to the acquirer.
- **Liability shift** — successful 3DS2 authentication shifts fraud liability from merchant to issuer (except for recurring MIT post-initial).
- **Recurring payments** — first transaction authenticated (CIT with SCA), subsequent MIT flagged to skip challenge.
- **Test in both frictionless and challenge modes** — most issuers step-up unpredictably; one path is not enough.
- **Abandon 3DS1** — officially retired October 2022; any remaining usage fails.

Per-region: EU/UK → mandatory. US → issuer-optional but rising. India → mandatory (RBI). Most LATAM → optional but growing.

---

## Subscription Lifecycle

```
created → trialing → active → past_due → canceled
                       │                    ▲
                       ├─ plan change ──────┤
                       │  (prorate)         │
                       └─ unpaid ───────────┘
```

| Event pattern | Action |
|--------------|--------|
| Subscription created | Provision access, send welcome |
| Subscription updated | Update plan/features, handle proration |
| Invoice/payment succeeded | Extend access, generate receipt |
| Invoice/payment failed | Notify user, start dunning sequence |
| Subscription canceled | Revoke access, send cancellation |

**Dunning sequence:** Retry charge → email day 1 → email day 3 → email day 7 → cancel or pause.

---

## PCI DSS 4.0.1 Compliance

All future-dated PCI DSS v4.0 requirements became mandatory March 31, 2025. Key additions: MFA required for all CDE access, targeted risk analysis for security frequencies, client-side script integrity monitoring (Requirement 6.4.3).

```
How do you handle card data?
├── Fully outsourced (iframe/redirect, no card data touches your page) → SAQ A
├── Embedded JS tokenizer (provider JS on your page) → SAQ A-EP
├── POS terminal only (no e-commerce) → SAQ B / B-IP
└── Card data on your server → SAQ D (full audit — avoid this)
```

| Level | Annual transactions | Requirement |
|-------|-------------------|-------------|
| 1 | > 6M | QSA audit + ROC |
| 2 | 1M–6M | SAQ + quarterly scan |
| 3 | 20K–1M | SAQ + quarterly scan |
| 4 | < 20K | SAQ |

**Recommendation:** Use provider-hosted tokenization (SAQ A). Handles 3D Secure, wallet methods, and 25+ payment types.

---

## Payment Rails & Methods

### Card & Wallet

| Method | Integration pattern | Considerations |
|--------|-------------------|----------------|
| **Apple Pay / Google Pay** | Wallet tokens via provider SDK | Domain verification (Apple); higher conversion, lower fraud |
| **BNPL** (Klarna, Afterpay, Affirm) | Provider widget or redirect | Increases AOV 20-30%; growing regulatory scrutiny |

### Bank & Real-Time

| Method | Integration pattern | Considerations |
|--------|-------------------|----------------|
| **ACH** (US) | Provider API | Low fees (~0.8%); 1-3 day settlement; good for B2B/recurring |
| **SEPA** (EU) | Provider API / redirect | Low fees; SEPA Instant for real-time; PSD3 will strengthen Open Banking |
| **FedNow** (US instant) | Bank integration / fintech API | Real-time settlement; $10M limit; 1500+ participating banks |
| **UPI** (India) | Provider API | Real-time; near-zero fees; dominant in Indian market |
| **iDEAL / Bancontact** | Provider redirect | Regional bank transfer methods (NL, BE) |

### Stablecoin Payments

Stablecoins (USDC, USDT) have matured beyond niche: $33T annual volume, 76% of crypto payments are stablecoins. Consider when:
- Cross-border B2B with high remittance costs
- Markets with limited banking infrastructure
- Instant settlement with no chargebacks needed

Integration via specialized gateways or provider add-ons. Regulatory landscape evolving rapidly.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Raw card data on server | PCI SAQ-D, massive liability | Provider-hosted tokenization (SAQ A) |
| No webhook signature verification | Attackers forge payment confirmations | Always verify provider signatures |
| Mutable price on client | Users modify amount in DevTools | Calculate price server-side only |
| No idempotency keys | Duplicate charges on retry | Idempotency key on every mutation |
| Single provider, no abstraction | Vendor lock-in, no failover | Provider adapter interface |
| Ignoring failed webhooks | Lost orders, broken state | Retry queue + dead letter + reconciliation |
| Storing amounts as floats | Rounding errors compound | Integer in smallest currency unit |
| No reconciliation job | Drift between provider and DB undetected | Daily automated reconciliation |

---

## Context Adaptation

### Frontend
- Provider SDK integration (Payment Element, Drop-in, hosted checkout)
- Loading states during payment processing
- Error handling and retry UX
- Wallet method buttons (Apple Pay, Google Pay)
- 3D Secure challenge handling

### Backend
- Provider adapter abstraction layer
- Webhook handlers with idempotent processing
- Subscription lifecycle management
- Daily reconciliation between provider and local DB
- Dunning (failed payment recovery)
- Payment orchestration / smart routing

### Security
- PCI scope reduction via tokenization
- Webhook signature verification
- Fraud detection (provider rules + custom)
- 3D Secure enforcement for high-risk transactions
- Client-side script integrity monitoring (PCI DSS 4.0.1 Req 6.4.3)

---

## Related Knowledge

- **security** — PCI compliance, webhook signature verification, fraud detection
- **compliance** — GDPR consent for payment data, PII handling, data retention, PSD3/PSR
- **backend** — webhook handler implementation, idempotency, background job processing
- **api-design** — payment API contracts, versioning, error responses

---

## References

- [provider-comparison.md](references/provider-comparison.md) — Provider selection tree, comparison matrix, pattern-to-provider short-list, regional coverage
- [payment-patterns.md](references/payment-patterns.md) — Provider-agnostic interfaces, adapter pattern, idempotency, reconciliation, refund flows, multi-currency
- [stripe-patterns.md](references/stripe-patterns.md) — Stripe-specific SDK code: PaymentIntent, Payment Element, webhooks, subscriptions, testing

Load references when you need provider short-lists, implementation code, provider adapter interfaces, or Stripe-specific patterns.
