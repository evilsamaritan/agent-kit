# Workflow: Migrate to FSD

Incrementally migrate an existing codebase to FSD. **Critical constraint: migrate bottom-up.** Start with `shared/`, end with `pages/`. Top-down migration creates dependency cycles.

---

## Step 1: Audit existing structure

Map each existing directory to its likely FSD layer:

```bash
# List top-level source dirs
ls src/

# List all directories (shows depth-2 structure)
find src/ -maxdepth 2 -type d | sort
```

Before building the map, detect the project's naming convention from existing dirs:

```bash
# Look at existing directory names to detect casing style
find src/ -maxdepth 3 -type d | sort | head -30
```

Identify the style in use (kebab-case, camelCase, PascalCase) and carry it forward when naming new FSD dirs. Do not introduce a different style — keep the codebase consistent.

Build a mapping table:

| Existing dir | FSD layer | Notes |
|--------------|-----------|-------|
| `utils/` | `shared/lib/` | Pure utilities, no domain |
| `components/Button` | `shared/ui/` | Reusable, no domain |
| `components/UserCard` | `entities/user/ui/` | Domain-specific component |
| `store/userSlice` | `entities/user/model/` | Domain state |
| `store/authSlice` | `features/auth/model/` | Business action |
| `api/userApi` | `entities/user/api/` or `features/auth/api/` | Depends on purpose |
| `pages/Home` | `pages/home/` | Route-level |

If uncertain about a dir's layer, check the placement decision tree in `SKILL.md`.

---

## Step 2: Grep dependency graph

Before moving anything, map what imports what. Adjust file extensions to match the project (`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.svelte`):

```bash
# Find all import statements (adjust --include for project's file types)
grep -rn "^import\|^from\|require(" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.vue" --include="*.svelte" | head -100

# Find imports of a specific dir (e.g., utils)
grep -rn "from.*utils\|require.*utils" src/ --include="*.ts" --include="*.tsx" --include="*.vue" --include="*.svelte"
```

High-import-count files are high-risk to move. Move them last within their layer group.

---

## Step 3: Move `shared/` first

Lowest dependency — these files import from nothing (or only external packages).

1. Create `src/shared/{ui,api,lib,config}/`
2. Move pure utilities → `shared/lib/`
3. Move UI primitives → `shared/ui/`
4. Move HTTP client / third-party wrappers → `shared/api/` or `shared/lib/`
5. Move global constants / env bindings → `shared/config/`
6. Create `index.ts` at each shared sub-dir
7. Update all imports across the codebase to use new paths

```bash
# Update imports after moving (example for utils → shared/lib)
# Use your IDE's rename/refactor, or:
find src/ -name "*.ts" -o -name "*.tsx" | xargs sed -i '' "s|from '.*utils/|from '@/shared/lib/|g"
```

Verify after this step:
```bash
grep -rn "from.*utils/" src/ && echo "STALE IMPORTS REMAIN" || echo "OK"
```

---

## Step 4: Move `entities/`

Domain types and data — no business logic, no user actions.

1. Create `src/entities/<name>/` for each domain object
2. Move domain types/interfaces → `entities/<name>/model/`
3. Move domain store slices (state only, no actions) → `entities/<name>/model/`
4. Move entity-specific API calls → `entities/<name>/api/`
5. Move domain-specific components → `entities/<name>/ui/`
6. Create `index.ts` at each entity root
7. Update imports

Rule of thumb: if a file describes *what a thing is*, it belongs in `entities/`. If it describes *what a user can do with it*, it belongs in `features/`.

---

## Step 5: Move `features/`

User actions with business value. Extract from existing page/component directories.

1. Create `src/features/<name>/` for each business action
2. Move business logic / action-driven store slices → `features/<name>/model/`
3. Move feature-specific UI (forms, buttons) → `features/<name>/ui/`
4. Move feature-specific API calls → `features/<name>/api/`
5. Create `index.ts` at each feature root
6. Update imports

At each step, check: does this feature import another feature? If yes, extract the shared dependency to `entities/` or `shared/`.

---

## Step 6: Move `pages/` last

Most entangled — pages typically import from many layers.

1. Create `src/pages/<name>/` for each route
2. Move page components → `pages/<name>/ui/`
3. Create `index.ts` at each page root
4. Update route configuration in `app/` to point to new paths

Pages should only compose — they import from `widgets/`, `features/`, `entities/`, `shared/`. No logic lives in pages.

---

## Step 7: Set up import enforcement

After moving files, configure tooling to prevent future violations. Choose based on project stack:

1. **Path aliases** — configure `tsconfig.json` paths (or bundler aliases for non-TS projects) so imports use `@/shared/ui` instead of relative paths
2. **Linting** — install `@feature-sliced/eslint-config` or configure `import/no-restricted-paths` rules
3. **CI check** — add a grep-based script (from `workflows/review.md`) to CI as a safety net

---

## Step 8: Validate at each step

After each layer migration:

```bash
# No upward imports
grep -rn "entities.*from.*features\|shared.*from.*entities" src/ && echo "VIOLATION" || echo "OK"

# No cross-slice imports in features
grep -rn "features/[a-z-]*/.*from.*features/[a-z-]*/" src/ && echo "CROSS-SLICE VIOLATION" || echo "OK"

# No bypassed public APIs (imports from internal paths)
grep -rn "from.*entities/[a-z-]*/[a-z]\|from.*features/[a-z-]*/[a-z]" src/ | grep -v "index" && echo "BYPASSED API" || echo "OK"
```

Run the full compliance review (`workflows/review.md`) when all layers are migrated.
