# Release Engineering Patterns & Implementation Guide

Setup and workflows for versioning, publishing, feature flags, and monorepo releases. The JavaScript tooling below is a named example of the neutral rules in SKILL.md; the same rules apply to other ecosystems with their own tools. Workflow snippets follow the `ci-cd` rules: explicit job permissions, pinned actions (`<sha> # vX.Y.Z` placeholders), a fixed runner label, and runtime versions that are examples (use a supported release).

## Contents

- [Version Range Semantics](#version-range-semantics)
- [Changesets Setup](#changesets-setup)
- [Publishing Credentials](#publishing-credentials)
- [Conventional Commits Configuration](#conventional-commits-configuration)
- [Feature Flag Implementation](#feature-flag-implementation)
- [Rollback Procedures](#rollback-procedures)
- [Monorepo Release Workflow](#monorepo-release-workflow)
- [Changelog Entries](#changelog-entries)
- [Release Checklist Template](#release-checklist-template)

---

## Version Range Semantics

npm semantics (other ecosystems differ: Cargo's default requirement behaves like `^`, Go uses minimum version selection, Python uses `~=` and `>=`):

| Range | Matches |
|-------|---------|
| `1.2.3` | Only 1.2.3 |
| `~1.2.3` | >=1.2.3, <1.3.0 |
| `^1.2.3` | >=1.2.3, <2.0.0 |
| `1.x` | >=1.0.0, <2.0.0 |
| `>=1.2.0 <2.0.0` | Explicit range |

For `0.x.y`, `^0.2.3` means >=0.2.3, <0.3.0 because a MINOR bump may break.

---

## Changesets Setup

```bash
npm install -D @changesets/cli @changesets/changelog-github
npx changeset init
```

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",   // `changeset init` writes the schema URL matching your installed version
  "changelog": ["@changesets/changelog-github", { "repo": "org/repo" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@internal/docs", "@internal/e2e"]
}
```

### Release workflow with trusted publishing

No registry token is stored: the job exchanges its OIDC identity for a short-lived publish credential, and the registry records provenance.

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

concurrency:
  group: release
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  release:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    permissions:
      contents: write          # push the version commit and tags
      pull-requests: write     # open the release PR
      id-token: write          # OIDC for trusted publishing
    steps:
      - uses: actions/checkout@<sha>  # vX.Y.Z
        with:
          fetch-depth: 0
          persist-credentials: false   # the action authenticates with its own token input
      - uses: actions/setup-node@<sha>  # vX.Y.Z
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - uses: changesets/action@<sha>  # v2.x.y (needs Changesets CLI v3)
        with:
          version-script: npx changeset version
          publish-script: npx changeset publish
          commit-message: "chore: version packages"
          pr-title: "chore: version packages"
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

`changesets/action` v2 renamed its inputs (`version` to `version-script`, `publish` to `publish-script`, `commit` to `commit-message`, `title` to `pr-title`), takes the token through `github-token` (the `GITHUB_TOKEN` environment variable is ignored), and no longer reads `NPM_TOKEN` into `.npmrc`: authenticate through trusted publishing. v1 of the action is the line for Changesets CLI v2.

If a later job needs a token that can trigger other workflows, use a GitHub App token instead of a personal token.

### Changeset file format

```markdown
---
"@scope/package-a": minor
"@scope/package-b": patch
---

Add PKCE support to the OAuth2 sign-in flow for public clients.
```

---

## Publishing Credentials

Prefer trusted publishing to stored tokens. The registry is configured to trust a specific repository, workflow file, and optionally environment; the job proves its identity with OIDC and receives a short-lived credential.

- **npm**: configure a trusted publisher for the package (repository and exact workflow filename including `.yml`, case-sensitive), grant `id-token: write`, use npm 11.5.1 or later on Node 22.14 or later, and keep a `repository.url` in `package.json` that matches the repository. Supported CI: GitHub Actions on GitHub-hosted runners, GitLab CI/CD on GitLab.com shared runners, and CircleCI cloud; self-hosted runners are not supported. Provenance attestations are generated automatically on GitHub Actions and GitLab CI/CD.
- **PyPI** and **crates.io**: both support trusted publishing from GitHub Actions (crates.io: `rust-lang/crates-io-auth-action` with `id-token: write`, after the first release is published manually); check each registry's documentation for other CI providers.
- **Fallback when a registry has no trusted publishing**: a scoped token stored as an environment secret on a protected environment, rotated, never available to fork PRs.

Restrict who can edit the publishing workflow (branch protection, CODEOWNERS), since the registry trusts that file.

---

## Conventional Commits Configuration

### Commitlint

```bash
npm install -D @commitlint/cli @commitlint/config-conventional husky
npx husky init
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
```

```js
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['auth', 'api', 'ui', 'db', 'deps', 'ci']],
    'subject-max-length': [2, 'always', 72],
  },
};
```

Enforce on the PR title as well if you squash-merge: the squashed title becomes the commit the release tool reads.

### release-please

release-please-action v4 reads its settings from files, not from action inputs: custom changelog sections go in the config file.

```yaml
# .github/workflows/release-please.yml
name: Release Please
on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  release:
    runs-on: ubuntu-24.04
    permissions:
      contents: write
      issues: write
      pull-requests: write
    steps:
      - uses: googleapis/release-please-action@<sha>  # v4.x.y
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

```json
// release-please-config.json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "packages": { ".": {} },
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance" },
    { "type": "docs", "section": "Documentation", "hidden": true },
    { "type": "chore", "section": "Miscellaneous", "hidden": true }
  ]
}
```

Pull requests and tags created with the default `GITHUB_TOKEN` do not trigger other workflows; pass a GitHub App token or PAT through the action's `token` input when CI must run on the release PR. `.release-please-manifest.json` holds the current version per package (`{ ".": "1.2.3" }`). release-please supports many `release-type` values beyond `node`.

### semantic-release

```json
// .releaserc.json
{
  "branches": ["main", { "name": "beta", "prerelease": true }],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github",
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version}"
    }]
  ]
}
```

---

## Feature Flag Implementation

Pattern: evaluate once at a seam, inject the client, choose the implementation there. Neither the checkout code nor anything below it knows a flag exists.

```ts
// Port: the only thing application code sees. An OpenFeature client satisfies it.
interface Flags {
  isEnabled(name: FlagName, context: { userId: string }): boolean;
}

// Known flags are a closed list; a typo is a compile-time or startup error, not a silent "off".
type FlagName = 'new-checkout' | 'fast-search';

// Composition root: the one place that reads the flag
function buildCheckout(flags: Flags, user: { id: string }): Checkout {
  return flags.isEnabled('new-checkout', { userId: user.id })
    ? new NewCheckout(deps)
    : new LegacyCheckout(deps);
}
```

Requirements for a flag evaluator or provider:

- **Stable bucketing**: hash `userId` plus flag name with a stable, uniform hash so a user keeps the same variant.
- **Monotonic ramps**: raising a percentage only adds users; it never flips earlier ones off.
- **Fail loudly in development and test** on an unknown flag name; in production, return the flag's declared default and emit a metric.
- **Audit**: record who changed what, when.
- **Evaluation takes its inputs as arguments** (context, time if needed); no global or system-clock reads inside.

### Flag cleanup tracking

Keep a registry (file or flag-service metadata) with owner, creation date, cleanup date, and status. A CI job passes the current date in and fails when a non-deprecated flag is past its cleanup date, so the check is deterministic and testable:

```ts
function expiredFlags(registry: FlagRecord[], today: string): string[] {
  return registry.filter(f => f.status !== 'deprecated' && f.cleanupBy < today).map(f => f.name);
}
// CI: const expired = expiredFlags(loadRegistry(), process.env.TODAY!); fail if expired.length > 0
```

---

## Rollback Procedures

Rollback redeploys a previously built, immutable artifact; it never rebuilds from source.

```bash
# Kubernetes
kubectl rollout undo deployment/my-app -n production
kubectl rollout status deployment/my-app -n production

# Helm
helm rollback my-release <revision> --wait --timeout 5m

# Argo Rollouts: abort an in-flight canary
kubectl argo rollouts abort my-app -n production

# Single host / Compose: redeploy the recorded previous tag (see deployment-patterns.md)
```

Verify health after every rollback with the same checks as a deploy.

### Schema changes and deploys

Never couple a destructive schema change to a code deploy. Sequence it: expand (additive, backward compatible) first, deploy code that works with both shapes, backfill, and contract (drop) in a later release once nothing reads the old shape. Expand/contract mechanics, backfills, and lock safety: `database`.

---

## Monorepo Release Workflow

### Turborepo with changesets

```json
// turbo.json (Turborepo 2.x uses "tasks")
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "publish": { "dependsOn": ["build"] }
  }
}
```

### Publish order and internal dependencies

```bash
npx changeset publish          # publishes in dependency order
pnpm -r publish --access public # pnpm recursive publish also orders topologically
```

```json
// packages/ui/package.json
{ "dependencies": { "@scope/utils": "workspace:^" } }
// workspace:^ is rewritten to ^<current version> at publish time
// workspace:* is rewritten to the exact current version; workspace:~ to ~<current version>
```

---

## Changelog Entries

This skill produces the entries: derive them from change notes (changeset files or conventional commits) and keep user-facing wording to what changed for the consumer, with breaking changes and migration steps called out. The writing quality of changelogs and migration guides: `documentation`.

---

## Release Checklist Template

```markdown
**Pre-release:** CI green, changelog accurate, version bump matches the contract change, breaking changes and deprecations documented, flags configured with owners and dates, schema changes follow expand/contract, dependency audit clean.
**Deploy:** staging and smoke tests, production through the chosen strategy, watch error rate and latency, verify key flows and integrations, rollback command ready.
**Post-release:** tag and publish notes, notify stakeholders, monitor, schedule flag cleanup, close issues.
```
