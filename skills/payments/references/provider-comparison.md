# Payment Provider Comparison

Detailed vendor short-lists for specific business needs. Use this as a lookup after picking a payment path in SKILL.md.

## Contents

- [Provider Selection Decision Tree](#provider-selection-decision-tree)
- [Provider Comparison Matrix](#provider-comparison-matrix)
- [Pattern-to-Provider Shortlist](#pattern-to-provider-shortlist)
- [Notes on Regional Coverage](#notes-on-regional-coverage)

---

## Provider Selection Decision Tree

This tree branches by business profile, not by paths. Use it only after you have picked a payment path in SKILL.md and need a named short-list.

```
What are you building?
├── SaaS / digital products (need tax + compliance handled)?
│   ├── Want zero tax/compliance burden? → Merchant of Record (Paddle, LemonSqueezy)
│   │   MoR = they are the seller of record, handle VAT/GST/sales tax globally
│   └── Want full control + own merchant account? → Stripe / Adyen
├── Marketplace / platform with payouts to sellers?
│   ├── US + simple → Stripe Connect
│   └── Global + complex → Adyen for Platforms / Stripe Connect
├── Enterprise / high-volume / multi-region?
│   └── Adyen (interchange++, 250+ methods, unified online+POS)
├── In-person / retail POS?
│   ├── SMB / US-focused → Square
│   └── Enterprise / global → Adyen
├── Consumer checkout trust matters most?
│   └── PayPal / Braintree (highest consumer recognition)
└── Cross-border / multi-currency priority?
    └── Adyen or Airwallex
```

---

## Provider Comparison Matrix

| Factor | Stripe | Adyen | Braintree | Square | Paddle/LS |
|--------|--------|-------|-----------|--------|-----------|
| **Model** | Gateway | Gateway | Gateway | Gateway | MoR |
| **Best for** | Startups, SaaS | Enterprise, global | PayPal ecosystem | SMB, POS | SaaS, no tax ops |
| **Tax handling** | Add-on (Stripe Tax) | Partial | No | No | Included |
| **POS** | Terminal | Unified | Limited | Core strength | No |

---

## Pattern-to-Provider Shortlist

| Payment path (from SKILL.md) | Typical short-list |
|---|---|
| One-time card checkout, global | Stripe, Adyen, Braintree |
| Subscriptions | Stripe Billing, Chargebee (on top of Stripe/Adyen), Adyen |
| Marketplace / payouts | Stripe Connect, Adyen for Platforms |
| Regional (LATAM / APAC / India) | Local: MercadoPago (LATAM), Razorpay (India), Airwallex (APAC) |
| SaaS MoR | Paddle, LemonSqueezy |
| Crypto / stablecoins | Coinbase Commerce, BitPay, Circle |

---

## Notes on Regional Coverage

- **EU/UK** — Any major gateway works; ensure PSD2/SCA exemption flags are wired correctly.
- **US** — Card networks dominate; ACH/FedNow for B2B and recurring.
- **LATAM** — Local methods (Boleto, OXXO, Pix) matter more than card acceptance; use local aggregators.
- **India** — UPI + RuPay are primary; RBI rules (mandatory 3DS, tokenization) require an India-native PSP.
- **APAC** — Fragmented; multi-method coverage (Alipay, WeChat Pay, GrabPay, local banks) is the deciding factor.
