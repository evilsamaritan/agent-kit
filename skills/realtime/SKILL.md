---
name: realtime
description: Design real-time communication — WebSocket, SSE, WebTransport, scaling, reconnection, presence, CRDTs. Use when implementing WebSocket, SSE, reconnection, presence, binary protocols, collaborative editing, or edge realtime. Do NOT use for message queues or HTTP polling.
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Realtime Communication

Real-time communication patterns for web and API systems. Protocol selection, scaling, reconnection, presence, collaboration.

**Rules:**
- Authenticate on connection upgrade, never after
- Always implement heartbeat + reconnection with exponential backoff and jitter
- Use rooms/channels for targeted delivery, never broadcast to all
- Choose the simplest protocol that meets requirements (SSE before WebSocket before WebTransport)
- Binary protocols only when JSON throughput is a measured bottleneck

---

## Protocol Decision Tree

```
What communication pattern do you need?

Server-to-client only (notifications, feeds, dashboards)?
  YES -> SSE
         Simple, HTTP/2 friendly, auto-reconnect, Last-Event-ID replay.

Bidirectional (chat, collaboration, gaming)?
  YES -> Need low-latency unreliable delivery (gaming, media)?
           YES -> WebTransport (if HTTP/3 available) or WebRTC DataChannel
           NO  -> Need rooms, namespaces, ack, fallback transport?
                    YES -> Socket.io (batteries-included abstraction)
                    NO  -> WebSocket (direct control, widest support)

Peer-to-peer (no server relay)?
  YES -> WebRTC DataChannel (browser-to-browser, needs signaling server)

Collaborative editing (conflict resolution)?
  YES -> CRDT library (Yjs, Automerge) over any transport above

Server-driven UI updates (no client JS for interactivity)?
  YES -> HTML-over-the-wire (LiveView/Livewire pattern over WebSocket)
```

## Protocol Comparison

| Feature | WebSocket | SSE | WebTransport | WebRTC DataChannel |
|---------|-----------|-----|--------------|-------------------|
| Direction | Bidirectional | Server -> Client | Bidirectional | Peer-to-peer bidirectional |
| Transport | TCP (ws/wss) | HTTP/1.1 or HTTP/2 | QUIC (HTTP/3) | DTLS/SCTP over UDP |
| Binary | Yes (frames) | No (text only) | Yes (streams + datagrams) | Yes |
| Unreliable delivery | No | No | Yes (datagrams) | Yes (configurable) |
| Auto-reconnect | Manual | Built-in | Manual | Manual |
| HTTP/2 multiplexing | No (separate TCP) | Yes | N/A (uses QUIC) | No |
| Head-of-line blocking | Yes (TCP) | Yes (TCP) | No (QUIC) | No (UDP) |
| Browser support | All modern | All modern | Chromium + Firefox (expanding) | All modern |
| Connection limit | OS-level | 6/domain (HTTP/1.1) | OS-level | OS-level |
| Auth | On upgrade or message | Headers/cookies | On session setup | Signaling server |

---

## WebSocket Essentials

### Connection Lifecycle

```
Client                          Server
  |--- HTTP Upgrade Request ------>|
  |<-- 101 Switching Protocols ----|
  |--- Auth message -------------->|   (if not in upgrade headers)
  |<-- Auth ack -------------------|
  |<-- ping ---------------------->|   (heartbeat, every 30s)
  |<-- pong ---------------------->|
  |--- data ---------------------->|
  |<-- data -----------------------|
  |--- close (1000, "done") ----->|
  |<-- close (1000, "done") ------|
```

### Heartbeat Rules
- Server pings every 30s; if no pong in 10s, terminate connection
- Client detects server silence and reconnects
- Use application-level ping (JSON) if WS ping frames are inaccessible (browser API)

### Close Codes

| Code | Meaning | Action |
|------|---------|--------|
| 1000 | Normal closure | Clean shutdown |
| 1001 | Going away (page navigation) | Clean shutdown |
| 1006 | Abnormal closure (no close frame) | Reconnect |
| 1008 | Policy violation | Do not reconnect |
| 1011 | Server error | Reconnect with backoff |
| 1013 | Server overloaded | Reconnect with longer backoff |
| 4000-4999 | Application-defined | Custom logic |

---

## SSE Essentials

- Required headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- Wire format: `event:`, `data:`, `id:`, `retry:` fields; blank line terminates event
- `Last-Event-ID` header sent automatically on reconnect -- server replays missed events
- Heartbeat: send `: heartbeat\n\n` comment every 15s to prevent proxy timeouts
- HTTP/1.1 limit: 6 connections per domain; use HTTP/2 or dedicated subdomain
- Native `EventSource` API has no custom header support -- use `fetch()` with ReadableStream for bearer tokens

---

## WebTransport Essentials

WebTransport provides bidirectional communication over QUIC (HTTP/3) with features WebSocket lacks:
- **Streams**: reliable, ordered (like WebSocket but multiplexed -- no head-of-line blocking)
- **Datagrams**: unreliable, unordered (like UDP -- for gaming, cursor positions, sensor data)
- **Multiple streams**: open many concurrent streams over a single connection

```
When to choose WebTransport over WebSocket:
- Head-of-line blocking is a measured problem (high-frequency small messages)
- You need mix of reliable streams + unreliable datagrams
- HTTP/3 is available in your infrastructure
- Target browsers support it (check caniuse.com/webtransport)

When to stay with WebSocket:
- Need widest browser support
- TCP ordering is acceptable
- Existing infrastructure and tooling
```

Status: W3C Working Draft with growing browser support. Check caniuse.com/webtransport before adopting. Use as progressive enhancement until ecosystem matures.

---

## Scaling Strategies

