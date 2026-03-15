# Code Quality Tooling

Reference for linting, formatting, type checking, git hooks, and commit conventions in frontend projects. Loaded on demand — use this when configuring or auditing a project's code quality pipeline.

---

## Linting + Formatting Selection

Ask: What matters most — speed, plugin ecosystem breadth, or minimal tooling?

### Decision Tree

```
What linter/formatter should I use?
├── New project, Vite/Rolldown toolchain, want maximum speed
│   └── oxlint (lint) + oxfmt (format) — OXC unified toolchain
│       Note: JS plugin support is alpha; verify required plugins work first
│
├── Want a single binary, no Node dependency, unified tool
│   └── Biome — linter + formatter in one, Rust-speed
│       Note: Plugin ecosystem still maturing vs ESLint
│
├── Need the broadest plugin ecosystem, custom org rules, type-aware linting
│   └── ESLint flat config (v9+) + Prettier
│       Note: Most mature, most config surface area
│
├── Already on ESLint, want to add/replace formatter
│   ├── Want Prettier-compatible output with Rust speed → oxfmt
│   └── Want battle-tested, widest editor support → Prettier
│
└── Formatting only, simplest possible setup
    └── Prettier (standalone, pairs with any linter)
```

### Comparison

| Tool | Lint | Format | Speed vs ESLint | Ecosystem | Maturity |
|------|------|--------|-----------------|-----------|----------|
| oxlint + oxfmt | Yes | Yes | 50-100x | OXC/Vite integrated, JS plugins alpha | Beta (2025) |
| Biome | Yes | Yes | 10-25x | Growing, 450+ rules | v2 stable (2025) |
| ESLint flat (v9+) | Yes | No | Baseline | Largest, decade of plugins | Stable |
| Prettier | No | Yes | Fast enough | Standard, widest editor support | Stable |

---

## oxlint + oxfmt (OXC Toolchain)

