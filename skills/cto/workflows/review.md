# CTO Review Workflow

Step-by-step procedure for a holistic technical health review.

---

## Phase 1: Structural Scan

Map the entire project topology.

1. Identify the repository strategy (monorepo, polyrepo, or hybrid)
2. Map workspace layout: deployable apps/services, shared libraries, tooling, scripts
3. Scan every package manifest (package.json, Cargo.toml, go.mod, pyproject.toml, etc.)
   - Name, dependencies, scripts, entry points
4. Scan compiler/type-checker configs for strictness and consistency
5. Scan linter and formatter configs
6. Check env templates for completeness and documentation
7. Check build scripts, CI config, and tooling setup

---

## Phase 2: Dependency Graph

Construct and validate the internal dependency graph.

1. Build the dependency DAG from package manifests
2. Validate the graph against actual imports in source code
3. Flag these violations:
   - Circular dependencies (A depends on B depends on A)
   - Missing declared dependencies (imported but not in manifest)
   - Phantom dependencies (available only through transitive installation or hoisting)
   - Wrong dependency direction (shared package depending on a service)
   - Unused declared dependencies (in manifest but never imported)

---

## Phase 3: Quality Assessment

Evaluate each dimension with the checklists below.

### Repository Health
- [ ] Workspace layout is logical (apps vs packages vs tooling)
- [ ] Every package has consistent scripts (build, test, lint, check)
- [ ] Task orchestration works for all workspaces
- [ ] No workspace uses file-path or absolute references to siblings
- [ ] Root manifest has useful aggregate scripts

### Package Boundaries
- [ ] Each package has a single, clear responsibility
- [ ] Public API surface is intentional (no internal leaks)
- [ ] No cross-package relative imports (bypassing the package API)
- [ ] Types exported alongside implementations (not separate type packages)
- [ ] Package naming is consistent and descriptive
- [ ] No package too small (should merge) or too large (should split)

### Code Quality Enforcement
- [ ] Compiler strictness is maximal and consistent across packages
- [ ] Linter configured centrally, run from root
- [ ] Formatting enforced consistently (editor-based or tool-based)
- [ ] No type-system escape hatches without justification
- [ ] Pre-commit hooks prevent bad code from being committed
- [ ] Import paths use workspace aliases, not relative paths across packages

### Service Architecture
- [ ] Each service has clear domain ownership
- [ ] Services communicate via events/messages, not direct imports
- [ ] No service imports code from another service
- [ ] DI pattern consistent across services
- [ ] Config loading pattern consistent across services
- [ ] Graceful shutdown pattern consistent across services
- [ ] Entry point structure consistent

### Developer Experience
- [ ] New developer can start in under 15 minutes
- [ ] Scripts are consistent: same name does same thing everywhere
- [ ] Error messages from tooling are actionable
- [ ] There is a way to run all checks locally before pushing
- [ ] Architecture is documented for new team members

### Technical Debt
- [ ] No empty or unused script stubs
- [ ] No unused exports or dead code files
- [ ] No duplicated patterns across services
- [ ] TODOs are tracked (linked to issues)
- [ ] No experimental/temporary code in main branch
- [ ] Dependencies are up to date (no major version drift)

### Cross-Cutting Concerns
- [ ] Observability: structured logging, metrics, tracing consistent across services
- [ ] Configuration: validated, typed config — same pattern everywhere
- [ ] Error handling: shared taxonomy or consistent per-service approach
- [ ] API versioning: explicit strategy for evolving public APIs
- [ ] Security posture: secrets, auth, input validation applied uniformly
- [ ] Team alignment: code ownership matches team boundaries

---

## Phase 4: Report

Produce a structured assessment using this template.

```
## Technical CTO Assessment

### Summary
[2-3 sentences: overall project health, maturity level, top priorities]

### Project Topology
[Visual map: workspaces, dependency arrows, service boundaries]

### Dependency Graph
[Table: shared packages and their consumers]

### Package Health
| Package | Responsibility | API Surface | Size | Deps | Issues |
|---------|---------------|-------------|------|------|--------|

### Service Health
| Service | Domain | Packages Used | Config Pattern | DI | Shutdown | Scripts |
|---------|--------|--------------|----------------|-----|----------|---------|

### Code Quality Score
| Dimension | Score | Notes |
|-----------|-------|-------|
| Compiler strictness | | |
| Linter coverage | | |
| Formatting | | |
| Import hygiene | | |
| Pre-commit hooks | | |
| Test coverage | | |

### Boundary Violations
[Where things are in the wrong place or cross boundaries they should not]

### Technical Debt Inventory
| # | Type | Location | Impact | Effort | Recommendation |
|---|------|----------|--------|--------|----------------|

### Cross-Cutting Concerns
| Concern | Status | Consistency | Gaps |
|---------|--------|-------------|------|
| Observability | | | |
| Configuration | | | |
| Error handling | | | |
| API versioning | | | |
| Security posture | | | |

### Findings
| # | Area | Severity | Finding | Recommendation |
|---|------|----------|---------|----------------|

### Architecture Decisions Needed
[Decisions that are currently implicit and should be explicit]

### Recommendations
1. [Priority order — what to fix/improve first]
```
