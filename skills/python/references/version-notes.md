# Python Version Notes

Use this reference after determining the project's lowest supported Python version (`requires-python`). Write only features that version has; newer typing names come from `typing_extensions` on older versions. Checked against the CPython developer guide and release notes in October 2026.

## Contents

- [Support status](#support-status)
- [Features by version](#features-by-version)
- [Choosing a minimum version](#choosing-a-minimum-version)
- [Free-threaded build](#free-threaded-build)
- [Profiling tools](#profiling-tools)

## Support status

As of 2026-10-06 (CPython releases a new minor version each October and supports it for five years):

| Version | Status | End of life |
|---------|--------|-------------|
| 3.15 | Release candidate; final scheduled for 2026-10-09 | 2031-10 |
| 3.14 | Current stable, bugfix releases | 2030-10 |
| 3.13 | Security fixes only | 2029-10 |
| 3.12 | Security fixes only | 2028-10 |
| 3.11 | Security fixes only | 2027-10 |
| 3.10 and older | End of life | — |

Projects still on 3.10 or older run an interpreter without security fixes; plan the upgrade.

## Features by version

Only features that change how code is written are listed.

| Version | Language and runtime | Typing | Stdlib and asyncio |
|---------|----------------------|--------|--------------------|
| 3.10 | `match` statement; `X \| Y` unions at runtime; parenthesized context managers | `ParamSpec`, `TypeAlias`, `TypeGuard`, `Concatenate` | dataclass `slots=True`, `kw_only=True` |
| 3.11 | Exception groups and `except*`; `add_note`; faster interpreter | `Self`, `LiteralString`, `Never`, `assert_never`, `Required`/`NotRequired`, `reveal_type` at runtime | `asyncio.TaskGroup`, `asyncio.timeout`, `asyncio.Runner`; `tomllib`; `StrEnum` |
| 3.12 | PEP 695 type parameter syntax (`def f[T]`, `class Box[T]`, `type Alias = ...`); f-strings may nest quotes and span lines (PEP 701) | `@override`; `Unpack` for typed `**kwargs` (PEP 692) | `itertools.batched`; `asyncio.run(loop_factory=...)`; `distutils` removed |
| 3.13 | Experimental free-threaded build and JIT; new interactive REPL; `locals()` semantics defined | Type parameter defaults (PEP 696); `ReadOnly` TypedDict keys; `TypeIs`; `@warnings.deprecated` | `copy.replace`; `asyncio.Queue.shutdown`; legacy modules removed (PEP 594: `cgi`, `crypt`, `telnetlib`, others) |
| 3.14 | Annotations evaluated lazily (PEP 649/749, `annotationlib`); template strings `t"..."` (PEP 750); `except A, B:` without parentheses when there is no `as` (PEP 758); warning for `return`/`break`/`continue` in `finally` (PEP 765); free-threaded build officially supported (PEP 779); multiple interpreters in stdlib (PEP 734) | Forward references work without quotes or `from __future__ import annotations` | `compression.zstd`; `python -m asyncio ps`/`pstree`; asyncio policy API deprecated (removal planned for 3.16); `asyncio.get_event_loop()` raises `RuntimeError` when no loop is set |
| 3.15 (RC) | Explicit lazy imports with the `lazy` soft keyword (PEP 810); built-in `frozendict` (PEP 814) and `sentinel` (PEP 661); `*` and `**` unpacking in comprehensions (PEP 798); UTF-8 is the default encoding everywhere (PEP 686) | — | `profiling` package with a sampling profiler (PEP 799); `TaskGroup.cancel()` |

Notes:

- With deferred annotations (3.14+), code that reads `__annotations__` directly should use `annotationlib.get_annotations()`; libraries that introspect annotations (validation, dependency injection, serialization) need versions that support 3.14.
- `from __future__ import annotations` remains valid and is still useful when supporting versions before 3.14.
- 3.15's UTF-8 default changes `open()` without `encoding=` on systems whose locale was not UTF-8. Pass `encoding="utf-8"` explicitly in code that must behave the same on every version.
- Release-candidate features are not for production code until the final release and dependency support.

## Choosing a minimum version

- Applications and services: the newest version all runtime dependencies support, usually the current stable release or the one before it.
- Libraries: the oldest version still receiving security fixes, unless a needed feature forces a higher floor. Raising the floor is a breaking change for users on older interpreters; announce it in the changelog.
- Test the full range in CI; the newest version catches deprecations early.

## Free-threaded build

The free-threaded interpreter (often installed as `python3.14t`) runs Python threads in parallel without the GIL. Use it for CPU-bound threaded workloads only when every compiled dependency publishes free-threaded wheels; an incompatible extension re-enables the GIL at import with a warning. Single-threaded code runs somewhat slower on it. Shared mutable state that relied on the GIL for accidental atomicity needs explicit locks.

## Profiling tools

| Need | Tool |
|------|------|
| Where does CPU time go, in development | `cProfile` (deterministic, high overhead) or the 3.15 `profiling` sampling profiler |
| Production or long-running process | A sampling profiler that attaches by PID (py-spy, the 3.15 sampling profiler) |
| Memory growth | `tracemalloc` snapshots compared over time; memray for native allocations |
| Import time | `python -X importtime` |
| Async stalls | asyncio debug mode; `python -m asyncio pstree PID` (3.14+) |

Method (baselines, flame graphs, regression budgets) is owned by `performance`.
