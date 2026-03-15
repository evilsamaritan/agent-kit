# Redis Patterns

Data structures, Lua scripts, pub/sub, clustering, and persistence.

## Contents

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

# Atomic get-and-refresh
GET session:abc123
EXPIRE session:abc123 3600

# Conditional set (only if not exists -- for distributed lock)
SET lock:resource NX EX 30
```

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

# Top 10 with scores (descending)
ZREVRANGE leaderboard 0 9 WITHSCORES

# Player rank (0-indexed, descending)
ZREVRANK leaderboard "player:alice"

# Score range query
ZRANGEBYSCORE leaderboard 1000 2000 WITHSCORES
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

### Atomic Cache-Aside with Stampede Prevention

```lua
-- KEYS[1] = cache key
-- KEYS[2] = lock key
-- ARGV[1] = lock TTL (seconds)
-- Returns: cached value, or nil if lock acquired (caller should compute)

local cached = redis.call('GET', KEYS[1])
if cached then
    return cached
end

-- Try to acquire lock (only first request computes)
local acquired = redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[1])
if acquired then
    return nil  -- Caller should compute and SET the cache
else
    -- Another request is computing; return stale or wait
    return redis.call('GET', KEYS[1])
end
```

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

### Conditional Delete (Release Lock)

```lua
-- KEYS[1] = lock key
-- ARGV[1] = expected owner value
-- Only delete if the lock is still held by the expected owner

if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
```

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
# On write (any server instance):
def update_user(user_id, data):
    db.update(user_id, data)
    redis.publish('cache:invalidate', json.dumps({
        'type': 'user',
        'id': user_id,
    }))

# All server instances subscribe:
def on_invalidation(message):
    data = json.loads(message)
    local_cache.delete(f"{data['type']}:{data['id']}")
    redis.delete(f"{data['type']}:{data['id']}")

sub.subscribe('cache:invalidate', on_invalidation)
```

**Limitation:** Redis pub/sub is fire-and-forget. If a subscriber is disconnected, it misses messages. Use Redis Streams for reliable messaging.

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

**Note:** MULTI/EXEC is atomic but NOT isolated -- other clients can interleave commands between MULTI and EXEC. Use Lua scripts for true isolation.

---

## Distributed Locking

### Single-Instance Lock

```python
import uuid, time

def acquire_lock(redis, resource, ttl=30):
    owner = str(uuid.uuid4())
    acquired = redis.set(f"lock:{resource}", owner, nx=True, ex=ttl)
    return owner if acquired else None

def release_lock(redis, resource, owner):
    # Lua script: only delete if owner matches
    script = """
    if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
    end
    return 0
    """
    redis.eval(script, 1, f"lock:{resource}", owner)
```

### Redlock (Multi-Instance)

For high availability, acquire lock on N/2+1 independent Redis instances:

1. Get current time
2. Try to acquire lock on all N instances with short timeout
3. Lock acquired if: majority (N/2+1) agree AND total time < TTL
4. If failed, release lock on all instances

**Libraries:** redlock-py, redlock (Node.js), Redisson (Java)

---

## Clustering

### Redis Cluster

- 16384 hash slots distributed across nodes
- Each key maps to a slot: `CRC16(key) % 16384`
- Automatic failover with sentinel nodes
- Multi-key operations only work on same slot (use hash tags: `{user:123}:profile`, `{user:123}:settings`)

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

Use hashes for small objects (ziplist encoding: < 128 fields, < 64 bytes each). Set TTLs on all cache keys. Use `UNLINK` instead of `DEL` for large keys (non-blocking). Monitor with `redis-cli --bigkeys` and `MEMORY DOCTOR`.
