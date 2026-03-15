---
name: kubernetes
description: Kubernetes expertise — manifests, Helm charts, Gateway API, operators, RBAC, HPA/VPA/KEDA, Karpenter, native sidecars, debugging. Use when working with K8s manifests, Helm, Gateway API, RBAC, autoscaling, network policies, or cluster debugging. Do NOT use for container building (use docker) or CI/CD (use devops).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Kubernetes — Orchestration & Cluster Management

## Hard Rules

- NEVER use `latest` image tag -- pin tag + digest for deterministic deployments
- NEVER store secrets in plain manifests -- use External Secrets Operator or Sealed Secrets
- ALWAYS set resource requests AND memory limits on every container
- ALWAYS add readiness + liveness probes (startup probe when init > 10s)
- ALWAYS create PodDisruptionBudgets for production workloads
- ALWAYS use namespace-scoped Roles over ClusterRoles unless cross-namespace access is required
- ALWAYS apply Pod Security Standards (`restricted` profile for production namespaces)
- Use Gateway API for new projects -- Ingress NGINX retiring March 2026
- Omit CPU limits on HPA-managed workloads -- let HPA handle horizontal scaling

---

## Resource Type Decision Tree

```
What are you deploying?
├── Stateless app (API, worker) → Deployment
├── Stateful (DB, ordered startup, stable IDs) → StatefulSet
├── Node-level agent (logging, monitoring) → DaemonSet
├── One-off or scheduled task → Job / CronJob
└── Batch ML/AI workload → Job with completions + parallelism

How to expose it?
├── Internal only → Service (ClusterIP)
├── External HTTP/gRPC (new) → Gateway + HTTPRoute/GRPCRoute
├── External HTTP (legacy) → Ingress (migrate to Gateway API)
└── StatefulSet DNS → Headless Service (clusterIP: None)

How to configure it?
├── Non-sensitive config → ConfigMap
├── Sensitive data → ExternalSecret (External Secrets Operator)
└── TLS certificates → cert-manager
```

---

## Resource Manifests Quick Reference

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app.kubernetes.io/name: api
spec:
  replicas: 3
  selector:
    matchLabels: { app.kubernetes.io/name: api }
  template:
    metadata:
      labels: { app.kubernetes.io/name: api }
    spec:
      serviceAccountName: api-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
        - name: api
          image: registry.example.com/api:1.2.3@sha256:abc123
          ports: [{ containerPort: 8080, name: http }]
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { memory: 512Mi }  # CPU limit omitted — HPA handles scaling
          readinessProbe:
            httpGet: { path: /healthz, port: http }
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /healthz, port: http }
            periodSeconds: 10
          startupProbe:
            httpGet: { path: /healthz, port: http }
            failureThreshold: 30
            periodSeconds: 5
```

### Native Sidecar Containers (K8s 1.33+ GA)

Use `initContainers` with `restartPolicy: Always` for sidecars that must start before and outlive the main container (log shippers, proxy agents, vault injectors):

```yaml
initContainers:
  - name: log-shipper
    image: fluent-bit:3.2
    restartPolicy: Always  # Runs alongside main container
    resources:
      requests: { cpu: 50m, memory: 64Mi }
      limits: { memory: 128Mi }