| Strategy | How | Tradeoffs |
|----------|-----|-----------|
| Sticky sessions | Load balancer affinity (IP/cookie hash) | Simple; uneven load distribution |
| Pub/sub adapter | Cross-instance messaging via pub/sub broker | Scalable, standard; broker as dependency |
| Shared-nothing | Client knows which shard to connect to | No coordination overhead; complex routing |
| Edge realtime | Stateful edge instances close to users | Low latency globally; vendor-specific patterns |

### Edge Realtime Pattern

Stateful edge compute (e.g., Durable Objects, Liveblocks) co-locates WebSocket server with users:
- Each "room" runs as a stateful instance at the nearest edge location
- Built-in WebSocket hibernation -- instance sleeps when idle, wakes on message
- No separate pub/sub layer needed within a room; cross-room uses messaging
- Trade-off: vendor coupling, cold start latency, instance memory limits

---

## Reconnection Rules

- Formula: `delay = min(base * 2^attempt, maxDelay) * random(0.5, 1.0)`
- Reset attempt counter on **successful connection**, not on attempt
- Do not retry on close code 1008 (policy violation)
- Reconcile state on reconnect: send last event ID, replay missed events
- Cap max delay at 30s
- Detect network state: listen to `online`/`visibilitychange` events for immediate reconnect

---

## Collaborative Realtime (CRDTs)

For collaborative editing (documents, whiteboards, shared state), use CRDTs over raw WebSocket:

```
Do you need collaborative editing?
  NO  -> Standard WebSocket/SSE patterns
  YES -> What kind of data?
         Text / rich text -> Yjs (mature, editor bindings for Monaco/CodeMirror/Quill)
         JSON-like state  -> Automerge (clean API, Rust/WASM performance)
         Custom data types -> Build on CRDT primitives from either library
```

Key concepts:
- **Conflict-free**: concurrent edits merge deterministically without coordination
- **Local-first**: every client has a full copy; server is relay, not authority
- **Transport-agnostic**: CRDTs work over WebSocket, WebRTC, or any sync layer
- Awareness protocol (cursor positions, selections) runs alongside CRDT sync

---

## Binary Protocols

| Protocol | Size vs JSON | Schema | Best for |
|----------|-------------|--------|----------|
| Protocol Buffers | -60-80% | .proto files | High-throughput, cross-language |
| MessagePack | -20-40% | No | Drop-in JSON replacement |
| CBOR | -20-40% | No | IoT, constrained environments |
| FlatBuffers | -60-80% | .fbs files | Zero-copy reads, gaming, 60fps updates |

Only switch from JSON when: measured serialization cost > 10% of message processing time, or bandwidth is constrained.

---

## Context Adaptation

### Frontend
- Manage connection lifecycle: connect, disconnect, visibility change, network change
- Reconnect with exponential backoff + jitter; show connection status indicator
- Sync state on reconnect: send last known event ID, reconcile missed updates
- Optimistic updates: apply locally, confirm on server ack, rollback on failure
- For collaborative features: integrate CRDT library, not custom merge logic

### Backend
- Scale with pub/sub adapter for cross-instance message delivery
- Use rooms/channels for targeted broadcasting (never broadcast to everyone)
- Handle binary frames when throughput requires it
- Set connection limits per user/tenant; implement backpressure (check `bufferedAmount`)
- Authenticate on WebSocket upgrade request, not after connection
- Store recent events for replay on reconnect (event store with TTL)

### Architect
- SSE for simple server-push (dashboards, notifications) -- fewer moving parts than WebSocket
- WebSocket for bidirectional (chat, collaboration, gaming)
- WebTransport as progressive enhancement when QUIC infrastructure is available
- Edge realtime for latency-sensitive global apps (gaming, collaboration)
- CRDTs for conflict-free collaboration; avoid custom merge logic

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| No heartbeat | Dead connections consume resources | Ping/pong every 30s, timeout at 60s |
| Reconnect without backoff | Thundering herd on server recovery | Exponential backoff with jitter |
| Unbounded connections | Server runs out of file descriptors | Per-user limits, connection pooling |
| No auth on WS upgrade | Anyone can connect and listen | Validate token in upgrade headers |
| Broadcasting without rooms | Every client gets every message | Use rooms/channels for targeted delivery |
| Custom merge logic for collaboration | Race conditions, data loss | Use CRDT library (Yjs, Automerge) |
| WebSocket for server-push only | Unnecessary complexity | Use SSE -- simpler, auto-reconnect |
| JSON for high-frequency updates | Serialization becomes bottleneck | Measure first; switch to binary if needed |

---

## Related Knowledge

- **message-queues** -- event-driven backends that feed real-time frontends (broker -> WebSocket fan-out)
- **api-design** -- protocol selection, HTTP/2 streaming, API patterns that complement real-time
- **graphql** -- GraphQL subscriptions use WebSocket or SSE as transport layer
- **web-platform** -- HTTP/2, HTTP/3, fetch API, service workers, browser connection limits
- **networking** -- TLS, load balancing, QUIC/HTTP/3 infrastructure for WebTransport
- **performance** -- measuring serialization overhead, connection pooling, backpressure tuning
- **caching** -- cache invalidation strategies that trigger real-time updates

---

## References

- [websocket-patterns.md](references/websocket-patterns.md) -- Server/client implementations, authentication, scaling architecture, rate limiting, production checklist
- [sse-patterns.md](references/sse-patterns.md) -- SSE protocol, server implementations (Node/Go/Python), client patterns, authentication, scaling
- [socketio-patterns.md](references/socketio-patterns.md) -- Rooms/namespaces, auth middleware, adapter scaling, acknowledgments, error handling
- [reconnection-presence-binary.md](references/reconnection-presence-binary.md) -- Backoff implementation, state reconciliation, presence systems, binary protocol examples
