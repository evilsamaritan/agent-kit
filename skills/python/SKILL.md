---
name: python
description: "Write or review Python. Use for .py files, pyproject.toml, typing and type checkers, dataclasses and data models, asyncio, exceptions, packaging and environments (uv, pip, poetry, conda), ruff, and pytest. Do NOT use for framework specifics such as Django or FastAPI, or for code-practice rules that hold in any language (development)."
user-invocable: true
---

# Python

Idiomatic, typed, maintainable Python for applications, services, libraries, and scripts.

**First, determine the project's Python version and toolchain.** Read `requires-python` in `pyproject.toml`, `.python-version`, the lockfile (`uv.lock`, `poetry.lock`, `pylock.toml`, `requirements*.txt`, a conda environment file), and the CI matrix. Write only syntax and APIs the lowest supported version has; per-version features are in [version-notes.md](references/version-notes.md).

**Hard rules:**
- Use the project's own toolchain. Never mix installers in one environment, never install into the system interpreter, and never add a dependency without recording it in `pyproject.toml` and the lockfile.
- No bare `except:` and no `except Exception: pass`. Catch the narrowest type you can handle; let the rest propagate to a boundary that logs and reports it.
- Never swallow `asyncio.CancelledError`. Re-raise it after cleanup.
- No blocking call (sync HTTP client, `time.sleep`, file or CPU-heavy work) on the event loop.
- Every closed `match` or `if` chain over an enum or tagged union ends in `assert_never`; an open family is dispatched through a `Protocol`, never through `isinstance` chains in consumers.
- No mutable default arguments, no import-time side effects (connections, network, reading environment into globals), no module-level mutable singletons used as hidden dependencies.
- New and changed code is fully annotated and passes the project's type checker; `Any` and `# type: ignore[code]` need a reason in a comment.
- `assert` is for invariants, never for input validation: `python -O` removes it.

---

## Core Mental Model

Python is dynamic at runtime and statically checkable at review time. Treat annotations as a contract a type checker enforces, not as documentation. Untrusted data is parsed into typed values once, at the boundary; everything inside trusts those types.

- **Names are references.** Assignment never copies. Mutating a list or dict passed in mutates the caller's object; return new values or document mutation in the name.
- **Modules are singletons executed on first import.** Anything at module level runs at import, in import order. Keep module bodies to definitions and constants; build stateful objects in an explicit composition root (`main()`, an application factory) and pass them in.
- **Protocols over base classes.** Structural typing (`typing.Protocol`) lets a consumer declare the capability it needs without coupling implementations to a shared base. Use an abstract base class only when you also share implementation.
- **Explicit dependencies.** Constructor or function parameters, not globals and not `mock.patch` targets. If a test must patch a module attribute to substitute a collaborator, the collaborator should have been a parameter.
- **One concurrency model per call path.** Sync code, threads, processes, and asyncio each have different cancellation and blocking rules; crossing between them is an explicit bridge (`asyncio.to_thread`, `asyncio.run`), never an accident.

Code practice that holds in every language (ownership, variant knowledge with the variant, one writer, async owned by a live owner) is in `development`. This skill covers how to express it in Python.

---

## Decision Points

### Data model

```
What does the value represent?
├── Untrusted input at a boundary (HTTP body, config, env, message, file)
│   └── Validating model → parse once, then hand typed domain values inward
├── Internal record built by trusted code
│   └── @dataclass(frozen=True, slots=True)
├── Dict-shaped data that must stay a dict (JSON passthrough, **kwargs)
│   └── TypedDict (no runtime validation, no runtime cost)
├── Must behave as a tuple (unpacking, legacy APIs)
│   └── NamedTuple
└── A closed set of named constants
    └── Enum / StrEnum
```

Pick one validating library per project; do not let validation models leak through every layer when a plain dataclass would do. Depth: [typing-and-data-models.md](references/typing-and-data-models.md).

### Typing strictness

```
Codebase state?
├── New project → strict mode in the chosen checker from day one
├── Partially typed → strict per package or module; widen the strict set as code is touched
└── Untyped legacy → annotate public functions and boundaries first; gate CI on "no new errors"
```

Use the type checker the project already runs. Pick one as the CI gate; editors may run a different one. Checker choice and configuration: [packaging-and-tooling.md](references/packaging-and-tooling.md).

### Packaging and environments

The tool that owns the existing lockfile or configuration wins. A new project picks its environment tool by whether non-Python binaries must be resolved together with Python packages; the tool tree is in [packaging-and-tooling.md](references/packaging-and-tooling.md).

