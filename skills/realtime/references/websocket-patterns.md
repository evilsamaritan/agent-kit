# WebSocket Patterns

Server and client code, authentication, limits, and operations. Node examples use the `ws` library; the patterns apply to any server.

## Contents

- [Server Implementation](#server-implementation)
- [Authentication](#authentication)
- [Subscription Authorization](#subscription-authorization)
- [Client Implementation](#client-implementation)
- [Fan-Out Across Instances](#fan-out-across-instances)
- [Limits and Backpressure](#limits-and-backpressure)
- [Transport Status](#transport-status)
- [Production Checklist](#production-checklist)

---

## Server Implementation

Authenticate in the HTTP upgrade handler, before the WebSocket exists.

```javascript
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });   // size limit per message
const ALLOWED_ORIGINS = new Set(config.allowedOrigins);

server.on('upgrade', async (req, socket, head) => {          // 'upgrade' is emitted by the HTTP server
  try {
    if (!ALLOWED_ORIGINS.has(req.headers.origin)) throw new HttpError(403);
    const principal = await authenticateUpgrade(req);          // cookie session or single-use ticket
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, principal));
  } catch (err) {
    socket.write(`HTTP/1.1 ${err.status ?? 401} ${err.status === 403 ? 'Forbidden' : 'Unauthorized'}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }
});

wss.on('connection', (ws, req, principal) => {
  const conn = connections.add(ws, principal);                 // tracks user, rooms, expiry, rate limiter
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data, isBinary) => {
    if (!conn.rateLimiter.allow()) return ws.close(1008, 'rate limit');
    let msg;
    try { msg = decode(data, isBinary); } catch { return send(ws, { type: 'error', code: 'bad_message' }); }
    router.handle(conn, msg).catch((err) => {
      log.error({ err, user: principal.userId }, 'ws handler failed');
      send(ws, { type: 'error', code: 'internal', ref: msg.id });
    });
  });

  ws.on('close', () => connections.remove(conn));
  ws.on('error', (err) => log.warn({ err: err.message, user: principal.userId }, 'ws error'));
});

// Heartbeat: terminate connections that missed a pong
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
wss.on('close', () => clearInterval(heartbeat));
```

Other stacks: authenticate in the HTTP handler before calling the upgrader, check `Origin` in the upgrader, set a read limit, reset the read deadline in the pong handler, and use one reader and one writer per connection.

---

## Authentication

### 1. Session cookie + Origin allowlist (preferred for browsers on the same site)

```javascript
async function authenticateUpgrade(req) {
  const session = await sessions.fromCookie(req.headers.cookie);
  if (session) return { userId: session.userId, expiresAt: session.expiresAt };
  const ticket = new URL(req.url, 'http://placeholder').searchParams.get('ticket');
  if (ticket) return redeemTicket(ticket);
  throw new HttpError(401);
}
```

The Origin check above is mandatory with cookies: without it, any site can open a socket with the user's cookies.

### 2. Single-use ticket (cross-site clients, or token-based apps)

```javascript
// HTTP, authenticated with the normal API credential
app.post('/realtime/tickets', requireAuth, async (req, res) => {
  const ticket = randomToken(32);
  await store.set(`ws-ticket:${sha256(ticket)}`, req.user.id, { ttlSeconds: 30 });
  res.json({ ticket });
});

async function redeemTicket(ticket) {
  const userId = await store.getAndDelete(`ws-ticket:${sha256(ticket)}`);   // single use
  if (!userId) throw new HttpError(401);
  return { userId, expiresAt: Date.now() + SESSION_MAX_MS };
}

// Client
const { ticket } = await api.post('/realtime/tickets');
const ws = new WebSocket(`wss://rt.example.com/ws?ticket=${encodeURIComponent(ticket)}`);
```

A ticket in the URL is acceptable because it is useless after one use and seconds of validity.

### 3. Auth message with a deadline

Accept the upgrade, start a timer (for example 5 s), process nothing except `{ type: 'auth', token }`, and close with 4401 if it does not arrive or fails. Do not subscribe the connection to anything before it succeeds.

### Expiry and refresh

```javascript
// Server: enforce expiry on the connection
setInterval(() => {
  for (const conn of connections.all()) {
    if (conn.expiresAt <= Date.now()) conn.ws.close(4401, 'credential expired');
  }
}, 15_000);

// Refresh over the socket: same subject only
async function onAuthRefresh(conn, msg) {
  const principal = await verifyAccessToken(msg.token);
  if (principal.userId !== conn.principal.userId) return conn.ws.close(1008, 'subject mismatch');
  conn.expiresAt = principal.expiresAt;
  await conn.recheckSubscriptions();                    // permissions may have changed
}
```

---

## Subscription Authorization

```javascript
async function onJoin(conn, { room, id }) {
  const resource = parseRoom(room);                      // e.g. { type: 'document', id: '...' }; unknown → reject
  if (!resource || !(await policy.canRead(conn.principal, resource))) {
    return send(conn.ws, { type: 'join_rejected', room, ref: id });
  }
  if (conn.rooms.size >= MAX_ROOMS_PER_CONN) return send(conn.ws, { type: 'join_rejected', room, reason: 'limit', ref: id });
  rooms.join(room, conn);
  send(conn.ws, { type: 'joined', room, ref: id });
}

// When access changes (member removed, document unshared), the domain publishes an event:
events.on('access.revoked', ({ userId, resource }) => {
  for (const conn of connections.forUser(userId)) {
    const room = roomFor(resource);
    if (conn.rooms.has(room)) { rooms.leave(room, conn); send(conn.ws, { type: 'removed', room }); }
  }
});
```

Writes over the socket (`edit`, `send-message`) go through the same service-layer authorization as HTTP writes.

---

## Client Implementation

```typescript
class RealtimeClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stableTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;        // at most one pending reconnect
  private connecting = false;
  private closedByUser = false;

  constructor(private opts: { connect: () => Promise<WebSocket>; onMessage: (m: Message) => void;
                              onStatus: (s: 'connecting' | 'open' | 'closed') => void;
                              onError: (err: unknown) => void;
                              refreshAuth: () => Promise<boolean> }) {}  // false: sign-in needed; rejects: transient

  // The caller's intent to be connected; only start() clears a previous stop()
  start() {
    this.closedByUser = false;
    return this.open();
  }

  private async open() {
    if (this.closedByUser || this.connecting || this.isLive()) return;   // one socket at a time
    this.connecting = true;
    this.opts.onStatus('connecting');
    let ws: WebSocket;
    try {
      ws = await this.opts.connect();                         // fetches a ticket if needed
    } catch (err) {                                           // offline, server down, ticket refused
      this.connecting = false;
      this.opts.onError(err);
      this.opts.onStatus('closed');
      if (!this.closedByUser) this.scheduleReconnect(1);
      return;
    }
    this.connecting = false;
    if (this.closedByUser) { ws.close(1000); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.opts.onStatus('open');
      this.stableTimer = setTimeout(() => { this.attempt = 0; }, 30_000);   // reset only when stable
      this.resubscribeWithPositions();
    };
    ws.onmessage = (e) => this.opts.onMessage(JSON.parse(e.data));
    ws.onclose = async (e) => {
      clearTimeout(this.stableTimer);
      if (this.ws === ws) this.ws = null;
      this.opts.onStatus('closed');
      if (this.closedByUser) return;
      if (e.code === 1008 || e.code === 4401) {
        try {
          if (!(await this.opts.refreshAuth())) return;       // stop: user must sign in again
        } catch (err) {
          this.opts.onError(err);                             // transient: fall through and retry
        }
        if (this.closedByUser) return;                        // stop() ran while refreshing
      }
      this.scheduleReconnect(e.code === 1013 || e.code === 1012 ? 4 : 1);
    };
  }

  stop() {
    this.closedByUser = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.stableTimer);
    this.retryTimer = undefined;
    this.ws?.close(1000);
  }

  // Skip the backoff wait (network back, tab visible); no-op while a socket is open or connecting
  reconnectNow() {
    if (this.closedByUser) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    void this.open();                                         // open() handles its own failures
  }

  private isLive() {
    return this.ws !== null && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN);
  }

  private scheduleReconnect(multiplier: number) {
    if (this.closedByUser) return;
    clearTimeout(this.retryTimer);
    const cap = Math.min(30_000, 1_000 * 2 ** this.attempt) * multiplier;
    const delay = Math.random() * Math.min(cap, 120_000);    // full jitter
    this.attempt++;
    this.retryTimer = setTimeout(() => { this.retryTimer = undefined; void this.open(); }, delay);   // open() re-checks closedByUser
  }

  private resubscribeWithPositions() { /* send { type: 'join', room, after: lastSeq[room] } per room */ }
}

