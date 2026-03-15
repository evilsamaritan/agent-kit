# Workflow: FSD Compliance Review

Scan a codebase for FSD violations. Produce a prioritized report with severity, file, line, and specific fix for each issue.

Severity model:
- **BLOCKING** — import rule violation, cross-slice reference (breaks isolation guarantees)
- **CONCERN** — bypassed public API (fragile, breaks on refactor)
- **SUGGESTION** — non-canonical segment, unclear placement, structural smell

---

## Phase 1: Verify layer structure

Check that top-level source dirs match FSD layer names:

```bash
ls src/
```

Expected: `app/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/` (not all required).

Flag any unrecognized top-level dirs:

```bash
# Dirs that are not FSD layers
ls src/ | grep -vE "^(app|pages|widgets|features|entities|shared)$"
```

**SUGGESTION** for each unrecognized dir — indicate which FSD layer it maps to.

---

## Phase 2: Check import rule (upward / cross-layer)

Layers may only import downward. Scan for violations. Adjust `--include` flags to match the project's file types (add `*.vue`, `*.svelte`, `*.jsx` as needed):

```bash
# shared importing from any layer above it
grep -rn "from.*['\"].*entities/\|from.*['\"].*features/\|from.*['\"].*widgets/\|from.*['\"].*pages/\|from.*['\"].*app/" src/shared/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte"

# entities importing from features, widgets, pages, app
grep -rn "from.*['\"].*features/\|from.*['\"].*widgets/\|from.*['\"].*pages/\|from.*['\"].*app/" src/entities/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte"

# features importing from widgets, pages, app
grep -rn "from.*['\"].*widgets/\|from.*['\"].*pages/\|from.*['\"].*app/" src/features/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte"

# widgets importing from pages, app
grep -rn "from.*['\"].*pages/\|from.*['\"].*app/" src/widgets/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte"

# pages importing from app
grep -rn "from.*['\"].*app/" src/pages/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte"
```

Report each result as **BLOCKING** with file, line, and fix.

---

## Phase 3: Check cross-slice imports

Slices within the same layer must not import each other:

```bash
# Features cross-slice (most common violation)
grep -rn "from.*['\"].*features/" src/features/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" -l

# Entities cross-slice
grep -rn "from.*['\"].*entities/" src/entities/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" -l

# Widgets cross-slice
grep -rn "from.*['\"].*widgets/" src/widgets/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" -l
```

For each flagged file, show the exact import line:
```bash
grep -n "from.*['\"].*features/" src/features/auth/model/store.ts
```

Report each as **BLOCKING**. Fix: extract shared dependency to `entities/` or `shared/`.

---

## Phase 4: Check public API boundaries

First, determine whether the project uses barrel exports:

```bash
# Check if index files exist in slices
find src/{entities,features,widgets} -maxdepth 2 -name "index.*" 2>/dev/null | head -10
```

**If barrel exports exist** — check for imports that bypass the index:

```bash
# Deep imports into slice internals (not going through index)
grep -rn "from.*['\"].*entities/[a-zA-Z-]*/[a-zA-Z]" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" | grep -v "/index"
grep -rn "from.*['\"].*features/[a-zA-Z-]*/[a-zA-Z]" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" | grep -v "/index"
grep -rn "from.*['\"].*widgets/[a-zA-Z-]*/[a-zA-Z]" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" | grep -v "/index"
```

Report each as **CONCERN** — bypassed public API. Fix: import from `slice/` root (via index).

**If project avoids barrel exports** — check that imports don't go deeper than `layer/slice/`:

```bash
# Imports reaching into segment subdirs (layer/slice/segment/file)
grep -rn "from.*['\"].*entities/[a-zA-Z-]*/[a-zA-Z][a-zA-Z-]*/[a-zA-Z]" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte"
grep -rn "from.*['\"].*features/[a-zA-Z-]*/[a-zA-Z][a-zA-Z-]*/[a-zA-Z]" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte"
```

Report each as **CONCERN**. Fix: enforce via linter rule (`import/no-internal-modules` or `@feature-sliced/eslint-config`), TypeScript paths, or bundler aliases.

---

## Phase 5: Check segment names

Verify segment dirs use canonical names only:

```bash
# List all segment dirs (depth-3 within FSD layers)
find src/{entities,features,widgets,pages,shared} -maxdepth 2 -mindepth 2 -type d 2>/dev/null | sort
```

Canonical names: `ui`, `model`, `api`, `lib`, `config`.

Flag non-canonical names (e.g., `helpers`, `utils`, `hooks`, `store`, `types`) as **SUGGESTION**.

---

## Phase 6: Check shared purity

`shared/` must contain zero business domain knowledge:

```bash
# Look for domain terms in shared (adjust terms and extensions to the project)
grep -rn "User\|Order\|Product\|Auth\|Cart\|Payment" src/shared/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" -l
```

Review flagged files manually — type parameter names may be generic. Report concrete domain logic as **CONCERN**.

---

## Phase 7: Produce report

Format the report with severity-grouped sections. Most-critical first.

```markdown
# FSD Compliance Report

## BLOCKING (must fix — breaks isolation)

### [BLOCKING] Upward import: entities → features
`src/entities/user/model/store.ts:14` imports from `features/auth`.
Entities cannot know about features — this creates an upward dependency.
**Fix:** Move the shared dependency to `shared/` or restructure so `features/auth` passes data down.

---

### [BLOCKING] Cross-slice: features/auth → features/cart
`src/features/auth/model/store.ts:8` imports from `features/cart`.
Cross-slice imports couple independent features.
**Fix:** Extract the shared data to `entities/` (if it's a domain object) or `shared/` (if domain-free).

---

## CONCERN (fix before next refactor)

### [CONCERN] Bypassed public API
`src/pages/home/ui/HomePage.tsx:3` imports `entities/user/model/types.ts` directly.
Internal paths break when the slice restructures.
**Fix:** `import type { User } from 'entities/user'` (via index).

---

## SUGGESTION (improve when convenient)

### [SUGGESTION] Non-canonical segment: helpers/
`src/features/auth/helpers/` is not a canonical FSD segment.
**Fix:** Rename to `lib/`.

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKING | 2 |
| CONCERN  | 1 |
| SUGGESTION | 1 |

Total violations: 4
```

Deliver the report. Do not auto-fix BLOCKING violations without user confirmation — import restructuring can break compilation.
