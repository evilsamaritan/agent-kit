# Payments Regulation and Rails

Volatile facts behind the evergreen rules in SKILL.md, with the date each status was reached; regulators and card schemes change thresholds, dates, and eligibility criteria. The primary sources are the PCI SSC document library, the EU Official Journal and Council register, and the scheme or central bank. Compliance programme obligations: `compliance`.

## Contents

- [PCI DSS](#pci-dss)
- [SCA and Regional Authentication Rules](#sca-and-regional-authentication-rules)
- [PSD2, PSD3, and PSR](#psd2-psd3-and-psr)
- [Bank and Instant Rails](#bank-and-instant-rails)
- [Wallets, BNPL, Stablecoins](#wallets-bnpl-stablecoins)

---

## PCI DSS

- **Version:** PCI DSS v4.0.1 is the published version; successors appear in the PCI SSC document library first. The requirements that v4.0 marked "future-dated" became mandatory on 31 March 2025 (among them MFA for all access to the cardholder data environment, targeted risk analyses, and payment-page script controls in 6.4.3 and change detection in 11.6.1).
- **SAQ A update (published January 2025, effective 31 March 2025):** requirements 6.4.3, 11.6.1, and the related targeted risk analysis in 12.3.1 were removed from SAQ A. In their place, an eligibility criterion requires the merchant to confirm its site is not susceptible to attacks from scripts that could affect its e-commerce system. PCI SSC FAQ 1588 (February 2025) allows two ways to confirm it for embedded payment forms: apply techniques such as those in 6.4.3 and 11.6.1 yourself or through a third party, or obtain written confirmation from the payment provider that its embedded solution includes such protection when implemented as instructed. The requirements themselves remain in PCI DSS.
- **Merchant levels** are set by each card brand and acquirer (by annual transaction count per brand); they decide whether you file a self-assessment or need an on-site assessment by a QSA. Ask the acquirer for your level rather than inferring it.

| Integration | Usual SAQ |
|-------------|-----------|
| Redirect to provider page, or all card fields in provider iframes | SAQ A (if eligibility criteria hold) |
| Your page's scripts can affect how card data is captured (direct post, JS-built form) | SAQ A-EP |
| Standalone terminals / IP terminals / validated P2PE | SAQ B / B-IP / P2PE |
| Card data stored, processed, or transmitted by your systems | SAQ D |

---

## SCA and Regional Authentication Rules

- **EEA and UK:** SCA under PSD2 and the UK equivalent. Low-value exemption: up to EUR 30 per transaction with cumulative limits (count or amount since the last authentication) tracked by the issuer. TRA thresholds scale with the acquirer's and issuer's fraud rates.
- **India:** additional factor of authentication for card-not-present domestic transactions, with RBI-defined exceptions; card-on-file storage is restricted to tokenized credentials.
- **Elsewhere:** 3DS is usually optional and used for liability shift or high-risk transactions; issuer and scheme rules differ by market.
- 3DS 1.0 has been retired by the schemes; integrations use EMV 3DS 2.x.

---

## PSD2, PSD3, and PSR

- PSD2 remains the law in force in the EEA.
- PSD3 (a directive) and the Payment Services Regulation (PSR, directly applicable): provisional agreement with the European Parliament on 27 November 2025, confirmed by the Council's COREPER on 22 April 2026. The Council's financial-services state of play of 2 October 2026 still lists both at that stage: not yet formally adopted, not published in the Official Journal, not in force.
- Both apply only after a transition period counted from Official Journal publication (reported as roughly 18 months for PSD3 transposition and 21 months for the PSR); take the exact dates from the published text.
- Expected effects for merchants and PSPs: stronger fraud-prevention and liability rules (including impersonation fraud), changes to open-banking access, and refined SCA rules. Build against the published text, not the provisional agreement.

---

## Bank and Instant Rails

| Rail | Region | Pattern | Notes |
|------|--------|---------|-------|
| ACH | US | Batch debit/credit via provider | 1–3 business days; returns arrive days later — treat as pending |
| FedNow / RTP | US | Instant credit transfer via bank or fintech partner | Push-only; per-transaction limits set by the network and each participant bank |
| SEPA Credit Transfer / Instant | EEA | Push payment; SEPA Instant settles in seconds | Instant reachability is mandated for euro-area PSPs under the Instant Payments Regulation |
| SEPA Direct Debit | EEA | Pull with a mandate | Customer can dispute for weeks; long refund window |
| UPI | India | Push or collect via provider | Near-instant; mandates for recurring payments |
| Pix | Brazil | QR or key-based instant push | Dominant local method |
| Local bank redirects (iDEAL, Bancontact, BLIK, ...) | Regional | Redirect to bank or app | Confirmation via webhook; never via redirect alone |

Pull rails (debits) can be reversed after "success"; design fulfilment and access for late returns.

---

## Wallets, BNPL, Stablecoins

- **Wallets** (Apple Pay, Google Pay, Click to Pay): network tokens with device authentication; web integrations need domain registration with the wallet; usually counted as authenticated for SCA.
- **BNPL:** provider redirect or widget; the BNPL provider carries credit risk; consumer-credit regulation is tightening in several markets — check disclosure rules per market.
- **Stablecoins:** settlement is fast and irreversible (no chargebacks), which also means no consumer dispute path; licensing, travel-rule, and tax treatment vary by jurisdiction. Use a licensed gateway or provider add-on and convert at the boundary; keep token precision separate from fiat minor units.
