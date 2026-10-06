# Stripe Patterns — Worked Provider Example

Provider-specific code for the patterns in SKILL.md and payment-patterns.md.

**Versions.** Stripe field names and event payloads depend on the account's or request's API version. The code below targets API versions from `2025-03-31.basil` onward (Invoice `payment_intent`, `charge`, and `paid` removed in favour of `invoice.payments`; `invoice.subscription` moved to `invoice.parent.subscription_details.subscription`; `confirmation_secret` added). Before copying, read the version pinned in the project (SDK constructor or `Stripe-Version` header) and the webhook endpoint's version, and check the changelog for fields used here. Since `2024-09-30.acacia`, Stripe ships a monthly API version without breaking changes and, twice a year, a named major release whose first version may break; monthly versions stay in the named line.

## Contents

- [Client Setup](#client-setup)
- [One-Time Payment](#one-time-payment)
- [Webhook Endpoint](#webhook-endpoint)
- [Subscriptions](#subscriptions)
- [Testing](#testing)

---

## Client Setup

```typescript
import Stripe from 'stripe';

// Pin the API version explicitly and upgrade it deliberately (SDK major + webhook endpoint version together)
export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: config.stripe.apiVersion,   // e.g. a "YYYY-MM-DD.name" string recorded in config
  maxNetworkRetries: 2,                   // SDK retries reuse the same idempotency key
  timeout: 10_000,
});
```

---

## One-Time Payment

### Server: create the PaymentIntent

```typescript
// POST /api/orders/:orderId/payment
async function startPayment(orderId: string, viewer: User) {
  const order = await orders.getForViewer(viewer, orderId);       // price computed server-side, stored on the order
  const attempt = await orders.currentPaymentAttempt(order.id);   // increments only when the customer starts over

  const pi = await stripe.paymentIntents.create({
    amount: Number(toProviderMinor(order.total)),                 // provider-boundary conversion
    currency: order.total.currency.toLowerCase(),
    customer: await customers.stripeIdFor(viewer),
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: order.id },
  }, {
    idempotencyKey: `pay:${order.id}:${attempt}`,
  });

  return { clientSecret: pi.client_secret };
}
```

### Client: Payment Element

```tsx
function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/complete` },
    });
    if (error) { setError(error.message ?? 'Payment failed'); setProcessing(false); }
    // On success the browser goes to return_url; that page shows status but does not fulfil.
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe || processing}>{processing ? 'Processing…' : 'Pay'}</button>
      {error && <div role="alert">{error}</div>}
    </form>
  );
}
```

---

## Webhook Endpoint

```typescript
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event: Stripe.Event;
  try {
    // verifies the Stripe-Signature header over the raw body, including the timestamp tolerance
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'] as string, config.stripe.webhookSecret);
  } catch {
    return res.status(400).send('Invalid signature');
  }

  // The claim and the job commit together: a duplicate delivery can only be acknowledged
  // when the first one's job exists (transactional job table or outbox, not a separate queue call).
  await db.transaction(async (tx) => {
    const claimed = await tx.query(
      `INSERT INTO payment_events (provider, event_id, type, payload, received_at)
       VALUES ('stripe', $1, $2, $3, now()) ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
      [event.id, event.type, req.body]);
    if (claimed.rowCount === 0) return;                         // duplicate delivery
    await tx.jobs.enqueue('stripe-event', { id: claimed.rows[0].id });
  });
  res.sendStatus(200);
});

// Worker
async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      return onPaymentSucceeded({ kind: 'payment_succeeded', ref: { provider: 'stripe', id: pi.id },
        orderId: pi.metadata.orderId, amount: fromProviderMinor(pi.amount_received, pi.currency) });
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      return onPaymentFailed(pi.metadata.orderId, pi.last_payment_error?.code);
    }
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscriptionId = subscriptionIdOf(event.data.object);
      if (subscriptionId) return syncSubscription(subscriptionId);    // re-read current state; events arrive out of order
      return;
    }
    default:
      log.info({ type: event.type, id: event.id }, 'stripe event ignored');  // subscribed but not handled
  }
}

function subscriptionIdOf(obj: Stripe.Invoice | Stripe.Subscription): string | null {
  if (obj.object === 'subscription') return obj.id;
  const ref = obj.parent?.type === 'subscription_details'
    ? obj.parent.subscription_details?.subscription             // basil+: replaces invoice.subscription
    : null;
  return typeof ref === 'string' ? ref : ref?.id ?? null;
}
```

To read the PaymentIntent behind an invoice (basil+), expand `payments` on the invoice and use `invoice.payments.data[i].payment.payment_intent`; `invoice.payment_intent` no longer exists.

---

## Subscriptions

### Create, with or without a trial

```typescript
async function createSubscription(userId: string, customerId: string, priceId: string, requestId: string, trialDays?: number) {
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    ...(trialDays ? { trial_period_days: trialDays } : {}),
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
    metadata: { userId },
  }, {
    idempotencyKey: `subscribe:${requestId}`,                  // the client's subscribe request id
  });

  // No trial: the first invoice needs payment → confirm with the invoice's confirmation secret.
  // Trial: the first invoice is zero → collect the method with the pending SetupIntent instead.
  const invoice = sub.latest_invoice as Stripe.Invoice | null;
  const setupIntent = sub.pending_setup_intent as Stripe.SetupIntent | null;
  const clientSecret = invoice?.confirmation_secret?.client_secret ?? setupIntent?.client_secret ?? null;
  if (!clientSecret) throw new Error(`Subscription ${sub.id} has neither a payment nor a setup to confirm`);

  return {
    subscriptionId: sub.id,
    clientSecret,
    confirm: invoice?.confirmation_secret ? 'payment' : 'setup',   // client calls confirmPayment or confirmSetup
  };
}
```

### Plan change

```typescript
async function changePlan(change: { id: string; subscriptionId: string; newPriceId: string }) {
  const sub = await stripe.subscriptions.retrieve(change.subscriptionId);
  await stripe.subscriptions.update(change.subscriptionId, {
    items: [{ id: sub.items.data[0].id, price: change.newPriceId }],
    proration_behavior: 'create_prorations',
  }, {
    idempotencyKey: `plan-change:${change.id}`,     // stored change request id; same on every retry
  });
}
```

### Failed renewals

Configure Smart Retries (or a custom retry schedule) and the customer emails in the Billing settings, plus what happens after the last retry (cancel, mark unpaid, or leave past due). Your code only reacts:

```typescript
async function syncSubscription(subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await access.set(sub.metadata.userId, accessFor(sub.status));
}

function accessFor(status: Stripe.Subscription.Status): Access {
  switch (status) {
    case 'active': case 'trialing': return 'full';
    case 'past_due':                return 'grace';
    case 'incomplete': case 'incomplete_expired':
    case 'unpaid': case 'canceled': case 'paused': return 'none';
  }
}
```

---

## Testing

| Card number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Succeeds |
| 4000 0025 0000 3155 | Requires authentication (3DS) on session, and off session until set up |
| 4000 0000 0000 9995 | Declined: insufficient funds |
| 4000 0000 0000 0341 | Attaches, then fails when charged |

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe   # local forwarding with a test signing secret
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_failed
```

- Test the webhook path with signed test events (the CLI, or the SDK's test-header helper), not by calling the worker directly with unsigned objects.
- Test clocks simulate subscription renewals, trials, and retries without waiting.
- Scenario cards come from the provider's testing page; take new scenarios from there rather than guessing numbers.
