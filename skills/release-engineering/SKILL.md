---
name: release-engineering
description: "Design releases and rollouts. Use for versioning, changesets, feature flags, progressive rollout, rollback, deprecation windows, and release coordination."
user-invocable: true
---

# Release Engineering

Versioning, release automation, feature flags, progressive delivery, rollback.

## Scope and boundaries

| Question | Owner |
|----------|-------|
| Version numbers, release notes, tags, publishing, flags, rollout strategy, rollback, hotfix and backport flow | this skill |
| Pipeline syntax, caches, runners, CI secrets | `ci-cd` |
| Schema migration mechanics (expand/contract, backfills, locks) | `database` ([safe migrations](../database/SKILL.md#safe-migrations)) |
| API and wire compatibility rules, deprecation headers | `api-design` |
| Probe and shutdown semantics, SLOs that gate a rollout | `reliability` |
| Proxies, TLS, DNS, CDN | `networking` |
| Hardening, supply-chain controls | `security` |
| Changelog production (this skill decides how entries are produced) | this skill |
| Wording quality of changelogs and migration guides | `documentation` |
| Migration slices and structure of a staged refactor | `architecture` |
| Code structure of flag checks | `development` |

## Release rules

- **Compatibility contract.** Decide what consumers may rely on (public API, wire format, CLI, config) and let the version number describe changes to that contract.
- **One version source of truth.** One file or tag drives every artifact version; automation writes it, nobody edits copies by hand.
- **Build once, promote.** Tag and artifact are immutable: a published version is never overwritten or rebuilt. Deploys and rollbacks redeploy a previously built artifact.
- **Retraction policy.** Say how a bad release is withdrawn: yank or deprecate on the registry, publish a fixed version, never reuse a number.
- **Publishing credentials.** Prefer OIDC trusted publishing (npm, PyPI, crates.io and others support it) to long-lived registry tokens, with provenance attached; details in [release-patterns.md](references/release-patterns.md).

---

## Versioning Strategy

```
What are you versioning?
├── Library / package / API with consumers → SemVer (communicates compatibility)
├── Application with scheduled releases → CalVer (communicates freshness)
└── Tightly coupled monorepo released together → either; SemVer if consumers depend on it
```

```
MAJOR.MINOR.PATCH[-prerelease][+build]

MAJOR — breaking change to the contract
MINOR — backward-compatible feature
PATCH — backward-compatible fix
Pre-release: 1.0.0-alpha.1 < 1.0.0-beta.1 < 1.0.0-rc.1 < 1.0.0   Build metadata is ignored in precedence.
```

When MAJOR is 0, a MINOR bump may break. CalVer (`YYYY.MM.PATCH`, `YYYY.MINOR.PATCH`) does not communicate compatibility; pair it with release notes. Version ranges (`^`, `~`) are per-ecosystem semantics: see [release-patterns.md](references/release-patterns.md#version-range-semantics).

---

## Release Automation

```
How should releases be managed?
├── Many packages in one repo
│   ├── Human-written change notes per PR → changeset files
│   ├── Commit-driven, reviewed release PR → release-please-style tool
│   └── Per-package interactive release → release-it-style tool
├── Single package
│   ├── Zero manual steps → semantic-release-style tool
│   └── Reviewed release PR → release-please-style tool
└── Not sure → start with changeset files (flexible, low lock-in)
```

Change notes come from either a file per PR (written by a person) or conventional commits (generated). Pick one source for the changelog and generate entries from it; do not hand-edit generated files. With conventional commits, the commit message format (`type(scope): subject`, `!` or a `BREAKING CHANGE:` footer for breaking changes) maps to the bump, and a commit linter plus a PR-title check enforces it; skip both when change notes are changeset files. Tool setup and workflows (JavaScript tooling; release-please and semantic-release also cover other ecosystems, Cargo and Go projects have their own tooling): [release-patterns.md](references/release-patterns.md).

---

## Feature Flags

```
CREATE → DEVELOP → TEST → ROLLOUT → GA → CLEANUP

Create:   default OFF, owner, cleanup date (short-lived release flags: weeks, not quarters)
Develop:  code behind the flag, merged to the main line
Test:     enable in staging
Rollout:  small percentage → larger, watching error rate and latency at each step
GA:       ON for all
Cleanup:  delete flag and the old path; CI fails when a flag outlives its date
```

**Pattern.** Evaluate a flag once, at a single seam (composition root, route, or service entry), and choose the implementation there; downstream code receives the chosen behavior and never asks the flag. Inject the flag client and the clock; do not read a global or the system time. An unknown flag name is an error in development and test, not a silent "off". Rules for dispatch and dependencies: `development`. A sketch is in [release-patterns.md](references/release-patterns.md#feature-flag-implementation).

Flag kinds differ in lifetime: **release** flags (temporary), **ops** flags and kill switches (long-lived, documented), **experiment** flags (end with the experiment), **permission** flags (really entitlements; keep them out of the flag system).

```
What do you need from flags?
├── Vendor-neutral client API → OpenFeature SDK in front of any provider
├── Complex targeting + audit trail → managed platform
├── Self-hosted control → open-source flag service
├── Flags tied to product analytics or experiments → platform with built-in experimentation
└── A handful of static switches → config or environment variables
```

If you build an evaluator instead, it needs: stable bucketing (the same user gets the same answer, keyed on user plus flag), monotonic ramps (raising a percentage never flips users back off), an audit log of changes, and no clock or global reads inside the evaluation.

---

## Progressive Delivery

Combine a deployment strategy, flags, and observability so exposure grows only while signals stay healthy.

```
Deployment strategy?
├── Downtime acceptable (dev, batch)? → Recreate
└── Zero downtime needed
    ├── Can the platform split traffic AND do you have per-version signals (errors, latency)?
    │   ├── Yes → Canary: small share first, grow while SLO signals hold
    │   └── No → Rolling (the low-overhead default)
    └── Need instant rollback and can afford a second full environment? → Blue-green
```

| Strategy | Downtime | Rollback | Extra capacity | Needs |
|----------|----------|----------|----------------|-------|
| Recreate | Yes | Redeploy previous | None | Nothing |
| Rolling | No | Roll back (minutes) | Small surge | Readiness checks |
| Blue-green | No | Switch back (seconds) | Full second environment | Traffic switch; state compatible across both |
| Canary | No | Route away (seconds) | Small | Traffic splitting, per-version observability |
| Shadow | No user impact | n/a | Full | Mirrored traffic, side-effect isolation |

Rollout pattern: deploy canary at a small share → watch error rate, latency, and business metrics → grow in stages, rolling back automatically on a breach → 100%. Gate each step on SLIs (the SLOs come from `reliability`), keep a kill switch for the new path, and when a release is suspected of an incident, roll back first and investigate after. Flags decouple deploy from release: ship the code dark, expose it by percentage. Strategy snippets: [deployment-patterns.md](references/deployment-patterns.md).

---

## Monorepo Versioning

| Aspect | Independent | Fixed (locked) |
|--------|-------------|----------------|
| Version per package | Own | One shared |
| Release | Per package | Together |
| Best for | Loosely coupled libraries | Tightly coupled packages |

Publish order: detect changed packages → topologically sort by dependency → bump leaves first → update internal dependency references → publish in order → tag each release (`pkg@1.2.3`).

---

## Hotfix & Rollback

**Hotfix flow:** assess severity → branch from the release point (main on trunk-based flow, the release branch or tag on a branch-per-release flow) → minimal fix and tests → expedited review → merge, PATCH bump, tag → deploy and monitor → propagate the fix per the backport rule below → postmortem.

**Backports:** fix on main first, then cherry-pick to each supported release branch. When the fix must land on a release branch first (main has diverged or is frozen), forward-port it to main in the same change set so the next release does not lose it. One fix per PR, referenced by the original.

| Rollback | Speed | Data risk | Use when |
|----------|-------|-----------|----------|
| Flag off | Instant | None | Change is behind a flag |
| Traffic switch (blue-green, canary route-away) | Seconds | None | Strategy supports it |
| Redeploy previous artifact (`kubectl rollout undo`, `helm rollback`, previous tag) | Minutes | None if schema is compatible | Stateless services |
| Revert commit and ship a new build | Slower | None | Code must be removed from main |
| Schema rollback | Slow | High | Avoid; roll forward |

**Schema rule:** deploy order is expand the schema first, deploy code that works with old and new, contract later in a separate release. Never drop a column in the release that stops using it. Roll forward with a new migration instead of a down migration. Mechanics (lock timeouts, concurrent index builds, `NOT VALID` then validate, batched backfills): `database` [safe migrations](../database/SKILL.md#safe-migrations).

---

## Deprecation and Compatibility Windows

A breaking change ships in three steps: announce and mark deprecated (with the replacement), run old and new side by side for a stated window, then remove in a MAJOR release. Telemetry on old-path usage decides when removal is safe. API and wire specifics: `api-design`; schema specifics: `database`.

---

## Anti-Patterns

1. **No versioning strategy** — random numbers break dependency management.
2. **Hand-edited changelog or version copies** — generate from change notes; one version source.
3. **Flags without cleanup** — owner and deadline at creation; CI enforces.
4. **Flag checks scattered through code** — evaluate at one seam.
5. **No rollback plan** — write the rollback before the release; rehearse it.
6. **Rebuild to roll back** — redeploy a previous immutable artifact.
7. **Big-bang deploys** — use progressive exposure.
8. **Rollout without signals** — gate each step on error rate, latency, and business metrics.
9. **Long-lived registry tokens in CI** — use trusted publishing.

---

## Context Adaptation

**Pipelines:** build → test → version → publish → deploy; the pipeline triggers what this skill defines (`ci-cd`).

**Backend and frontend:** flags are consumed at a seam (middleware or composition root, route or provider); frontend releases also need cache busting (content-hashed filenames, service-worker update, CDN invalidation).

---

## Related Knowledge

- **ci-cd** — pipelines that execute release steps
- **database** — migrations, expand/contract
- **architecture** — migration slices for staged refactors
- **documentation** — wording quality of changelogs and migration guides
- **api-design** — compatibility and deprecation of APIs
- **development** — structure of flag checks
- **reliability** — SLOs and error budgets that gate releases
- **observability** — signals for progressive rollout
- **kubernetes** — rollout mechanics and rollback commands
- **networking** — proxies, TLS, and traffic switching
- **security** — supply chain and hardening

## References

- [release-patterns.md](references/release-patterns.md) — changeset and release-please setup, conventional commits, trusted publishing workflow, flag implementation, monorepo publish, checklist
- [deployment-patterns.md](references/deployment-patterns.md) — deploy strategy implementation (Kubernetes canary, blue-green, single-host deploy with rollback), serverless notes, preview environments, failure modes
