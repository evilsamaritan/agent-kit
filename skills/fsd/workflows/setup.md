# Workflow: New FSD Project Setup

Create a compliant FSD directory skeleton from scratch.

---

## Step 1: Identify needed layers

Not every project needs all 6 layers. Determine which apply:

| Layer | Include when |
|-------|-------------|
| `shared/` | Always — even trivial projects reuse utilities |
| `entities/` | Project has identifiable business domain objects |
| `features/` | Project has user-driven actions with business value |
| `widgets/` | Project has reusable composite UI blocks |
| `pages/` | Project has route-level views |
| `app/` | Project has app-level bootstrap (providers, router) |

If uncertain, start with `shared/`, `entities/`, `features/`, `pages/`, `app/`. Add `widgets/` when standalone UI blocks emerge.

---

## Step 2: Create layer directories bottom-up

Create in this exact order (lowest dependency first):

```bash
mkdir -p src/shared/{ui,api,lib,config}
mkdir -p src/entities
mkdir -p src/features
mkdir -p src/widgets        # omit if not needed
mkdir -p src/pages
mkdir -p src/app
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

## Step 4 (was Step 3): Create first slices

For each layer with known slices, create the slice with segment subdirs:

```bash
# Example: entities/user slice
mkdir -p src/entities/user/{ui,model,api}

# Example: features/auth slice
mkdir -p src/features/auth/{ui,model,api}

# Example: pages/home slice
mkdir -p src/pages/home/ui
```

Only create segments that will have content. Empty dirs are noise.

---

## Step 4: Define public API boundary

Each slice needs a single entry point that consumers import from. Two approaches — choose based on project convention:

**Option A: barrel `index` file** (default, most common)

```bash
touch src/entities/user/index.ts    # or index.js, index.vue — match project extension
touch src/features/auth/index.ts
touch src/pages/home/index.ts
touch src/shared/ui/index.ts
touch src/shared/api/index.ts
touch src/shared/lib/index.ts
touch src/shared/config/index.ts
```

Each index re-exports only what external consumers need. Internal files are not re-exported.

**Option B: no barrel exports** (when barrel exports cause bundler/circular-dep issues)

Skip index files. Instead, enforce slice isolation via a linter rule (e.g., `@feature-sliced/eslint-plugin` or a custom `import/no-internal-modules` rule). The rule: no import path may point deeper than `layer/slice/`. Consumers reference the slice root; the bundler resolves entry from the framework's file conventions.

Ask the user which convention the project uses if unclear.

---

## Step 5: Verify structure

Run these checks before proceeding:

```bash
# Confirm layer dirs exist
ls src/

# Check no upward imports exist (should return no results)
grep -rn "from.*shared.*entities\|from.*entities.*features\|from.*features.*pages" src/ || echo "No violations"

# Check no cross-slice imports in features (should return no results)
grep -rn "features/[^'\"]*.*from.*features/" src/ || echo "No cross-slice violations"
```

---

## Step 6: Output final tree

Show the user the generated structure:

```bash
find src/ -type d | sort
```

Confirm with user before writing any application code. The structure is the contract — fix it before building on top of it.

---

## Resulting skeleton (example)

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
