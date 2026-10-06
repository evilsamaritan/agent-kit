---
name: payments
description: "Design payment flows and operations. Use for checkout, card payments, 3DS/SCA, PCI scope, provider integration, subscriptions, invoices, dunning, payment webhooks, refunds, disputes, money amounts, reconciliation, and multi-provider orchestration."
---

# Payments

Determine the provider, its SDK version, and the pinned provider API version from the project's manifest and configuration first: field names and event shapes change between provider API versions. Provider-specific code: [stripe-patterns.md](references/stripe-patterns.md) is the worked example.

## Hard Rules

- **Fulfil from server-side events, never from the client's "success" redirect.** The redirect is UX; the verified provider event (or a server-side status fetch) is the fact.
- **Never handle raw card numbers.** Provider-hosted fields or pages keep card data off your servers and pages.
- **Prices are computed on the server**, and before fulfilment the paid amount, currency, and order id are checked against your own records.
- **Every payment mutation (charge, capture, refund, plan change) carries an idempotency key derived from the intent** — order id, refund id, change id supplied by your system — never from time or randomness per attempt. Pattern owner: `message-queues` → [idempotency-patterns.md](../message-queues/references/idempotency-patterns.md).
- **Webhooks: verify the signature on the raw body, claim the event id, acknowledge fast, process from a queue.** Contract: `api-design` → [rest-patterns.md](../api-design/references/rest-patterns.md#webhooks).
- **Unknown provider events and statuses are explicit.** Unhandled event types are logged and acknowledged; an unmapped status is an error or an explicit `unknown` the caller must handle — never a default to "failed" or "succeeded" (`development` rule 2).
- **Money is an integer in minor units plus a currency code**, with the exponent taken from ISO 4217 data, never a hand-kept list or floating point.

---

## Payment Lifecycle

```
tokenize → authorize → capture → settle → reconcile → (refund | dispute)
```

| Stage | What happens | Who owns it |
|-------|-------------|-------------|
| Tokenize | Card or account data replaced with an opaque token | Provider-hosted fields (client) |
| Authorize | Issuer approves and holds funds; may require customer authentication | Provider → network → issuer |
| Capture | Merchant claims authorized funds, immediately or later (holds expire) | Your backend → provider |
| Settle | Funds move to the merchant, net of fees | Acquirer / provider |
| Reconcile | Provider reports matched against your ledger | Your scheduled job |
| Refund / dispute | Money returns by your choice (refund) or the cardholder's (chargeback) | Your backend / provider |

---

## Choosing a Payment Path

Pick by business need, then shortlist providers:

- **One-time checkout** → a card processor with provider-hosted fields or a hosted checkout page.
- **Recurring billing** → a provider with native subscriptions, invoices, and retry schedules; build only access control on top.
- **Marketplace or payouts to sellers** → connected-account / multi-party flows with onboarding (KYC) handled by the provider.
- **You do not want to be the seller of record for tax** → a merchant-of-record provider.
- **Local methods dominate the market** → a regional provider or an aggregator covering local wallets and bank transfers.
- **Bank-to-bank or instant rails** → see [regulatory-and-rails.md](references/regulatory-and-rails.md).
- **In-app purchases or subscriptions sold through the app stores** → [store-billing.md](references/store-billing.md).

Short-lists by path and region: [provider-comparison.md](references/provider-comparison.md).

---

## Integration Shape

```
How many providers are live or committed?
├── one → one payments module: provider SDK calls inside it, your own types at its edge
│         (Money, PaymentStatus, PaymentEvent); no registry, no routing layer
├── two or more, chosen per market or method → capability interfaces (charge, refund,
│         subscribe, verify webhook) each provider implements only where it supports them,
│         plus an explicit selection rule
└── routing on cost or success rate, cascading failover → an orchestration layer
          (in-house or a platform); see payment-patterns.md
```

Provider types must not leak into domain code; a second provider is added when it is committed, not in advance (`development`). Interfaces, event mapping, refunds, and money: [payment-patterns.md](references/payment-patterns.md).

---

## SCA and 3DS

**Strong Customer Authentication** (EEA and UK) needs two of: knowledge, possession, inherence. **3DS (EMV 3-D Secure 2)** carries it: frictionless when the issuer's risk engine approves, challenge otherwise.

- **Out of scope** (no SCA required): merchant-initiated transactions after an authenticated customer-initiated setup with a mandate; one-leg-out transactions (card or acquirer outside the region); mail and telephone orders.
- **Exemptions** (requested by the acquirer, may be refused): low-value payments (with cumulative count and amount limits), transaction risk analysis (depends on the acquirer's fraud rate), trusted beneficiaries, secure corporate payments.
- **The issuer may still demand a challenge.** Always handle the "requires action" state, in checkout and in off-session charges (bring the customer back on-session).
- **Liability:** successful authentication generally shifts fraud liability to the issuer; exemptions usually keep it with the merchant.
- **Recurring:** authenticate the first payment (or the setup), store the mandate reference, flag later charges as merchant-initiated.
- Test both frictionless and challenge paths, and the off-session "authentication required" failure.

Regional mandates outside the EEA/UK and current thresholds: [regulatory-and-rails.md](references/regulatory-and-rails.md).

---

## Subscriptions

```
incomplete → trialing → active → past_due → (active | unpaid | canceled)
                          │
                          └─ plan change (proration) ─▶ active
```

- **Prefer the provider's retry schedule and customer emails** for failed renewals; configure them, do not rebuild them.
- Your code reacts to state changes and controls access: `active`/`trialing` → access; `past_due` → grace period with a banner; `unpaid`/`canceled` → revoke. Access is derived from the latest subscription state, not toggled per event, because events arrive out of order.
- Plan changes carry an idempotency key from your change request id; decide proration once per product.
- Trials without a payment method need a setup flow (save the method, authenticate if required) before the first charge.

---

## PCI DSS Scope

```
How does card data reach the provider?
├── Provider-hosted payment page or iframe fields only; no card data in your page's DOM → SAQ A (if all eligibility criteria hold)
├── Your page's JavaScript can affect the payment form (direct post, JS that builds the form) → SAQ A-EP
├── Terminals only, no e-commerce → SAQ B / B-IP / P2PE variants
└── Card data passes through your servers → SAQ D (avoid)
```

**Reduce scope first:** every system that stores, processes, or transmits card data, or connects to such a system, is in the cardholder data environment (CDE). Tokenize at the provider so card data never reaches you, keep the CDE segmented from everything else, and limit access, logging, and MFA controls to the systems that remain in scope.

Payment-page scripts are an attack path even with hosted fields: keep an inventory of scripts on pages that host the payment form, restrict them with CSP, and monitor for changes. SAQ eligibility criteria, merchant levels, and current requirement changes: [regulatory-and-rails.md](references/regulatory-and-rails.md).

---

## Refunds, Disputes, Reconciliation

- **Refunds** are their own records: several partial refunds per payment, each with its own idempotency key; refundable = captured − sum(succeeded and pending refunds).
- **Disputes** have evidence deadlines; record them on arrival, alert, gather evidence automatically, submit before the deadline. A dispute can follow a refund; do not refund a disputed payment twice.
- **Reconcile daily** against provider balance transactions or settlement reports: missing locally, missing at the provider, amount or currency mismatch, fee drift.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Fulfilling on the client's success redirect | Users skip payment; redirects get lost | Fulfil from a verified server-side event |
| Unknown event or status defaulting to "failed" | A new provider event triggers failure flows | Explicit ignore for events; error or `unknown` for statuses |
| Check, process, then record for webhooks | Parallel deliveries fulfil twice | Claim the event id first, process idempotently |
| Fulfilling without checking amount and currency | Underpayment or wrong currency is accepted | Compare against your order before fulfilment |
| Provider SDK types throughout domain code | Every provider change touches the domain | One payments module with your own types |
| Adapter registry for a single provider | Abstraction with no second implementation | Add capability interfaces when a second provider is committed |
| Time-based idempotency keys | A retry gets a new key and charges twice | Keys from the intent (order, refund, change id) |
| One refund per order with an overwritten amount | Second partial refund rejected; totals wrong | Refund records and computed refundable amount |
| Floating-point or `× 100` money | Wrong for 0- and 3-decimal currencies; rounding drift | Integer minor units, ISO 4217 exponent |
| Hand-built dunning on top of provider billing | Duplicate emails and retries | Provider retry settings; your code controls access |
| No reconciliation | Drift between provider and ledger goes unnoticed | Daily automated reconciliation |

---

## Related Knowledge

- `api-design` — webhook contract (sender and receiver), idempotency-key contract, error format
- `message-queues` — idempotency pattern owner; claim-first processing
- `background-jobs` — webhook processing queues, reconciliation and retry jobs
- `backend` — webhook endpoint wiring and error mapping
- `reliability` — retry policy for provider calls
- `security` — script integrity on payment pages, secrets, fraud signals
- `compliance` — PCI DSS obligations, payment data retention, PSD2/PSD3
- `i18n` — currency formatting for display

---

## References

- [payment-patterns.md](references/payment-patterns.md) — integration module and capability interfaces, event mapping, webhook processing, refunds, money, saved methods, reconciliation, disputes
- [stripe-patterns.md](references/stripe-patterns.md) — worked provider example: API version pinning, payment and subscription flows, webhooks, testing
- [provider-comparison.md](references/provider-comparison.md) — provider short-lists by path and region (dated)
- [store-billing.md](references/store-billing.md) — entitlement server, receipt/token verification, restore purchases, store notifications and refunds
- [regulatory-and-rails.md](references/regulatory-and-rails.md) — PCI DSS levels and SAQ eligibility, SCA regions and thresholds, PSD3/PSR status, bank and instant rails (dated)
