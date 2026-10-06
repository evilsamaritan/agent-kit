---
name: realtime
description: "Design live communication and collaboration. Use for WebSocket, SSE, WebTransport, Socket.IO, live updates, chat, notifications, presence, reconnection and replay, subscription authorization, collaborative editing (CRDT/OT), and realtime scaling."
---

# Realtime Communication

Protocol choice, connection security, message contracts, reconnection, scaling, and collaboration for live features.

## Rules

- **Authenticate before accepting data, authorize every subscription.** A connection proves who the caller is; each join, subscribe, or room entry is checked against the resource. Rooms and channels are access boundaries, not only delivery groups.
- **Check `Origin` on every WebSocket upgrade** when cookies authenticate the connection (cross-site WebSocket hijacking). CORS does not apply to WebSockets.
- **Never put long-lived credentials in URLs** — URLs land in proxy logs and history. Use cookies, a short-lived single-use ticket, or an auth message with a deadline.
- **Enforce token expiry on the server.** Close or require refresh when the credential expires; a refreshed credential must carry the same subject; revoked permissions reach open connections.
- **Limit everything per connection:** message size, message rate, subscriptions, and outbound buffer.
- **Heartbeat and reconnect with full jitter**; replay from a per-stream position, or tell the client to resync from a snapshot. Never silently skip a gap.
- **Choose the simplest protocol that meets the need** (SSE before WebSocket before WebTransport).

---

## Protocol Decision Tree

```
Server-to-client only (notifications, feeds, dashboards, progress)?
  YES -> SSE: plain HTTP, built-in reconnect and Last-Event-ID replay

Bidirectional (chat, collaboration, multiplayer)?
  YES -> Need unreliable or unordered delivery, or many independent streams without head-of-line blocking?
           YES -> WebTransport where HTTP/3 reaches clients end to end; WebRTC DataChannel for peer-to-peer
           NO  -> Want rooms, acks, and fallback transports from a library?
                    YES -> a batteries-included realtime library (Socket.IO-style)
                    NO  -> WebSocket

Peer-to-peer media or data?
  YES -> WebRTC (needs a signaling server and TURN for restrictive networks)

Server renders UI updates (no client-side state)?
  YES -> HTML-over-the-wire over WebSocket or SSE
```

| Feature | WebSocket | SSE | WebTransport | WebRTC DataChannel |
|---------|-----------|-----|--------------|-------------------|
| Direction | Bidirectional | Server → client | Bidirectional | Peer-to-peer |
| Transport | TCP (HTTP/1.1 upgrade; HTTP/2 and HTTP/3 where supported) | HTTP | QUIC (HTTP/3) | SCTP over DTLS/UDP |
| Binary | Yes | No (text) | Yes | Yes |
| Unreliable delivery | No | No | Yes (datagrams) | Yes (configurable) |
| Auto-reconnect | Manual | Built in | Manual | Manual |
| Head-of-line blocking | Yes | Yes | No (per stream) | Configurable |
| Proxy / LB support | Widespread | Widespread (disable buffering) | Requires HTTP/3 path | Needs TURN |

