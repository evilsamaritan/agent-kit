# Redis Patterns

Data structures, Lua scripts, pub/sub, clustering, and persistence.

## Contents

- [Licensing Note](#licensing-note)
- [Data Structure Selection](#data-structure-selection)
- [Data Structure Patterns](#data-structure-patterns)
- [Lua Scripts](#lua-scripts)
- [Pub/Sub Patterns](#pubsub-patterns)
- [Pipelining and Batching](#pipelining-and-batching)
- [Distributed Locking](#distributed-locking)
- [Clustering](#clustering)
- [Persistence](#persistence)
- [Connection Management](#connection-management)
- [Memory Management](#memory-management)

---

## Licensing Note

Redis-compatible servers differ in license and governance, and these terms have changed more than once: Valkey (Linux Foundation fork made just before the Redis license change) is BSD-licensed; Redis 7.4 moved to source-available licenses, and Redis 8 added AGPLv3 as an option. Other compatible servers (for example Dragonfly) use their own licenses and architectures. Choose by your organization's license policy and by what your managed provider offers, and verify current terms before deciding. The commands below work on Redis and Valkey unless noted.

---

## Data Structure Selection

| Structure | Use Case | Example |
|-----------|----------|---------|
| String | Simple key-value, counters | Session data, feature flags |
| Hash | Object with fields | User profile, config |
| List | Ordered collection, queue | Recent activity, job queue |
| Set | Unique collection, membership | Online users, tags |
| Sorted Set | Ranked data | Leaderboard, rate limiting windows |
| Stream | Event log, pub/sub | Activity feed, notifications |
| HyperLogLog | Cardinality estimation | Unique visitors count |

---

## Data Structure Patterns

### String: Session Cache

```redis
# Store session with TTL
SET session:abc123 '{"userId":"u1","role":"admin"}' EX 3600

# Atomic get-and-refresh TTL (Redis 6.2+)
GETEX session:abc123 EX 3600
```

For locks, use the [canonical recipe](#distributed-locking), not a bare `SET NX`.

### Hash: Object Cache

```redis
# Store user profile as hash
HSET user:123 name "Alice" email "alice@example.com" plan "pro"

# Get specific fields (not the whole object)
HMGET user:123 name plan

# Increment a field atomically
HINCRBY user:123 loginCount 1

# Get all fields
HGETALL user:123
```

### Sorted Set: Leaderboard

```redis
# Add scores
ZADD leaderboard 1500 "player:alice"
ZADD leaderboard 2300 "player:bob"
ZADD leaderboard 1800 "player:charlie"

# Top 10 with scores (descending; ZRANGE ... REV replaces the deprecated ZREVRANGE, Redis 6.2+)
ZRANGE leaderboard 0 9 REV WITHSCORES

# Player rank (0-indexed, descending)
ZREVRANK leaderboard "player:alice"

# Score range query (ZRANGE ... BYSCORE replaces the deprecated ZRANGEBYSCORE)
ZRANGE leaderboard 1000 2000 BYSCORE WITHSCORES
```

### Sorted Set: Rate Limiter (Sliding Window)

```redis
# On each request:
MULTI
ZADD ratelimit:user:123 <timestamp_ms> <unique_request_id>
ZREMRANGEBYSCORE ratelimit:user:123 0 <timestamp_ms - window_ms>
ZCARD ratelimit:user:123
EXPIRE ratelimit:user:123 <window_seconds>
EXEC

# If ZCARD result > limit, reject request
```

### Set: Feature Flags / Membership

```redis
# Enable feature for specific users
SADD feature:dark-mode user:1 user:5 user:42

# Check if user has feature
SISMEMBER feature:dark-mode user:5    # Returns 1 (true)

# Remove user from feature
SREM feature:dark-mode user:5
```

### List: Recent Activity Feed

```redis
# Push new activity (keep last 100)
LPUSH activity:user:123 '{"type":"purchase","item":"widget"}'
LTRIM activity:user:123 0 99

# Get recent 10 activities
LRANGE activity:user:123 0 9
```

---

## Lua Scripts

Every key a script touches must be passed in `KEYS`, and in Redis Cluster all of them must hash to the same slot — give keys used together a shared hash tag (`{product:42}:data`, `{product:42}:lock`).

### Atomic Cache-Aside with Stampede Prevention

```lua
-- KEYS[1] = cache key, e.g. {product:42}:data
-- KEYS[2] = lock key,  e.g. {product:42}:lock   (same hash tag)
-- ARGV[1] = lock token (random, per caller)
-- ARGV[2] = lock TTL (seconds)
-- Returns {value} on hit, {false, 1} if this caller holds the lock and must compute,
-- {false, 0} if another caller is computing (wait briefly or serve stale)

local cached = redis.call('GET', KEYS[1])
if cached then
    return {cached}
end
if redis.call('SET', KEYS[2], ARGV[1], 'NX', 'EX', ARGV[2]) then
    return {false, 1}
end
return {false, 0}
```

The caller that got the lock computes, sets the value, and releases with the owner-checked delete from [Distributed Locking](#distributed-locking).

### Atomic Rate Limiter

```lua
-- KEYS[1] = rate limit key
-- ARGV[1] = window size (ms)
-- ARGV[2] = max requests
-- ARGV[3] = current timestamp (ms)
-- ARGV[4] = unique request ID
-- Returns: {allowed (0/1), current_count, ttl_ms}

local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local reqId = ARGV[4]

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < limit then
    redis.call('ZADD', key, now, reqId)
    redis.call('PEXPIRE', key, window)
    return {1, count + 1, window}
else
    return {0, count, redis.call('PTTL', key)}
end
```

Lock acquire, extend, and owner-checked release scripts: [Distributed Locking](#distributed-locking).

---

## Pub/Sub Patterns

### Basic Pub/Sub

```redis
# Subscriber
SUBSCRIBE channel:notifications
PSUBSCRIBE channel:user:*         # Pattern subscribe

# Publisher
PUBLISH channel:notifications '{"type":"alert","msg":"Server restarted"}'
PUBLISH channel:user:123 '{"type":"dm","from":"alice"}'
```

### Pub/Sub for Cache Invalidation

```python
# Writer: source first, then the shared entry, then tell every instance
def update_user(user_id, data):
    db.update(user_id, data)
    redis.delete(f"user:{user_id}")
    redis.publish('cache:invalidate', f"user:{user_id}")

# Every instance: drop only its in-process copy
def on_invalidation(key):
    local_cache.delete(key)

sub.subscribe('cache:invalidate', on_invalidation)
```

**Limitation:** pub/sub is fire-and-forget; a disconnected subscriber misses messages and keeps its copy until TTL. Keep in-process TTLs short, or use a stream when every instance must see every invalidation. Client-side caching with server-assisted tracking (`CLIENT TRACKING`, Redis 6+) is an alternative for L1 invalidation.

---

## Pipelining and Batching

### Pipeline (Reduce Round Trips)

```python
# Without pipeline: 100 round trips
for key in keys:
    redis.get(key)

# With pipeline: 1 round trip
pipe = redis.pipeline()
for key in keys:
    pipe.get(key)
results = pipe.execute()    # All results at once
```

### Multi/Exec (Atomic Transaction)

```redis
MULTI
SET user:123:name "Alice"
INCR user:123:visits
EXPIRE user:123:name 3600
EXEC
```

**Note:** MULTI/EXEC runs the queued commands in sequence with no other client's commands interleaved, but a command cannot use an earlier command's result and there is no rollback. Use WATCH for optimistic check-and-set, or a Lua script when logic depends on values read inside the operation.

---

## Distributed Locking

The canonical recipe for this kit; other skills link here.

1. **Acquire** with a random token as the value and a TTL: `SET lock:{name} <token> NX PX <ttl_ms>`.
2. **TTL longer than the work**, or renew it while working (extend only if the token still matches). A lock that expires mid-work lets a second worker in.
3. **Release only if you still own it** — compare the token and delete atomically (Lua below). A plain `DEL` after expiry deletes another worker's lock.
4. **Fencing token when the lock guards a write.** A paused process can still believe it holds an expired lock. Issue a monotonically increasing number with each acquisition (`INCR lock:{name}:fence`) and have the protected store reject writes carrying an older number. Without fencing, a lock gives efficiency (avoiding duplicate work), not correctness.

```python
import uuid

RELEASE = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
"""

EXTEND = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
"""

def acquire_lock(redis, key, ttl=30):
    token = uuid.uuid4().hex
    return token if redis.set(key, token, nx=True, ex=ttl) else None

def release_lock(redis, key, token):
    return redis.eval(RELEASE, 1, key, token) == 1

def extend_lock(redis, key, token, ttl_ms):
    return redis.eval(EXTEND, 1, key, token, ttl_ms) == 1
```

```python
# Skip-if-running guard for a scheduled job
token = acquire_lock(redis, "lock:daily-report", ttl=3600)
if token is None:
    return "skipped: already running"
try:
    run_report()
finally:
    release_lock(redis, "lock:daily-report", token)
```

For correctness-critical mutual exclusion (only one writer may ever act), prefer the database itself — a row lock, an advisory lock, or a conditional write — over a cache-based lock.

### Redlock (multiple independent instances)

Redlock acquires the lock on a majority of N independent instances within the TTL. It improves availability of the lock service, but it depends on bounded clock drift and process pauses and does not replace fencing: treat it as an efficiency lock. Client libraries exist for most languages.

---

## Clustering

### Redis Cluster

- 16384 hash slots distributed across primaries; resharding moves whole slots
- Each key maps to a slot: `CRC16(key) % 16384`, computed over the hash tag if the key has one
- Failover is built in: the cluster promotes a replica when a primary fails. Sentinel is the separate failover system for primary/replica setups without Cluster.
- Multi-key commands, transactions, and Lua scripts work only when all keys share a slot (use hash tags: `{user:123}:profile`, `{user:123}:settings`)
- Clients must be cluster-aware (follow `MOVED` / `ASK` redirects)

### Hash Tags for Co-location

```redis
# These keys map to the same slot because of {user:123}
SET {user:123}:profile '...'
SET {user:123}:settings '...'
SET {user:123}:sessions '...'

# Now MULTI/EXEC and Lua scripts work across these keys
```

---

## Persistence

| Strategy | Durability | Performance | Recovery Time |
|----------|-----------|-------------|---------------|
| RDB (snapshots) | Point-in-time | Fast (background fork) | Fast (load file) |
| AOF (append-only) | Every write | Slower (fsync options) | Slower (replay log) |
| RDB + AOF | Best of both | AOF overhead | Use AOF for recovery |
| None | No persistence | Fastest | N/A (cache only) |

```redis
# RDB configuration
save 900 1          # Snapshot if 1+ key changed in 900s
save 300 10         # Snapshot if 10+ keys changed in 300s
save 60 10000       # Snapshot if 10000+ keys changed in 60s

# AOF configuration
appendonly yes
appendfsync everysec    # fsync every second (good balance)
# appendfsync always    # fsync every write (safest, slowest)
```

---

## Connection Management

```python
# Connection pooling (Python)
pool = redis.ConnectionPool(
    host='redis',
    port=6379,
    db=0,
    max_connections=50,
    socket_timeout=5,
    socket_connect_timeout=2,
    retry_on_timeout=True,
    health_check_interval=30,
)
r = redis.Redis(connection_pool=pool)
```

```javascript
// Node.js (ioredis)
const redis = new Redis({
  host: 'redis',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  enableReadyCheck: true,
  lazyConnect: true,
});
```

---

## Memory Management

### Eviction Policies

| Policy | Description | Use When |
|--------|-------------|----------|
| noeviction | Return error on memory limit | Data must not be lost |
| allkeys-lru | Evict least recently used | General cache |
| allkeys-lfu | Evict least frequently used | Power-law access patterns |
| volatile-lru | LRU among keys with TTL | Mix of cache and persistent data |
| volatile-ttl | Evict shortest TTL first | Prioritize longer-TTL data |

```redis
# Set memory limit and policy
maxmemory 2gb
maxmemory-policy allkeys-lfu

# Monitor memory
INFO memory
MEMORY USAGE key_name
```

### Memory Optimization

Small hashes, lists, and sorted sets use a compact encoding (listpack) below configurable thresholds (`hash-max-listpack-entries`, `hash-max-listpack-value`). Set TTLs on all cache keys. Use `UNLINK` instead of `DEL` for large keys (non-blocking). Monitor with `redis-cli --bigkeys` and `MEMORY DOCTOR`.
