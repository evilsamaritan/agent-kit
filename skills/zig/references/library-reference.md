# Zig Library Reference

Ecosystem overview, standard library highlights, and popular packages.

---

## Standard Library Highlights

| Module | Purpose |
|--------|---------|
| `std.mem` | Memory operations, allocator interface, slices |
| `std.fs` | Filesystem operations |
| `std.net` | TCP/UDP networking, address parsing |
| `std.http` | HTTP client and server |
| `std.json` | JSON parsing and serialization |
| `std.fmt` | String formatting |
| `std.log` | Scoped logging with levels |
| `std.testing` | Test framework, allocator with leak detection |
| `std.heap` | Allocator implementations (GPA, Arena, page) |
| `std.Thread` | OS threads, thread pool |
| `std.crypto` | Cryptographic primitives |
| `std.compress` | zlib, gzip, zstd, lz4 |
| `std.hash` | Hash functions (wyhash, crc32, xxhash) |
| `std.math` | Math operations with overflow checking |
| `std.os` | OS-specific APIs |
| `std.meta` | Type reflection, comptime utilities |
| `std.StaticStringMap` | Comptime perfect-hash string map |
| `std.ArrayList` | Dynamic array |
| `std.HashMap` | Hash map |
| `std.BoundedArray` | Fixed-capacity array (no allocation) |

---

## Popular Third-Party Packages

### Web / HTTP

| Package | Purpose |
|---------|---------|
| `zap` | High-performance HTTP server (based on facil.io) |
| `httpz` | HTTP server framework |
| `zhp` | Zero-allocation HTTP server |
| `jetzig` | Full web framework (routing, templates, ORM) |

### Serialization

| Package | Purpose |
|---------|---------|
| `std.json` (stdlib) | JSON parsing/serialization |
| `zig-msgpack` | MessagePack |
| `zig-protobuf` | Protocol Buffers |
| `zig-toml` | TOML parser |
| `zig-yaml` | YAML parser |

### Database

| Package | Purpose |
|---------|---------|
| SQLite via `@cImport` | SQLite (zero-overhead C interop) |
| `pg.zig` | PostgreSQL client |
| `lmdb-zig` | LMDB bindings |

### Networking

| Package | Purpose |
|---------|---------|
| `std.net` (stdlib) | TCP/UDP |
| `std.http` (stdlib) | HTTP client/server |
| `zig-tls` | TLS implementation |
| `websocket.zig` | WebSocket client/server |

### Game Development / Graphics

| Package | Purpose |
|---------|---------|
| `raylib-zig` | Raylib bindings |
| `mach` | Game engine / GPU framework |
| `zig-opengl` | OpenGL bindings |
| `SDL.zig` | SDL2 bindings |

### Embedded / OS

| Package | Purpose |
|---------|---------|
| `microzig` | Embedded development framework |
| `dtb-parser` | Device tree blob parser |

---

## C Libraries via @cImport

Zig can use any C library directly. Common examples:

```zig
// SQLite
const c = @cImport(@cInclude("sqlite3.h"));

// OpenSSL
const c = @cImport({
    @cInclude("openssl/ssl.h");
    @cInclude("openssl/err.h");
});

// POSIX
const c = @cImport(@cInclude("unistd.h"));
```

Link in build.zig:
```zig
exe.linkSystemLibrary("sqlite3");
exe.linkLibC();
```

---

## Notable Zig Projects

| Project | What it is |
|---------|-----------|
| **Bun** | JavaScript runtime (Zig + JavaScriptCore) |
| **TigerBeetle** | Financial transactions database |
| **Mach** | Game engine |
| **River** | Reverse proxy / load balancer |
| **Ghostty** | Terminal emulator |

These demonstrate Zig's strengths: C interop, performance, cross-compilation.

---

## Adding Dependencies

```zig
// 1. Add to build.zig.zon
.dependencies = .{
    .zap = .{
        .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.2.0.tar.gz",
        .hash = "1220...", // zig build will tell you the hash
    },
},

// 2. Use in build.zig
const zap = b.dependency("zap", .{
    .target = target,
    .optimize = optimize,
});
exe.root_module.addImport("zap", zap.module("zap"));

// 3. Import in code
const zap = @import("zap");
```

Fetch hash: run `zig build` — it will error with the correct hash to paste.
