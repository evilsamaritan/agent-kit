# Zig Dependencies and Standard Library

Package lists and project showcases go stale faster than they help. This file covers how to choose a dependency and where the standard library moves most.

## Contents

- [Choosing a dependency](#choosing-a-dependency)
- [Standard library areas that move most](#standard-library-areas-that-move-most)
- [Standard library first](#standard-library-first)

## Choosing a dependency

```
Does the standard library cover it? → use std
Is it a C library with a stable ABI? → link it and import its header (see build-system.md); a Zig wrapper is optional
Otherwise, a Zig package:
├── Does its build.zig.zon declare a minimum_zig_version at or below the project's? If not, skip it.
├── Does it install with `zig fetch --save <url>`? Hand-copied sources drift.
├── Was it released or updated since the project's Zig version shipped? A package last touched two releases ago probably does not compile.
├── Does it take an allocator (and, from 0.16, an Io) from the caller rather than creating its own?
└── Can the project vendor or replace it in a day? If not, read its tests first.
```

Pin by commit or tagged release, never by branch. Re-run the full build after every Zig upgrade: a dependency pinned to an old release is the usual blocker.

## Standard library areas that move most

Read the release notes of the project's version before writing against these:

| Area | What changes |
|------|--------------|
| I/O: files, networking, process, time, randomness | 0.15 made readers and writers concrete; 0.16 threads an `std.Io` instance through blocking calls |
| Containers: `ArrayList`, hash maps, bit sets | Allocator-passing style, renamed types and methods |
| Allocators | Names and constructors of the checked general-purpose allocator |
| Formatting | Specifiers and the `format` method signature |
| Reflection: `@typeInfo`, `std.meta`, `@Type` replacements | Field-info shape and builtin names |
| Build API: `std.Build`, step helpers, translate-c | Module-centred configuration, step helper names |

Details: [version-notes.md](version-notes.md).

## Standard library first

Reach for `std` before a package for: JSON (`std.json`), hashing and crypto (`std.hash`, `std.crypto`), compression (`std.compress`), logging (`std.log`), string and slice operations (`std.mem`), math with overflow checks (`std.math`), and lookup tables built at compile time (`std.StaticStringMap`). Use `std.testing` for tests and `std.testing.allocator` to catch leaks.
