---
name: zig
description: Write idiomatic Zig — comptime, allocators, error unions, C interop, build system. Use when working with .zig files, build.zig, build.zig.zon, or any Zig question. Triggers on comptime, allocator, errdefer, @cImport, zig build. Do NOT use for general systems programming patterns (use backend) or Rust (use rust).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Zig

Systems programming with explicit control. Zig 0.14+, comptime metaprogramming, manual memory management with allocator interface, zero hidden control flow.

**Hard rules:**
- No hidden allocations — every allocation goes through an explicit `Allocator`
- No hidden control flow — no operator overloading, no exceptions, no hidden function calls
- Always `defer`/`errdefer` for resource cleanup — never rely on callers
- Never ignore errors — handle or explicitly discard with `_ = expr`
- Prefer slices (`[]T`) over pointers (`[*]T`) — slices carry length
- No undefined behavior — Zig safety checks are on by default (disable only in ReleaseFast)

---

## Core Mental Model

Zig is **C with better tools**, not "Rust without the borrow checker". It gives you the same low-level control as C but with: explicit allocators instead of malloc, comptime instead of macros/preprocessor, error unions instead of errno, and safety checks instead of undefined behavior.

**No runtime.** No garbage collector, no async runtime, no hidden allocations. What you write is what executes. This makes Zig ideal for embedded, OS kernels, game engines, and performance-critical code that needs to interop with C.

---

## Allocators

The defining feature of Zig. Every allocation is explicit and goes through an `Allocator` interface.

```zig
// Functions that allocate take an allocator parameter
fn parseJson(allocator: std.mem.Allocator, input: []const u8) !JsonValue {
    var list = std.ArrayList(u8).init(allocator);
    defer list.deinit();
    // ...
}
```

### Allocator Decision Tree

```
Which allocator?
├── Short-lived, bulk deallocate → ArenaAllocator (free everything at once)
├── Fixed-size buffer, no heap → FixedBufferAllocator (stack or static buffer)
├── General purpose, debug → GeneralPurposeAllocator (leak detection, double-free detection)
├── Performance-critical, production → c_allocator or page_allocator
├── Testing → testing.allocator (detects leaks, reports in test failure)
└── Composing allocators → wrap inner allocator (logging, tracking, pooling)
```

| Allocator | Heap? | Leak detection | Use case |
|-----------|-------|---------------|----------|
| `GeneralPurposeAllocator` | Yes | Yes (debug) | Development, debugging |
| `ArenaAllocator` | Yes | No (bulk free) | Request handling, parsing, frame-based |
| `FixedBufferAllocator` | No | N/A | Embedded, stack-constrained |
| `page_allocator` | Yes | No | Large allocations, backing for arenas |
| `c_allocator` | Yes | No | C interop, production performance |
| `testing.allocator` | Yes | Yes | Unit tests |

**Pattern:** Arena for request-scoped work, GPA for development, c_allocator/page_allocator for production.

---

## Error Handling

Zig uses **error unions** (`!T`) — a value is either a result or an error. No exceptions, no panics for recoverable errors.

```zig
fn readFile(path: []const u8) ![]u8 {
    const file = std.fs.cwd().openFile(path, .{}) catch |err| {
        return err;  // or: return error.FileNotFound;
    };
    defer file.close();
    return file.readToEndAlloc(allocator, max_size);
}

// try = shorthand for catch |err| return err
fn process() !void {
    const data = try readFile("config.json");
    defer allocator.free(data);
    // ...
}
```

| Keyword | Purpose |
|---------|---------|
| `try expr` | Propagate error if expr is error, unwrap if success |
| `catch \|err\| ...` | Handle error explicitly |
| `catch unreachable` | Assert no error (safety-checked, panics in debug) |
| `errdefer` | Run cleanup ONLY if function returns an error |
| `defer` | Run cleanup unconditionally on scope exit |
| `if (expr) \|value\|` | Unwrap optional |
| `orelse` | Provide default for optional |

**errdefer** — the critical pattern for resource safety:

```zig
fn init(allocator: Allocator) !Self {
    const buffer = try allocator.alloc(u8, 1024);
    errdefer allocator.free(buffer);  // free ONLY if init fails

    const handle = try openHandle();
    errdefer closeHandle(handle);     // close ONLY if init fails

    return Self{ .buffer = buffer, .handle = handle };
}
```

---

## Comptime

Zig's metaprogramming system. Code runs at compile time — no macros, no preprocessor, no code generation.

```zig
// Generic via comptime type parameter
fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

// Comptime string formatting
fn fieldName(comptime prefix: []const u8, comptime name: []const u8) []const u8 {
    return prefix ++ "_" ++ name;
}

// Type reflection
fn hasField(comptime T: type, comptime name: []const u8) bool {
    const fields = std.meta.fields(T);
    for (fields) |f| {
        if (std.mem.eql(u8, f.name, name)) return true;
    }
    return false;
}
```