OXC is a suite of JavaScript tools built in Rust — parser, resolver, transformer, linter (oxlint), and formatter (oxfmt). Developed by the VoidZero team (Evan You's company), it is deeply integrated with Vite and will underpin Rolldown.

### oxlint

- **Speed**: 50-100x faster than ESLint. A 2 million line codebase that took 1 minute in ESLint ran in under 4 seconds with oxlint + JS plugins.
- **Rules**: 695+ built-in rules (ESLint core, TypeScript, React, unicorn, and more) enabled by default with sensible defaults.
- **JS Plugin support**: Alpha as of March 2026. Provides an ESLint-compatible plugin API — run existing ESLint plugins and write custom rules inside Oxlint. An estimated 80% of ESLint plugin users can switch without changes.
- **Type-aware linting**: Alpha as of late 2025. Uses tsgo (Go port of TypeScript compiler) for full type system fidelity. Supports 59 of 61 typescript-eslint type-aware rules. Type-aware runs that previously took 60+ seconds now complete in under 10 seconds.
- **Multi-file analysis**: Supports project-wide rules like `import/no-cycle`.

```json
// .oxlintrc.json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "unicorn"],
  "rules": {
    "no-console": "warn",
    "react/jsx-no-target-blank": "error"
  },
  "env": {
    "browser": true,
    "es2022": true
  }
}
```

```json
// package.json scripts
{
  "scripts": {
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix"
  }
}
```

**Vite integration**: `vite-plugin-oxlint` runs oxlint during dev server and build — lint errors surface in the browser overlay.

### oxfmt

- **Status**: Beta as of February 2026. Alpha released December 2025.
- **Speed**: 30x faster than Prettier, 3x faster than Biome on initial run (without caching).
- **Prettier compatibility**: Passes 100% of Prettier's JavaScript and TypeScript conformance tests. Drop-in replacement output.
- **File support**: JS, JSX, TS, TSX, JSON, JSONC, JSON5, YAML, TOML, HTML, Angular, Vue, CSS, SCSS, Less, Markdown, MDX, GraphQL.
- **Import sorting**: Built-in, introduced in beta.
- **Tailwind CSS**: Class sorting support added in beta.
- **Adoption**: vuejs/core, vercel/turborepo, huggingface/huggingface.js use oxfmt.

```bash
# Install
npm install -D oxfmt

# Format
oxfmt .
oxfmt --check .   # CI check (no writes)
```

```json
// .oxfmtrc.json (mirrors .prettierrc options)
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all"
}
```

**Migration from Prettier**: Run `oxfmt .` — output is identical. Remove Prettier from dependencies.

---

## Biome

Biome is the successor to Rome. It ships as a single binary with no Node.js dependency (though an npm package wrapper exists for convenience). Version 2.0 was released June 2025.

- **Speed**: 10-25x faster than ESLint + Prettier.
- **Single config**: `biome.json` replaces `.eslintrc`, `.prettierrc`, `.editorconfig`.
- **Rules**: 459 rules from ESLint, typescript-eslint, and other sources.
- **Type-aware linting** (v2+): First linter to provide type-aware rules without calling the TypeScript compiler. Catches ~85% of what typescript-eslint catches.
- **Plugin system** (v2+): First iteration of linter plugins — match code patterns and report diagnostics.
- **Language support**: JS, TS, JSX, JSON, CSS, GraphQL. Partial support for Astro, Svelte, Vue files.
- **Adoption**: 800,000+ weekly downloads by end of 2025. Enterprise support available since January 2025.

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "warn"
      }
    }
  },
  "organizeImports": {
    "enabled": true
  },
  "files": {
    "ignore": ["node_modules", "dist", ".next", ".nuxt"]
  }
}
```

```json
// package.json scripts
{
  "scripts": {
    "lint": "biome lint .",
    "format": "biome format . --write",
    "check": "biome check .",
    "check:ci": "biome ci ."
  }
}
```

**When not to use Biome**: If you depend on ESLint plugins with no Biome equivalent (e.g., complex custom org rules, some framework-specific plugins), the ESLint ecosystem is more complete.

---

## ESLint Flat Config (v9+)

ESLint v9 made flat config (`eslint.config.js`) the default. The old `.eslintrc.*` cascade format is removed in v9.

### What changed from v8

- Single `eslint.config.js` at the project root (or `eslint.config.mjs`/`eslint.config.cjs`).
- Config is an array of config objects — no more cascade inheritance.
- `env`, `extends`, and `plugins` work differently.
- Global ignores replace `.eslintignore`.
- `extends` property added in ESLint v9.40+ to simplify sharing configs.

### Minimal TypeScript setup

```js
// eslint.config.js
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.nuxt/', '.next/'],
  }
)
```

### With React

```js
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
    },
    settings: {
      react: { version: 'detect' },
    },
  }
)
```

### Popular config packages

| Package | Purpose |
|---------|---------|
| `@eslint/js` | ESLint core recommended rules |
| `typescript-eslint` | TypeScript rules, type-aware support |
| `eslint-plugin-react` + `eslint-plugin-react-hooks` | React rules |
| `eslint-plugin-vue` | Vue SFC rules |
| `eslint-plugin-unicorn` | Opinionated best practices |
| `eslint-plugin-import-x` | Import order + resolution (maintained fork of eslint-plugin-import) |
| `eslint-config-prettier` | Disable ESLint rules that conflict with Prettier |

**eslint-plugin-import-x**: The `un-ts/eslint-plugin-import-x` fork is the maintained choice over the original `eslint-plugin-import`. It uses `unrs-resolver` (Rust-based) instead of `tsconfig-paths`, is significantly faster, and fully supports flat config.

### Type-aware linting with typescript-eslint

Type-aware rules (e.g., `@typescript-eslint/no-floating-promises`) require `parserOptions.project`:

```js
export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
)
```

Note: Type-aware linting is slower (seconds vs milliseconds) because it calls the TypeScript compiler. Use `recommendedTypeChecked` only on files that benefit from it, and consider oxlint's type-aware alpha for speed.

---

## Prettier

Prettier remains the standard standalone formatter with the widest editor integration. As of early 2026 the stable series is **3.x** (3.8.x). Prettier 4 is in alpha; the faster CLI from 3.6's `--experimental-cli` is planned as the v4 stable CLI.

- **Prettier 3.5** (Feb 2025): `objectWrap` option, `experimentalOperatorPosition`, TypeScript config file support.
- **Prettier 3.6** (Jun 2025): Experimental fast CLI flag (`--experimental-cli`). OXC and Hermes parser plugins.
- **Prettier 3.7** (Nov 2025): Consistent TypeScript/Flow class formatting, Angular 21, GraphQL 16.12 support.

```json
// .prettierrc
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "plugins": []
}
```

```
# .prettierignore
dist/
node_modules/
*.min.js
```

**Pairing with ESLint**: Always add `eslint-config-prettier` to prevent formatting rule conflicts:

```js
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettierConfig  // must be last — disables conflicting ESLint rules
)
```

---

## Type Checking

Type checking is separate from linting. Both are needed in CI.

```bash
# Standalone type check — emits no output files
tsc --noEmit

# Vue SFCs — requires vue-tsc
vue-tsc --noEmit

