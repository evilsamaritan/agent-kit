# Workflow: New FSD Project Setup

Create a compliant FSD directory skeleton from scratch.

---

## Step 1: Identify needed layers

Not every project needs all 6 layers. Start small and add layers when a second slice needs the same code (see "Start in the page, extract on second use" in `SKILL.md`). Determine which apply:

| Layer | Include when |
|-------|-------------|
| `shared/` | Always — even trivial projects reuse utilities |
| `entities/` | Optional: domain objects used by several pages |
| `features/` | Optional: user actions used by several pages |
| `widgets/` | Project has reusable composite UI blocks |
| `pages/` | Project has route-level views |
| `app/` | Project has app-level bootstrap (providers, router) |

If uncertain, start with `shared/`, `pages/`, `app/`. Add `entities/`, `features/`, and `widgets/` when code is genuinely shared between slices. If the framework reserves `app/` or `pages/`, use the renamed layers (`references/framework-integration.md`).

---

## Step 2: Create layer directories

Create only the layers chosen in Step 1:

```bash
mkdir -p src/shared/{ui,api,lib,config}
mkdir -p src/pages
mkdir -p src/app
# mkdir -p src/entities   # only when a second page needs it
# mkdir -p src/features
# mkdir -p src/widgets
```

`src/` prefix is conventional but not required. Use the project's existing root convention.

---

## Step 3: Establish naming convention

Before creating slices, determine the project's file/directory naming style. Check existing dirs and files, or ask the user:

```bash
ls src/   # if dirs already exist — match their casing
```

| Style | Example | Use when |
|-------|---------|----------|
| kebab-case | `user-profile/` | most common in FSD projects |
| camelCase | `userProfile/` | project already uses this |
| PascalCase | `UserProfile/` | less common, some React projects |

If starting fresh with no prior convention — default to **kebab-case**. Whatever is chosen, apply it consistently across all layers and slices. Do not mix styles. If unclear, ask the user before creating any directories.

---

## Step 4: Create first slices

For each layer with known slices, create the slice with segment subdirs:

```bash
# Example: pages/home slice
mkdir -p src/pages/home/ui

# Only when several pages share the code:
mkdir -p src/entities/user/{ui,model,api}
mkdir -p src/features/auth/{ui,model,api}
```

Only create segments that will have content. Empty dirs are noise.

---

## Step 5: Define public API boundary

Each slice needs a single entry point that consumers import from. Two approaches — choose based on project convention. Ask the user which convention the project uses if unclear.

**Option A: barrel `index` file** (default, most common)

```bash
# Use the project's file extension (.ts, .js, .vue, etc.)
touch src/entities/user/index.ts
touch src/features/auth/index.ts
touch src/pages/home/index.ts
touch src/shared/api/index.ts
touch src/shared/config/index.ts
# shared/ui and shared/lib get one entry per component or library, not one barrel over the segment
touch src/shared/ui/button/index.ts
touch src/shared/lib/dates/index.ts
```

Each index re-exports only what external consumers need. Internal files are not re-exported. A single barrel over all of `shared/ui` or `shared/lib` is the large-tree barrel the `frontend` skill warns against.

**Option B: no barrel exports** (when barrel exports cause bundler/circular-dep issues)

Skip index files. Instead, enforce slice isolation via linting or bundler configuration:
- Steiger, or `import/no-internal-modules` (ESLint)
- TypeScript `paths` in `tsconfig.json`
- Bundler aliases (Vite `resolve.alias`, webpack `resolve.alias`)

The rule: no import path may point deeper than `layer/slice/`. Consumers reference the slice root.

---

## Step 6: Set up import enforcement

Configure at least one enforcement mechanism (see "Import Rule Enforcement" in `SKILL.md`): Steiger or ESLint restricted-path rules, plus path aliases.

---

## Step 7: Verify structure

Confirm the layer directories exist (`ls src/`), then run the checks in `workflows/review.md` (Phases 1-4) against the new skeleton. Fix every BLOCKING result before writing application code.

---

## Step 8: Output final tree

Show the user the generated structure:

```bash
find src/ -type d | sort
```

Confirm with user before writing any application code. The structure is the contract — fix it before building on top of it.

---

## Resulting skeleton (example for a project that already shares code across pages)

```
src/
├── app/
├── pages/
│   └── home/
│       ├── ui/
│       └── index.ts
├── widgets/
├── features/
│   └── auth/
│       ├── ui/
│       ├── model/
│       ├── api/
│       └── index.ts
├── entities/
│   └── user/
│       ├── ui/
│       ├── model/
│       ├── api/
│       └── index.ts
└── shared/
    ├── ui/
    │   └── index.ts
    ├── api/
    │   └── index.ts
    ├── lib/
    │   └── index.ts
    └── config/
        └── index.ts
```
