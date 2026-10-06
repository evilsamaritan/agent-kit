---
name: kubernetes
description: "Build or troubleshoot Kubernetes workloads. Use for manifests, Helm, Gateway API, operators, RBAC, autoscaling, networking, and cluster operations."
user-invocable: true
---

# Kubernetes — Orchestration & Cluster Management

Check the cluster's Kubernetes version and installed API versions (`kubectl version`, `kubectl api-resources`, CRDs) before writing manifests; feature availability and add-on API versions (Gateway API, operators) follow the cluster, not this skill.

## Hard Rules

- NEVER use `latest` image tag — pin tag + digest for deterministic deployments
- NEVER store secrets in plain manifests — use External Secrets Operator or Sealed Secrets
- ALWAYS set CPU and memory requests on every container, and a memory limit. CPU limits: omit unless the namespace needs them for quota, noisy-neighbour control, or Guaranteed QoS; CPU limits throttle bursts even when the node has idle CPU
- ALWAYS define a readiness probe; add a startup probe for slow starters. Liveness is optional and must not check dependencies (probe semantics: `reliability`)
- ALWAYS create PodDisruptionBudgets for production workloads
- ALWAYS prefer namespace-scoped Roles over ClusterRoles unless cross-namespace access is required
- ALWAYS enforce Pod Security Standards (`restricted` for production namespaces) and write manifests that pass it
- Use Gateway API for new external traffic. The Ingress API still works but is frozen, and the ingress-nginx controller is retired

---

## Resource Type Decision Tree

```
What are you deploying?
├── Stateless app (API, worker) → Deployment
├── Stateful (DB, ordered startup, stable IDs) → StatefulSet (or an operator)
├── Node-level agent (logging, monitoring) → DaemonSet
├── One-off or scheduled task → Job / CronJob
└── Batch workload → Job with completions + parallelism

How to expose it?
├── Internal only → Service (ClusterIP)
├── External HTTP/gRPC (new) → Gateway + HTTPRoute/GRPCRoute
├── External HTTP (existing Ingress) → keep, plan migration to Gateway API
└── StatefulSet DNS → Headless Service (clusterIP: None)

How to configure it?
├── Non-sensitive config → ConfigMap
├── Sensitive data → ExternalSecret (External Secrets Operator), mounted as files where possible
└── TLS certificates → cert-manager
```

---

## Minimal Production Deployment

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
      automountServiceAccountToken: false     # enable only if the app calls the API server
      securityContext:                        # pod level
        runAsNonRoot: true
        runAsUser: 10001
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: api
          image: registry.example.com/api:1.2.3@sha256:<digest>
          ports: [{ containerPort: 8080, name: http }]
          securityContext:                    # container level; required by `restricted`
            allowPrivilegeEscalation: false
            capabilities: { drop: ["ALL"] }
            readOnlyRootFilesystem: true      # recommended extra, not required by `restricted`
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { memory: 512Mi }
          readinessProbe:
            httpGet: { path: /readyz, port: http }
            periodSeconds: 5
          startupProbe:                       # holds off liveness/readiness checks while the app boots
            httpGet: { path: /readyz, port: http }
            failureThreshold: 30
            periodSeconds: 5
```

Probe mechanics here, semantics in `reliability`: the startup probe runs first and disables liveness until it succeeds; a failing readiness probe removes the pod from Service endpoints without a restart; a failing liveness probe restarts the container. Use separate `/livez` (process is not wedged, no dependency checks) and `/readyz` (can serve traffic) endpoints. Readiness must not fail because a shared downstream failed, or every replica leaves the Service at once. Graceful shutdown (`preStop`, `terminationGracePeriodSeconds`, native sidecars) and more manifests: [manifests-patterns.md](references/manifests-patterns.md).

---

## Traffic Routing

Gateway API separates roles (platform owns the Gateway, teams own Routes), supports HTTP, gRPC, TCP, TLS and UDP, and has native traffic splitting. Check the latest release and release channel supported by the chosen controller and the CRDs installed in the cluster.

```
Gateway controller?
├── No existing controller → pick any controller that passes the Gateway API conformance report for the version you need
├── Service mesh in use → the mesh's own gateway implementation
├── eBPF CNI in use → its integrated Gateway
└── Migrating from NGINX Ingress → a controller with an ingress2gateway provider, converted one service at a time
```

Gateway, HTTPRoute, GRPCRoute, BackendTLSPolicy, controller comparison, and migration steps: [operators-gateway.md](references/operators-gateway.md).

---

## RBAC Pattern

Least privilege: Role → RoleBinding → ServiceAccount, namespace-scoped.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { namespace: app, name: pod-reader }
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { namespace: app, name: read-pods }
subjects:
  - { kind: ServiceAccount, name: app-sa, namespace: app }
roleRef: { kind: Role, name: pod-reader, apiGroup: rbac.authorization.k8s.io }
```