| Project kind | Dependency declaration |
|--------------|------------------------|
| Library | Compatible ranges in `[project].dependencies`; never pin exact versions; test the lowest and highest supported Python |
| Application or service | Ranges in `pyproject.toml`, exact versions in a committed lockfile; install from the lock in CI and images |
| Dev and test tools | `[dependency-groups]` (PEP 735), not runtime extras |

Use the `src/` layout for anything installable, so tests run against the installed package and not the working directory. Tools, build backends, and configuration: [packaging-and-tooling.md](references/packaging-and-tooling.md).

### Concurrency

```
What kind of work?
├── Many concurrent I/O waits (network, sockets) → asyncio, or threads if the code base is sync
├── A few blocking calls inside async code → asyncio.to_thread
├── CPU-bound pure Python → ProcessPoolExecutor, or the free-threaded build when every
│   compiled dependency supports it
├── CPU-bound in native libraries that release the GIL (numeric, compression) → threads
└── Sync code calling one async API → asyncio.run at the entry point, not per call
```

---

## asyncio

Structured concurrency: every task has a live owner that waits for it and sees its failure.

```python
async def load_dashboard(client: ApiClient, user_id: str) -> Dashboard:
    async with asyncio.timeout(5):
        async with asyncio.TaskGroup() as tg:
            profile = tg.create_task(client.profile(user_id))
            orders = tg.create_task(client.orders(user_id))
    return Dashboard(profile.result(), orders.result())
```

- `TaskGroup` cancels siblings when one fails and raises an `ExceptionGroup`; handle it with `except*`.
- `asyncio.timeout()` bounds a block; put deadlines on every network wait.
- Bound fan-out with a `Semaphore` or a fixed pool of workers reading a queue; never spawn one task per item of unbounded input.
- A bare `asyncio.create_task` without a stored reference can be garbage-collected mid-flight and loses its exception. Background tasks belong to an owner (a `TaskGroup` living as long as the service) that cancels and awaits them on shutdown.
- Cleanup goes in `finally` or `async with`; `CancelledError` is re-raised.
- Blocking work goes through `asyncio.to_thread` or an executor. Use async-native clients for I/O.

Cancellation semantics, shutdown, queues, and bridging sync and async: [async-patterns.md](references/async-patterns.md).

---

## Errors

```python
class BillingError(Exception):
    """Base for every error this package raises on purpose."""

class CardDeclined(BillingError):
    def __init__(self, reason: str) -> None:
        super().__init__(f"card declined: {reason}")
        self.reason = reason

try:
    response = gateway.charge(request)
except GatewayTimeout as exc:
    raise BillingUnavailable("charge timed out") from exc
```

- Each package that raises on purpose has one base exception; callers catch the base or a specific subclass.
- Translate third-party exceptions at the boundary of your package with `raise ... from exc`, so the cause chain survives and callers never import your dependency's exception types.
- `except Exception` belongs only at a process or request boundary, where it logs with the traceback (`logger.exception`) and turns the error into a response, exit code, or retry decision.
- `contextlib.suppress` only for one named, expected exception. Use `add_note` to add context without changing the type.
- Return `None` or a result type only for an expected absence; failures raise.

Retry policy (which errors, backoff, budgets) is owned by `reliability`.

---

## Variant Families

Decide first whether the set is closed or open (`development`).

**Closed set** — a protocol's message kinds, a state machine's states. Use an `Enum` or a tagged union of dataclasses and an exhaustive `match`. `match` with no matching case does nothing silently, so close it with `assert_never` and let the type checker prove completeness:

```python
@dataclass(frozen=True)
class Circle:
    radius: float

@dataclass(frozen=True)
class Rect:
    width: float
    height: float

type Shape = Circle | Rect   # 3.12+; older versions use TypeAlias

def area(shape: Shape) -> float:
    match shape:
        case Circle(radius=r):
            return math.pi * r * r
        case Rect(width=w, height=h):
            return w * h
        case _:
            assert_never(shape)
```

**Open family** — storage backends, notification channels, importers, payment providers. Each variant implements a `Protocol` and owns its behavior; one registration point (a dict built in the composition root, or entry points for plugins) maps keys to implementations. Consumers call the protocol method; they never test `isinstance` or compare a `kind` string. Adding a variant means adding a class and one registration line.

---

## Testing

Strategy, fixtures design, and flake diagnosis are owned by `testing`. Python specifics:

