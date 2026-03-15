# Package Managers & Workspaces

Universal reference for package manager selection, workspace configuration, and monorepo task orchestration. Loaded on demand from SKILL.md.

---

## Package Manager Selection

Ask: Single project or monorepo? Frontend-only or full-stack? Is the team already using one?

### Decision Tree

```
Which package manager?
├── Want PM + runtime + test runner in one → Bun
├── Need strict isolation, large monorepo, no phantom deps → pnpm
├── Enterprise, PnP strict mode, cross-package policy enforcement → yarn berry
├── Zero setup, universal compatibility, Node-bundled → npm
└── Already using one? → Keep it (switching PM is expensive)
```

Rule: Do not mix package managers in a single repo. Pick one and enforce it with `engines` and `packageManager` fields in `package.json`.

### Comparison

| Manager | Cold install | Disk usage | Strictness | Workspaces | Runtime | Lockfile |
|---------|-------------|------------|------------|------------|---------|----------|
| Bun | Fastest | Low (global cache) | Moderate | `workspaces` in package.json | Built-in | bun.lockb |
| pnpm | Fast | Lowest (content-addressable) | Strict (no phantom deps) | pnpm-workspace.yaml | — | pnpm-lock.yaml |
| yarn berry | Fast | PnP: zero (no node_modules) | PnP strict | `workspaces` in package.json | — | yarn.lock |
| npm | Baseline | Highest | Loose (hoisting) | `workspaces` in package.json | — | package-lock.json |

---

### Bun (PM + runtime + task runner)

Current stable: 1.2.x (as of mid-2025, actively updated with minor releases).

Bun merges three tools into one binary: runtime, package manager, and test runner. It uses a global content-addressable cache and reads the `workspaces` key from `package.json`.

Key workspace capabilities:
- `--filter <pattern>` runs scripts in matching workspace packages
- `--workspaces` runs a script across all workspaces
- `bunfig.toml` option `install.linkWorkspacePackages = false` installs workspace deps from registry instead of linking (speeds up certain CI scenarios)
- Supports pnpm-style `pnpm-workspace.yaml` — Bun reads it and treats listed packages as workspaces
- `bun outdated` supports checking catalog-defined dependency versions (Bun 1.2.16+)

When to choose Bun:
- Greenfield JS/TS project that can commit to Bun's runtime
- Want one tool for install, run, test, and bundle
- Speed matters more than strict phantom-dependency isolation

Limitation: Node.js compatibility is high but not 100%. Some native addons and edge cases still require Node.

```toml
# bunfig.toml
[install]
linkWorkspacePackages = true   # default: true (link from local)
```

---

### pnpm (strict isolation)

Current stable: 10.x (as of 2025; pnpm 10.29+ adds catalog: protocol to `pnpm dlx`, bare `workspace:` specifier, `auditLevel` in workspace config, and Config Dependencies for sharing hooks and patches across projects).

pnpm stores all packages in a content-addressable global store and symlinks them into `node_modules`, eliminating phantom dependencies by default.

Key features:
- **Content-addressable store** — one copy of each version on disk, hard-linked per project
- **No phantom deps** — packages can only access what they explicitly declare
- **Catalog protocol** — define shared dependency versions once in `pnpm-workspace.yaml`, reference with `catalog:` in any `package.json`
- **workspace: protocol** — `"react": "workspace:*"` links internal packages without publishing
- **Config Dependencies** — centralize hooks, patches, and build permissions across projects
- Workspace filtering: `pnpm --filter <package> <command>`

When to choose pnpm:
- Large monorepo where disk usage and install correctness matter
- Team wants strict isolation (prevents accidental use of undeclared deps)
- Need catalog-level version pinning across many packages

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.8.0

catalogs:
  react18:
    react: ^18.3.0
    react-dom: ^18.3.0
