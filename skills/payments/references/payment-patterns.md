# Payment Patterns — Provider-Agnostic

Integration shape, event handling, refunds, and money. TypeScript-flavoured; the patterns apply in any language.

## Contents

- [Payments Module and Capability Interfaces](#payments-module-and-capability-interfaces)
- [Mapping Provider Events and Statuses](#mapping-provider-events-and-statuses)
- [Webhook Processing](#webhook-processing)
- [Idempotency Keys](#idempotency-keys)
- [Refunds](#refunds)
- [Money and Currencies](#money-and-currencies)
- [Saved Payment Methods and Off-Session Charges](#saved-payment-methods-and-off-session-charges)
- [Reconciliation](#reconciliation)
- [Disputes](#disputes)
- [Orchestration](#orchestration)

---

## Payments Module and Capability Interfaces

**One provider:** a single module owns every SDK call and exposes your own types. No interface, no registry.

```typescript
// payments/index.ts — the only place that imports the provider SDK
export async function startCheckout(order: Order, idempotencyKey: string): Promise<CheckoutSession>
export async function refund(request: RefundRequest): Promise<RefundRecord>
export function verifyEvent(rawBody: Buffer, headers: Headers): WebhookEnvelope   // throws InvalidSignature
export function mapEvent(envelope: WebhookEnvelope): PaymentEvent                   // throws on unmappable data
```

**Two or more committed providers:** split by capability so each provider implements only what it supports.

```typescript
interface Charges {
  createPayment(p: CreatePayment): Promise<PaymentAttempt>     // p.idempotencyKey required
  capture(paymentRef: ProviderRef, amount: Money, idempotencyKey: string): Promise<PaymentAttempt>
}
interface Refunds {
  refund(paymentRef: ProviderRef, amount: Money, idempotencyKey: string): Promise<ProviderRefund>
}
interface Subscriptions {
  subscribe(p: Subscribe): Promise<SubscriptionState>
  changePlan(p: ChangePlan): Promise<SubscriptionState>
}
interface WebhookSource {
  // each provider reads its own headers or payload fields for verification
  verify(rawBody: Buffer, headers: Headers): WebhookEnvelope   // throws InvalidSignature only
  map(envelope: WebhookEnvelope): PaymentEvent                 // throws UnknownProviderStatus and similar
}

type ProviderRef = { provider: ProviderId; id: string }   // ProviderId is a closed union of live providers
type WebhookEnvelope = { provider: ProviderId; eventId: string; type: string; payload: unknown }   // eventId: the provider's event id
```

Selection is an explicit rule (by market, method, or merchant account), written where it is tested; adding a provider adds a case the compiler checks.

---

## Mapping Provider Events and Statuses

Provider event sets are open: providers add events at any time. Your mapped set is closed.

```typescript
type PaymentEvent =
  | { kind: 'payment_succeeded'; ref: ProviderRef; orderId: string; amount: Money }
  | { kind: 'payment_failed'; ref: ProviderRef; orderId: string; reason: string }
  | { kind: 'refund_updated'; ref: ProviderRef; refundId: string; status: RefundStatus }
  | { kind: 'subscription_changed'; ref: ProviderRef; subscriptionId: string }
  | { kind: 'dispute_opened'; ref: ProviderRef; disputeId: string; amount: Money; evidenceDueBy: Date }
  | { kind: 'ignored'; providerType: string }                       // explicit: not handled here

function mapEvent(raw: WebhookEnvelope): PaymentEvent {
  switch (raw.type) {
    case 'payment_intent.succeeded':      return { kind: 'payment_succeeded', /* ... */ }
    case 'payment_intent.payment_failed': return { kind: 'payment_failed', /* ... */ }
    // ...every type you subscribed to
    default:                              return { kind: 'ignored', providerType: raw.type }
  }
}

type PaymentStatus = 'requires_payment_method' | 'requires_action' | 'processing'
                   | 'authorized' | 'captured' | 'canceled' | 'failed'

function mapStatus(s: string): PaymentStatus {
  switch (s) {
    case 'requires_payment_method': return 'requires_payment_method'
    case 'requires_action':         return 'requires_action'
    case 'processing':              return 'processing'
    case 'requires_capture':        return 'authorized'
    case 'succeeded':               return 'captured'
    case 'canceled':                return 'canceled'
    default: throw new UnknownProviderStatus(s)     // surfaces in alerts; never guessed
  }
}
```

The worker logs `ignored` events and finishes; the consumer of `PaymentEvent` switches exhaustively over `kind` with no default. Subscribe the webhook endpoint only to the event types you map.

---

## Webhook Processing

```typescript
// HTTP endpoint: verify, claim, enqueue, acknowledge. Mapping happens in the worker.
async function receive(req: RawRequest): Promise<Response> {
  let envelope: WebhookEnvelope
  try { envelope = source.verify(req.rawBody, req.headers) }
  catch (err) {
    if (err instanceof InvalidSignature) return status(400)   // bad signature or stale timestamp
    throw err                                                  // anything else is a 500; the provider redelivers
  }

  await db.transaction(async tx => {
    const claimed = await tx.query(
      `INSERT INTO payment_events (provider, event_id, type, payload, received_at)
       VALUES ($1, $2, $3, $4, now()) ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
      [envelope.provider, envelope.eventId, envelope.type, envelope.payload])
    if (claimed.rowCount === 0) return                         // duplicate delivery
    await tx.jobs.enqueue('payment-event', { id: claimed.rows[0].id })   // same transaction as the claim
  })
  return status(200)
}

// Worker: map the stored event, then dispatch on kind
async function processPaymentEvent(id: string) {
  const stored: WebhookEnvelope = await db.paymentEvents.get(id)
  const event = source.map(stored)   // a mapping error fails the job: alerted, stored, replayable
  switch (event.kind) {
    case 'ignored':           return log.info('payment event not handled', { type: event.providerType })
    case 'payment_succeeded': return onPaymentSucceeded(event)
    // ...one case per kind, no default
  }
}

// Worker: idempotent per order, verifies amounts against your records
async function onPaymentSucceeded(e: Extract<PaymentEvent, { kind: 'payment_succeeded' }>) {
  await db.transaction(async tx => {
    const order = await tx.orders.lockById(e.orderId)
    if (!order) throw new UnknownOrder(e.orderId)                     // alert; do not drop
    if (order.status === 'paid') return                               // already applied
    if (!sameMoney(order.total, e.amount)) {
      await tx.orders.flag(order.id, 'amount_mismatch', e)            // manual review, no fulfilment
      return
    }
    await tx.orders.markPaid(order.id, e.ref)
    await tx.outbox.add('order.paid', { orderId: order.id })          // fulfilment downstream
  })
}
```

- The claim (unique insert) happens before any side effect; the loser of a race returns 2xx and does nothing.
- The claim and the enqueue commit together (an outbox or a database-backed queue). If the enqueue could fail after the claim commits, a redelivery would see the claim and the event would never be processed.
- Verification failures are the only 400. Mapping runs in the worker, so an unmappable status raises an alert and stays stored for replay instead of looking like a bad signature.
- Store the payload so a failed job can be retried or replayed without the provider.
- Events arrive out of order: apply state transitions only forward (a late `payment_failed` must not undo `paid`), or re-fetch the object's current state from the provider before acting.
- Queue and retry mechanics: `background-jobs`; the outbox pattern: `architecture`.

---

## Idempotency Keys

The pattern (claim first, scoped keys from intent, request hash, external side effects via the provider key or an outbox) is owned by `message-queues` → [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md); this section lists the payment keys.

| Operation | Key derived from |
|-----------|------------------|
| Create payment for an order | `pay:{orderId}:{attemptNo}` — attempt number increments only when the customer starts a new attempt |
| Capture | `capture:{paymentId}` |
| Refund | `refund:{refundId}` — your refund record's id, created before the provider call |
| Plan change | `plan-change:{changeRequestId}` |
| Payout | `payout:{payoutId}` |

- The key is created once, stored with the intent, and reused on every retry of that intent.
- If inputs change (amount, currency), it is a new intent with a new key; providers reject a reused key with different parameters.
- Provider key retention is limited (often about a day); long-running retries also check your own records before calling.
- Retry policy for provider calls (which errors, backoff with jitter, budgets): `reliability`.

---

## Refunds

```typescript
async function requestRefund(paymentId: string, amount: Money, reason: RefundReason, requestedBy: string) {
  const { refund, payment } = await db.transaction(async tx => {
    const payment = await tx.payments.lockById(paymentId)
    const refunded = await tx.refunds.sumActive(paymentId)          // succeeded + pending; failed excluded
    const refundable = subtract(payment.captured, refunded)
    if (amount.minor <= 0n || amount.currency !== payment.captured.currency) throw new InvalidRefundAmount()
    if (amount.minor > refundable.minor) throw new ExceedsRefundable(refundable)
    const refund = await tx.refunds.insert({ paymentId, amount, reason, requestedBy, status: 'pending' })   // id = idempotency key
    return { refund, payment }
  })

  await submitRefund(refund, payment.ref)
  return refund
}

// Also run by a sweeper job for `pending` refunds that have no provider reference yet
async function submitRefund(refund: RefundRecord, paymentRef: ProviderRef) {
  try {
    const result = await refunds.refund(paymentRef, refund.amount, `refund:${refund.id}`)   // same key on every attempt
    await db.refunds.update(refund.id, { providerRef: result.ref, status: result.status })
  } catch (err) {
    if (err instanceof ProviderRejected) {                     // definitive: the provider will not refund this
      await db.refunds.update(refund.id, { status: 'failed', failureCode: err.code })
      throw err
    }
    log.warn('refund submission outcome unknown; left pending for retry', { refundId: refund.id, err })
  }
}

type RefundReason = 'customer_request' | 'duplicate' | 'fraud' | 'order_canceled' | 'other'   // yours; map at the provider edge
```

- A timeout or network error leaves the record `pending`; the sweeper (`background-jobs`) resubmits it with the same key, so the provider refunds at most once. Only a definitive rejection marks it `failed`, which releases the amount.
- Several partial refunds per payment; the order's refund status is derived from totals (`none`, `partial`, `full`), never stored separately.
- Final refund state arrives by webhook (`refund_updated`); refunds can fail after acceptance.
- A full refund is an explicit amount equal to the refundable balance, not "amount omitted".

---

## Money and Currencies

```typescript
type Money = { minor: bigint; currency: string }   // currency: ISO 4217 code, uppercase ("USD", "JPY", "KWD")

// Exponent from a maintained currency table. Intl (CLDR data) is convenient but differs from
// ISO 4217 for a few currencies; use an ISO 4217 table when the ledger must match it exactly.
function exponent(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

// Parse a decimal string without floating point
function fromDecimal(value: string, currency: string): Money {
  const e = exponent(currency)
  const [whole, frac = ''] = value.split('.')
  if (frac.length > e) throw new TooManyDecimals(value, currency)
  return { minor: BigInt(whole + frac.padEnd(e, '0')), currency }
}
```

- 0-decimal (JPY, KRW), 2-decimal (USD, EUR), and 3-decimal (KWD, BHD, OMR, TND) currencies exist; never assume `× 100`.
- Providers sometimes use a different exponent than ISO 4217 for specific currencies, or require amounts divisible by 10 or 100. Convert at the provider boundary, in the provider module, with that provider's documented table; your ledger stays in ISO minor units.
- Provider APIs may expect lowercase codes; normalize at the boundary.
- Tokens with more decimals than ISO currencies (stablecoins on-chain) keep their own precision; do not squeeze them into 2-decimal minor units.
- Formatting for display: `i18n`. Splitting amounts (tax lines, installments): allocate remainders explicitly so parts sum to the total.

---

## Saved Payment Methods and Off-Session Charges

- Save a method only with the customer's consent for future use, recorded with what it covers (one merchant, recurring, or unscheduled charges).
- Collect and authenticate at setup (a setup flow with SCA where required); keep the mandate or network transaction reference the provider returns.
- Off-session charges are flagged as merchant-initiated and may still fail with "authentication required": notify the customer and bring them back on-session to authenticate.
- Card updates (network account updater) can change expiry or number silently; react to provider events instead of storing card details.

---

## Reconciliation

Daily job:
1. Fetch provider balance transactions or the settlement report for the period.
2. Load local payments, refunds, disputes, and fees for the same period.
3. Match by provider reference; report missing locally, missing at the provider, amount or currency mismatches, and fee differences.
4. Raise each discrepancy to an owner; never auto-correct the ledger silently.

Settlement payouts are reconciled separately: payout total = sum of included balance transactions.

---

## Disputes

On `dispute_opened`: record it with amount, reason, and evidence deadline; freeze related fulfilment where possible; alert; gather evidence (delivery proof, usage logs, communication, terms accepted); submit before the deadline. Track outcomes to tune fraud rules. Do not refund a disputed payment separately; the dispute already moves the funds.

---

## Orchestration

When routing or failover across providers is required:

- **Routing inputs:** currency, card country and network, method, amount, merchant account, recent success rate and cost per provider.
- **Failover:** retry on another provider only for errors that prove the first attempt did not authorize (network errors before a response are ambiguous — check status first); never for issuer declines such as insufficient funds or suspected fraud.
- **One payment, several attempts:** model attempts as children of your payment, each with its own provider and idempotency key; reconciliation runs per provider.
- **Tokens are provider-bound** unless you use network tokens or a vault that can forward card data to several providers.
