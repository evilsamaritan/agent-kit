# Socket.io Patterns

Rooms, namespaces, authentication middleware, and scaling with Redis adapter.

## Contents

- [Rooms and Namespaces](#rooms-and-namespaces)
- [Auth Middleware](#auth-middleware)
- [Scaling with Redis Adapter](#scaling-with-redis-adapter)
- [Acknowledgments](#acknowledgments)
- [Error Handling](#error-handling)

---

## Rooms and Namespaces

```javascript
// Server
const io = new Server(server, { cors: { origin: '*' } });

// Namespace: logical separation
const chatNs = io.of('/chat');
const notifNs = io.of('/notifications');

chatNs.on('connection', (socket) => {
  // Join rooms
  socket.join(`user:${socket.userId}`);
  socket.join(`org:${socket.orgId}`);

  // Send to specific room
  chatNs.to(`org:${socket.orgId}`).emit('message', data);

  // Send to user across all their connections (devices)
  chatNs.to(`user:${targetUserId}`).emit('dm', data);

  // Acknowledgments
  socket.on('send-message', (data, callback) => {
    const saved = saveMessage(data);
    callback({ status: 'ok', id: saved.id });     // Client receives ack
  });
});
```

### Room Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| User room | `user:${userId}` | Direct messages, cross-device sync |
| Org/tenant room | `org:${orgId}` | Tenant-wide broadcasts |
| Resource room | `doc:${docId}` | Collaborative editing |
| Role room | `role:admin` | Admin-only notifications |

---

## Auth Middleware

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const user = verifyJwt(token);
    socket.userId = user.sub;
    socket.orgId = user.org;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

### Per-Namespace Auth

```javascript
// Different auth for different namespaces
chatNs.use(requireRole('chat'));
adminNs.use(requireRole('admin'));

function requireRole(role) {
  return (socket, next) => {
    if (socket.user.roles.includes(role)) {
      next();
    } else {
      next(new Error('Forbidden'));
    }
  };
}
```

---

## Scaling with Redis Adapter

```javascript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://redis:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
// Now emit() reaches clients on ALL server instances
```

### How It Works

```
Client A -----> Server 1 ---+
                             |---> Redis Pub/Sub ---+
Client B -----> Server 2 ---+                       |
                             |<--- Redis Pub/Sub ---+
Client C -----> Server 2 ---+
```

When Server 1 emits to a room, the Redis adapter publishes the message. Server 2 receives it via subscription and delivers to its local clients in that room.

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
    const saved = await saveMessage(data);
    callback({ status: 'ok', id: saved.id });
  } catch (err) {
    callback({ status: 'error', error: err.message });
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
  if (err.message === 'Authentication failed') {
    // Redirect to login
  } else {
    // Will auto-retry with backoff
  }
});

// Disconnect reasons
socket.on('disconnect', (reason) => {
  switch (reason) {
    case 'io server disconnect':
      // Server forced disconnect -- need manual reconnect
      socket.connect();
      break;
    case 'transport close':
    case 'ping timeout':
      // Auto-reconnect will handle these
      break;
  }
});
```
