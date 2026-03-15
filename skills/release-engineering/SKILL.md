---
name: release-engineering
description: Design release strategies — versioning, changesets, feature flags, progressive delivery, monorepo releases, rollback. Use when choosing semver vs calver, implementing changesets, designing feature flag lifecycle, or planning canary/blue-green rollouts. Do NOT use for CI/CD pipelines (use devops) or container deployment (use docker/kubernetes).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Release Engineering

Expert-level release management knowledge. Versioning strategy, release automation, feature flags, progressive delivery, rollback.

---

## Versioning Strategy

### Decision tree

```
What are you versioning?
├── Library / package / API with consumers
│   └── SemVer (MAJOR.MINOR.PATCH) — communicates compatibility
├── Application / SaaS with scheduled releases
│   └── CalVer (YYYY.MM.PATCH or YYYY.MINOR.PATCH) — communicates freshness
└── Tightly coupled monorepo (all packages release together)
    └── Either works — SemVer if consumers depend on it, CalVer if internal
```

### SemVer rules

```
MAJOR.MINOR.PATCH[-prerelease][+build]

MAJOR  — breaking changes (removed API, changed behavior)
MINOR  — new features, backward compatible
PATCH  — bug fixes, backward compatible

Pre-release: 1.0.0-alpha.1 < 1.0.0-beta.1 < 1.0.0-rc.1 < 1.0.0
Build metadata: 1.0.0+20260115 (ignored in precedence)
```

| Version range | Syntax | Matches |
|---------------|--------|---------|
| Exact | `1.2.3` | Only 1.2.3 |
| Patch updates | `~1.2.3` | >=1.2.3, <1.3.0 |
| Minor updates | `^1.2.3` | >=1.2.3, <2.0.0 |
| Any minor | `1.x` | >=1.0.0, <2.0.0 |
| Range | `>=1.2.0 <2.0.0` | Explicit range |

**0.x.y rule:** When MAJOR is 0, MINOR bumps can break. `^0.2.3` = `>=0.2.3, <0.3.0`.

### CalVer formats

| Format | Example | When to use |
|--------|---------|-------------|
| `YYYY.MM.PATCH` | `2026.03.1` | Monthly releases |
| `YYYY.MINOR.PATCH` | `2026.1.0` | Arbitrary cadence |
| `YY.MM` | `26.03` | Ubuntu-style, short |

CalVer does not communicate compatibility. Pair with release notes or migration guides.

---

## Release Automation

### Decision tree

```
How do you want to manage releases?
├── Monorepo with multiple packages?
│   ├── Want human-written changelogs? → Changesets
│   ├── Want commit-driven automation? → release-please (or Nx release for Nx monorepos)
│   └── Want per-package interactive release? → release-it
├── Single package?
│   ├── Want full automation, zero manual steps? → semantic-release
│   ├── Want PR-based review before publish? → release-please
│   └── Want interactive CLI prompts? → release-it
└── Not sure? → Start with Changesets (flexible, low lock-in)
```

### Tool comparison (supplementary)

| Aspect | Changesets | release-please | semantic-release | release-it |
|--------|-----------|----------------|------------------|------------|
| Change tracking | Separate .md file per PR | Commit messages | Commit messages | Interactive CLI |
| Monorepo | Excellent (native) | Good (multi-component) | Plugin required | Per-package |
| Changelog | Human-written | Auto-generated | Auto-generated | Template-based |
| Automation | Semi (PR review step) | Semi (PR approval) | Full | Semi (interactive) |
| CI integration | GitHub Actions | GitHub Actions | Any CI | Any CI |

---

## Feature Flags

### Flag lifecycle

```
CREATE → DEVELOP → TEST → ROLLOUT → GA → CLEANUP

1. Create:   Add flag with default OFF, set cleanup deadline (max 90 days)
2. Develop:  Code behind flag, merge to main (trunk-based development)
3. Test:     Enable in staging, run tests
4. Rollout:  1% → 10% → 50% → 100% (monitor error rates at each step)
5. GA:       Flag ON for all, declare feature stable
6. Cleanup:  Remove flag + old code path (enforce deadline in CI)
```

### Implementation patterns

```ts
// Simple boolean flag
if (featureFlags.isEnabled('new-checkout')) {
  return <NewCheckout />;
}
return <LegacyCheckout />;

// Percentage rollout
if (featureFlags.isEnabledForUser('new-checkout', userId, { percentage: 10 })) {
  // 10% of users see this
}

// Kill switch — inverse flag for emergency disable
if (!featureFlags.isEnabled('disable-payments')) {
  processPayment();
}
```

### Platform decision tree

