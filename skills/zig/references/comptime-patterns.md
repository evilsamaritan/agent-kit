# Zig Comptime Patterns

Compile-time code for things the standard library does not already give you: distinct types, validation, static tables, and interfaces. Reflection and I/O APIs shift between releases; see [version-notes.md](version-notes.md).

## Contents

- [Type-generating functions](#type-generating-functions)
- [Reflection and compile-time validation](#reflection-and-compile-time-validation)
- [Compile-time string processing](#compile-time-string-processing)
- [Interfaces](#interfaces)
- [Embedded files and static maps](#embedded-files-and-static-maps)
- [Conditional compilation](#conditional-compilation)
- [Testing comptime code](#testing-comptime-code)

## Type-generating functions

A function that takes `comptime` arguments and returns `type` builds a new type per distinct argument. Use it for types that differ only by a tag, so the compiler separates what the values mean.

```zig
fn Id(comptime Tag: type) type {
    return struct {
        value: u64,

        const Self = @This();
        pub const entity = Tag;

        pub fn init(value: u64) Self {
            return .{ .value = value };
        }
        pub fn eql(a: Self, b: Self) bool {
            return a.value == b.value;
        }
    };
}

const UserId = Id(User);
const OrderId = Id(Order);

fn cancel(id: OrderId) void { _ = id; }
// cancel(UserId.init(7)) is a compile error: the types are distinct
```

Generic containers already exist in `std`; write a new one only for a shape the standard library lacks.

## Reflection and compile-time validation

`@typeInfo(T)` returns a union describing a type. Fail the build with `@compileError` when a type does not meet a contract:

```zig
fn ensureHasId(comptime T: type) void {
    if (!@hasField(T, "id")) {
        @compileError(@typeName(T) ++ " must have an 'id' field");
    }
    const id_type = @FieldType(T, "id");
    if (id_type != u64 and id_type != []const u8) {
        @compileError("'id' field of " ++ @typeName(T) ++ " must be u64 or []const u8");
    }
}

fn save(comptime T: type, item: T) !void {
    comptime ensureHasId(T);
    _ = item;
    // ...
}
```

Iterating struct fields depends on the version. 0.16 and earlier, an array of field records:

```zig
fn printFields(comptime T: type) void {
    const info = @typeInfo(T).@"struct";
    inline for (info.fields) |field| {
        std.debug.print("{s}: {s}\n", .{ field.name, @typeName(field.type) });
    }
}
```

0.17 and later, parallel arrays:

```zig
fn printFields(comptime T: type) void {
    const info = @typeInfo(T).@"struct";
    inline for (info.field_names, info.field_types) |name, ty| {
        std.debug.print("{s}: {s}\n", .{ name, @typeName(ty) });
    }
}
```

Prefer `@hasField`, `@hasDecl`, and `@FieldType` where they are enough: they are stable across releases. `@hasDecl` reports only public declarations from 0.17.

## Compile-time string processing

Inputs known at compile time can be parsed at compile time, and the result sized by the same computation:

```zig
fn countFields(comptime csv: []const u8) usize {
    var n: usize = 1;
    for (csv) |ch| {
        if (ch == ',') n += 1;
    }
    return n;
}

fn csvFields(comptime csv: []const u8) [countFields(csv)][]const u8 {
    var out: [countFields(csv)][]const u8 = undefined;
    var it = std.mem.splitScalar(u8, csv, ',');
    var i: usize = 0;
    while (it.next()) |field| : (i += 1) {
        out[i] = std.mem.trim(u8, field, " ");
    }
    return out;
}

const columns = csvFields("id, name, email"); // evaluated at compile time
```

Compile-time evaluation has a branch quota. A long loop needs `@setEvalBranchQuota`; if the quota keeps growing, move the work to a build step that generates a file.

## Interfaces

Zig has no interface keyword. Choose by when the implementation is known:

```
Known at compile time (one type per call site) → anytype / comptime T with @hasDecl checks
Chosen at runtime, or an open family          → vtable: pointer plus a table of function pointers
```

Static dispatch:

```zig
fn serialize(writer: *std.Io.Writer, value: anytype) !void {
    const T = @TypeOf(value);
    if (@hasDecl(T, "serialize")) {
        try value.serialize(writer);
    } else {
        try writer.print("{any}", .{value});
    }
}
```

Runtime dispatch for an open family: each member fills the vtable once, consumers call the interface and never switch on the member (`development`).

```zig
const Storage = struct {
    ptr: *anyopaque,
    vtable: *const VTable,

    const VTable = struct {
        put: *const fn (ptr: *anyopaque, key: []const u8, value: []const u8) anyerror!void,
    };

    pub fn put(s: Storage, key: []const u8, value: []const u8) !void {
        return s.vtable.put(s.ptr, key, value);
    }
};

const MemStorage = struct {
    // ... fields

    pub fn storage(self: *MemStorage) Storage {
        return .{ .ptr = self, .vtable = &.{ .put = put } };
    }

    fn put(ptr: *anyopaque, key: []const u8, value: []const u8) anyerror!void {
        const self: *MemStorage = @ptrCast(@alignCast(ptr));
        _ = self;
        _ = key;
        _ = value;
    }
};
```

`std.mem.Allocator` and the standard I/O interfaces use this same pattern.

## Embedded files and static maps

```zig
const template = @embedFile("templates/index.html"); // []const u8, no runtime I/O

const keywords = std.StaticStringMap(TokenKind).initComptime(.{
    .{ "fn", .keyword_fn },
    .{ "return", .keyword_return },
    .{ "if", .keyword_if },
});

fn lookup(word: []const u8) ?TokenKind {
    return keywords.get(word);
}
```

`StaticStringMap` is built at compile time and needs no heap.

## Conditional compilation

A branch whose condition is comptime-known is not analyzed when untaken, so an unsupported target can use `@compileError` safely:

```zig
const builtin = @import("builtin");

const sys = switch (builtin.target.os.tag) {
    .linux => @import("linux.zig"),
    .macos => @import("macos.zig"),
    else => @compileError("unsupported OS"),
};

fn scratch(gpa: std.mem.Allocator) ![]u8 {
    if (comptime builtin.target.os.tag == .freestanding) {
        return &static_buffer; // no heap on this target
    }
    return gpa.alloc(u8, 4096);
}
```

## Testing comptime code

A comptime failure is a compile error, so it surfaces during `zig build test`, not at runtime. Test the accepting cases; a rejected case cannot be asserted from inside the same file.

```zig
test "validation accepts a conforming type" {
    const Valid = struct { id: u64, name: []const u8 };
    comptime ensureHasId(Valid);
}

test "csvFields trims and splits" {
    const fields = comptime csvFields("a, b, c");
    try std.testing.expectEqual(@as(usize, 3), fields.len);
    try std.testing.expectEqualStrings("b", fields[1]);
}
```
