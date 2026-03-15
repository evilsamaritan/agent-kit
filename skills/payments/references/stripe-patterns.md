# Stripe Patterns — Integration Deep Dive

## Contents

- [Payment Element Setup](#payment-element-setup-recommended) — server PaymentIntent, client Payment Element
- [Webhook Handler](#webhook-handler) — Express implementation, signature verification
- [Subscription Setup](#subscription-setup) — trial, plan change with proration, dunning
- [Testing](#testing) — test cards, webhook testing, integration test pattern

## Payment Element Setup (Recommended)

### Server: Create PaymentIntent

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/checkout
async function createCheckout(req: Request) {
  const { orderId, items } = req.body;

  // Calculate price SERVER-SIDE (never trust client)
  const amount = await calculateOrderTotal(items);

  // Find or create customer
  const customer = await getOrCreateStripeCustomer(req.user);

  const paymentIntent = await stripe.paymentIntents.create({
    amount, // in cents
    currency: 'usd',
    customer: customer.id,
    metadata: { orderId, userId: req.user.id },
    automatic_payment_methods: { enabled: true },
  }, {
    idempotencyKey: `checkout-${orderId}`,
  });

  return { clientSecret: paymentIntent.client_secret };
}
```

### Client: Payment Element

```tsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/complete`,
      },
    });

    if (submitError) {
      setError(submitError.message ?? 'Payment failed');
      setProcessing(false);
    }
    // If successful, user is redirected to return_url
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe || processing}>
        {processing ? 'Processing...' : 'Pay now'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

function CheckoutPage({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm />
    </Elements>
  );
}
```

---

## Webhook Handler

### Express Implementation

```typescript
import express from 'express';

const app = express();

// CRITICAL: Use raw body for webhook verification
app.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Webhook signature verification failed');
      return res.status(400).send('Invalid signature');
    }

    // Idempotent processing — check if already handled
    const handled = await db.webhookEvents.findUnique({
      where: { stripeEventId: event.id },
    });
    if (handled) return res.json({ received: true });

    try {
      await processWebhookEvent(event);

      // Mark as handled
      await db.webhookEvents.create({
        data: { stripeEventId: event.id, type: event.type, processedAt: new Date() },
      });
    } catch (err) {
      console.error('Webhook processing failed:', err);
      return res.status(500).send('Processing failed'); // Stripe will retry
    }

    res.json({ received: true });
  }
);

async function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await fulfillOrder(pi.metadata.orderId, pi.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await notifyPaymentFailed(pi.metadata.orderId, pi.last_payment_error?.message);
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      await extendSubscriptionAccess(invoice.subscription as string);
      await sendReceipt(invoice);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await startDunning(invoice.subscription as string, invoice.id);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await revokeAccess(sub.metadata.userId);
      await sendCancellationEmail(sub.metadata.userId);
      break;
    }
  }
}
```

---

## Subscription Setup

### Create Subscription with Trial

```typescript
async function createSubscription(
  customerId: string,
  priceId: string,
  trialDays: number = 14
) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_behavior: 'default_incomplete', // require payment method
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: { userId: 'user-123' },
  }, {
    idempotencyKey: `sub-${customerId}-${priceId}`,
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const pi = invoice.payment_intent as Stripe.PaymentIntent;

  return {
    subscriptionId: subscription.id,
    clientSecret: pi.client_secret, // for Payment Element
    status: subscription.status,
  };
}
```

### Plan Change with Proration

```typescript
async function changePlan(subscriptionId: string, newPriceId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: 'create_prorations', // credit unused time
  }, {
    idempotencyKey: `plan-change-${subscriptionId}-${newPriceId}-${Date.now()}`,
  });
}
```

### Dunning (Failed Payment Recovery)

```typescript
async function startDunning(subscriptionId: string, invoiceId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.userId;

  // Attempt 1: Immediate notification
  await sendEmail(userId, 'payment-failed', {
    updatePaymentUrl: `${APP_URL}/billing/update-payment`,
    retryDate: addDays(new Date(), 3),
  });

  // Schedule follow-ups via background jobs
  await dunningQueue.add('retry-notification', {
    subscriptionId, userId, attempt: 2,
  }, { delay: 3 * 24 * 60 * 60 * 1000 }); // 3 days

  await dunningQueue.add('final-warning', {
    subscriptionId, userId, attempt: 3,
  }, { delay: 7 * 24 * 60 * 60 * 1000 }); // 7 days
}
```

---

## Testing

### Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 3220 | 3D Secure required |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0000 0000 0341 | Attached but fails on charge |

### Webhook Testing

```bash
# Local development — forward webhooks to localhost
stripe listen --forward-to localhost:3000/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger invoice.payment_failed
```

### Integration Test Pattern

```typescript
describe('checkout flow', () => {
  it('creates payment intent and handles webhook', async () => {
    // 1. Create checkout
    const { body } = await request(app)
      .post('/api/checkout')
      .send({ orderId: 'test-order', items: [{ id: 'item-1', qty: 1 }] });

    expect(body.clientSecret).toBeDefined();

    // 2. Simulate webhook (in test, skip signature verification)
    const event = createTestEvent('payment_intent.succeeded', {
      metadata: { orderId: 'test-order' },
    });
    await processWebhookEvent(event);

    // 3. Verify order fulfilled
    const order = await db.orders.findUnique({ where: { id: 'test-order' } });
    expect(order.status).toBe('fulfilled');
  });
});
```