```

Native sidecars start before regular containers, survive restarts, and shut down after main containers exit. Replaces the old workaround of putting sidecars in `containers[]` with lifecycle hacks.

---

## Traffic Routing: Gateway API

Gateway API is the production standard for L4/L7 traffic routing (successor to Ingress, GA since v1.0, current v1.4).

```yaml
# Gateway API HTTPRoute (preferred)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
spec:
  parentRefs:
    - name: main-gateway
  hostnames: ["api.example.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: / }
      backendRefs:
        - name: api
          port: 80
```

Key advantages over Ingress: role-oriented (platform owns Gateway, teams own Routes), multi-protocol (HTTP, gRPC, TCP, UDP), native traffic splitting for canary/blue-green, standardized policy attachment. GRPCRoute also GA.

### Gateway Controller Selection

If no existing controller: Envoy Gateway (reference implementation).
If service mesh needed: Istio (with Ambient mode for sidecarless mTLS).
If eBPF networking: Cilium (high performance, integrated CNI + Gateway).
If migrating from NGINX: NGINX Gateway Fabric.
If middleware-heavy: Traefik.

---

## RBAC Pattern

```yaml
# Least-privilege: Role → RoleBinding → ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: app
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  namespace: app
  name: read-pods
subjects:
  - kind: ServiceAccount
    name: app-sa
    namespace: app
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

Role = namespace-scoped. ClusterRole = cluster-wide. Prefer Role unless cross-namespace access is needed.

---

## Autoscaling Decision Tree

```
What needs scaling?
├── Pods (horizontal) — request/CPU-driven stateless
│   └── HPA (autoscaling/v2, stabilizationWindowSeconds: 300)
├── Pods (horizontal) — event-driven, scale-to-zero
│   └── KEDA (CNCF graduated, 70+ scalers: Kafka, SQS, Prometheus, Cron)
├── Pod resources (vertical) — right-sizing requests/limits
│   └── VPA (do NOT combine with HPA on the same metric)
└── Nodes — provision/deprovision compute
    └── Karpenter (GA v1.0+, replaces Cluster Autoscaler)
        Provisions right-sized nodes in seconds, bin-packs efficiently,
        supports spot/on-demand mix, consolidation, drift detection
```

---

## Network Policies

```yaml
# Default deny all ingress, then allow specific traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
spec:
  podSelector:
    matchLabels: { app: db }
  ingress:
    - from:
        - podSelector: { matchLabels: { app: api } }
      ports:
        - port: 5432
```

For advanced network policies (L7 filtering, DNS-aware, FQDN egress), use Cilium NetworkPolicy CRDs.

---

## Multi-Tenancy Decision Tree

```
Isolation requirement?
├── Soft (teams share cluster, cost-efficient)
│   └── Namespace per team + RBAC + ResourceQuota + NetworkPolicy
├── Medium (teams need own control plane, CRDs)
│   └── vCluster (virtual clusters — own API server, shared nodes)
└── Hard (regulatory, full isolation)
    └── Separate physical clusters
```

---

## Debugging Toolkit

| Command | Purpose |
|---------|---------|
| `kubectl describe pod <name>` | Events, conditions, container status |
| `kubectl logs <pod> -c <container> --previous` | Logs (including crashed containers) |
| `kubectl debug <pod> --image=busybox` | Ephemeral debug container |
| `kubectl port-forward svc/<name> 8080:80` | Local access to cluster service |
| `kubectl get events --sort-by=.lastTimestamp` | Cluster events timeline |
| `kubectl top pods` | Resource usage (requires metrics-server) |
| `kubectl auth can-i --list --as=system:serviceaccount:ns:sa` | RBAC permission check |

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| No resource requests/limits | Noisy neighbor, OOM kills | Set requests + memory limits always |
| Everything in default namespace | No isolation, RBAC nightmare | Namespace per team/environment |
| Secrets in plain manifests | Committed to git, visible in etcd | External Secrets Operator, Sealed Secrets |
| No network policies | Any pod can reach any pod | Default deny + explicit allow |
| `latest` image tag | Non-deterministic deployments | Pinned tag + digest |
| No probes | Traffic to unhealthy pods | readiness + liveness + startup probes |
| New projects using Ingress | Ingress NGINX retiring March 2026 | Gateway API for greenfield |
| CPU limits on HPA workloads | Throttling under load, HPA conflicts | Omit CPU limits, let HPA scale horizontally |
| Sidecar in `containers[]` with lifecycle hacks | Fragile ordering, shutdown races | Native sidecar (`initContainers` + `restartPolicy: Always`) |
| Cluster Autoscaler for dynamic workloads | Slow provisioning, poor bin-packing | Karpenter (seconds vs minutes, right-sized nodes) |

---

## Context Adaptation

### DevOps
- Manifest management: Helm charts, Kustomize overlays, GitOps (Argo CD, Flux)
- CI/CD integration: image build, push, deploy, rollout status checks
- Multi-environment: namespace-per-env, overlay-per-env, promotion pipelines

### SRE
- Pod health: liveness/readiness/startup probes, PodDisruptionBudget
- Autoscaling: HPA for request-driven, KEDA for event-driven, VPA for right-sizing, Karpenter for nodes
- Observability: ServiceMonitor, PodMonitor, OpenTelemetry Collector DaemonSet

### Security
- RBAC: least-privilege ServiceAccounts, namespace-scoped Roles
- Network Policies: default-deny ingress, explicit allow rules (Cilium for L7)
- Pod Security Standards: `restricted` profile, seccomp, AppArmor
- Secrets: External Secrets Operator, Sealed Secrets -- never plain manifests in git
- Service mesh: Istio Ambient mode for sidecarless mTLS (ztunnel per node, waypoint proxies for L7)

---

## Related Knowledge

- **docker** -- build container images consumed by Kubernetes workloads
- **devops** -- CI/CD pipelines deploying to clusters, GitOps workflows
- **networking** -- DNS, TLS/mTLS, service mesh, load balancing
- **security** -- RBAC hardening, pod security standards, supply chain
- **observability** -- distributed tracing, metrics, logging for cluster workloads
- **sre** -- SLOs, PDBs, incident response for cluster reliability

## References

- [manifests-patterns.md](references/manifests-patterns.md) -- Detailed manifest patterns, labeling, production configurations, Pod Security Standards
- [helm-patterns.md](references/helm-patterns.md) -- Chart structure, templating, values organization, hooks, testing
- [operators-gateway.md](references/operators-gateway.md) -- Operator patterns, Gateway API migration, advanced autoscaling (VPA/KEDA/Karpenter), service mesh

Load references when you need detailed manifest templates, Helm chart guidance, Gateway API migration steps, or Karpenter/service mesh configuration.
