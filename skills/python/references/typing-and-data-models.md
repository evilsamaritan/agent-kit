# Typing and Data Models

Use this reference when annotating code, choosing a data model type, configuring checker strictness, or reviewing typed Python. Syntax availability per version is in [version-notes.md](version-notes.md); when the project supports older versions, import newer names from `typing_extensions`.

## Contents

- [Gradual typing in practice](#gradual-typing-in-practice)
- [Annotation choices](#annotation-choices)
- [Protocols and generics](#protocols-and-generics)
- [Narrowing](#narrowing)
- [TypedDict](#typeddict)
- [Dataclasses, attrs, and validating models](#dataclasses-attrs-and-validating-models)
- [Parse at the boundary](#parse-at-the-boundary)
- [Review checklist](#review-checklist)

## Gradual typing in practice

Checkers treat unannotated parameters as unknown, and mypy by default skips the bodies of unannotated functions, so an untyped function silently weakens checks for its callers and itself. The useful order when adding types to existing code:

1. Public functions and methods of each package (parameters and return types).
2. Boundary parsers: anything that turns JSON, rows, environment, or messages into values.
3. Shared data structures (replace `dict[str, Any]` with dataclasses or `TypedDict`).
4. Internals, as they are touched.

Turn on strict checking per package once it is annotated, and keep it on. A CI gate of "no new errors" (a baseline file or per-module overrides) lets a legacy codebase improve without a big-bang migration.

`Any` turns checking off in both directions. Prefer `object` when a value can be anything and the code narrows before use. A needed suppression is coded and explained: `# type: ignore[arg-type]  # vendor stub wrong, see upstream issue` — or the checker's own equivalent comment.

Stubs: install `types-*` packages or the library's own `py.typed` distribution; for an untyped dependency, a small local stub of the functions you call beats sprinkling `Any`.

## Annotation choices

| Situation | Prefer | Avoid |
|-----------|--------|-------|
| Parameter that is only read | `Sequence[T]`, `Mapping[K, V]`, `Iterable[T]` | `list[T]`, `dict[K, V]` (forces callers' type) |
| Return value | Concrete type (`list[T]`) | Abstract types that hide what the caller gets |
| Optional value | `T \| None` with an explicit `None` check | Implicit `None` default without `\| None` |
| Fixed set of strings | `Literal["asc", "desc"]` or a `StrEnum` | Bare `str` |
| Distinct IDs of the same runtime type | `NewType("OrderId", str)` | Raw `str` everywhere |
| Callback | `Callable[[Event], None]` or a callback `Protocol` for keyword arguments | `Callable[..., Any]` |
| Method returning its own class | `Self` | A string forward reference to the class |
| Overriding a base method | `@override` | Silent overrides that break on rename |
| Constant | `Final` | Module globals reassigned at runtime |
| Forwarding `**kwargs` with known keys | `Unpack[SomeTypedDict]` | `**kwargs: Any` |
| Deprecated API kept for compatibility | `@deprecated("use X")` | Comment-only deprecation |

## Protocols and generics

A `Protocol` lets the consumer declare exactly what it needs:

```python
class BlobStore(Protocol):
    def put(self, key: str, data: bytes) -> None: ...
    def get(self, key: str) -> bytes | None: ...

class ReportArchiver:
    def __init__(self, store: BlobStore) -> None:
        self._store = store
```

Any class with matching methods satisfies it; no import of the protocol is needed by implementers. Keep protocols small and defined next to the consumer. `@runtime_checkable` only checks method presence, not signatures; do not use it to dispatch (that is an `isinstance` chain by another name).

Generics: with Python 3.12+ write `def first[T](items: Sequence[T]) -> T` and `class Page[T]: ...`; on older versions declare `T = TypeVar("T")`. Use a bound (`[T: Comparable]`) or constraints when the function relies on an operation. Do not add a type parameter used only once; `object` or the concrete type is clearer.

## Narrowing

Checkers narrow on `is None`, `isinstance`, `==` against literals, `in` for literal unions, and `match` patterns. For reusable checks, write a `TypeIs[T]` function (or `TypeGuard[T]` when the check does not narrow the negative branch). `assert_never(x)` in the final branch makes the checker prove a closed union or enum is exhausted; it also raises at runtime if an unexpected value arrives.

`cast()` is an unchecked claim. Prefer a narrowing check that also fails loudly at runtime.

## TypedDict

`TypedDict` types dict-shaped data without changing the runtime value:

- Use it for JSON passthrough, `**kwargs` typing, and gradual typing of existing dict-heavy code.
- `Required`, `NotRequired`, and `ReadOnly` mark keys individually; `total=False` makes all keys optional.
- It performs no validation. Data from outside still needs a parser.
- Do not use it for internal records that are constructed by your own code; a dataclass gives attribute access, immutability, and methods.

## Dataclasses, attrs, and validating models

```
Need runtime validation or coercion of untrusted input?
├── Yes → validating model (pydantic is the common choice; msgspec for speed-critical
│         decoding; attrs with validators when the project already uses attrs)
└── No
    ├── Plain record, immutable → @dataclass(frozen=True, slots=True)
    ├── Needs converters, validators, or features dataclasses lack, and attrs is present → attrs
    └── Must be a tuple → NamedTuple
```

| Concern | `dataclass` | attrs | pydantic |
|---------|-------------|-------|----------|
| Dependency | stdlib | third-party | third-party, compiled core |
| Validation | none | opt-in validators | always on construction |
| Coercion (`"1"` to `1`) | none | opt-in converters | default in lax mode; disable with strict mode |
| Serialization | `asdict` only | via cattrs | built in (`model_dump`, JSON schema) |
| Best for | internal values | rich internal values | boundaries: requests, config, messages |

Rules:

- `frozen=True` by default for values; mutate with `dataclasses.replace` (or `copy.replace` on 3.13+).
- `kw_only=True` for records with more than a few fields, so call sites stay readable and fields can be reordered.
- Mutable field defaults use `field(default_factory=list)`.
- pydantic: use the v2 API (`model_validate`, `model_dump`, `ConfigDict`, `field_validator`); the v1 API and `pydantic.v1` are legacy. Enable strict mode where silent coercion would hide bad input.
- Do not inherit domain behavior from a validation library's base class across the whole codebase; it couples every layer to the library and to its validation cost.

## Parse at the boundary

```python
@dataclass(frozen=True, slots=True)
class ShipmentRequest:
    destination: CountryCode
    weight_grams: int

def parse_shipment(raw: Mapping[str, object]) -> ShipmentRequest:
    ...  # validate once; raise a domain error with the field name on failure
```

Parse untrusted input into typed values once, where it enters (request handler, message consumer, config loader). Inner code receives `ShipmentRequest`, not a `dict`, and never re-validates. The same applies to environment and configuration: load into one typed settings object at startup and pass it in, instead of calling `os.environ` throughout the code.

## Review checklist

- Public signatures annotated; no implicit `Any` from unannotated functions on changed paths.
- No `dict[str, Any]` crossing a module boundary.
- `Any`, `cast`, and ignores justified in a comment.
- Closed unions and enums dispatched exhaustively with `assert_never`.
- Read-only parameters typed with abstract collection types.
- One validating library, used at boundaries.
