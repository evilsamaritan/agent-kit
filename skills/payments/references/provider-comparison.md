# Payment Provider Comparison

Provider short-lists after a payment path is chosen in SKILL.md. Names are examples, not endorsements; providers change products, coverage, and ownership often, so confirm current capabilities and terms with the provider before recommending one.

## Contents

- [Selection Decision Tree](#selection-decision-tree)
- [Durable Differences](#durable-differences)
- [Path-to-Provider Short-List](#path-to-provider-short-list)
- [Regional Notes](#regional-notes)

---

## Selection Decision Tree

```
Do you want to be the seller of record (register for and remit sales tax/VAT yourself)?
├── no → merchant-of-record provider
└── yes → What dominates the business?
    ├── Payouts to third parties (marketplace, platform) → provider with connected accounts and KYC onboarding
    ├── Online + in-person in one ledger → provider with unified online and terminal acceptance
    ├── Many countries and local methods → global acquirer, or a regional provider per market behind your own module
    ├── Consumer wallet recognition at checkout → add a wallet provider's button alongside cards
    └── Otherwise → a developer-focused card processor with hosted fields and native billing
```

---

## Durable Differences

| Dimension | Options | Why it matters |
|-----------|---------|----------------|
| Seller of record | Gateway/processor (you are the merchant) vs merchant of record (provider is) | Tax registration, refunds policy, chargeback handling, margins |
| Pricing model | Blended rate vs interchange-plus | Cost predictability vs lower cost at volume |
| Acquiring | Own acquiring licence vs partner acquirers | Authorization rates, settlement control |
| Coverage | Global vs regional | Local methods and local acquiring raise acceptance |
| Channels | Online only vs unified online + terminals | One customer and one ledger across channels |
| Billing | Native subscriptions and invoicing vs bring-your-own billing system | Who owns retries, proration, tax lines |

---

## Path-to-Provider Short-List

Examples only.

| Payment path | Typical short-list |
|---|---|
| One-time card checkout | Stripe, Adyen, Braintree, Checkout.com |
| Recurring billing | Provider-native billing (Stripe Billing, Adyen), or a billing system on top (Chargebee, Recurly) |
| Marketplace / payouts | Stripe Connect, Adyen for Platforms |
| Merchant of record | Paddle, FastSpring |
| LATAM | Mercado Pago, dLocal, EBANX |
| India | Razorpay, PayU, Cashfree |
| APAC multi-market | Adyen, Airwallex, local wallets via aggregators |
| In-person SMB | Square, Stripe Terminal, SumUp |
| Stablecoin acceptance | Provider add-ons or specialised crypto gateways; check licensing per market |

---

## Regional Notes

- **EEA/UK** — any major gateway works; wire SCA exemptions and merchant-initiated flags correctly.
- **US** — cards dominate; ACH for B2B and recurring; instant rails through bank or fintech partners.
- **LATAM** — local methods (Pix, Boleto, OXXO) and installments matter more than card acceptance alone.
- **India** — UPI is primary; card-on-file tokenization and authentication rules favour India-licensed providers.
- **APAC** — fragmented; wallet and bank-method coverage per market is the deciding factor.
