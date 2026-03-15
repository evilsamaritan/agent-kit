# WebSocket Patterns

Connection lifecycle, scaling, authentication, binary protocols, and production patterns.

## Contents

- [Server Implementation](#server-implementation)
- [Client Implementation](#client-implementation)
- [Authentication](#authentication)
- [Scaling Architecture](#scaling-architecture)
- [Binary Protocol Integration](#binary-protocol-integration)
- [Rate Limiting and Backpressure](#rate-limiting-and-backpressure)
- [Production Checklist](#production-checklist)

---

## Server Implementation

### Node.js (ws library)

```javascript
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer();
const wss = new WebSocketServer({ server });

// Connection tracking
const clients = new Map();       // userId -> Set<WebSocket>

wss.on('connection', (ws, req) => {
  const userId = authenticateFromUpgrade(req);
  if (!userId) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Track connection
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);

  // Heartbeat
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data, isBinary) => {
    try {
      const msg = isBinary ? decodeBinary(data) : JSON.parse(data);
      handleMessage(ws, userId, msg);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    clients.get(userId)?.delete(ws);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
    handleDisconnect(userId);
  });

  ws.on('error', (err) => {
    console.error(`WS error for user ${userId}:`, err.message);
  });
});

// Heartbeat interval
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();              // Dead connection
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeatInterval));

// Send to specific user (all their connections/devices)
function sendToUser(userId, message) {
  const sockets = clients.get(userId);
  if (!sockets) return;
  const data = JSON.stringify(message);
  sockets.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
}

// Broadcast to a channel
function broadcastToChannel(channelId, message, excludeUserId) {
  const members = getChannelMembers(channelId);
  const data = JSON.stringify(message);
  members.forEach((userId) => {
    if (userId === excludeUserId) return;
    sendToUser(userId, message);
  });
}
```

### Go (gorilla/websocket)

Key patterns: use `Upgrader` with origin check, authenticate in HTTP handler before upgrade, set `ReadLimit` for max message size, use `PongHandler` to reset read deadline, separate read/write goroutines (read pump in main goroutine, write pump in spawned goroutine with ping ticker).

---

## Client Implementation

### Robust Client with Reconnection

```typescript
interface WSClientOptions {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  maxReconnectDelay?: number;
  onMessage: (data: unknown) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

class WSClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private lastEventId: string | null = null;
  private forceClosed = false;
  private messageBuffer: unknown[] = [];

  constructor(private options: WSClientOptions) {}

  connect() {
    this.forceClosed = false;
    this.options.onStatusChange('connecting');

    this.ws = new WebSocket(this.options.url, this.options.protocols);

    this.ws.onopen = () => {
      this.attempt = 0;
      this.options.onStatusChange('connected');
      this.flushBuffer();
      this.requestSync();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id) this.lastEventId = data.id;
      this.options.onMessage(data);
    };

    this.ws.onclose = (event) => {
      this.options.onStatusChange('disconnected');
      if (!this.forceClosed && event.code !== 1008) {
        this.scheduleReconnect();
      }
    };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.messageBuffer.push(data);    // Buffer while disconnected
    }
  }

  disconnect() {
    this.forceClosed = true;
    this.ws?.close(1000, 'Client disconnect');
  }

  private scheduleReconnect() {
    const baseDelay = 1000;
    const maxDelay = this.options.maxReconnectDelay || 30000;
    const delay = Math.min(baseDelay * Math.pow(2, this.attempt), maxDelay);
    const jitter = delay * (0.5 + Math.random() * 0.5);
    this.attempt++;
    setTimeout(() => this.connect(), jitter);
  }

  private requestSync() {
    if (this.lastEventId) {
      this.send({ type: 'sync', lastEventId: this.lastEventId });
    }
  }

  private flushBuffer() {
    while (this.messageBuffer.length > 0) {
      this.send(this.messageBuffer.shift());
    }
  }
}
```

### Visibility and Network Awareness

```javascript
// Reconnect on tab becoming visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wsClient.isConnected()) {
    wsClient.connect();
  }
});

// Reconnect on network recovery
window.addEventListener('online', () => {
  if (!wsClient.isConnected()) {
    wsClient.connect();
  }
});

// Clean disconnect on page unload
window.addEventListener('beforeunload', () => {
  wsClient.disconnect();
});
```

---

## Authentication

### Token in Upgrade Request

```javascript
// Client: include token in URL or headers
const ws = new WebSocket(`wss://api.example.com/ws?token=${accessToken}`);

// OR via protocols (workaround for browser WebSocket header limitations)
const ws = new WebSocket('wss://api.example.com/ws', [`bearer-${accessToken}`]);

// Server: validate during upgrade
wss.on('upgrade', (request, socket, head) => {
  const token = new URL(request.url, 'http://localhost').searchParams.get('token');

  try {
    const user = verifyJwt(token);
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.userId = user.sub;
      wss.emit('connection', ws, request);
    });
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});
```

### Token Refresh During Connection

```javascript
// Client: send new token before old one expires
function scheduleTokenRefresh() {
  const expiresIn = getTokenExpiry(accessToken) - Date.now() - 60000; // 1min before
  setTimeout(async () => {
    const newToken = await refreshAccessToken();
    ws.send(JSON.stringify({ type: 'auth-refresh', token: newToken }));
    scheduleTokenRefresh();
  }, expiresIn);
}

// Server: handle token refresh
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'auth-refresh') {
    try {
      const user = verifyJwt(msg.token);
      ws.userId = user.sub;
    } catch {
      ws.close(1008, 'Invalid token');
    }
  }
});
```

---

## Scaling Architecture

### Multi-Server with Redis Pub/Sub

```
Client A -----> Server 1 ---+
                             |---> Redis Pub/Sub ---+
Client B -----> Server 2 ---+                       |
                             |<--- Redis Pub/Sub ---+
Client C -----> Server 2 ---+
```

```javascript
import Redis from 'ioredis';

const pub = new Redis();
const sub = new Redis();

// Publish from any server
function broadcastToChannel(channel, message) {
  pub.publish(`ws:channel:${channel}`, JSON.stringify(message));
}

// Each server subscribes
sub.psubscribe('ws:channel:*');
sub.on('pmessage', (pattern, channel, message) => {
  const channelId = channel.replace('ws:channel:', '');
  const data = JSON.parse(message);
  // Deliver to local clients in this channel
  localBroadcast(channelId, data);
});
```

### Connection Limits

```javascript
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_TOTAL_CONNECTIONS = 10000;

wss.on('connection', (ws, req) => {
  // Check total connections
  if (wss.clients.size >= MAX_TOTAL_CONNECTIONS) {
    ws.close(1013, 'Server overloaded');
    return;
  }

  // Check per-user connections
  const userConns = clients.get(userId);
  if (userConns && userConns.size >= MAX_CONNECTIONS_PER_USER) {
    // Close oldest connection
    const oldest = userConns.values().next().value;
    oldest.close(1000, 'Connection replaced');
    userConns.delete(oldest);
  }
});
```

---

## Rate Limiting and Backpressure

> For binary protocol details (Protocol Buffers, MessagePack, CBOR, FlatBuffers), see `reconnection-presence-binary.md`.

### Message Rate Limiting

```javascript
const rateLimiters = new Map();

function checkRateLimit(userId, messageType) {
  const key = `${userId}:${messageType}`;
  const limiter = rateLimiters.get(key) || { count: 0, resetAt: Date.now() + 1000 };

  if (Date.now() > limiter.resetAt) {
    limiter.count = 0;
    limiter.resetAt = Date.now() + 1000;
  }

  limiter.count++;
  rateLimiters.set(key, limiter);

  const limits = { 'chat': 5, 'cursor': 30, 'typing': 2 };
  return limiter.count <= (limits[messageType] || 10);
}
```

### Server-Side Backpressure

```javascript
function safeSend(ws, data) {
  if (ws.bufferedAmount > 1024 * 1024) {  // 1MB buffered
    // Connection is slow -- drop non-critical messages
    if (data.priority !== 'high') return;
  }
  ws.send(JSON.stringify(data));
}
```

---

## Production Checklist

- [ ] Authentication on WebSocket upgrade (not after connection)
- [ ] Heartbeat ping/pong (30s interval, 10s timeout)
- [ ] Reconnection with exponential backoff + jitter
- [ ] State reconciliation on reconnect (last event ID)
- [ ] Connection limits (per-user and total)
- [ ] Rate limiting per message type
- [ ] Backpressure handling (bufferedAmount check)
- [ ] Graceful shutdown (close all connections with 1001)
- [ ] TLS (wss://) in production
- [ ] CORS / origin validation on upgrade
- [ ] Logging: connection/disconnection events, errors (not message content)
- [ ] Metrics: active connections, message rate, error rate, latency
- [ ] Load balancer: sticky sessions or Redis pub/sub for multi-server
- [ ] Max message size limit (ReadLimit)
- [ ] Binary message support if needed
