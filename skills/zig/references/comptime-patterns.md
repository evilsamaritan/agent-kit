# Zig Comptime Patterns

Compile-time metaprogramming, type reflection, and generic data structures.

---

## Generic Data Structures via Comptime

Zig uses comptime type parameters instead of templates or generics syntax.

```zig
fn ArrayList(comptime T: type) type {
    return struct {
        items: []T,
        capacity: usize,
        allocator: std.mem.Allocator,

        const Self = @This();

        pub fn init(allocator: std.mem.Allocator) Self {
            return .{
                .items = &[_]T{},
                .capacity = 0,
                .allocator = allocator,
            };
        }

        pub fn append(self: *Self, item: T) !void {
            if (self.items.len == self.capacity) {
                try self.grow();
            }
            self.items.len += 1;
            self.items[self.items.len - 1] = item;
        }

        pub fn deinit(self: *Self) void {
            self.allocator.free(self.items.ptr[0..self.capacity]);
        }
    };
}

// Usage
var list = ArrayList(u32).init(allocator);
defer list.deinit();
try list.append(42);
```

---

## Type Reflection

`@typeInfo` returns a union describing any type at comptime.

```zig
fn printFields(comptime T: type) void {
    const info = @typeInfo(T);
    switch (info) {
        .@"struct" => |s| {
            inline for (s.fields) |field| {
                std.debug.print("field: {s}, type: {s}\n", .{
                    field.name,
                    @typeName(field.type),
                });
            }
        },
        else => @compileError("Expected struct type"),
    }
}
```

### Compile-Time Validation

```zig
fn ensureHasId(comptime T: type) void {
    if (!@hasField(T, "id")) {
        @compileError(@typeName(T) ++ " must have an 'id' field");
    }
    const id_type = @FieldType(T, "id");
    if (id_type != u64 and id_type != []const u8) {
        @compileError("'id' field must be u64 or []const u8");
    }
}

fn save(comptime T: type, item: T) !void {
    comptime ensureHasId(T);
    // ...
}
```

---

## Compile-Time String Processing

```zig
fn csvFields(comptime csv: []const u8) []const []const u8 {
    comptime {
        var fields: []const []const u8 = &.{};
        var iter = std.mem.splitScalar(u8, csv, ',');
        while (iter.next()) |field| {
            fields = fields ++ .{std.mem.trim(u8, field, " ")};
        }
        return fields;
    }
}

// Usage — resolved at compile time, zero runtime cost
const columns = csvFields("id, name, email, created_at");
// columns[0] == "id", columns[1] == "name", etc.
```

---

## Interface Pattern via Comptime

Zig has no interfaces. Use comptime duck-typing:

```zig
fn serialize(writer: anytype, value: anytype) !void {
    const T = @TypeOf(value);
    if (@hasDecl(T, "serialize")) {
        try value.serialize(writer);
    } else {
        try writer.print("{}", .{value});
    }
}
```

For vtable-style dynamic dispatch, use `@fieldParentPtr` or function pointer structs.

---

## Embed Files

```zig
const template = @embedFile("templates/index.html");
const font_data = @embedFile("assets/font.ttf");
```

Files are embedded as `[]const u8` at compile time. Zero runtime I/O.

---

## Comptime HashMap

```zig
const std = @import("std");

const keywords = std.StaticStringMap(TokenType).initComptime(.{
    .{ "fn", .keyword_fn },
    .{ "return", .keyword_return },
    .{ "if", .keyword_if },
    .{ "else", .keyword_else },
    .{ "while", .keyword_while },
});

fn lookup(str: []const u8) ?TokenType {
    return keywords.get(str);
}
```

`StaticStringMap` generates a perfect hash at comptime — O(1) lookup with zero heap allocation.

---

## Conditional Compilation

```zig
const builtin = @import("builtin");

const os = if (builtin.os.tag == .linux) @import("linux.zig")
           else if (builtin.os.tag == .macos) @import("macos.zig")
           else @compileError("Unsupported OS");

// Feature detection
fn allocate() ![]u8 {
    if (comptime builtin.os.tag == .freestanding) {
        // Embedded: use static buffer
        return &static_buffer;
    } else {
        // OS: use page allocator
        return std.heap.page_allocator.alloc(u8, 4096);
    }
}
```

---

## Testing Comptime Code

Comptime errors are compile errors — they show up when you `zig build test`, not at runtime.

```zig
test "comptime validation rejects bad types" {
    // This would be a compile error:
    // comptime ensureHasId(struct { name: []const u8 });

    // Instead, test that valid types work:
    const ValidType = struct { id: u64, name: []const u8 };
    comptime ensureHasId(ValidType); // should compile
}

test "csvFields parses correctly" {
    const fields = comptime csvFields("a, b, c");
    try std.testing.expectEqual(@as(usize, 3), fields.len);
    try std.testing.expectEqualStrings("a", fields[0]);
    try std.testing.expectEqualStrings("b", fields[1]);
}
```
