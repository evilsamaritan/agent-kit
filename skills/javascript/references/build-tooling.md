# JavaScript Build Tooling

Decision trees and current configuration for bundlers, package managers and workspaces, linting, formatting, type-checking, and git hooks. These tools change fast: read the versions in the project's `package.json` and lockfile first, and treat names, defaults, and config keys below as correct for the current major versions at the time of writing (2026-10). Pipeline design (caches, matrices, affected runs) is in `ci-cd`; commit conventions, versioning, and changelogs are in `release-engineering`.

## Contents

- [Bundler](#bundler)
- [Vite configuration](#vite-configuration)
- [Build optimization](#build-optimization)
- [Package manager](#package-manager)
- [Workspaces and monorepos](#workspaces-and-monorepos)
- [Lint and format](#lint-and-format)
- [Type checking](#type-checking)
- [Git hooks](#git-hooks)
- [Anti-patterns](#anti-patterns)

## Bundler

```
Does the framework choose?
├── Yes (Next.js, Nuxt, SvelteKit, Astro, React Router, Remix) → use its default bundler; do not override
└── No (custom SPA, library, internal tool)
    ├── New project → Vite
    ├── Existing webpack project
    │   ├── Large config, custom loaders and plugins → Rspack (webpack-compatible config)
    │   └── Small config → migrate to Vite
    ├── Script, CLI, serverless handler, no dev server → esbuild or the runtime's own transpiler
    └── Library published to npm → Vite library mode, tsdown, or tsc alone when no bundling is needed
```

Next.js 16 uses Turbopack by default for dev and build; use its default unless the project opts out for a plugin gap. Questions that change the answer: what the framework mandates, how much webpack-specific code exists, whether SSR or an edge runtime is a target, and whether tests should share the bundler's config (Vitest reads `vite.config.ts`).

Module Federation is native to webpack and Rspack, and supported through Nx. For a Vite project, check that a federation plugin is maintained and supports the project's Vite version before adopting it.

esbuild alone is a poor production bundler for browser apps: no dev server or HMR, and limited chunk deduplication. Use it for transforms and scripts.

## Vite configuration

From Vite 8 the bundler is Rolldown in both dev and build. Vite 7 and earlier use Rollup and esbuild; check `vite` in the lockfile before copying options.

Vite 8: `build.rolldownOptions` replaces `build.rollupOptions` (the old key still works as a deprecated alias). The object form of `manualChunks` is removed; use `codeSplitting` groups:

```ts
// vite.config.ts (Vite 8)
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules/, priority: 10 },
          ],
        },
      },
    },
  },
})
```

Vite 7 and earlier: the same intent is `build.rollupOptions.output.manualChunks`. Route-level `import()` already splits per route, so write manual groups only for a measured problem, such as a heavy library loaded on every page.

SSR and library builds:

```ts
export default defineConfig({
  build: {
    // SSR entry
    ssr: true,
    // Library mode
    lib: { entry: 'src/index.ts', formats: ['es', 'cjs'] },
    // Dependencies the consumer provides
    rolldownOptions: { external: ['react', 'react-dom'] },
  },
})
```

Pick either `ssr` or `lib` for a build, not both. Framework plugins (React, Vue, Svelte, Solid) come from the framework's own Vite plugin; use the one the framework documents.

Vitest shares `vite.config.ts`. Use `jsdom` or `happy-dom` for logic and components without layout dependence, and browser mode when a test needs real layout, CSS, or browser APIs. Browser mode takes a provider function and an instance list (the form introduced in Vitest 4 and still documented for Vitest 5):

```ts
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

Test strategy is in `testing`.

## Build optimization

- Split at route boundaries first, then split large dependencies needed only on some screens (charting, editors, PDF). Very small chunks cost more in requests than they save.
- Tree shaking needs ESM, and for libraries `"sideEffects": false` (or a list of files that do have side effects) in `package.json`. Barrel-file guidance is in `frontend`.
- Measure before tuning: run the bundler's analyzer (a visualizer plugin for Vite and Rollup, `rsdoctor` for Rspack, `webpack-bundle-analyzer` for webpack) and ask what the largest dependency is, whether every page needs it, and whether a smaller one will do.
- Content-hashed filenames and separate vendor chunks keep browser caches valid across releases; cache header policy is in `caching`.
- Set the build target from the supported browsers (`browserslist` or `build.target`) and ship one bundle; the bundler lowers syntax and injects needed polyfills. Do not serve separate modern and legacy bundles (`module`/`nomodule`) and do not add manual polyfills.
- Import from the ESM build of a library (`lodash-es`, not `lodash`) so tree shaking works.
- Do not commit build output for applications.

## Package manager

```
Is one already in use (lockfile present)? → keep it; switching is expensive
Otherwise:
├── Large or strict monorepo, no phantom dependencies → pnpm
├── Runtime, installs, and test runner from one tool; Bun runtime is acceptable → Bun
├── Policy enforcement across teams (constraints), zero-install, PnP tolerated by all tools → Yarn (Berry)
└── Only Node is guaranteed, or a simple single package → npm
```

One package manager per repository. Declare it in the root `package.json` and fail fast on a mismatch:

```json
{
  "packageManager": "pnpm@<version the project pins>",
  "engines": { "node": ">=22" }
}
```

How the `packageManager` field is honored depends on the tool: pnpm and Yarn read it and manage their own version; Corepack reads it too, but Corepack is not bundled with Node 25 and later, so install it explicitly (`npm install -g corepack`) or rely on the manager's own version management. Do not rely on it being present.

| Manager | Lockfile | Strictness | Notes |
|---------|----------|------------|-------|
| npm | `package-lock.json` | Hoisted; phantom dependencies possible | Ships with Node; `npm ci` for clean installs |
| pnpm | `pnpm-lock.yaml` | Strict; undeclared imports fail | `catalog:` shares versions across a workspace |
| Yarn Berry | `yarn.lock` | PnP is strict, `nodeLinker: node-modules` is not | Constraints engine in `yarn.config.cjs` |
| Bun | `bun.lock` (text; older versions wrote binary `bun.lockb`) | Hoisted by default | Node compatibility is high but not complete; test native addons |

Rules that hold for every manager: commit the lockfile; use the frozen-install command in CI (`npm ci`, `pnpm install --frozen-lockfile`, `yarn install --immutable`, `bun install --frozen-lockfile`); update dependencies through a bot or a scheduled change; review dependency additions as supply-chain changes (`security`).

## Workspaces and monorepos

Workspace declaration: `workspaces` in the root `package.json` (npm, Yarn, Bun) or `pnpm-workspace.yaml` (pnpm).

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalog:
  react: ^19.0.0
  typescript: ^6.0.0
```

```json
// packages/ui/package.json
{ "dependencies": { "react": "catalog:" } }
```

Link internal packages with `"@scope/ui": "workspace:*"` (pnpm, Yarn, Bun); npm links workspaces by name and version. Make every workspace package export through an `exports` map (see [module system](../SKILL.md#module-system)); do not import across packages by relative path.

TypeScript across packages: set `composite: true` and `declaration: true` in each library's `tsconfig.json`, list `references` in a root `tsconfig.json` with `"files": []`, and type-check with `tsc --build`. `baseUrl` is deprecated in TypeScript 6 and removed in 7; use explicit `paths` or package `exports`.

```
Orchestrator needed?
├── Fewer than about five packages, linear dependencies → the package manager's own recursive scripts (`pnpm -r`, `npm run -ws`)
├── JS/TS monorepo, wants task caching and minimal config → Turborepo
├── Wants generators, an affected graph, or Module Federation tooling → Nx
└── Polyglot repository (JS plus Go, Rust, others) with pinned toolchains → moon
```

Use one orchestrator per repository. Each declares a task graph and hashes inputs; the shape is the same across them:

```json
// turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "dev": { "persistent": true, "cache": false }
  }
}
```

`^build` means "build my dependencies first". Keep `outputs` to real build artifacts, declare every environment variable that changes output in the task's `env` list, and turn caching off for tasks with side effects. Remote cache, affected-only runs, and CI wiring are in `ci-cd`.

## Lint and format

```
Which linter and formatter?
├── Needs the widest plugin ecosystem, custom organization rules, or type-aware rules → ESLint (flat config) + Prettier or oxfmt
├── Wants one tool and a single config file, standard rules are enough → Biome
├── Wants maximum speed on an existing Vite/OXC stack, plugins optional → oxlint (+ oxfmt)
├── Already configured and working → keep it
└── Formatting only → Prettier, or oxfmt for Prettier-compatible output
```

Use one formatter per repository. Formatter-linter conflicts are removed by turning off the linter's formatting rules, not by running both. Check each tool's maturity before adopting: oxlint is at 1.x, oxfmt is still 0.x, and oxlint's JS plugins are documented as alpha.

### ESLint (flat config)

Flat config (`eslint.config.js`) is the only format in ESLint 10, which no longer supports eslintrc configs. Use `defineConfig` from `eslint/config`; `extends` per config object composes shared configs, and `globalIgnores` replaces ignore files. `tseslint.config()` is deprecated in typescript-eslint in favor of `defineConfig`.

```js
// eslint.config.mjs
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['dist/', 'coverage/']),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
)
```

Type-aware rules (`no-floating-promises`, `no-misused-promises`) need type information; enable them with `projectService`, not `parserOptions.project`:

```js
{
  files: ['**/*.{ts,tsx}'],
  extends: [tseslint.configs.recommendedTypeChecked],
  languageOptions: {
    parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
  },
}
```

Type-aware linting is slower because it runs the TypeScript program. Scope it to source files rather than config files, and note that typescript-eslint needs the JavaScript-based TypeScript 6 package until TypeScript 7 ships a stable programmatic API; see [typescript.md](typescript.md#typescript-6-and-7).

Add framework plugins (`eslint-plugin-react-hooks`, `eslint-plugin-vue`) from the framework skill's guidance. If Prettier is the formatter, put `eslint-config-prettier` last. Import ordering and cycles come from `eslint-plugin-import-x` (the maintained fork) unless the formatter sorts imports.

### Biome

One binary, one `biome.json`. Import sorting moved from `organizeImports` to the `assist` actions, and ignore patterns moved into `files.includes` with `!` negations. Use the schema that ships with the installed package, and run `biome migrate --write` after upgrades.

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "files": { "includes": ["src/**", "!**/dist"] },
  "formatter": { "indentStyle": "space", "lineWidth": 100 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "assist": { "actions": { "source": { "organizeImports": "on" } } },
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }
}
```

The value form of an assist action (`"on"` versus `true`) differs between 2.x minors: check the installed schema. Commands: `biome check .` (lint, format check, imports), `biome check --write .`, and `biome ci .` in CI. If the project needs ESLint plugins with no Biome equivalent, use ESLint.

### oxlint and oxfmt

Rust tools from the OXC project. `oxlint .` runs with sensible defaults and reads `.oxlintrc.json`; `oxlint --deny-warnings` fails on warnings. `oxfmt .` formats and `oxfmt --check .` is the CI form; its output is designed to match Prettier. Verify that the plugins a project needs are supported before replacing ESLint.

### Prettier

Standalone formatter with the widest editor support: `.prettierrc` for options, `.prettierignore` for paths, `prettier --check .` in CI.

## Type checking

Type checking is separate from linting; run both in CI, in the order lint, type-check, test, build.

```bash
tsc --noEmit            # application or library
tsc --build --noEmit    # project references
vue-tsc --noEmit        # Vue single-file components
```

Faster feedback: `--incremental` for repeated local runs, or the native compiler (TypeScript 7) where the project has moved to it. Do not skip the CI check because the editor shows errors: editors check only open files.

## Git hooks

```
Hook runner?
├── Wants no Node dependency for the runner, parallel hooks, one YAML file → lefthook
└── Wants the most documented setup, already uses lint-staged → husky + lint-staged
```

Hooks give fast feedback on staged files; CI is the authority because `--no-verify` skips hooks.

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,jsx,ts,tsx,vue}"
      run: npx eslint --max-warnings=0 {staged_files}
    format:
      glob: "*.{js,jsx,ts,tsx,vue,css,json,md}"
      run: npx prettier --check {staged_files}
```

Replace the commands with the project's linter and formatter. Run the type check in CI, or as a `pre-push` hook, rather than on every commit. For husky, `npx husky init` creates `.husky/pre-commit`, which runs `npx lint-staged`, with a `lint-staged` map from globs to commands in `package.json`. Commit message checks (commitlint) and the conventions behind them are in `release-engineering`.

## Anti-patterns

| Anti-pattern | Problem | Fix |
|--------------|---------|-----|
| Two formatters, or a linter that also formats | Output depends on run order | One formatter; disable the linter's formatting rules |
| Linting all files in every hook | Slow hooks get skipped | Lint staged files; do the full run in CI |
| Warnings left unbounded | The count only grows | `--max-warnings=0` or `--deny-warnings` in CI |
| Copying a bundler config across majors | Removed or renamed keys fail or are ignored | Check the installed major version first |
| Mixed package managers | Two lockfiles, divergent resolution | One manager, declared in `packageManager` |
| `npm install` in CI | Rewrites the lockfile | `npm ci` or the manager's frozen install |
| Two monorepo orchestrators | Duplicate cache logic | One orchestrator |
| Phantom dependencies | Imports work until a refactor | pnpm or PnP strictness, or `no-extraneous-dependencies` lint |
| Type-check only in the editor | CI passes with type errors | `tsc --noEmit` as a CI step |
