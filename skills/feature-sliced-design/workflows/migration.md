# Workflow: Migrate to FSD

Incrementally migrate an existing codebase to FSD, **pages first**. Split the code by page, separate pages from shared code, and only then extract entities and features for code that more than one slice uses. Keep the application working after every step.

Principles:
- **Start in the page.** Code used by one page moves into that page.
- **Extract on second use**, and only when it is the same knowledge (not merely similar-looking code). `entities/` and `features/` are optional layers.
- **Keep a store and the operations that keep its invariants together** in the slice that owns it. A feature orchestrates a user flow by calling those operations; it does not take over writing the state.
- Use the IDE or language-server move/rename (or a codemod) to rewrite imports, then re-run the review checks (`workflows/review.md`, Phases 2-4). Do not hand-roll bulk text replacement.

---

## Step 1: Audit existing structure

Map the current layout and note the naming convention (kebab-case, camelCase, PascalCase) in use; carry it into new directories.

```bash
find src/ -maxdepth 2 -type d | sort
```

Build a mapping table of what each directory becomes:

| Existing dir | Target | Notes |
|--------------|--------|-------|
| `routes/` / route components | `pages/<name>/ui/` | One slice per page |
| `components/Button` | `shared/ui/` | Reusable, no domain |
| `components/UserCard` (one page) | `pages/<name>/ui/` | Single-page code stays in the page |
| `components/UserCard` (several pages) | `entities/user/ui/` | Extract on second use |
| `utils/` | `shared/lib/` (or into the page that uses it) | Pure utilities |
| `store/` | the owning page or entity `model/` | Store plus its operations stay together |

If a placement is unclear, use the placement tree in `SKILL.md`. When the framework reserves `app/` or `pages/`, use the renamed layers from `references/framework-integration.md`.

Check which files import which (use the IDE's find-usages, or Phase 2-4 commands in `workflows/review.md`). Files with many importers are high-risk; move them last within their step.

---

## Step 2: Divide the code by page

1. Create `pages/<name>/` for each route, with `ui/` and an entry point (`index`).
2. Move each route's page component into it; make the routing code import only the page's entry point.
3. Leave everything else where it is for now.

---

## Step 3: Separate pages from the rest

1. Create `app/` for routing, providers, and global styles; move app bootstrap code into it.
2. Create `shared/` for code that is not tied to a page.
3. Check that nothing outside `app/` imports from `app/`.

---

## Step 4: Break cross-page imports

Pages must not import each other. For each cross-page import:
- Needs the code on both pages and it is domain-free → move it to `shared/` (segment `ui`, `lib`, `api`, or `config`).
- It is the same domain knowledge used by both → leave for Step 7 (extract an entity or feature).
- It only looks alike → duplicate it into each page.

---

## Step 5: Unpack `shared/`

Move code that only one page uses from `shared/` back into that page. `shared/` keeps only code with no domain knowledge that is used by several slices (or is a UI-kit/infrastructure primitive).

---

## Step 6: Organize by purpose

Inside each slice, group code into the canonical segments: `ui/`, `model/` (state, types, and operations), `api/`, `lib/`, `config/`. Rename non-canonical folders (`helpers`, `utils`, `hooks`, `store`, `types`).

---

## Step 7: Extract entities and features where code is shared

Optional, and only for code used by two or more slices:
- **Entity** — a business domain object (user, order) with its types, state, and operations in `entities/<name>/model/`, API in `api/`, domain UI in `ui/`.
- **Feature** — a user action (sign in, add to cart) in `features/<name>/`; its `model/` orchestrates the flow and calls entity operations.
- Widgets — reusable composite UI blocks used by several pages.

After each extraction, confirm no feature imports another feature; extract the shared dependency instead.

---

## Step 8: Enforce and validate

1. Configure an enforcement tool (see "Import Rule Enforcement" in `SKILL.md`).
2. Run the compliance review (`workflows/review.md`) after every step, not only at the end. Fix BLOCKING items before continuing.
3. Run the project's build, type check, and tests after each move.
