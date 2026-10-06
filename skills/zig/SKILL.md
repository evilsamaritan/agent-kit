---
name: zig
description: "Write or review Zig. Use for .zig/build.zig, comptime, allocators, errors, C interop, build configuration, and resource cleanup."
user-invocable: true
---

# Zig

Systems programming with explicit control: manual memory through an allocator interface, comptime instead of macros, error unions instead of errno, no hidden control flow.

**Determine the Zig version first.** Run `zig version` and read `minimum_zig_version` in `build.zig.zon`. The standard library and the build API break in every minor release, so write only what that version supports. Per-version API changes are in [version-notes.md](references/version-notes.md); this file holds only what stays true across versions.

**Hard rules:**
- No hidden allocations — every allocation goes through an explicit `Allocator` that the caller passes in
- No hidden control flow — no operator overloading, no exceptions, no hidden function calls
- `defer`/`errdefer` at the point of acquisition — never rely on callers to clean up
- Never ignore errors — handle them, or discard with `_ = expr` plus a comment saying why
- Prefer slices (`[]T`) over many-item pointers (`[*]T`) — slices carry length
- Illegal behavior is trapped only in `Debug` and `ReleaseSafe`; `ReleaseFast` and `ReleaseSmall` remove the checks, so code must be correct without them

## Mental model

Zig is C with better tools, not Rust without the borrow checker. There is no runtime, garbage collector, or hidden allocation: what you write is what executes. Ownership is by convention — the allocator that allocated frees, and the type's `deinit` documents who owns what. That suits embedded, kernels, game engines, and code that talks to C.

## Allocators

Functions that allocate take an `Allocator` parameter. Containers store no allocator in current versions: pass it to each call that may allocate.

```zig
fn splitLines(gpa: std.mem.Allocator, input: []const u8) ![][]const u8 {
    var lines: std.ArrayList([]const u8) = .empty;
    errdefer lines.deinit(gpa);
    var it = std.mem.splitScalar(u8, input, '\n');
    while (it.next()) |line| try lines.append(gpa, line);
    return lines.toOwnedSlice(gpa);
}
```

### Which allocator

```
├── Scoped bulk work (request, parse, frame) → ArenaAllocator over a backing allocator; free everything at once
├── No heap allowed → FixedBufferAllocator over a stack or static buffer
├── Debug builds → the leak- and misuse-detecting general-purpose allocator (name varies by version)
├── Program edge → the allocator the entry point provides (0.16+); otherwise the release multithreaded allocator, or c_allocator when linking libc (names by version in [version-notes.md](references/version-notes.md))
├── Tests → std.testing.allocator (fails the test on a leak)
└── page_allocator → a backing allocator for the others, not for small allocations
```

Pick the allocator at the program edge (`main` or the test) and pass it down; library code never chooses one. An allocation and its free use the same allocator. Allocation inside a hot loop is a design smell: pre-size, reuse a buffer, or use an arena reset per iteration.

## Errors

A function returns an error union (`!T`): a result or an error from an error set. Recoverable failures are errors; programmer mistakes are asserts or `unreachable`.

| Form | Meaning |
|------|---------|
| `try expr` | Propagate the error, unwrap on success |
| `expr catch \|err\| ...` | Handle it here |
| `catch unreachable` | Assert it cannot happen — traps in safe modes, undefined behavior otherwise; only for proven invariants |
| `defer` | Run on every scope exit |
| `errdefer` | Run only when the scope exits with an error |
| `orelse` / `if (opt) \|v\|` | Default for, or unwrap, an optional |

`errdefer` pairs each acquisition with its undo while the function can still fail:

```zig
const Conn = struct {
    buffer: []u8,
    handle: Handle,

    fn init(gpa: std.mem.Allocator) !Conn {
        const buffer = try gpa.alloc(u8, 1024);
        errdefer gpa.free(buffer);
        const handle = try openHandle();
        errdefer closeHandle(handle);
        try handshake(handle); // fails: both errdefers run, in reverse order
        return .{ .buffer = buffer, .handle = handle };
    }
};
```

Prefer a named error set for public functions so callers can switch exhaustively; inferred sets (`!T`) are fine inside a module.

## Comptime

Code that runs at compile time replaces macros and templates. Types are values: a function that takes `comptime T: type` is generic, and one that returns `type` builds a new type.

- `comptime` parameters make functions generic; `@typeInfo(T)` reflects on any type; `inline for` unrolls over comptime-known items.
- `@compileError` turns a violated assumption into a build failure with a message.
- `@embedFile` embeds a file as a constant; `std.StaticStringMap` builds a lookup table at comptime.

If you would write a macro in C, write comptime in Zig. Patterns, and the reflection API shape that changed in 0.17, are in [comptime-patterns.md](references/comptime-patterns.md).

## Build system

`build.zig` is a Zig program that describes a graph of steps. Its shape stays the same across versions:

1. Read `target` and `optimize` from `standardTargetOptions` and `standardOptimizeOption`.
2. Create a module with those, and a compile step from it (executable, library, or test).
3. `installArtifact` for the install step; a named `test` step that runs the test compile step.
4. Link C libraries and add imports on the module, not on the compile step.

Optimize mode is a property of each module, so a debug-friendly tool and a release library can coexist in one build. Dependencies live in `build.zig.zon` (package name as an enum literal, a required `fingerprint`, `minimum_zig_version`); add them with `zig fetch --save <url>` rather than writing hashes by hand. A complete current example, the dependency flow, and C translation by version are in [build-system.md](references/build-system.md).

Cross-compiling is built in: `zig build -Dtarget=aarch64-linux-musl`, `-Dtarget=x86_64-windows-gnu`, `-Dtarget=wasm32-wasi`. `zig cc` is a drop-in C compiler using the same toolchain.

## C interop

Zig reads C headers directly and calls C without a binding layer. How a header is imported depends on the version: `@cImport` in older releases, a build-system translate step or an external translate-c package in newer ones. Check the version, then follow [build-system.md](references/build-system.md). Whatever the import path, convert C types at the boundary: `[*:0]const u8` for C strings, `?*T` for nullable pointers, and wrap each C resource in a Zig type with `init`/`deinit`.

## Testing

`test` blocks live next to the code and run with `zig build test` (or `zig test file.zig` for one file). Use `std.testing.allocator` so leaks fail the test, and `try testing.expect...` for assertions.

```zig
test "splitLines returns every line" {
    const lines = try splitLines(std.testing.allocator, "a\nb");
    defer std.testing.allocator.free(lines);
    try std.testing.expectEqual(@as(usize, 2), lines.len);
    try std.testing.expectEqualStrings("b", lines[1]);
}
```

## Tagged unions

`union(enum)` carries a payload per variant, and a `switch` over it is exhaustive.

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
            .number, .string, .eof => false,
        };
    }
};
```

Use tagged unions for closed sets: tokens, protocol messages, states. List the remaining tags instead of `else`, so a new member forces a decision at each switch. An open family (providers, importers, backends) is a struct of function pointers, or a vtable interface, that each member fills in and registers once; consumers call it instead of switching (`development`).

## Optimization modes

| Mode | Safety checks | Use |
|------|---------------|-----|
| `Debug` | On | Development (default) |
| `ReleaseSafe` | On | Production default |
| `ReleaseFast` | Off | Benchmarked hot paths where the speed is proven needed |
| `ReleaseSmall` | Off | Binary size: embedded, WASM |

Zig 0.17 renamed the enum tags to `debug`, `safe`, `fast`, `small` (`std.lang.Optimize`); the names above remain as deprecated aliases and `-Doptimize=ReleaseSafe` is still accepted ([version-notes.md](references/version-notes.md)).

## Anti-patterns

| # | Anti-pattern | Problem | Fix |
|---|--------------|---------|-----|
| 1 | `_ =` on an error with no reason | Hides bugs | Handle it, or comment why it is safe to drop |
| 2 | `c_allocator` or `page_allocator` in tests | No leak detection | `std.testing.allocator` |
| 3 | Acquiring without `errdefer` | Leaks on error paths | One `errdefer` per resource acquired before a failable step |
| 4 | Many-item pointers where a slice works | No length, no bounds checks | `[]T` |
| 5 | `@intCast` without validation | Illegal behavior in unsafe modes | Check the range first, or use `std.math.cast` |
| 6 | Mutable global state | Untestable, thread-unsafe | Pass state and dependencies explicitly (`development`) |
| 7 | `catch unreachable` on unproven errors | Traps in safe modes, undefined behavior in `ReleaseFast` | Handle the error |
| 8 | Allocation inside a hot loop | Slow, fragments memory | Pre-size, reuse a buffer, or reset an arena per iteration |
| 9 | Freeing with a different allocator than allocated | Undefined behavior | Same allocator for alloc and free |
| 10 | Resource acquired without an immediate `defer` | Leaks on early return | `defer` on the next line |
| 11 | Copying API usage from old examples | Does not compile on the project's version | Check [version-notes.md](references/version-notes.md) |

## Related Knowledge

- **development** — the code practice these idioms express: variant families, ownership, explicit dependencies
- **backend** — service structure for HTTP servers and workers written in Zig
- **database** — storage design when embedding SQLite or building a storage engine
- **docker** — minimal static binaries and scratch images
- **rust** — comparison: Zig is explicit simplicity, Rust is compiler-enforced safety

## References

- [version-notes.md](references/version-notes.md) — API changes by release, to read before writing std or build code
- [build-system.md](references/build-system.md) — `build.zig` and `build.zig.zon` example, dependencies, C translation by version
- [comptime-patterns.md](references/comptime-patterns.md) — type generation, reflection, compile-time validation, interfaces
- [library-reference.md](references/library-reference.md) — vetting a dependency, stdlib areas that move most