```

```json
// packages/ui/package.json — reference catalog versions
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  }
}
```

Catalog strictness modes (set in `pnpm-workspace.yaml`):
- `strict` — only catalog versions allowed; error on any other specifier
- `prefer` — prefers catalog, falls back to direct if no match
- `manual` (default) — catalog available but not enforced

---

### yarn berry (PnP, enterprise)

Current stable: yarn 4.x (Yarn Modern). Corepack ships yarn 4 as the managed version in Node.js 18+.

Yarn Berry replaces `node_modules` with Plug'n'Play (PnP): dependencies are stored as zip archives, and a `.pnp.cjs` resolver map replaces the filesystem resolution algorithm.

Key features:
- **Zero-installs** — commit `.yarn/cache` (zip archives) for reproducible installs without running `yarn install` in CI
- **PnP strict mode** — packages can only access declared dependencies; eliminates hoisting
- **Constraints engine** — JavaScript-based (replaced prior Prolog engine in yarn 4) via `yarn.config.cjs`; enforces cross-workspace policies (version alignment, banned deps, consistent fields)
- **Plugin system** — extend yarn with first- and third-party plugins
- `workspace:*` protocol for internal package linking
- Interactive upgrade: `yarn upgrade-interactive`

When to choose yarn berry:
- Enterprise monorepo requiring policy enforcement across teams
- Zero-install CI reproducibility without caching node_modules
- PnP strict isolation acceptable (check tooling compatibility first — some tools still struggle with PnP)

```js
// yarn.config.cjs — constraints example
/** @type {import('@yarnpkg/types')} */
module.exports = {
  async constraints({ Yarn }) {
    // Enforce the same TypeScript version across all workspaces
    for (const dep of Yarn.dependencies({ ident: 'typescript' })) {
      dep.update('^5.8.0');
    }
    // Ban a deprecated package
    for (const dep of Yarn.dependencies({ ident: 'request' })) {
      dep.delete();
    }
  },
};
```

---

### npm (universal default)

Current stable: 11.x (ships with Node.js; no separate install needed).

npm 11 focuses on security hardening, improved lockfile stability, and workspace usability. It remains the baseline — every Node environment has it.

Key workspace features:
- `npm init -w ./packages/a` scaffolds a new workspace package and wires it automatically
- `npm run <script> --workspace=<name>` or `-w` flag targets specific packages
- `npm install --workspaces` installs all workspace packages
- `overrides` field for forcing a dependency version across the tree

Limitation: npm uses hoisting by default — phantom dependency access is possible. No equivalent to pnpm's strict isolation without manual workarounds.

When to choose npm:
- Project must work in environments where only Node is available (no Bun, no extra tools)
- Simple single-package project or small monorepo with few packages
- Team's lowest common denominator

---

## Enforcing the Chosen Package Manager

Add to root `package.json` to prevent accidental use of the wrong manager:

```json
{
  "packageManager": "pnpm@10.10.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.0.0"
  }
}
```

The `packageManager` field is consumed by Corepack (Node 16.9+). Enable it with `corepack enable`.

---

## Workspace Setup

### pnpm workspace

```yaml
# pnpm-workspace.yaml — must be at repo root
packages:
  - 'apps/*'
  - 'packages/*'
  - '!**/node_modules/**'   # explicit exclusion (usually not needed)
```

### Bun / npm / yarn workspace

```json
// package.json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### Internal package linking

Use the `workspace:` protocol so the package manager links local packages instead of resolving from the registry:

```json
// apps/web/package.json
{
  "dependencies": {
    "@my/ui": "workspace:*",
    "@my/utils": "workspace:^1.0.0"
  }
}
```

`workspace:*` resolves to the exact local version. `workspace:^1.0.0` resolves to a semver range within the workspace.

### TypeScript project references

Wire TypeScript so it type-checks across packages without publishing:

```json
// tsconfig.json at repo root
{
  "files": [],
  "references": [
    { "path": "./packages/ui" },
    { "path": "./apps/web" }
  ]
}
```

