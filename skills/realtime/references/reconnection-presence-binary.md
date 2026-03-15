# Reconnection, Presence, and Binary Protocols

Exponential backoff with jitter, state reconciliation, presence systems, and binary protocol selection.

## Contents

- [Exponential Backoff with Jitter](#exponential-backoff-with-jitter)
- [State Reconciliation on Reconnect](#state-reconciliation-on-reconnect)
- [Presence Systems](#presence-systems)
- [Binary Protocol Details](#binary-protocol-details)

---

## Exponential Backoff with Jitter

```javascript
class ReconnectingSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.attempt = 0;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.attempt = 0;            // Reset on success
      this.reconcileState();       // Sync missed data
    };

    this.ws.onclose = (event) => {
      if (event.code === 1008) return;  // Policy violation -- don't retry
      this.scheduleReconnect();
    };
  }

  scheduleReconnect() {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt),
      this.maxDelay
    );
    const jitter = delay * (0.5 + Math.random() * 0.5);
    this.attempt++;
    setTimeout(() => this.connect(), jitter);
  }

  reconcileState() {
    // Send last known event ID / timestamp to server
    // Server sends missed events since that point
    this.ws.send(JSON.stringify({
      type: 'sync',
      lastEventId: this.lastEventId,
    }));
  }
}
```

### Backoff Timing Reference

| Attempt | Base Delay | With Jitter (range) |
|---------|-----------|---------------------|
| 0 | 1s | 0.5s - 1s |
| 1 | 2s | 1s - 2s |
| 2 | 4s | 2s - 4s |
| 3 | 8s | 4s - 8s |
| 4 | 16s | 8s - 16s |
| 5+ | 30s (max) | 15s - 30s |

### Key Principles

- **Always add jitter** -- prevents thundering herd when server recovers
- **Reset attempt counter on successful connection** -- not on connect attempt
- **Respect close codes** -- don't retry on 1008 (policy violation)
- **Reconcile state on reconnect** -- send last event ID, get missed events
- **Cap maximum delay** -- 30s is typical; longer frustrates users

---

## State Reconciliation on Reconnect

### Server-Side Event Store

```javascript
// Store recent events per channel/user for replay
class EventStore {
  constructor(maxAge = 5 * 60 * 1000) { // 5 minutes
    this.events = new Map();
    this.maxAge = maxAge;
  }

  add(channel, event) {
    if (!this.events.has(channel)) this.events.set(channel, []);
    this.events.get(channel).push({
      ...event,
      timestamp: Date.now(),
    });
    this.cleanup(channel);
  }

  getSince(channel, lastEventId) {
    const events = this.events.get(channel) || [];
    const idx = events.findIndex(e => e.id === lastEventId);
    return idx === -1 ? events : events.slice(idx + 1);
  }

  cleanup(channel) {
    const cutoff = Date.now() - this.maxAge;
    const events = this.events.get(channel) || [];
    this.events.set(channel, events.filter(e => e.timestamp > cutoff));
  }
}
```

### Client-Side Sync Protocol

```javascript
ws.onopen = () => {
  // Step 1: request missed events
  ws.send(JSON.stringify({
    type: 'sync',
    lastEventId: localStorage.getItem('lastEventId'),
    channels: getSubscribedChannels(),
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'sync-response') {
    // Step 2: apply missed events in order
    msg.events.forEach(applyEvent);
  }

  // Step 3: track last event ID
  if (msg.id) {
    localStorage.setItem('lastEventId', msg.id);
  }
};
```

---

## Presence Systems

### Heartbeat-Based Presence

```
1. Client connects -> server adds to presence set with TTL
2. Client sends heartbeat every 30s -> server refreshes TTL
3. If TTL expires (no heartbeat for 60s) -> user marked offline
4. On status change -> broadcast to relevant subscribers
```

### Redis-Backed Implementation

```javascript
async function updatePresence(userId, status) {
  const key = `presence:${userId}`;
  await redis.hset(key, { status, lastSeen: Date.now() });
  await redis.expire(key, 60);          // 60s TTL
  await redis.publish('presence-changes', JSON.stringify({ userId, status }));
}

async function getPresence(userIds) {
  const pipeline = redis.pipeline();
  userIds.forEach(id => pipeline.hgetall(`presence:${id}`));
  const results = await pipeline.exec();
  return userIds.map((id, i) => ({
    userId: id,
    status: results[i][1]?.status || 'offline',
    lastSeen: results[i][1]?.lastSeen,
  }));
}
```

### Presence Event Flow

```javascript
// Server: handle presence
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'heartbeat') {
    updatePresence(ws.userId, msg.status || 'online');
  }
});

ws.on('close', () => {
  // Don't immediately mark offline -- wait for TTL
  // This handles brief disconnections gracefully
});

// Subscribe to presence changes
redisSub.subscribe('presence-changes');
redisSub.on('message', (channel, message) => {
  const change = JSON.parse(message);
  // Broadcast to users who care about this person's status
  broadcastToFriends(change.userId, {
    type: 'presence',
    userId: change.userId,
    status: change.status,
  });
});
```

---

## Binary Protocol Details

### Protocol Buffers over WebSocket

```protobuf
// message.proto
syntax = "proto3";

message WSMessage {
  string type = 1;
  oneof payload {
    ChatMessage chat = 2;
    PresenceUpdate presence = 3;
    CursorPosition cursor = 4;
  }
}

message CursorPosition {
  string user_id = 1;
  float x = 2;
  float y = 3;
  int64 timestamp = 4;
}
```

```javascript
// Server: handle binary frames
ws.on('message', (data, isBinary) => {
  if (isBinary) {
    const msg = WSMessage.decode(new Uint8Array(data));
    handleProtobufMessage(ws, msg);
  } else {
    const msg = JSON.parse(data);
    handleJsonMessage(ws, msg);
  }
});

// Send binary
const encoded = WSMessage.encode({ type: 'cursor', cursor: { x: 100, y: 200 } }).finish();
ws.send(encoded);
```

### MessagePack Example

```javascript
import { encode, decode } from '@msgpack/msgpack';

// Send
ws.send(encode({ type: 'cursor', x: 100, y: 200 }));

// Receive
ws.onmessage = (event) => {
  const data = decode(new Uint8Array(event.data));
  handleMessage(data);
};
```

### Protocol Selection Guide

| Factor | Protocol Buffers | MessagePack | CBOR | FlatBuffers |
|--------|-----------------|-------------|------|-------------|
| Schema required | Yes (.proto) | No | No | Yes (.fbs) |
| Size reduction vs JSON | ~60-80% | ~20-40% | ~20-40% | ~60-80% |
| Parse speed | Fast (compiled) | Fast | Fast | Zero-copy |
| Cross-language | Excellent | Good | Good | Good |
| Best for | High-throughput APIs | Drop-in JSON replacement | IoT/constrained | Game state, 60fps updates |
