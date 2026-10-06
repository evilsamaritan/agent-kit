# Store Billing

In-app purchases and subscriptions sold through the Apple App Store and Google Play. The store is the merchant; your server is the record of entitlements. This file covers the server and the client contract (send the purchase proof, finish the transaction after the grant, restore); platform purchase-library calls follow the store documentation. Store APIs, fields, and review policies are revised often; take field names and deadlines from the store documentation for the library version in use.

## Contents

- [Entitlement Server](#entitlement-server)
- [Receipt and Token Verification](#receipt-and-token-verification)
- [Restore Purchases](#restore-purchases)
- [Store Notifications and Refunds](#store-notifications-and-refunds)
- [Rules](#rules)

## Entitlement Server

The app never decides what the user owns. The server keeps one entitlement record per user and product (state, expiry, store transaction id, environment) and answers "may this user use this?" from it.

- Entitlements derive from the latest verified store state, not from a client claim and not from event order (same rule as provider subscriptions in SKILL.md).
- Link the store's account identifier (App Store `appAccountToken`, Google Play `obfuscatedAccountId`, both attached at purchase) to your user, so a purchase can be tied to the right account even when the app was reinstalled.
- Web or provider billing and store billing for the same product map to one entitlement, with the source recorded.

## Receipt and Token Verification

- The client sends the purchase proof (signed transaction or purchase token) to your server after the purchase.
- The server verifies it with the store: validate the signature or call the store server API, then check bundle or package id, product id, environment (sandbox vs production), and that the transaction id was not already granted to another user.
- Grant the entitlement, then tell the client to finish (acknowledge or consume) the transaction. A Google Play purchase not acknowledged within three days is refunded automatically and the entitlement revoked; an unfinished App Store transaction is redelivered.
- Verification is idempotent on the store transaction id (pattern: `message-queues` → [idempotency-patterns.md](../../message-queues/references/idempotency-patterns.md)).

## Restore Purchases

- Provide an explicit "Restore purchases" action; App Review Guideline 3.1.1 expects a restore mechanism for any restorable purchase (non-consumables and subscriptions).
- Restore re-submits current proofs to the server, which re-verifies them and rebuilds the entitlement; it never trusts local state.
- Handle a purchase that belongs to a different account of yours: decide, per product, whether to transfer, refuse, or share, and document it.

## Store Notifications and Refunds

- Subscribe to the stores' server notifications (App Store Server Notifications, Google Real-time developer notifications) for renewals, billing retry, grace period, expiry, refund, and revocation. Treat each as a hint: verify the signature, then re-fetch the current state from the store API before changing the entitlement.
- Refunds are decided by the store, not by you: you learn of them from a notification or a refund query, and revoke the entitlement. Consumable value already spent needs an explicit policy.
- Acknowledge notifications quickly and process from a queue; webhook mechanics are in [payment-patterns.md](payment-patterns.md).

## Rules

- A client-side "purchase succeeded" is UX, never fulfilment.
- Never skip the sandbox/production environment check; sandbox transactions must not grant production entitlements.
- Reconcile entitlements against store state on a schedule to catch missed notifications.