Avoid wildcard verbs and resources, and bindings to `cluster-admin` for workloads. Check effective access with `kubectl auth can-i --list --as=system:serviceaccount:<ns>:<sa>`.

---

## Autoscaling Decision Tree

```
What needs scaling?
├── Pods, request/CPU-driven stateless → HPA (autoscaling/v2) with a scale-down stabilization window
├── Pods, event-driven or scale-to-zero → KEDA
├── Pod size (right-sizing requests) → VPA, in recommendation mode first (not on the same metric as HPA)
└── Nodes → the cloud's managed node autoscaler or Karpenter where a provider exists; Cluster Autoscaler otherwise
```

Metrics, behavior policies, KEDA triggers, and Karpenter configuration: [operators-gateway.md](references/operators-gateway.md).

---

## Network Policies

Policies are additive allow-lists, and they only take effect when the cluster's CNI enforces them. Start with a namespace-wide deny, then allow what is needed, including DNS egress:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: app }
spec:
  podSelector: {}                      # all pods in the namespace
  policyTypes: [Ingress, Egress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-api-to-db, namespace: app }
spec:
  podSelector: { matchLabels: { app: db } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector: { matchLabels: { app: api } }
      ports: [{ port: 5432 }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns-egress, namespace: app }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }
      ports: [{ port: 53, protocol: UDP }, { port: 53, protocol: TCP }]
```

Each workload that makes outbound calls then needs its own egress allow. L7 or FQDN rules need a CNI that provides them (for example Cilium). Mesh mTLS and policy: `networking`.

---

## Multi-Tenancy Decision Tree

```
Isolation requirement?
├── Soft (teams share cluster) → namespace per team + RBAC + ResourceQuota + NetworkPolicy
├── Medium (own control plane, CRDs) → virtual clusters
└── Hard (regulatory, full isolation) → separate clusters
```

---

## Debugging Toolkit

| Command | Purpose |
|---------|---------|
| `kubectl describe pod <name>` | Events, conditions, container status |
| `kubectl logs <pod> -c <container> --previous` | Logs of a crashed container |
| `kubectl debug <pod> --image=<debug-image>` | Ephemeral debug container (use for shell-less images) |
| `kubectl port-forward svc/<name> 8080:80` | Local access to a service |
| `kubectl get events --sort-by=.lastTimestamp` | Event timeline |
| `kubectl top pods` | Resource usage (needs metrics-server) |
| `kubectl rollout status` / `undo` | Rollout progress and rollback |

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| No resource requests | Bad scheduling, noisy neighbours, OOM kills | Requests everywhere, memory limit always |
| Blanket CPU limits | Throttling under bursts | Omit unless quota or QoS needs them |
| One endpoint for liveness and readiness, checking dependencies | A shared outage restarts or drains every pod | Separate `/livez` and `/readyz`; no dependency checks in liveness |
| Everything in the default namespace | No isolation | Namespace per team or environment |
| Secrets in plain manifests | In git and visible in etcd | External Secrets Operator or Sealed Secrets; encrypt etcd at rest |
| No default-deny NetworkPolicy | Any pod reaches any pod | Deny, then allow, on an enforcing CNI |
| `latest` tag | Non-deterministic rollouts | Pinned tag + digest |
| Manifests that fail `restricted` | Rejected at admission | Container securityContext as above |
| Sidecars in `containers[]` with lifecycle hacks | Ordering and shutdown races | Native sidecars (`initContainers` with `restartPolicy: Always`) |

---

## Context Adaptation

**Delivery:** Helm or Kustomize per environment, GitOps (Argo CD or Flux), rollout status checks in the pipeline (`ci-cd`).

**Operations:** PDBs, autoscaling, `ServiceMonitor`/`PodMonitor` for metrics (`observability`).

**Security:** least-privilege RBAC and ServiceAccounts, Pod Security Standards, default-deny networking, external secrets, etcd encryption.

---

## Related Knowledge

- **docker** — images consumed by workloads; shell-less images affect hooks and debugging
- **ci-cd** — pipelines deploying to clusters
- **release-engineering** — rollout strategy and rollback policy
- **networking** — DNS, TLS/mTLS, service mesh, load balancing
- **security** — RBAC hardening, supply chain
- **observability** — metrics, logs, tracing for cluster workloads
- **reliability** — probe semantics, graceful shutdown, SLOs

## References

- [manifests-patterns.md](references/manifests-patterns.md) — load for labels, shutdown and drain, native sidecars, Services, ConfigMaps and external secrets, Jobs, PDB, quotas, Pod Security Standards
- [helm-patterns.md](references/helm-patterns.md) — load for chart structure, values, helpers, hooks, tests, Helm 3 vs 4 commands
- [operators-gateway.md](references/operators-gateway.md) — load for Gateway API resources and Ingress migration, operators (adopting and writing), VPA/KEDA/HPA tuning, Karpenter, service mesh enrolment
