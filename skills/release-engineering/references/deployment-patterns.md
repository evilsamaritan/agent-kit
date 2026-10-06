# Deployment Patterns

Implementation of the deploy strategies chosen in SKILL.md (strategy tree, strategy table, rollback table). This file keeps strategy mechanics, single-host deploys, preview environments, and failure modes. Everything else points to the skill that owns it.

## Contents

- [Strategy Implementation](#strategy-implementation)
- [Single-Host Deployment](#single-host-deployment)
- [Orchestrated and Serverless Deployment](#orchestrated-and-serverless-deployment)
- [Preview Environments](#preview-environments)
- [Owned Elsewhere](#owned-elsewhere)
- [Common Deployment Failures](#common-deployment-failures)

---

## Strategy Implementation

### Rolling update

Replace instances gradually, gated by readiness. In Kubernetes: `strategy.type: RollingUpdate` with `maxUnavailable` and `maxSurge`, plus a readiness probe and a PodDisruptionBudget ([kubernetes](../../kubernetes/SKILL.md)). Roll back with `kubectl rollout undo`.

### Canary with Argo Rollouts

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: my-app-canary
      stableService: my-app-stable
      # Without trafficRouting, weights are approximated by replica counts.
      # For exact percentages, configure trafficRouting for your ingress, Gateway API, or mesh provider.
      steps:
        - setWeight: 5
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: error-rate     # abort and roll back when the metric breaches
        - setWeight: 25
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 10m }
```

The analysis template queries your metrics backend (error rate, latency, business metric per version); the rollout aborts automatically on a breach. Any controller with weighted routing and metric gates works the same way. A plain `Deployment` plus a weighted `HTTPRoute` is a manual canary.

### Blue-green

```
1. Deploy the new version to the idle environment (green)
2. Run smoke tests against green
3. Switch traffic (load balancer target group, DNS, route weight)
4. Watch error rate and latency for a fixed window
5. On errors: switch back to blue (instant rollback)
6. When stable: keep blue until the window closes, then reuse it for the next release
```

The routing mechanism varies; the pattern does not. Both environments share the database, so schema changes must be compatible with both versions (expand/contract: `database`).

### Flag-based release

Deploy the code dark, then raise exposure by percentage with a flag (see SKILL.md). Rollback is the flag, not a deploy.

---

## Single-Host Deployment

Deploy an immutable image tag, record the running tag, verify health, and roll back to the recorded tag on failure. Exit codes distinguish outcomes: 0 success, 10 deploy failed and rolled back, 20 deploy failed and rollback failed or impossible.

```bash
#!/usr/bin/env bash
set -euo pipefail
NEW_TAG="${1:?Usage: deploy.sh <tag>}"

ssh deploy@server bash -s -- "$NEW_TAG" <<'REMOTE'
set -uo pipefail
cd /opt/app
NEW_TAG="$1"
PREV_TAG="$(cat .current_tag 2>/dev/null || true)"

health() { for _ in $(seq 1 20); do curl -fsS http://localhost:3000/readyz >/dev/null && return 0; sleep 3; done; return 1; }
up()     { TAG="$1" docker compose pull && TAG="$1" docker compose up -d --remove-orphans; }

if up "$NEW_TAG" && health; then echo "$NEW_TAG" > .current_tag; exit 0; fi
echo "deploy of $NEW_TAG failed" >&2

[ -n "$PREV_TAG" ] || exit 20                      # nothing to roll back to
if up "$PREV_TAG" && health; then echo "rolled back to $PREV_TAG" >&2; exit 10; fi
exit 20
REMOTE
```

Compose references `image: registry.example.com/app:${TAG}`. Keep several previous tags available in the registry. Proxy, TLS, host hardening, and Compose details: see [Owned Elsewhere](#owned-elsewhere).

---

## Orchestrated and Serverless Deployment

Orchestrators (Kubernetes, Nomad, ECS, Cloud Run) share the principles: immutable tags or digests, health gating, resource limits, and rollback to a previous revision. Kubernetes specifics: `kubernetes`.

Serverless platforms: publish an immutable version of the function, shift traffic between versions or aliases with weights (that is the canary), and use provisioned or minimum capacity where cold starts hurt. Roll back by pointing the alias at the previous version. Trade-off: simpler operations, less runtime control, tighter platform coupling.

---

## Preview Environments

Short-lived, isolated deployments per pull request or branch, destroyed on merge or close.

| Approach | Complexity | Best for |
|----------|-----------|----------|
| Compose with dynamic ports | Low | Single server, small teams |
| Kubernetes namespace per PR | Medium | Teams already on Kubernetes |
| Managed platform previews | Low | Frontend-only |
| Per-PR infrastructure | High | Full-stack with provisioned infra |

```
PR opened  → provision environment → run tests → post URL to the PR
PR updated → update environment → re-run tests
PR merged or closed → destroy environment and clean up
```

Cost control: a TTL (destroy after idle days), shared databases with per-PR schemas instead of per-PR databases, and scale to zero when idle. Never copy production data into previews without masking.

---

## Owned Elsewhere

| Topic | Where |
|-------|-------|
| Reverse proxies, TLS certificates and renewal, load balancers, CDN | `networking` |
| Security headers | `web` (mechanics), `security` (policy) |
| Server hardening (SSH, firewall, updates), policy-as-code, admission policy, secrets | `security` |
| Compose files, log rotation settings, container runtime flags | `docker` |
| GitOps controllers (Argo CD, Flux), Kustomize and Helm | `kubernetes` |
| Pipelines and approval gates | `ci-cd` |
| Cost controls beyond preview TTLs | no dedicated skill; keep environment TTLs and right-sizing review in the pipeline |

Infrastructure as code and GitOps follow one rule: the desired state lives in version control, changes go through review, and drift is detected and reconciled instead of fixed by hand. There is no infrastructure-as-code skill in this kit.

---

## Common Deployment Failures

| Failure | Cause | Prevention |
|---------|-------|------------|
| Restart mid-transaction | No graceful shutdown | Drain connections (`reliability`) |
| Broken version stays live | No health gate | Verify readiness before marking the deploy successful |
| Rollback restarts the same version | Previous tag not recorded | Store the running tag before deploying |
| `latest` in production | Cannot roll back or audit | Immutable tags or digests |
| Secrets in image layers | `.env` copied at build | Runtime injection, `.dockerignore` |
| Concurrent migrations | Several instances migrate on start | Single migration job or lock (`database`) |
| Config drift | Manual edits diverge from source | Reconcile from version control, no manual edits |
| Certificate expiry | Renewal not monitored | Automatic renewal plus expiry alerts (`networking`) |
