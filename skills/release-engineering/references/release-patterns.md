# Release Engineering Patterns & Implementation Guide

Detailed patterns for versioning, deployment, feature flags, and release workflows.

## Contents

- [Changesets Setup](#changesets-setup)
- [Conventional Commits Configuration](#conventional-commits-configuration)
- [Feature Flag Implementation](#feature-flag-implementation)
- [Deployment Strategy Implementation](#deployment-strategy-implementation)
- [Rollback Procedures](#rollback-procedures)
- [Monorepo Release Workflow](#monorepo-release-workflow)
- [Release Checklist Template](#release-checklist-template)

---

## Changesets Setup

### Installation and configuration

```bash
npm install -D @changesets/cli @changesets/changelog-github
npx changeset init
```

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
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

### GitHub Actions workflow

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: npx changeset publish
          version: npx changeset version
          commit: 'chore: version packages'
          title: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Changeset file format

```markdown
<!-- .changeset/happy-tiger.md -->
---
"@scope/package-a": minor
"@scope/package-b": patch
---

Add new authentication flow with OAuth2 PKCE support.

Users can now authenticate using PKCE flow for public clients.
```

---

## Conventional Commits Configuration

### Commitlint setup

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
    'body-max-line-length': [2, 'always', 100],
  },
};
```

### release-please setup

```yaml
# .github/workflows/release-please.yml
name: Release Please
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          release-type: node
          changelog-types: |
            [
              { "type": "feat",     "section": "Features" },
              { "type": "fix",      "section": "Bug Fixes" },
              { "type": "perf",     "section": "Performance" },
              { "type": "refactor", "section": "Code Refactoring" },
              { "type": "docs",     "section": "Documentation", "hidden": true },
              { "type": "chore",    "section": "Miscellaneous", "hidden": true }
            ]
```

### semantic-release setup

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

### Feature flag provider (framework-agnostic pattern)

```ts
// Feature flag evaluation — applies to any framework (React context, Vue provide/inject, server middleware)
interface FlagConfig {
  enabled: boolean;
  percentage?: number;       // 0-100 for gradual rollout
  allowlist?: string[];      // user IDs always enabled
  blocklist?: string[];      // user IDs always disabled
  expiresAt?: Date;          // auto-disable after date
}

class FeatureFlags {
  private flags: Map<string, FlagConfig>;

  constructor(config: Record<string, FlagConfig>) {
    this.flags = new Map(Object.entries(config));
  }

  isEnabled(name: string, userId?: string): boolean {
    const flag = this.flags.get(name);
    if (!flag || !flag.enabled) return false;
    if (flag.expiresAt && new Date() > flag.expiresAt) return false;
    if (userId && flag.blocklist?.includes(userId)) return false;
    if (userId && flag.allowlist?.includes(userId)) return true;
    if (flag.percentage !== undefined && userId) {
      const hash = this.hashUserId(userId, name);
      return (hash % 100) < flag.percentage;
    }
    return true;
  }

  private hashUserId(userId: string, flagName: string): number {
    const str = `${userId}:${flagName}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
```

### Feature flag cleanup tracking

```ts
// flag-registry.ts — track flag lifecycle
const FLAG_REGISTRY = {
  'new-checkout': {
    owner: 'team-payments',
    createdAt: '2026-01-15',
    cleanupBy: '2026-04-15',  // 3-month max lifetime
    jiraTicket: 'PAY-456',
    status: 'rollout',        // draft | testing | rollout | ga | deprecated
  },
} as const;

// CI check: fail build if any flag is past cleanupBy date
function auditFlags() {
  const now = new Date();
  const expired = Object.entries(FLAG_REGISTRY)
    .filter(([_, config]) => new Date(config.cleanupBy) < now && config.status !== 'deprecated');

  if (expired.length > 0) {
    console.error('Feature flags past cleanup deadline:', expired.map(([name]) => name));
    process.exit(1);
  }
}
```

---

## Deployment Strategy Implementation

### Kubernetes canary with Argo Rollouts

```yaml
# rollout.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5      # 5% traffic to canary
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: error-rate
        - setWeight: 25
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 10m }
        - setWeight: 100
      canaryService: my-app-canary
      stableService: my-app-stable
```

### Blue-green deployment flow

```
1. Deploy new version to green environment
2. Run smoke tests against green
3. Switch traffic routing to green (load balancer, DNS, ingress)
4. Monitor error rates for 5 minutes
5. If errors: switch back to blue (instant rollback)
6. If stable: drain blue, prepare for next release
```

Works with any load balancer (ALB, nginx, Kubernetes ingress, Cloudflare). The pattern is the same — only the routing mechanism changes.

---

## Rollback Procedures

### Automated rollback script

```bash
#!/bin/bash
# rollback.sh — revert to last known good version
set -euo pipefail

LAST_GOOD_TAG=$(git describe --tags --abbrev=0 HEAD~1)
echo "Rolling back to ${LAST_GOOD_TAG}"

# Option 1: Redeploy previous version
git checkout "${LAST_GOOD_TAG}"
npm ci && npm run build
npm run deploy

# Option 2: Kubernetes rollback
# kubectl rollout undo deployment/my-app -n production

# Option 3: Argo Rollouts abort
# kubectl argo rollouts abort my-app -n production
```

### Database migration rollback

```ts
// migrations/20260115_add_user_status.ts
export async function up(db: Database) {
  // Step 1: Add new column (backward compatible)
  await db.schema.alterTable('users', table => {
    table.string('status').defaultTo('active');
  });
}

export async function down(db: Database) {
  // Rollback: remove column
  await db.schema.alterTable('users', table => {
    table.dropColumn('status');
  });
}

// RULE: Deploy migration BEFORE code that uses new column
// RULE: Drop column AFTER code no longer references it (separate release)
// Timeline:
//   Release N:   Run migration (add column)
//   Release N+1: Code starts using column
//   Release N+2: Code stops using old pattern
//   Release N+3: Drop old column (if needed)
```

---

## Monorepo Release Workflow

### Turborepo + Changesets

```json
// turbo.json (Turborepo v2+ uses "tasks", not "pipeline")
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "version": {
      "dependsOn": ["build"]
    },
    "publish": {
      "dependsOn": ["build", "version"]
    }
  }
}
```

### pnpm workspace publish order

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```bash
# Publish in dependency order
pnpm -r --filter './packages/**' publish --access public

# Or with changesets (handles ordering automatically)
npx changeset publish
```

### Internal dependency versioning

```json
// packages/ui/package.json
{
  "name": "@scope/ui",
  "version": "2.1.0",
  "dependencies": {
    "@scope/utils": "workspace:^"
  }
}
// "workspace:^" → resolved to "^1.3.0" at publish time
// "workspace:*" → resolved to "1.3.0" (exact)
// "workspace:~" → resolved to "~1.3.0" (patch range)
```

---

## Release Checklist Template

```markdown
**Pre-release:** CI green, changelog accurate, semver correct, breaking changes documented, flags configured, DB migrations tested (up + down), dependency audit clean, bundle size checked.
**Deploy:** Staging + smoke tests, production (canary if available), monitor error rates 15min, verify key flows, check integrations.
**Post-release:** Tag release, publish changelog, notify stakeholders, monitor 24h, schedule flag cleanup, close issues.
```