- pytest: fixtures with `yield` for teardown and the narrowest scope that works; `tmp_path` and `monkeypatch` over hand-rolled temp files and global patching.
- `@pytest.mark.parametrize` with `ids=` for table-driven cases; Hypothesis for property-based tests of parsers and pure functions.
- Async tests through the project's plugin (pytest-asyncio or the anyio plugin), configured once, not per test.
- Substitute collaborators through parameters and fakes; `mock.patch` on import paths couples tests to module layout.
- Run tests against the installed package (`src/` layout) on every Python version the project claims.

---

## Performance

Measure before changing anything (`performance`). Python specifics:

- Profile with a sampling profiler on a realistic workload before optimizing; the stdlib profilers are listed in [version-notes.md](references/version-notes.md).
- Fix the algorithm and the I/O pattern first (N+1 queries, per-item network calls). Then move hot loops into vectorized or native code (numeric libraries, compiled extensions).
- Generators and iterators for streaming large data; `__slots__` or `slots=True` dataclasses for many small objects.
- `functools.cache` on methods keeps `self` alive forever; cache module-level functions or use an explicit bounded cache.
- Import time counts for CLIs and serverless: keep heavy imports out of module bodies on the startup path.

---

## Anti-Patterns

| # | Anti-pattern | Problem | Fix |
|---|--------------|---------|-----|
| 1 | `def f(items=[])` | Default shared across calls | `None` default, create inside |
| 2 | `except Exception: pass` or bare `except:` | Hides bugs, catches `KeyboardInterrupt` (bare) | Catch a named type, or log at the boundary and re-raise |
| 3 | `isinstance` / `kind ==` chains in consumers | Every new variant edits every consumer | `Protocol` method on the variant; `match` + `assert_never` for closed sets |
| 4 | `match` or `if/elif` over an enum without `assert_never` | New member falls through silently | Close with `case _: assert_never(x)` |
| 5 | `requests` or `time.sleep` inside `async def` | Blocks the whole loop | Async client, `await asyncio.sleep`, `asyncio.to_thread` |
| 6 | Fire-and-forget `create_task` | Task garbage-collected, exception lost | Owned `TaskGroup` or stored and awaited task |
| 7 | Catching `CancelledError` and continuing | Shutdown and timeouts stop working | Clean up, then re-raise |
| 8 | Client or connection created at import | Untestable, breaks forked workers, slow startup | Build in the composition root, pass in |
| 9 | `dict[str, Any]` passed through layers | No checker help, typos become runtime errors | Parse into a dataclass or `TypedDict` at the boundary |
| 10 | `Any` or blanket `# type: ignore` | Disables checking downstream | Narrow types, `object` plus narrowing, coded ignore with reason |
| 11 | `pip install` into the active global interpreter, or mixing installers | Unreproducible environment | Project-managed venv from the lockfile |
| 12 | Exact pins in a library's dependencies | Unresolvable conflicts for users | Ranges in the library, pins only in application locks |
| 13 | Comparing to singletons with `==` (`x == None`) | Overridable `__eq__`, wrong for sentinels | `x is None` |
| 14 | Wildcard imports and circular imports patched with local imports | Hidden names, fragile load order | Explicit imports; break the cycle by moving the shared type |

---

## Related Knowledge

- **development** — code practice these idioms express: variant families, explicit dependencies, errors, async lifetime
- **architecture** — module and package boundaries, integration patterns
- **backend** — service structure, request pipeline, startup and shutdown
- **testing** — test strategy, fixtures, property tests, flake diagnosis
- **performance** — profiling method and capacity work
- **database** — schemas, migrations, query and transaction patterns
- **security** — input trust, deserialization (`pickle`, `yaml.load`), secrets, supply chain
- **docker** — images for Python services, wheels and lockfile installs in builds
- **ci-cd** — version matrix, caching environments, lint and type gates

## References

- [typing-and-data-models.md](references/typing-and-data-models.md) — gradual typing, Protocol, generics, TypedDict, narrowing, dataclasses versus attrs versus pydantic, boundary parsing
- [async-patterns.md](references/async-patterns.md) — TaskGroup, cancellation, timeouts, bounded concurrency, queues, shutdown, sync and async bridges
- [packaging-and-tooling.md](references/packaging-and-tooling.md) — uv, pip, poetry, conda, build backends, `pyproject.toml`, ruff, type checkers, pre-commit and CI
- [version-notes.md](references/version-notes.md) — supported versions and features by Python version
