# Socket.io Patterns

Rooms, namespaces, authentication middleware, load balancing, and adapters. Check the project's Socket.IO server and client versions first; features such as connection-state recovery depend on them.

## Contents

- [Rooms and Namespaces](#rooms-and-namespaces)
- [Auth Middleware](#auth-middleware)
- [Behind a Load Balancer](#behind-a-load-balancer)
- [Scaling with an Adapter](#scaling-with-an-adapter)
- [Acknowledgments](#acknowledgments)
- [Error Handling](#error-handling)

---

## Rooms and Namespaces

```javascript
// Server
const io = new Server(server, {
  cors: { origin: config.allowedOrigins, credentials: true },   // explicit allowlist, never '*'
  maxHttpBufferSize: 64 * 1024,
});

// Namespace: logical separation
const chatNs = io.of('/chat');
const notifNs = io.of('/notifications');
const adminNs = io.of('/admin');

chatNs.on('connection', (socket) => {
  const { user } = socket.data;                    // set by the auth middleware

  // Rooms derived from the authenticated identity
  socket.join(`user:${user.id}`);
  socket.join(`org:${user.orgId}`);

  // Rooms requested by the client are authorized first
  socket.on('join', async ({ docId }, ack) => {
    if (!(await policy.canRead(user, { type: 'document', id: docId }))) return ack({ status: 'forbidden' });
    socket.join(`doc:${docId}`);
    ack({ status: 'ok' });
  });

  // Send to a room / to one user's devices
  chatNs.to(`org:${user.orgId}`).emit('announcement', payload);
  chatNs.to(`user:${targetUserId}`).emit('dm', payload);
});
```

### Room Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| User room | `user:${userId}` | Direct messages, cross-device sync |
| Org/tenant room | `org:${orgId}` | Tenant-wide broadcasts |
| Resource room | `doc:${docId}` | Collaborative editing |
| Role room | `role:admin` | Admin-only notifications |

Rooms are access boundaries: any room a client can name must pass an authorization check before `join`.

---

## Auth Middleware

`io.use()` registers middleware for the main namespace (`/`) only. Register authentication on every namespace the app uses, before any permission check:

```javascript
async function authenticate(socket, next) {
  try {
    // cookie session (same site) or a token passed in the handshake auth payload (not the URL)
    const principal = await authenticateHandshake(socket.handshake);
    socket.data.user = { id: principal.userId, orgId: principal.orgId, permissions: principal.permissions };
    socket.data.expiresAt = principal.expiresAt;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
}

for (const ns of [io.of('/'), chatNs, notifNs, adminNs]) ns.use(authenticate);
```

### Per-Namespace Auth

```javascript
// Coarse gate per namespace, registered after authenticate; object-level checks still happen on join and on writes
chatNs.use(requirePermission('chat:use'));
adminNs.use(requirePermission('admin:access'));

function requirePermission(permission) {
  return (socket, next) =>
    socket.data.user.permissions.includes(permission) ? next() : next(new Error('forbidden'));
}
```

---

## Behind a Load Balancer

- By default a client starts with HTTP long-polling and upgrades to WebSocket. The polling requests of one session must reach the same instance: enable **sticky sessions** (cookie or connection-id affinity), or configure clients with `transports: ['websocket']` and accept losing the polling fallback.
- The adapter does not replace stickiness: it fans out emits between instances; it does not route a session's requests.
- Connection-state recovery (where the server version supports it) restores rooms and missed packets after a short disconnect; it needs an adapter that supports it and still requires stickiness for polling.
- Enforce credential expiry on the server: disconnect sockets whose `socket.data.expiresAt` has passed.

---

## Scaling with an Adapter

```javascript
import { createAdapter } from '@socket.io/redis-adapter';   // or the streams-based adapter for durability
import { createClient } from 'redis';

const pubClient = createClient({ url: config.redisUrl });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
// emits to a room reach members connected to any instance
```

The pub/sub adapter is fire-and-forget; an instance that is down misses packets. Use a durable log for replay (see [reconnection-presence-binary.md](reconnection-presence-binary.md#replay-contract)).

---

## Acknowledgments

```javascript
// Client: send with callback
socket.emit('send-message', { text: 'Hello' }, (response) => {
  if (response.status === 'ok') {
    console.log('Message saved with ID:', response.id);
  } else {
    console.error('Failed:', response.error);
  }
});

// Server: call the callback
socket.on('send-message', async (data, callback) => {
  try {
    const saved = await messages.send(socket.data.user, data);   // authorizes and validates; idempotent on data.clientId
    callback({ status: 'ok', id: saved.id });
  } catch (err) {
    if (err instanceof DomainError) return callback({ status: 'error', code: err.code });
    log.error({ err }, 'send-message failed');
    callback({ status: 'error', code: 'internal' });               // never the raw error message
  }
});
```

### Timeout for Acks

```javascript
// Client: timeout if server doesn't respond
socket.timeout(5000).emit('send-message', data, (err, response) => {
  if (err) {
    // Server did not acknowledge within 5 seconds
    handleTimeout();
  }
});
```

---

## Error Handling

```javascript
// Connection error
socket.on('connect_error', (err) => {
  if (err.message === 'unauthorized') {
    // Redirect to login
  } else {
    // Will auto-retry with backoff
  }
});

// Disconnect reasons
socket.on('disconnect', (reason) => {
  switch (reason) {
    case 'io server disconnect':
      // Server closed the session on purpose (often expired credentials): no auto-reconnect
      refreshCredentials().then((ok) => ok && socket.connect());
      break;
    case 'io client disconnect':
      break;                                   // we called socket.disconnect()
    default:
      // transport close, ping timeout, transport error: the client reconnects with backoff
      log.info({ reason }, 'socket disconnected');
  }
});
```
