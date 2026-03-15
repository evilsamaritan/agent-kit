# Payment Patterns — Provider-Agnostic Architecture

## Contents

- [Provider Adapter Pattern](#provider-adapter-pattern) — core interface, adapter implementation, provider registry
- [Idempotent Payment Processing](#idempotent-payment-processing) — key strategy, safe retry pattern
- [Webhook Handler](#webhook-handler-provider-agnostic) — signature verification, normalized events, idempotent processing
- [Reconciliation](#reconciliation) — daily reconciliation job
- [Refund Flows](#refund-flows) — refund handler, dispute/chargeback handling
- [Multi-Currency](#multi-currency) — currency handling rules, zero-decimal currencies
- [Payment Method Saving](#payment-method-saving) — setup intents, off-session charges
- [Receipt Generation](#receipt-generation) — receipt data model

## Provider Adapter Pattern

Abstract payment operations behind a common interface. Each provider implements the same contract.

### Core Interface

```typescript
interface PaymentProvider {
  name: string;

  // Lifecycle operations
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent>;
  capturePayment(paymentId: string, amount?: number): Promise<PaymentCapture>;
  refundPayment(paymentId: string, params: RefundParams): Promise<Refund>;

  // Customer & payment method management
  createCustomer(params: CustomerParams): Promise<Customer>;
  tokenizePaymentMethod(params: TokenizeParams): Promise<PaymentMethod>;

  // Subscriptions
  createSubscription(params: SubscriptionParams): Promise<Subscription>;
  updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, params: CancelParams): Promise<Subscription>;

  // Webhooks
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean;
  parseWebhookEvent(payload: string | Buffer): NormalizedEvent;
}

interface CreatePaymentParams {
  amount: Money;
  customerId?: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
  capture?: boolean;          // true = auth+capture; false = auth only
  returnUrl?: string;         // for redirect-based flows
  paymentMethodTypes?: string[];
}

interface Money {
  amount: number;    // smallest currency unit (cents for USD, yen for JPY)
  currency: string;  // ISO 4217 lowercase
}

interface PaymentIntent {
  id: string;
  providerId: string;         // provider's native ID
  provider: string;           // 'stripe' | 'adyen' | 'braintree' | etc.
  status: PaymentStatus;
  amount: Money;
  clientToken?: string;       // client secret / session token for frontend SDK
  metadata?: Record<string, string>;
}

type PaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'         // 3DS, redirect, etc.
  | 'processing'
  | 'authorized'              // auth hold placed
  | 'captured'                // funds claimed
  | 'canceled'
  | 'failed';

interface NormalizedEvent {
  id: string;
  provider: string;
  type: NormalizedEventType;
  originalType: string;       // provider's native event type
  data: Record<string, unknown>;
  timestamp: Date;
}

type NormalizedEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.refunded'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'dispute.created';
```

### Adapter Implementation (Stripe Example)

```typescript
class StripeAdapter implements PaymentProvider {
  name = 'stripe';
  private client: Stripe;

  constructor(secretKey: string) {
    this.client = new Stripe(secretKey);
  }

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntent> {
    const pi = await this.client.paymentIntents.create({
      amount: params.amount.amount,
      currency: params.amount.currency,
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      capture_method: params.capture === false ? 'manual' : 'automatic',
      automatic_payment_methods: { enabled: true },
      metadata: params.metadata,
    }, {
      idempotencyKey: params.idempotencyKey,
    });

    return {
      id: generateInternalId(),
      providerId: pi.id,
      provider: 'stripe',
      status: this.mapStatus(pi.status),
      amount: params.amount,
      clientToken: pi.client_secret ?? undefined,
      metadata: params.metadata,
    };
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
    try {
      this.client.webhooks.constructEvent(payload, signature, secret);
      return true;
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: string | Buffer): NormalizedEvent {
    const raw = JSON.parse(typeof payload === 'string' ? payload : payload.toString());
    return {
      id: raw.id,
      provider: 'stripe',
      type: this.mapEventType(raw.type),
      originalType: raw.type,
      data: raw.data.object,
      timestamp: new Date(raw.created * 1000),
    };
  }

  private mapEventType(stripeType: string): NormalizedEventType {
    const map: Record<string, NormalizedEventType> = {
      'payment_intent.succeeded': 'payment.succeeded',
      'payment_intent.payment_failed': 'payment.failed',
      'charge.refunded': 'payment.refunded',
      'customer.subscription.created': 'subscription.created',
      'customer.subscription.updated': 'subscription.updated',
      'customer.subscription.deleted': 'subscription.canceled',
      'invoice.payment_succeeded': 'invoice.paid',
      'invoice.payment_failed': 'invoice.payment_failed',
      'charge.dispute.created': 'dispute.created',
    };
    return map[stripeType] ?? 'payment.failed';
  }

  private mapStatus(stripeStatus: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      'requires_payment_method': 'requires_payment_method',
      'requires_confirmation': 'requires_confirmation',
      'requires_action': 'requires_action',
      'processing': 'processing',
      'requires_capture': 'authorized',
      'succeeded': 'captured',
      'canceled': 'canceled',
    };
    return map[stripeStatus] ?? 'failed';
  }
}
```

### Provider Registry

```typescript
class PaymentService {
  private providers = new Map<string, PaymentProvider>();
  private defaultProvider: string;

  constructor(defaultProvider: string) {
    this.defaultProvider = defaultProvider;
  }

  register(provider: PaymentProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name?: string): PaymentProvider {
    const provider = this.providers.get(name ?? this.defaultProvider);
    if (!provider) throw new Error(`Payment provider '${name}' not registered`);
    return provider;
  }

  // Route to provider based on rules
  resolveProvider(params: CreatePaymentParams): PaymentProvider {
    // Example routing logic:
    // - High-value transactions → provider with lower interchange fees
    // - Specific currencies → provider with best regional coverage
    // - Fallback → default provider
    return this.getProvider(this.defaultProvider);
  }
}

// Bootstrap
const paymentService = new PaymentService('stripe');
paymentService.register(new StripeAdapter(process.env.STRIPE_SECRET_KEY!));
// paymentService.register(new AdyenAdapter(process.env.ADYEN_API_KEY!));
```

---

## Idempotent Payment Processing

### Idempotency Key Strategy

Generate deterministic idempotency keys: `${action}-${orderId}-v${version}` (e.g., `charge-order-123-v1`). Increment version when inputs change (e.g., amount changed). Use distinct action prefixes for different operations (`charge-`, `refund-`).

### Safe Retry Pattern

```typescript
async function chargeWithRetry(
  provider: PaymentProvider,
  params: CreatePaymentParams,
  maxRetries: number = 3
): Promise<PaymentIntent> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await provider.createPaymentIntent(params);
    } catch (err: unknown) {
      const isRetryable = err instanceof Error &&
        ('code' in err && (err as any).code === 'ECONNRESET' ||
         'statusCode' in err && (err as any).statusCode >= 500);

      if (isRetryable && attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000); // exponential backoff
        continue; // safe — idempotency key prevents double charge
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}
```

---

## Webhook Handler (Provider-Agnostic)

```typescript
async function handleWebhook(req: Request, providerName: string) {
  const provider = paymentService.getProvider(providerName);

  // 1. Verify signature (provider-specific)
  const signature = req.headers[`x-${providerName}-signature`]
    ?? req.headers['stripe-signature']
    ?? req.headers['x-adyen-hmac-signature']
    ?? '';

  if (!provider.verifyWebhookSignature(req.rawBody, signature as string, getWebhookSecret(providerName))) {
    throw new UnauthorizedError('Invalid webhook signature');
  }

  // 2. Parse to normalized event
  const event = provider.parseWebhookEvent(req.rawBody);

  // 3. Idempotent processing — skip if already handled
  const existing = await db.webhookEvents.findUnique({ where: { eventId: event.id } });
  if (existing) return { received: true };

  // 4. Route by normalized event type
  try {
    await processNormalizedEvent(event);
    await db.webhookEvents.create({
      data: { eventId: event.id, provider: providerName, type: event.type, processedAt: new Date() },
    });
  } catch (err) {
    console.error(`Webhook processing failed [${event.type}]:`, err);
    throw err; // return 500 so provider retries
  }

  return { received: true };
}

async function processNormalizedEvent(event: NormalizedEvent) {
  switch (event.type) {
    case 'payment.succeeded':
      await fulfillOrder(event.data.metadata?.orderId as string, event.data.id as string);
      break;
    case 'payment.failed':
      await notifyPaymentFailed(event.data.metadata?.orderId as string);
      break;
    case 'invoice.paid':
      await extendSubscriptionAccess(event.data);
      await sendReceipt(event.data);
      break;
    case 'invoice.payment_failed':
      await startDunning(event.data);
      break;
    case 'subscription.canceled':
      await revokeAccess(event.data);
      await sendCancellationEmail(event.data);
      break;
    case 'dispute.created':
      await handleDispute(event);
      break;
  }
}
```

---

## Reconciliation

### Daily Reconciliation Job

Run daily: fetch provider transactions for yesterday, fetch local payment records for the same period, then cross-reference by provider transaction ID. Find three types of discrepancies: transactions missing locally, transactions missing in provider, and amount mismatches. Alert ops on any discrepancy with the specific IDs affected.

---

## Refund Flows

### Provider-Agnostic Refund Handler

```typescript
async function processRefund(
  orderId: string,
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent',
  amount?: number // undefined = full refund
): Promise<Refund> {
  const order = await db.orders.findUniqueOrThrow({ where: { id: orderId } });
  if (order.refundedAt) throw new ConflictError('Order already refunded');

  const provider = paymentService.getProvider(order.paymentProvider);
  const refund = await provider.refundPayment(order.providerPaymentId, {
    amount: amount ? { amount, currency: order.currency } : undefined,
    reason,
    metadata: { orderId, refundedBy: getCurrentUserId() },
    idempotencyKey: `refund-${orderId}-${amount ?? 'full'}`,
  });

  await db.orders.update({
    where: { id: orderId },
    data: { status: amount ? 'partially_refunded' : 'refunded', refundedAt: new Date(), refundId: refund.id, refundAmount: refund.amount.amount },
  });
  await sendRefundConfirmation(order.userId, order, refund);
  return refund;
}
```

### Dispute / Chargeback Handling

On `dispute.created` webhook: (1) log dispute immediately (provider, dispute ID, order ID, amount, reason, status, evidence due date), (2) alert ops team, (3) auto-gather evidence if order ID exists (shipping proof, access logs, correspondence) and submit via provider API before the evidence deadline.

---

## Multi-Currency

### Currency Handling Rules

```typescript
// ALWAYS store amounts as integers in smallest currency unit
interface Money {
  amount: number;    // 9999 = $99.99 USD, 9999 = ¥9999 JPY
  currency: string;  // ISO 4217 lowercase
}

// Zero-decimal currencies (no fractional units)
const ZERO_DECIMAL = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw',
  'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

function toSmallestUnit(displayAmount: number, currency: string): number {
  return Math.round(ZERO_DECIMAL.has(currency.toLowerCase()) ? displayAmount : displayAmount * 100);
}
function toDisplayAmount(smallestUnit: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? smallestUnit : smallestUnit / 100;
}
function formatMoney(money: Money, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency.toUpperCase() })
    .format(toDisplayAmount(money.amount, money.currency));
}
```

---

## Payment Method Saving

1. Create setup intent with `tokenizePaymentMethod({ customerId, usage: 'off_session' })` -- returns client token for frontend SDK
2. Charge saved method later with `createPaymentIntent({ customerId, paymentMethodId: savedMethodId })` using deterministic idempotency key

---

## Receipt Generation

Build receipts from order + payment + line items. Include: receipt number, date, customer info, line items (name, qty, unit price, total), subtotal, tax, total, currency, payment method summary ("Visa ****4242").
