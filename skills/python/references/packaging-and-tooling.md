# Packaging and Tooling

Use this reference when setting up or changing a Python project's environment, dependencies, build, lint, format, or type checking. Tool versions and defaults change often; the facts below were checked in October 2026. Confirm against the version the project pins before relying on a default.

## Contents

- [pyproject.toml as the single source](#pyprojecttoml-as-the-single-source)
- [Environment and installer tools](#environment-and-installer-tools)
- [Lockfiles](#lockfiles)
- [Build backends](#build-backends)
- [Lint and format with ruff](#lint-and-format-with-ruff)
- [Type checkers](#type-checkers)
- [CI gate](#ci-gate)

## pyproject.toml as the single source

```toml
[project]
name = "invoice-tools"
version = "1.4.0"
requires-python = ">=3.12"
dependencies = [
    "httpx>=0.27",
    "pydantic>=2.7,<3",
]

[project.optional-dependencies]
pdf = ["weasyprint>=62"]          # user-facing feature extras only

[dependency-groups]
dev = ["pytest>=8", "hypothesis>=6", "ruff", "mypy"]

[project.scripts]
invoice = "invoice_tools.cli:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- `[project]` (PEP 621) holds metadata and runtime dependencies for every modern tool, Poetry 2 included.
- `[dependency-groups]` (PEP 735) holds development, test, and docs tools; they are never published as package metadata. pip installs them with `pip install --group dev` (pip 25.1+); uv, Poetry 2, and PDM read them natively.
- Extras are for optional user-facing features, not for test tooling.
- `requires-python` is the lower bound the project tests. Ruff and type checkers infer their target version from it.
- Tool configuration lives in `[tool.<name>]` tables in the same file, not in scattered `setup.cfg`, `.flake8`, or `mypy.ini` files, unless the project already uses them.

## Environment and installer tools

```
A tool is already in use (lockfile, config, CI scripts)? → keep it
│   uv.lock → uv · poetry.lock → Poetry · pdm.lock → PDM · environment.yml → conda/mamba
│   pixi.toml or pixi.lock → pixi · requirements*.txt or pylock.toml → pip with venv
New project:
├── Standard Python dependencies, wants one fast tool for Python versions, venvs, locks → uv
├── Non-Python binary dependencies resolved together (CUDA toolkits, GDAL, compilers, R)
│   → conda-forge environment managed by conda/mamba, or pixi for a project-level lock
├── Policy allows only the standard toolchain → python -m venv + pip, with a lock or constraints file
└── Team standard is Poetry → Poetry 2 using the [project] table
```

| Tool | Typical commands | Notes |
|------|------------------|-------|
| uv | `uv sync --locked`, `uv add pkg`, `uv run pytest`, `uv python install 3.14`, `uvx ruff` | Manages Python installs, venvs, `uv.lock`, workspaces; `uv pip` is a pip-compatible interface for legacy flows |
| pip + venv | `python -m venv .venv`, `pip install -e . --group dev`, `pip install -r requirements.lock` | Pair with pip-tools (`pip-compile`) or a `pylock.toml` for reproducible installs |
| Poetry 2 | `poetry install`, `poetry sync`, `poetry add pkg` | Uses `[project]`; `[tool.poetry]` only for Poetry-specific features |
| conda / mamba | `conda env create -f environment.yml` | Install Python packages from conda-forge first; use pip inside the env only for what conda lacks, and last |
| pixi | `pixi install`, `pixi run test` | conda-forge packages with a per-project lockfile and tasks |
| PDM, Hatch | `pdm install`, `hatch run test` | Standards-based alternatives; keep them where already adopted |

Rules for every tool:

- The virtual environment lives in the project (`.venv`) or is managed by the tool; it is never committed.
- Install in CI and container images from the lockfile in a mode that fails when the lock is stale (`uv sync --locked`, `poetry check --lock` before install, `pip install --require-hashes -r ...`).
- Run commands through the tool (`uv run`, `poetry run`) or the activated venv, never against whichever `python` is first on `PATH`.
- Command-line tools used across projects install isolated (`uv tool install`, `pipx install`), not into a project environment.

## Lockfiles

| File | Producer | Installer |
|------|----------|-----------|
| `uv.lock` | uv | uv (cross-platform, universal resolution) |
| `poetry.lock` | Poetry | Poetry |
| `pixi.lock` | pixi | pixi |
| `requirements*.txt` with hashes | pip-tools, `uv pip compile`, `uv export` | pip, uv |
| `pylock.toml` (PEP 751) | `uv export --format pylock.toml`, `pip lock` (experimental since pip 25.1) | Standard format; pip reads it experimentally (`-r pylock.toml`, pip 26.1+); installer support is still uneven, check the tools in use |

A library commits a lock for its own development and CI, but published metadata keeps ranges. Applications commit the lock and update it deliberately (scheduled update PRs), never as a side effect of an unrelated change.

## Build backends

| Backend | Use when |
|---------|----------|
| hatchling | General pure-Python packages; common default |
| setuptools | Existing projects, C extensions with setuptools tooling |
| uv_build | Pure-Python packages in uv-managed projects |
| flit-core | Minimal pure-Python libraries |
| poetry-core, pdm-backend | Projects managed by those tools |
| maturin | Rust extensions (PyO3) |
| scikit-build-core, meson-python | C, C++, or Fortran extensions built with CMake or Meson |

Build artifacts with `python -m build` or `uv build`; publish wheels for every supported platform when there are compiled parts. Trusted publishing from CI (OIDC) replaces long-lived index tokens.

## Lint and format with ruff

Ruff is the standard linter and formatter (it replaces flake8, isort, pyupgrade, and Black-style formatting in one tool).

```toml
[tool.ruff]
line-length = 100            # target-version is inferred from requires-python

[tool.ruff.lint]
extend-select = ["I", "UP", "B", "SIM", "ASYNC", "S", "RUF"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101"]        # assert is fine in tests
```

- `select` replaces the default rule set; `extend-select` adds to it. Ruff 0.16 (July 2026) expanded the default set from 59 to about 400 rules, so upgrading across 0.16 without an explicit `select` surfaces many new findings; pin the ruff version and upgrade deliberately.
- The formatter follows a yearly style guide (the 2026 style arrived in 0.15); formatting diffs after an upgrade are expected and belong in a separate commit.
- Run `ruff check --fix` and `ruff format` locally or in a pre-commit hook; CI runs `ruff check` and `ruff format --check` without fixing.
- Useful families: `I` imports, `UP` modern syntax for the target version, `B` likely bugs, `ASYNC` blocking calls in async code, `S` security, `BLE` blind except, `PTH` pathlib, `TC` type-checking-only imports.

## Type checkers

```
Project already runs a checker? → keep it as the CI gate
New project:
├── Needs plugin support (Django models, older pydantic or SQLAlchemy plugins) → mypy
├── Editor-first workflow, strict inference, fast incremental → pyright (or basedpyright)
└── Very large codebase, checker speed is the bottleneck → pyrefly (stable since 1.0);
    ty is fast but still pre-1.0 as of October 2026 — evaluate before gating CI on it
```

| Checker | Status (October 2026) | Strict setting |
|---------|-----------------------|----------------|
| mypy | 2.x; parallel checking with `--num-workers`; 2.0 made `local_partial_types` and `strict_bytes` default | `[tool.mypy] strict = true` |
| pyright / basedpyright | Mature; pyright powers Pylance | `[tool.pyright] typeCheckingMode = "strict"` |
| pyrefly | 1.0 released May 2026 | `preset = "strict"`; configure in `[tool.pyrefly]` or `pyrefly.toml` |
| ty | Beta, 0.0.x releases (breaking changes may land in any release) | configure in `[tool.ty]` or `ty.toml`; rule set still changing |

Checkers disagree at the edges of the typing spec. Gate CI on exactly one; use per-module overrides for gradual strictness. In mypy, `strict` is a global-only option: set it in `[tool.mypy]` and relax individual flags per module, or use `ignore_errors = true` for a module that is fully excluded.

```toml
[tool.mypy]
strict = true

[[tool.mypy.overrides]]
module = ["legacy_reports.*"]
disallow_untyped_defs = false
disallow_incomplete_defs = false
disallow_untyped_calls = false
warn_return_any = false
```

## CI gate

A minimal CI job for a Python project, in order:

1. Install the locked environment for each supported Python version (matrix from `requires-python` to the newest release).
2. `ruff format --check` and `ruff check`.
3. The type checker on the package and tests.
4. `pytest` with the warnings filter set to fail on `DeprecationWarning` from the project's own code.
5. For libraries: build the wheel and sdist and install the built wheel in a clean environment before publishing.

Pipeline mechanics (caching, matrices, artifacts) are owned by `ci-cd`.