```
What do you need from feature flags?
├── Complex targeting rules + enterprise audit trail? → SaaS platform (paid)
├── Full control + self-hosted? → Open-source platform (Unleash, Flagsmith)
├── Flags + product analytics in one tool? → Integrated platform (PostHog, GrowthBook)
├── Simple on/off, no runtime changes needed? → Environment variables
└── Minimal setup, small team? → Config file or lightweight SaaS (ConfigCat)
```

---

## Progressive Delivery

Progressive delivery combines deployment strategies with feature flags and observability for incremental, data-driven rollouts.

### Deployment strategy decision tree

```
Need zero downtime?
├── No → Recreate (simplest)
└── Yes → Can you run 2x infrastructure?
    ├── Yes → Need instant rollback?
    │   ├── Yes → Blue-Green
    │   └── No → Rolling
    └── No → Canary (incremental, low overhead)
```

### Strategy comparison

| Strategy | Downtime | Rollback speed | Resource cost | Risk level |
|----------|----------|----------------|---------------|------------|
| **Recreate** | Yes | Slow (redeploy) | 1x | High |
| **Rolling** | No | Medium (roll back) | 1x-1.3x | Medium |
| **Blue-Green** | No | Instant (swap) | 2x | Low |
| **Canary** | No | Fast (route away) | 1.1x | Lowest |
| **Shadow/Dark** | No | N/A (no user impact) | 2x | Lowest |

### Progressive rollout pattern

```
Deploy canary (5% traffic)
  → Monitor error rate, latency, business metrics (5 min)
  → If degraded: auto-rollback
  → If stable: increase to 25% (10 min) → 50% (10 min) → 100%
```

Combine with feature flags: deploy code to all instances, control exposure via flag percentage. Decouples deploy from release.

---

## Monorepo Versioning

### Independent vs Fixed versioning

| Aspect | Independent | Fixed (locked) |
|--------|-------------|----------------|
| Version per package | Own version each | All share one version |
| Release frequency | Per-package | All together |
| Best for | Utility libraries, plugins | Tightly coupled packages |
| Examples | Babel plugins | Angular, Material UI |

### Publish ordering

```
1. Detect changed packages (git diff or changeset)
2. Topological sort by dependency graph
3. Bump versions bottom-up (leaf deps first)
4. Update internal dependency references
5. Publish in topological order
6. Tag each release: @scope/pkg@1.2.3
```

---

## Hotfix & Rollback

**Hotfix flow:** Assess severity (P0=skip staging) -> branch from main -> minimal fix -> automated tests -> expedited review (1 reviewer) -> merge + PATCH bump -> deploy + monitor -> backport + postmortem.

### Rollback strategies

| Strategy | Speed | Data risk | When to use |
|-------------------|-------|-----------|-------------|
| Feature flag off | Instant | None | Change is behind a flag |
| Revert deploy | Fast | None | Stateless services, no DB changes |
| Git revert + deploy | Medium | None | Need to undo code change |
| DB rollback | Slow | High | Schema migration broke things |

**Database rollback rule:** Always write backward-compatible migrations. Deploy migration separately from code. Never drop columns in the same release that stops using them.

---

## Anti-Patterns

1. **No versioning strategy** — random version numbers make dependency management impossible. Choose semver or calver deliberately
2. **Manual changelog** — error-prone and always out of date. Use changesets or conventional commits with auto-generation
3. **Feature flags without cleanup** — flags accumulate as tech debt. Set a cleanup deadline at creation and enforce in CI
4. **No rollback plan** — "we'll fix forward" fails under pressure. Document rollback steps before every release
5. **Big-bang deploys** — releasing everything at once maximizes blast radius. Use progressive delivery: canary + flags
6. **Deploy without observability** — releasing without monitoring error rates, latency, and business metrics. Connect flag rollouts to observability

---

## Context Adaptation

### DevOps
- Pipeline config for releases: build -> test -> version -> publish -> deploy stages
- Artifact management: container registry tagging, npm publish, GitHub Releases

### Backend
- Feature flag implementation: middleware for flag evaluation, context propagation
- Database migration coordination: run migration before deploy, backward-compatible schemas
- Backward compatibility: API versioning during transition, deprecation headers

### Frontend
- Feature flag consumption: framework context provider, route-level flags, component-level flags
- A/B testing integration: flag variants with analytics tracking, consistent assignment
- Cache busting on release: content hash in filenames, service worker update, CDN invalidation

---

## Related Knowledge

- **devops** — CI/CD pipelines that execute release processes, deployment strategy implementation
- **sre** — SLOs/error budgets that gate releases, incident response for failed deploys
- **observability** — metrics and monitoring for progressive delivery decisions
- **backend** — feature flag implementation, database migration coordination
- **frontend** — cache busting on release, service worker updates

## References

- `references/release-patterns.md` — changeset setup, conventional commits config, feature flag implementation, deployment strategy examples, rollback procedures, monorepo release workflow