// Reconnect promptly when the network or tab comes back
window.addEventListener('online', () => client.reconnectNow());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') client.reconnectNow(); });
```

- `start()` never rejects: a failed `connect()` schedules the next attempt, so the loop survives the common offline case.
- Only `start()` clears a previous `stop()`. Timers and `reconnectNow()` go through `open()`, which re-checks `closedByUser`, and the close handler re-checks it after awaiting a token refresh, so a stopped client never reconnects.
- One pending timer and the `connecting` guard keep `online`, `visibilitychange`, and the backoff timer from opening duplicate sockets.

Do not queue state-changing messages blindly while disconnected; either drop them with a visible error or resend them with idempotency keys after resync.

---

## Fan-Out Across Instances

```javascript
// Publish once; each instance delivers to its local members of the room
async function publish(room, message) {
  const stored = await log.append(room, message);             // durable, assigns per-room seq (see replay contract)
  await broker.publish(`rt:${room}`, JSON.stringify(stored));
}

broker.subscribe('rt:*', (channel, payload) => {
  const room = channel.slice(3);
  for (const conn of rooms.localMembers(room)) safeSend(conn, JSON.parse(payload));
});
```

Broker pub/sub is fire-and-forget: an instance that is down misses messages. Replay comes from the durable log, not from the broker.

---

## Limits and Backpressure

```javascript
const LIMITS = { maxPayloadBytes: 64 * 1024, messagesPerSecond: 20, roomsPerConn: 100, connsPerUser: 10 };

