# SSE Patterns

Server-Sent Events setup, event types, reconnection, polyfills, and use cases.

## Contents

- [SSE Protocol Fundamentals](#sse-protocol-fundamentals)
- [Server Implementations](#server-implementations)
- [Client Patterns](#client-patterns)
- [Authentication](#authentication)
- [Scaling SSE](#scaling-sse)
- [SSE vs Alternatives](#sse-vs-alternatives)
- [Use Case Patterns](#use-case-patterns)
- [Production Considerations](#production-considerations)

---

## SSE Protocol Fundamentals

### Wire Format

```
event: message-type\n
id: unique-event-id\n
retry: 5000\n
data: {"key": "value"}\n
\n
```

Rules:
- Each field is a single line ending with `\n`
- A blank line (`\n\n`) terminates the event
- Multi-line data: repeat `data:` on each line
- Comments: lines starting with `:` (used for heartbeats)
- Field names: `event`, `data`, `id`, `retry` only

### Event Types

```
# Default event (triggers 'message' listener)
data: Hello world\n
\n

# Named event (triggers specific listener)
event: user-joined\n
data: {"userId": "u123", "name": "Alice"}\n
\n

# Heartbeat comment (keeps connection alive)
: heartbeat\n
\n

# Set reconnection interval
retry: 3000\n
\n

# Multi-line data
data: line one\n
data: line two\n
data: line three\n
\n
```

---

## Server Implementations

### Node.js / Express

```javascript
app.get('/events', authenticate, async (req, res) => {
  // Required headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',        // Nginx: disable buffering
  });

  const userId = req.user.id;

  // Send initial retry interval
  res.write('retry: 5000\n\n');

  // Helper to send events
  function sendEvent(event, data, id) {
    if (id) res.write(`id: ${id}\n`);
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Subscribe first (buffer), then replay from Last-Event-ID, then flush — see the replay contract
  // in reconnection-presence-binary.md. Event ids here are the per-stream sequence numbers.
  let buffer = [];
  const unsubscribe = eventBus.subscribe(userId, (event) => {
    buffer ? buffer.push(event) : sendEvent(event.type, event.data, event.seq);
  });

  const lastEventId = req.headers['last-event-id'];
  let last = 0;
  if (lastEventId) {
    const after = Number(lastEventId);
    const replay = Number.isSafeInteger(after) ? await eventLog.since(userId, after) : null;
    if (replay === null) {
      sendEvent('resync_required', {}, undefined);           // unknown or expired position: client reloads a snapshot
    } else {
      for (const e of replay) { sendEvent(e.type, e.data, e.seq); last = e.seq; }
    }
  }
  for (const e of buffer.splice(0)) if (e.seq > last) sendEvent(e.type, e.data, e.seq);
  buffer = null;

  // Heartbeat to prevent proxy/LB timeout
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
```

### Go

Key pattern: assert `http.Flusher` interface, set SSE headers, handle `Last-Event-ID` for replay, use `select` loop with event channel + heartbeat ticker (15s), call `flusher.Flush()` after each write, return on `r.Context().Done()`.

### Python (FastAPI)

Key pattern: use `StreamingResponse` with `media_type="text/event-stream"`, async generator that yields SSE-formatted strings, check `request.is_disconnected()` in loop, yield `": heartbeat\n\n"` every 15s, handle `Last-Event-ID` header for replay.

---

## Client Patterns

### EventSource with Custom Event Handling

```javascript
class SSEClient {
  constructor(url, options = {}) {
    this.url = url;
    this.handlers = new Map();
    this.options = options;
  }

  connect() {
    this.source = new EventSource(this.url, {
      withCredentials: this.options.withCredentials || false,
    });

    // Register all event handlers
    this.handlers.forEach((handler, eventName) => {
      this.source.addEventListener(eventName, (event) => {
        const data = JSON.parse(event.data);
        handler(data, event.lastEventId);
      });
    });

    this.source.onerror = (event) => {
      if (this.source.readyState === EventSource.CLOSED) {
        this.options.onClosed?.();
      } else {
        this.options.onReconnecting?.();
        // EventSource auto-reconnects; retry interval set by server
      }
    };
  }

  on(eventName, handler) {
    this.handlers.set(eventName, handler);
    if (this.source) {
      this.source.addEventListener(eventName, (event) => {
        handler(JSON.parse(event.data), event.lastEventId);
      });
    }
    return this;
  }

  close() {
    this.source?.close();
  }
}

// Usage
const sse = new SSEClient('/events', {
  withCredentials: true,
  onReconnecting: () => showStatus('Reconnecting...'),
  onClosed: () => showStatus('Connection lost'),
});

sse.on('notification', (data) => showNotification(data));
sse.on('order-update', (data) => updateOrder(data));
sse.connect();
```

### Using fetch() for SSE (Custom Headers)

The native `EventSource` API does not support custom headers. Use `fetch()` with a ReadableStream when you need Authorization headers:

```javascript
async function fetchSSE(url, token, onEvent) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
    },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const events = buffer.split('\n\n');
    buffer = events.pop();           // Keep incomplete event in buffer

    for (const eventStr of events) {
      const event = parseSSEEvent(eventStr);
      if (event) onEvent(event);
    }
  }
}

function parseSSEEvent(raw) {
  const event = {};
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event.type = line.slice(6).trim();
    else if (line.startsWith('data:')) event.data = JSON.parse(line.slice(5).trim());
    else if (line.startsWith('id:')) event.id = line.slice(3).trim();
  }
  return event.data ? event : null;
}
```

---

## Authentication

### Cookie-Based (Preferred for SSE)

```javascript
// Client
const source = new EventSource('/events', { withCredentials: true });

// Server: session cookie is sent automatically
app.get('/events', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).end();
  }
  // ... SSE setup
});
```

### Header or Single-Use Ticket

Never put a long-lived access token in the URL: it is logged by proxies and kept in history.

- **Header:** use `fetch()` streaming (above) to send `Authorization: Bearer ...`.
- **Ticket:** when `EventSource` must be used cross-site, fetch a ticket valid for seconds and redeemable once, then open `/events?ticket=...`; the server redeems it and binds the stream to that user.

Enforce credential expiry on the server: end the stream when the session or token expires; the client re-authenticates and reconnects with `Last-Event-ID`. Authorize each stream or topic the client asks for, not just the connection.

---

## Scaling SSE

### Connection Limits

HTTP/1.1: browsers limit ~6 connections per domain. SSE uses one of these slots.
HTTP/2: multiplexes over a single TCP connection -- no practical limit from the browser.

**Mitigation for HTTP/1.1:**
- Use a dedicated subdomain for SSE: `events.example.com`
- Combine multiple event streams into one connection
- Use HTTP/2 (recommended)

### Multi-Server with Event Bus

Fan-out works as for WebSocket ([websocket-patterns.md](websocket-patterns.md#fan-out-across-instances)): append to the durable log, publish once on the broker, deliver to local streams, and replay from the log, never from the broker.

---

## SSE vs Alternatives

| Criteria | SSE | WebSocket | Long Polling |
|----------|-----|-----------|-------------|
| Direction | Server -> Client | Bidirectional | Server -> Client |
| Reconnection | Automatic | Manual | Manual |
| Last-Event-ID | Built-in | Manual | Manual |
| HTTP/2 multiplexing | Yes | No | Yes |
| Works through proxies | Usually | Sometimes blocked | Always |
| Binary data | No | Yes | No |
| Implementation | Simple | Moderate | Simple |

**Choose SSE when:** server-push only, text data, need auto-reconnect, HTTP/2 environment.
**Choose WebSocket when:** bidirectional, binary data, high-frequency, gaming/collaboration.

---

## Use Case Patterns

| Use Case | Event Name | Data Shape |
|----------|-----------|------------|
| Live notifications | `notification` | `{id, title, body, action, timestamp}` |
| Live dashboard | `metrics` | `{cpu, memory, requestsPerSecond, errorRate}` |
| Build or deploy progress | `build-progress` | `{buildId, stage, status, progress}` |
| Price updates | `price-update` | `{symbol, price, change, timestamp}` |

The SSE `id` is always the per-stream sequence number, never a timestamp or a composite string: replay needs an ordered position the log can answer from. Streams whose old values are worthless (metrics, prices) can skip replay and send the current snapshot on reconnect instead.

---

## Production Considerations

### Proxy Configuration

```nginx
# Nginx: disable buffering for SSE
location /events {
    proxy_pass http://backend;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;

    # Increase timeout for long-lived connections
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

### Event Storage for Replay

Use the per-stream log in [reconnection-presence-binary.md](reconnection-presence-binary.md#server-durable-per-stream-log): a sequence assigned per stream, retention, and an explicit "position expired" answer that triggers `resync_required`.

### Monitoring Checklist

- Active SSE connections per server
- Connection duration histogram
- Events sent per second
- Reconnection rate (high = infrastructure issue)
- Last-Event-ID hit rate (are clients catching up?)
- Memory usage per connection
- Heartbeat failures (proxy killing idle connections)