Browser support changes; check current data before choosing WebTransport. Status notes: [websocket-patterns.md](references/websocket-patterns.md#transport-status).

---

## Connection Security

Options, in order of preference for browsers:

1. **Session cookie + Origin allowlist** — the upgrade request carries the cookie; the server validates the session and rejects any `Origin` not on the allowlist before accepting.
2. **Short-lived single-use ticket** — the client fetches a ticket over an authenticated HTTP call (seconds of validity, bound to the user), passes it in the URL or a subprotocol; the server redeems it once during the upgrade.
3. **Auth message after connect** — only with a server deadline (a few seconds); no other message is processed or subscribed before it; close on timeout.

Then, per subscription: `join(room)` → `policy.canRead(user, room.resource)` → join or reject with a reason. Re-check when permissions change (membership removed, document unshared) and remove the connection from affected rooms. Socket and SSE examples: [websocket-patterns.md](references/websocket-patterns.md#authentication), [sse-patterns.md](references/sse-patterns.md#authentication). Authorization models: `auth`.

---

## Message Contract

- Every message has `type`, `id`, and — where order matters — a per-stream `seq`; schema changes are versioned (`v` field or versioned type names), and receivers ignore unknown types.
- Delivery over a reconnecting connection is at-least-once: handlers deduplicate by `id`, and client actions that change state carry an idempotency key the server acknowledges.
- Order is guaranteed per stream at most; never across streams or instances.
- Maximum message size is enforced on both sides; large payloads go over HTTP and the message carries a reference.
- Binary formats only after measuring that JSON size or parse time is a bottleneck; examples: [reconnection-presence-binary.md](references/reconnection-presence-binary.md#binary-formats).

---

## Heartbeats, Close Codes, Reconnection

**Heartbeat:** server pings every 25–30 s; a connection with no pong or message for two intervals is terminated. Browsers cannot send protocol pings, so clients detect silence with an application-level ping or the server's messages. SSE sends a comment line every 15–30 s to keep proxies from closing idle streams.

| Close code | Sent by | Client action |
|------------|---------|---------------|
| 1000 | Either | Normal; reconnect only if the app still needs the stream |
| 1001 | Server (shutdown, deploy) | Reconnect with backoff |
| 1006 | (none — abnormal drop) | Reconnect with backoff |
| 1008 / app code such as 4401 | Server (policy, auth expired) | Refresh credentials first, then reconnect; stop if refresh fails |
| 1011 | Server (error) | Reconnect with backoff |
| 1012 / 1013 | Server (restart / try again later) | Reconnect with longer backoff |
| 4000–4999 | Application | Documented per code |

**Reconnect backoff (full jitter):** `delay = random(0, min(maxDelay, base × 2^attempt))`, base about 1 s, max about 30 s. Reset `attempt` only after the connection has stayed up for a stable period (for example 30 s), not on open — a server that accepts and drops would otherwise be hammered. Reconnect immediately on `online` and on the tab becoming visible. Retry policy in general: `reliability`.

**Replay:** event ids are per stream and ordered. On reconnect the client sends its last position per stream; the server replays from a shared log, or answers `resync_required` when the position is unknown or too old, and the client reloads a snapshot. Contract and code: [reconnection-presence-binary.md](references/reconnection-presence-binary.md).

---

## Scaling

| Strategy | How | Trade-offs |
|----------|-----|-----------|
| Pub/sub fan-out | Each instance subscribes to a broker; publish once, deliver locally | Standard; broker is a dependency; pub/sub alone does not store messages for replay |
| Durable stream per channel | Log or stream with retention feeds instances and replay | Replay and ordering built in; more storage |
| Sticky sessions | Load balancer affinity | Required by protocols with multi-request handshakes (long-polling fallback); uneven load |
| Sharding by room | Route each room to one instance or actor | No cross-instance fan-out within a room; needs routing and rebalancing |
| Stateful per-room actor | One addressable stateful instance per room, possibly at the edge | Removes the pub/sub layer for that room; single-instance limits and vendor coupling |

- Graceful shutdown: stop accepting, send 1001 (or 1012), spread reconnects by letting clients' jitter do the work; drain within the orchestrator's grace period (`backend`, `reliability`).
- Backpressure: watch the per-connection send buffer; drop or coalesce non-critical messages (cursor positions), disconnect consumers that stay behind.
- Library-specific scaling (adapters, sticky sessions, connection-state recovery): [socketio-patterns.md](references/socketio-patterns.md).

---

## Collaboration

```
Will several users edit the same text or structure at the same time?
├── no → server-authoritative operations: each change is a command with a version check
│        (reject or rebase on conflict); field-level last-write-wins where acceptable;
│        one owner per field (`development` rule 3)
└── yes → Is the data text or nested structure with offline editing?
          ├── yes → CRDT library (local-first; merge without a central lock)
          └── no, always online with a central server → operational transformation or server-sequenced operations
```

CRDT operational concerns: the server still authorizes every update (who may write which document); documents and their history grow, so plan snapshotting and garbage collection; persist updates durably before acknowledging; cap document size. Presence and cursors (awareness) travel beside the document sync and are never persisted.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| Joining any room the client names | Anyone reads any channel | Authorize each join against the resource |
| Bearer token in the WebSocket or SSE URL | Leaks into logs and history | Cookie + Origin check, single-use ticket, or auth message with deadline |
| No Origin check with cookie auth | Cross-site WebSocket hijacking | Allowlist `Origin` on upgrade |
| Accepting a refreshed token for another user | Session swap mid-connection | Require the same subject; enforce expiry server-side |
| Replay that returns everything when the id is unknown | Gaps go unnoticed | `resync_required` and a snapshot reload |
| Per-process in-memory replay buffer | Events lost on another instance or restart | Shared log with retention |
| Reset backoff on open | Accept-and-drop servers get hammered | Reset after a stable period |
| No heartbeat | Dead connections hold resources; clients look connected | Ping and timeout on both sides |
| Reaching for CRDTs for forms and boards | Complexity without concurrent text editing | Server-authoritative commands with versions |
| Broadcasting to everyone | Leaks data and wastes bandwidth | Authorized rooms and per-resource channels |
| WebSocket for server-push only | Extra complexity | SSE |

---

## Related Knowledge

- `auth` — authentication options and authorization models for subscriptions
- `api-design` — protocol selection across REST, RPC, and push; idempotency keys
- `graphql` — subscriptions over WebSocket or SSE
- `message-queues` — broker fan-out and durable streams behind realtime gateways
- `web` — browser APIs, HTTP versions, connection limits
- `networking` — load balancers, proxies, HTTP/3 and QUIC paths
- `reliability` — retry policy, graceful shutdown semantics
- `performance` — measuring serialization and connection costs

---

## References

- [websocket-patterns.md](references/websocket-patterns.md) — server and client code, authentication options, limits and backpressure, transport status, production checklist
- [sse-patterns.md](references/sse-patterns.md) — SSE protocol, server and client patterns, authentication, replay storage, proxies
- [socketio-patterns.md](references/socketio-patterns.md) — rooms, namespaces, auth middleware, load balancer requirements, adapters, acknowledgments
- [reconnection-presence-binary.md](references/reconnection-presence-binary.md) — replay contract and code, presence, binary formats
