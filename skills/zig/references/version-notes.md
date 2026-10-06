# Zig Version Notes

API changes between releases. Zig has no stability guarantee before 1.0: read `zig version` and `minimum_zig_version` in `build.zig.zon`, then use only what that release supports. Facts below come from the official release notes at ziglang.org/download; when a symbol is not found, search the notes of the project's version and the next one.

## Contents

- [Detect and target the version](#detect-and-target-the-version)
- [Changes by release](#changes-by-release)
- [Allocator names by version](#allocator-names-by-version)
- [Writers, readers, and formatting](#writers-readers-and-formatting)
- [Migration order](#migration-order)

## Detect and target the version

- `zig version` is the installed toolchain; `minimum_zig_version` in `build.zig.zon` is what the project declares. They can differ: code must compile on the declared minimum.
- Dependencies pin their own minimum. A package that last released two Zig versions ago probably does not compile.
- As of 2026-10-06 the latest stable release is 0.17.0 (2026-10-01); 0.16.0 shipped 2026-04-13 and 0.15.x in 2025. Re-check ziglang.org/download for newer.

## Changes by release

Most-hit changes first within each release.

### 0.15

- `std.ArrayList` and the other collections are unmanaged by default: `var list: std.ArrayList(u8) = .empty;` then `list.append(gpa, x)`, `list.deinit(gpa)`. The managed form is `std.array_list.Managed`. `ArrayList.init(allocator)` no longer exists.
- Writers and readers are non-generic: `*std.Io.Writer` and `*std.Io.Reader` replace `anytype` writers and the old `std.io` generic types. Stdout needs an explicit buffer and a `flush`.
- `std.BoundedArray` was removed; use a fixed array plus a length, or an unmanaged list over a `FixedBufferAllocator`.
- `root_source_file`, `target`, and `optimize` are set on `root_module = b.createModule(...)`, not on `addExecutable`/`addTest`. `root_module` arrived in 0.14 with the old fields deprecated; 0.15 removed them. Link calls (`linkSystemLibrary`, `linkLibC`) go on the module.
- `usingnamespace` is gone; `async`/`await` do not exist.

### 0.16

- `std.Io`: blocking operations take an `io: std.Io` parameter. `fs.Dir` and `fs.File` became `std.Io.Dir` and `std.Io.File`, and `file.close(io)` takes it. Time, randomness, and sync primitives moved the same way (`io.random(&buf)`, `std.Io.Timestamp`, `std.Io.Event`).
- Entry point: `pub fn main(init: std.process.Init) !void` gives `init.io`, `init.gpa`, `init.arena`. Use these instead of constructing a general-purpose allocator in `main`.
- `@Type` was replaced by specific builtins: `@Int(.unsigned, 10)`, `@Tuple`, `@Pointer`, `@Fn`, `@Struct`, `@Union`, `@Enum`, `@EnumLiteral`.
- Small integers coerce to floats without a cast. Pointers are not allowed in `packed struct` or `packed union`; packed unions need an explicit backing integer.
- `@cImport` is deprecated in favor of a translate step in the build system (see [build-system.md](build-system.md)).
- Removed: `std.Thread.Pool`, `std.heap.ThreadSafeAllocator`, `std.Thread.Mutex.Recursive`, `SegmentedList`, `GenericReader`, `AnyReader`, `FixedBufferStream`, `null_writer`.

### 0.17

- `@cImport` is removed. `std.Build.Step.TranslateC` is deprecated in favor of the official translate-c package as a build dependency; fetch the package branch that matches the toolchain (see [build-system.md](build-system.md)).
- `DebugAllocator` is replaced by a thread-safe `SafeAllocator`; `std.heap.Check` is deprecated. `StackFallbackAllocator` is now `BufferFirstAllocator`, taking its buffer as an argument.
- `@typeInfo` struct and union info is struct-of-arrays: use `info.field_names` and `info.field_types` instead of iterating `info.fields`. `std.meta.fieldInfo`, `fieldNames`, and `fieldTypes` are deprecated.
- `errdefer |err|` capture is removed; restructure with `catch` or split the function.
- `@backingInt` and `@fromBackingInt` replace `@intFromEnum` and `@enumFromInt`; `@divCeil` is new; `@bitCast` has endian-agnostic semantics and rejects `extern` types (use `@ptrCast`).
- `void{}` is `{}`, `i0` is `u0`, array repetition with `**` is replaced by `@splat`. `@hasDecl` is true only for public declarations.
- `ArrayList.getLastOrNull()` is `last()`; `std.fmt.allocPrint` moved to the allocator's `print` method; `std.builtin` is deprecated in favor of `std.lang`, with `OptimizeMode` becoming `std.lang.Optimize`, whose tags are now `.debug`, `.safe`, `.fast`, `.small`. The old names (`Debug`, `ReleaseSafe`, `ReleaseFast`, `ReleaseSmall`) remain as deprecated aliases, and `-Doptimize=ReleaseSafe` is still accepted; `std.lang.Optimize.runtimeSafety()` replaces hand-written checks of the mode.
- Build: `zig fetch` without `--save` only fetches into the global cache; `b.build_root` became `b.root`; step-argument helpers moved to renamed variants (check the build API of the project's version); run steps forward arguments with `addPassthruArgs()`.

## Allocator names by version

| Need | 0.14 to 0.16 | 0.17 |
|------|--------------|------|
| Debug-build checked allocator | `std.heap.DebugAllocator` (named `GeneralPurposeAllocator` before 0.14) | `SafeAllocator` |
| Release-build multithreaded | `std.heap.smp_allocator` (introduced in 0.14) | `std.heap.smp_allocator` (unchanged) |
| Program-provided allocator | `init.gpa` from `std.process.Init` (0.16+) | `init.gpa` (unchanged) |

`DebugAllocator` still exists in 0.17 but is deprecated. `SafeAllocator` reports leaks in `deinit`, panics on allocation mismatches and double frees, and is thread-safe. Do not hand-write `defer _ = gpa.deinit()` patterns from old code without checking the project's version: the deinit return type and the type name changed.

## Writers, readers, and formatting

From 0.15 the writer is a concrete `*std.Io.Writer`; code that took `writer: anytype` for the standard library's types now takes the concrete pointer. Format strings:

- `{f}` calls a type's `format` method; `{}` on a type that has a `format` method is a compile error in 0.15+. `{any}` prints a value generically, skipping `format`.
- `{s}` for strings and `{d}` for integers are unchanged.
- Custom `format` methods take a `*std.Io.Writer`.

## Migration order

When moving a project to a newer release, change in this order: `build.zig` and `build.zig.zon` (they decide whether anything compiles), then `main` and I/O plumbing, then allocator names, then reflection code, then tests.