**Key comptime patterns:**
- `comptime` parameters make functions generic (no templates, no monomorphization syntax)
- `@typeInfo(T)` — reflect on any type at compile time
- `inline for` — unroll loops at comptime
- `@embedFile` — embed file contents as compile-time constant
- `comptime var` — mutable variable that must resolve at compile time

**Rule:** If you'd use a macro in C, use comptime in Zig. If you'd use a template in C++, use comptime type parameters.

---

## Build System

`build.zig` is Zig code — the build system is a Zig program, not a declarative file.

```zig
// build.zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    b.installArtifact(exe);

    // Link C library
    exe.linkSystemLibrary("sqlite3");
    exe.linkLibC();

    // Tests
    const tests = b.addTest(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
    });
    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_tests.step);
}
```

### Package Management (build.zig.zon)

```zig
// build.zig.zon
.{
    .name = "myproject",
    .version = "0.1.0",
    .dependencies = .{
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/v0.2.0.tar.gz",
            .hash = "...",
        },
    },
}
```

**Cross-compilation** — Zig's killer feature. Cross-compile to any target from any host:

```bash
zig build -Dtarget=aarch64-linux-musl          # ARM Linux static binary
zig build -Dtarget=x86_64-windows-gnu          # Windows from Linux/macOS
zig build -Dtarget=wasm32-wasi                  # WebAssembly
```

---

## C Interop

Zig can directly import and use C headers — no bindings, no FFI layer.

```zig
const c = @cImport({
    @cInclude("sqlite3.h");
});

fn openDb(path: [*:0]const u8) !*c.sqlite3 {
    var db: ?*c.sqlite3 = null;
    if (c.sqlite3_open(path, &db) != c.SQLITE_OK) {
        return error.SqliteOpenFailed;
    }
    return db.?;
}
```

**Zig as C compiler** — use `zig cc` as a drop-in replacement for `cc`/`gcc`:
```bash
zig cc -o program program.c -lm       # compile C with Zig's toolchain
```

---

## Testing

Built-in. No framework needed.

```zig
const std = @import("std");
const testing = std.testing;

test "addition" {
    try testing.expectEqual(@as(u32, 4), 2 + 2);
}

test "string contains" {
    try testing.expect(std.mem.indexOf(u8, "hello world", "world") != null);
}

test "allocation" {
    // testing.allocator detects leaks
    var list = std.ArrayList(u8).init(testing.allocator);
    defer list.deinit();
    try list.append(42);
    try testing.expectEqual(@as(usize, 1), list.items.len);
}
```

Run with `zig build test` or `zig test src/main.zig`.

---

## Tagged Unions

Zig's most powerful type — like Rust enums but with comptime reflection.

```zig
const Token = union(enum) {
    number: f64,
    string: []const u8,
    plus,
    minus,
    eof,

    fn isOperator(self: Token) bool {
        return switch (self) {
            .plus, .minus => true,
            else => false,
        };
    }
};
```

**Switch on tagged unions is exhaustive** — compiler enforces handling all variants.

---

## Optimization Modes

| Mode | Safety | Speed | Use |
|------|--------|-------|-----|
| `Debug` | Full | Slow | Development (default) |
| `ReleaseSafe` | Full | Fast | Production (recommended) |
| `ReleaseFast` | Off | Fastest | Performance-critical hot paths |
| `ReleaseSmall` | Off | Small binary | Embedded, WASM |

**Rule:** Default to `ReleaseSafe` for production. Only use `ReleaseFast` for benchmarked hot paths.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Fix |
|---|-------------|---------|-----|
| 1 | Ignoring errors with `_ =` silently | Hides bugs | Handle error or add comment explaining why ignored |
| 2 | Using `c_allocator` in tests | No leak detection | Use `testing.allocator` in tests |
| 3 | Not using `errdefer` | Resource leaks on error paths | `errdefer` for every resource acquired before a failable operation |
| 4 | Raw pointers when slices work | No bounds checking, no length | Prefer `[]T` slices over `[*]T` pointers |
| 5 | `@intCast` without validation | Runtime panic on overflow | Validate range before cast, or use `std.math.cast` |
| 6 | Global state | Untestable, thread-unsafe | Pass state explicitly as parameters |
| 7 | `catch unreachable` in non-proven code | Debug panic, release UB (in ReleaseFast) | Use `catch` with proper error handling |
| 8 | Allocating in hot loops | GC-like performance issues | Pre-allocate, use arena per frame |
| 9 | Mixing allocators for alloc/free | Undefined behavior | Same allocator for alloc and free |
| 10 | Not `defer`-ing close/deinit | Resource leaks | Immediately `defer` after acquiring resource |

---

## Related Knowledge

- **backend** — HTTP servers (zap, httpz), service patterns
- **database** — SQLite via @cImport, custom storage engines
- **docker** — minimal static binaries, scratch containers
- **rust** — comparison: Zig = explicit simplicity, Rust = compiler-enforced safety

## References

Load on demand for detailed patterns:

- `references/comptime-patterns.md` — type reflection, generic data structures, compile-time validation, serialization
- `references/library-reference.md` — ecosystem overview, popular packages, C library interop recipes