function safeSend(conn, message) {
  if (conn.ws.bufferedAmount > 1_000_000) {
    if (message.droppable) return;                            // cursor, typing: coalesce or drop
    if (conn.ws.bufferedAmount > 8_000_000) return conn.ws.close(1013, 'consumer too slow');
  }
  conn.ws.send(JSON.stringify(message));
}
```

- Token-bucket rate limits per connection and per message type; cheap types (cursor) get higher rates but are droppable.
- Per-user connection cap: reject new connections (or close the oldest with a documented code) when exceeded.
- Global connection cap per instance; shed with 1013 before memory runs out.

---

## Transport Status

Browser rows below follow MDN browser-compat-data; re-check it for engines and versions you target.

- **WebTransport:** Safari 26.4 (March 2026) shipped it, after Chromium-based browsers and Firefox, so all major engines now support it. Server, proxy, and load-balancer support for HTTP/3 and WebTransport sessions is the usual limit; keep a WebSocket fallback for networks that block UDP.
- **WebSocket over HTTP/2 (RFC 8441) and HTTP/3 (RFC 9220):** supported by some browsers and servers; most deployments still upgrade over HTTP/1.1. Proxies must be configured for whichever is used.
- **WebSocketStream** (promise-based API with backpressure): experimental and Chromium-only (Chrome/Edge 124+); feature-detect and fall back to `WebSocket`.

---

## Production Checklist

- [ ] Authentication in the upgrade handler (or auth message with a deadline); no long-lived tokens in URLs
- [ ] `Origin` allowlist on upgrade
- [ ] Authorization on every join and on writes; revocation reaches open connections
- [ ] Server-side credential expiry; refresh keeps the same subject
- [ ] Heartbeat on the server; silence detection on the client
- [ ] Reconnection with full jitter, reset after a stable period, close-code handling
- [ ] Replay from a durable per-stream log, `resync_required` for unknown positions
- [ ] Message size, rate, room, and connection limits
- [ ] Backpressure on the send buffer
- [ ] Graceful shutdown: 1001/1012, drained within the grace period
- [ ] `wss://` only
- [ ] Logs: connects, disconnects with codes, auth failures — not message bodies
- [ ] Metrics: active connections, messages in/out, send-buffer drops, reconnect rate
