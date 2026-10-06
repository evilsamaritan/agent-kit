# Replay, Presence, and Binary Formats

The replay contract behind reconnection, presence that reports offline correctly, and binary message formats. Backoff and close-code rules are in SKILL.md.

## Contents

- [Replay Contract](#replay-contract)
- [Server: Durable Per-Stream Log](#server-durable-per-stream-log)
- [Client: Positions and Resync](#client-positions-and-resync)
- [Presence](#presence)
- [Binary Formats](#binary-formats)

---

## Replay Contract

- A **stream** is the unit of ordering: one room, document, or user feed. Each event in it has a monotonically increasing `seq` (and a globally unique `id` for deduplication).
- On (re)subscribe the client sends `after: <last seq it applied>` for that stream.
- The server answers with one of:
  - the events after that position, then live events;
  - `resync_required` when the position is unknown, older than retention, or from another stream epoch — the client reloads a snapshot over HTTP and resubscribes from the snapshot's position.
- **Subscribe first, then replay.** Register for live events, buffer them, read the backlog, then flush the buffer skipping anything with `seq` already sent. Replaying first and subscribing after loses events published in between.

---

## Server: Durable Per-Stream Log

```javascript
// Shared storage (a table, a stream with retention, or a log service) — not per-process memory
async function append(stream, event) {
  const seq = await db.one(
    `INSERT INTO stream_events (stream, seq, id, type, payload)
     VALUES ($1, COALESCE((SELECT max(seq) FROM stream_events WHERE stream = $1), 0) + 1, $2, $3, $4)
     RETURNING seq`, [stream, event.id, event.type, event.payload]);
  return { ...event, stream, seq };
}
// Concurrent appends to one stream need a single writer per stream, a per-stream lock,
// or a log that assigns positions (e.g. a stream entry id); the subquery above alone races.

async function subscribe(conn, stream, after) {
  let buffer = [];
  const live = bus.subscribe(stream, (e) => buffer ? buffer.push(e) : send(conn, e));   // 1. subscribe first

  const oldest = await db.oneOrNone('SELECT min(seq) AS seq FROM stream_events WHERE stream = $1', [stream]);
  if (after != null && (oldest?.seq == null ? after > 0 : after < oldest.seq - 1)) {
    live.unsubscribe();
    return send(conn, { type: 'resync_required', stream });                            // gap: do not guess
  }

  const backlog = after == null ? [] :
    await db.many('SELECT * FROM stream_events WHERE stream = $1 AND seq > $2 ORDER BY seq', [stream, after]);
  let last = after ?? 0;
  for (const e of backlog) { send(conn, e); last = e.seq; }                             // 2. replay

  for (const e of buffer.splice(0)) if (e.seq > last) { send(conn, e); last = e.seq; }  // 3. flush, dedupe
  buffer = null;                                                                         // live from here
  conn.onClose(() => live.unsubscribe());
}
```

Retention (minutes to days) is a product decision; anything older returns `resync_required`.

---

## Client: Positions and Resync

```javascript
// Positions are per stream and per account; in-memory or session-scoped storage
const positions = new Map();   // stream -> last applied seq

function onEvent(e) {
  const last = positions.get(e.stream) ?? 0;
  if (e.seq <= last) return;                                  // duplicate
  if (e.seq > last + 1) return requestResync(e.stream);       // gap detected client-side
  apply(e);
  positions.set(e.stream, e.seq);
}

async function requestResync(stream) {
  const snapshot = await api.get(`/streams/${stream}/snapshot`);    // returns state + seq
  replaceState(stream, snapshot.state);
  positions.set(stream, snapshot.seq);
  ws.send(JSON.stringify({ type: 'join', room: stream, after: snapshot.seq }));
}

// on server message { type: 'resync_required', stream } → requestResync(stream)
```

If positions are persisted (to survive reloads), key them by account and stream and clear them on sign-out.

---

## Presence

```
connect    → add connectionId to presence:{userId} (set), refresh TTL; if set size went 0→1, publish online
heartbeat  → refresh TTL of the connection entry
disconnect → remove connectionId; if set size went 1→0, publish offline (after a short grace period)
crash      → no disconnect runs: a sweeper (or expiry notifications) removes expired connection entries
             and publishes offline when a user's set becomes empty
```

```javascript
// Connection entries with their own expiry, counted per user
async function heartbeat(userId, connectionId) {
  await redis.zadd(`presence:${userId}`, Date.now() + 60_000, connectionId);   // score = expiry time
}

async function sweep() {                                                        // runs every few seconds on one worker
  for (const userId of await presenceIndex.members()) {
    await redis.zremrangebyscore(`presence:${userId}`, 0, Date.now());
    if (await redis.zcard(`presence:${userId}`) === 0) {
      await presenceIndex.remove(userId);
      await bus.publish('presence', { userId, status: 'offline' });
    }
  }
}
```

- Count connections per user; a user with two tabs is online until both close.
- Publish presence only to users allowed to see it (contacts, room members), not globally.
- Presence is ephemeral: never persist it as user state; "last seen" is a separate, rate-limited write.

---

## Binary Formats

Measure first: compare message size and parse time on real payloads before switching from JSON. Compression (permessage-deflate) is often enough for size; it costs CPU and memory per connection.

| Format | Schema | Typical fit |
|--------|--------|-------------|
| Protocol Buffers | Required (`.proto`) | Typed, evolving messages across languages |
| MessagePack | None | Drop-in replacement for JSON shapes |
| CBOR | None (optional CDDL) | Constrained devices, standards that mandate it |
| FlatBuffers | Required | Zero-copy reads of large state (games) |

```protobuf
syntax = "proto3";

message Envelope {
  string id = 1;
  string stream = 2;
  uint64 seq = 3;
  oneof body {
    ChatMessage chat = 10;
    CursorPosition cursor = 11;
  }
}

message CursorPosition {
  string user_id = 1;
  float x = 2;
  float y = 3;
}
```

Receivers handle an unset `oneof` (a newer sender's message type) by ignoring it, the binary equivalent of ignoring unknown `type` values. Schema evolution rules: `api-design` → [rpc-patterns.md](../../api-design/references/rpc-patterns.md#protobuf-evolution).