```json
// packages/ui/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

### package.json exports field

Define explicit entry points so bundlers and Node resolve the correct files:

```json
// packages/ui/package.json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./button": {
      "import": "./dist/button.js",
      "types": "./dist/button.d.ts"
    }
  }
}
```

---

## Composability: Bun + Vite + Turborepo

These tools complement each other — they operate at different layers:

| Layer | Tool | Responsibility |
|-------|------|---------------|
| Package manager + runtime | Bun (or pnpm/npm) | Install deps, run scripts, link workspaces |
| Build + dev server | Vite + Vitest | Bundle, HMR, unit/component tests — per package |
| Monorepo orchestration | Turborepo (or Nx, moon) | Task graph, caching, run order across packages |

Single project: Bun + Vite — no orchestrator needed.
Monorepo: pnpm + Vite + Turborepo — each tool at its own layer, no overlap.

They do not conflict because each solves a different scope. Turborepo does not bundle; Vite does not orchestrate; pnpm does not cache build artifacts.

---

## Monorepo Task Orchestration

Ask: How many packages? Need remote cache? Single language or polyglot? Need generators?

### Decision Tree

```
Monorepo orchestrator?
├── JS/TS, want caching, minimal config → Turborepo
├── Enterprise: generators, affected commands, module federation → Nx
├── Polyglot (JS + Go + Rust etc.), Rust-based, WASM plugins → moon
└── < 5 packages, linear deps, no CI caching needed → PM workspace scripts only
```

### Comparison

| Tool | Language | Remote cache | Affected runs | Generators | Module federation | Best for |
|------|----------|-------------|---------------|------------|-------------------|----------|
| Turborepo | JS config (turbo.json) | Vercel Remote Cache (self-host supported) | via --filter | — | — | JS/TS monorepos, simple pipeline |
| Nx | JS config (project.json) | Nx Cloud (self-host supported) | nx affected | Yes (schematics) | Yes (Rspack, Webpack) | Enterprise, multi-framework |
| moon | YAML config | Built-in (moon.io cloud) | via affected | — | — | Polyglot, Rust-speed hashing |

---

### Turborepo

Current stable: 2.x. Task config moved from `pipeline` (v1) to `tasks` (v2).

Turborepo builds a task dependency graph, hashes inputs (source files, env vars, lockfile, turbo.json), and skips tasks whose hash matches a cache entry. Remote cache is HMAC-SHA256 signed.

```json
// turbo.json
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "cache": true
    },
    "dev": {
      "persistent": true,
      "cache": false
    }
  }
}
```

The `^` prefix in `dependsOn` means "run this task in all dependencies first."

Package-level override (extend root config):

```json
// apps/web/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "env": ["NEXT_PUBLIC_API_URL"]
    }
  }
}
```

Useful run flags:
- `turbo run build --filter=web` — run only for the `web` package
- `turbo run build --filter=...web` — run for `web` and all its dependencies
- `turbo run build --filter=[HEAD^1]` — run for packages changed since last commit
- `turbo run build --dry` — print what would run without executing

Remote cache setup (Vercel):

```bash
turbo login
turbo link
```

Self-hosted remote cache: any HTTP server implementing the Turborepo Remote Cache API spec. Set `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM` in the environment.

---

### Nx

Current stable: 21.x. Nx 21 introduced Continuous Tasks (long-running tasks with dependency awareness) and improved Module Federation with Rspack.

Nx builds a project graph from `project.json` files and inferred configuration. The `nx affected` command determines which projects changed relative to a base branch and runs tasks only for those.

```json
// project.json (per package)
{
  "name": "web",
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "options": {
        "outputPath": "dist/apps/web"
      },
      "dependsOn": ["^build"]
    },
    "test": {
      "executor": "@nx/vitest:test"
    }
  }
}
```

Key commands:
- `nx run web:build` — run a target for a specific project
- `nx affected --target=build` — run build only for affected projects
- `nx graph` — open the project dependency graph in a browser
- `nx generate @nx/react:component Button --project=ui` — scaffold with a generator

Module Federation (Nx 21):
- `NxModuleFederationPlugin` (Rspack) configures sharing based on the project graph
- Continuous Tasks: `nx serve remote1` automatically serves the host shell alongside
- Generators scaffold host + remote apps with correct federation config

When Nx makes sense over Turborepo:
- Need code generators / schematics
- Using Module Federation across multiple apps
- Want `nx affected` with a visual project graph
- Polyglot but primarily JS/TS

---

### moon

Current stable: 2.0.x. moon 2.0 replaced the old platform system with a WASM plugin system for language toolchains.

moon is written in Rust for fast hashing and is language-agnostic. It downloads and pins explicit versions of Node, Bun, Rust, Go, etc. per project.

```yaml
# .moon/workspace.yml
projects:
  - 'apps/*'
  - 'packages/*'