# Faster incremental type check
tsc --noEmit --incremental
```

**Monorepo with TypeScript project references**:

```json
// tsconfig.json (root)
{
  "files": [],
  "references": [
    { "path": "./packages/ui" },
    { "path": "./packages/web" }
  ]
}
```

```bash
# Type-check all packages
tsc --build --noEmit
```

**CI pipeline order**: lint → type-check → test → build. Do not skip type-check in CI even if the IDE catches errors — IDE checks are not guaranteed to run on all files.

---

## Git Hooks and CI Integration

### Pre-commit hook tools

Ask: Do you want to minimize dependencies and support monorepos, or use the most widely documented setup?

| Tool | Language | Config | Speed | Notes |
|------|----------|--------|-------|-------|
| lefthook | Go binary | `lefthook.yml` | Fastest — parallel execution | No Node dependency for the runner |
| husky + lint-staged | Node.js | `.husky/` + `package.json` | Slower — sequential by default | Most documented, widest tutorial coverage |

### lefthook (recommended for new projects)

Single YAML file replaces `husky` + `lint-staged`. Parallel hooks cut wait time significantly. No Node dependency for the hook runner itself.

```bash
npm install -D lefthook
npx lefthook install
```

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,jsx,ts,tsx,vue}"
      run: npx oxlint {staged_files}
    format:
      glob: "*.{js,jsx,ts,tsx,vue,css,json,md}"
      run: npx oxfmt --check {staged_files}
    typecheck:
      run: npx tsc --noEmit

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

### husky + lint-staged (widely adopted)

```bash
npm install -D husky lint-staged
npx husky init
```

```bash
# .husky/pre-commit
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,vue}": [
      "oxlint --fix",
      "oxfmt"
    ],
    "*.{css,json,md}": [
      "oxfmt"
    ]
  }
}
```

Or with a standalone config file:

```js
// .lintstagedrc.mjs
export default {
  '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{css,json,md,yml}': ['prettier --write'],
}
```

### CI lint step

Always run the full lint and type-check in CI — pre-commit hooks can be skipped with `git commit --no-verify`.

```yaml
# GitHub Actions example
- name: Lint
  run: npm run lint

- name: Type check
  run: npm run typecheck

- name: Format check
  run: npm run format:check
```

Treat warnings as errors in CI:

```bash
# ESLint — fail on warnings
eslint . --max-warnings=0

# oxlint — deny warnings
oxlint . --deny-warnings
```

---

## Conventional Commits

Conventional Commits is a lightweight specification for commit messages. Format:

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types**: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

- `feat`: new feature → minor version bump
- `fix`: bug fix → patch version bump
- `BREAKING CHANGE:` in footer or `!` after type → major version bump

### commitlint setup

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

```js
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
  },
}
```

Add to git hook (lefthook example above includes this; for husky):

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

### Semantic release integration

`semantic-release` reads Conventional Commits to decide version bumps, generate changelogs, and publish packages automatically.

```bash
npm install -D semantic-release @semantic-release/changelog @semantic-release/git
```

```json
// .releaserc.json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git"
  ]
}
```

---

## Import Organization

Consistent import order reduces merge conflicts and improves readability.

Ask: Is import sorting already handled by your formatter (oxfmt, Biome), or do you need an ESLint rule?

| Tool | How |
|------|-----|
| oxfmt | Built-in import sorting (beta+) — zero config |
| Biome | `organizeImports: { enabled: true }` in `biome.json` |
| eslint-plugin-import-x | `import/order` rule with ESLint |

### eslint-plugin-import-x order rule

```js
// eslint.config.js
import importX from 'eslint-plugin-import-x'

export default [
  {
    plugins: { 'import-x': importX },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-cycle': 'error',
      'import-x/no-unused-modules': 'warn',
    },
  },
]
```

**Auto-fix on save**: Configure your editor to run `eslint --fix` (or `biome check --write`) on save. Do not rely solely on pre-commit hooks for developer experience.

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| ESLint + Prettier rule conflicts | Prettier reformats what ESLint just fixed, causing a loop | Add `eslint-config-prettier` last in config, or switch to Biome/oxfmt |
| No pre-commit hooks | Lint errors found only in CI — slow feedback loop | Add lefthook or husky + lint-staged |
| Ignoring warnings indefinitely | Warning count grows unbounded; nobody fixes them | Use `--max-warnings=0` in CI to treat warnings as errors |
| Multiple formatters running | Two formatters fighting — output depends on order | Pick one formatter per project; remove the other |
| Type-check only in IDE | CI passes but runtime type errors exist | Run `tsc --noEmit` (or `vue-tsc --noEmit`) as a CI step |
| Linting all files on every commit | Slow pre-commit hooks — developers skip hooks | Use lint-staged or lefthook's `{staged_files}` to lint only changed files |
| `.eslintignore` with flat config | `.eslintignore` is not read in flat config | Use `ignores` array in `eslint.config.js` |
| Committing with `--no-verify` routinely | Hooks exist for a reason; bypassing creates drift | Fix the underlying lint error; do not skip hooks |
| No import organization rule | Inconsistent import order across files — noisy diffs | Enable Biome `organizeImports`, oxfmt import sort, or `import-x/order` |