node:
  version: '22.0.0'
  packageManager: 'pnpm'
  packageManagerVersion: '10.10.0'
```

```yaml
# moon.yml (per project, or inherit from root)
tasks:
  build:
    command: 'vite build'
    inputs:
      - 'src/**/*'
      - 'package.json'
    outputs:
      - 'dist'
    deps:
      - '^:build'

  test:
    command: 'vitest run'
    deps:
      - '^:build'
```

Key features:
- Task inheritance: define once at workspace level, inherit per project with optional overrides
- `.env` loading before task execution (moon 2.0)
- Deep merge of task inheritance (2.0: merges `inputs`/`outputs` arrays rather than replacing)
- Remote cache via moon.io cloud or self-hosted

When moon makes sense:
- Polyglot monorepo (JS, Rust, Go, etc.)
- Want pinned toolchain versions across all machines and CI
- WASM plugin extensibility for custom language support

---

## Dependency Management

- **Commit the lockfile.** Always. Non-committed lockfiles produce non-reproducible CI builds.
- **Use `workspace:*`** for internal package dependencies, not version ranges.
- **Use `catalog:`** (pnpm) for shared dependency versions across many packages.
- **Pin exact versions in CI.** Use `--frozen-lockfile` (pnpm), `--ci` (npm), or `--immutable` (yarn) to fail if the lockfile is out of date.
- **Prefer strict isolation.** pnpm and yarn PnP prevent phantom dep access; npm and Bun allow it by default.
- **Automate updates.** Use Renovate or Dependabot to keep dependencies current.
- **Audit regularly.** `pnpm audit`, `npm audit`, or integrate Snyk / Socket.dev in CI.
- **License compliance.** Run `license-checker` or `licensee` as a CI step for regulated projects.

### CI flags by manager

| Manager | Frozen install flag |
|---------|-------------------|
| pnpm | `pnpm install --frozen-lockfile` |
| npm | `npm ci` |
| yarn berry | `yarn install --immutable` |
| Bun | `bun install --frozen-lockfile` |

---

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| Mixing package managers | Two lockfiles, conflicting resolution | Pick one, enforce via `packageManager` field + Corepack |
| No lockfile in CI | Non-reproducible installs | Commit lockfile; use frozen install flag |
| `npm install` in CI | Updates lockfile silently | Use `npm ci` instead |
| Phantom dependencies | Package uses a dep it didn't declare; breaks on refactor | Use pnpm strict mode or yarn PnP |
| `workspace:*` mixed with registry version | Causes version confusion | Use `workspace:*` consistently for all internal packages |
| No task filtering in CI | Every package builds on every change | Use `--filter=[HEAD^1]` (Turborepo) or `nx affected` |
| Turborepo + Nx together | Two overlapping orchestrators, duplicated caching logic | Pick one orchestrator per repo |
| Caching non-deterministic tasks | Stale cache served for tasks with side effects | Set `"cache": false` for those tasks |
| Large `outputs` glob | Slow cache artifact upload | Narrow `outputs` to actual build artifacts, not entire project |
| Storing secrets in turbo.json env | Env values logged in cache key | Reference via env var names only — Turborepo hashes the value, not the name |
