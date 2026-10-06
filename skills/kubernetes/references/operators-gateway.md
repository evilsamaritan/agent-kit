# Operators, Gateway API, Autoscaling & Service Mesh

Versions and API groups below follow the cluster: read them from the installed CRDs and the chosen controller's documentation.

## Table of Contents

- [Gateway API](#gateway-api)
- [Operators](#operators)
- [Advanced Autoscaling](#advanced-autoscaling)
- [Node Autoscaling](#node-autoscaling)
- [Service Mesh Enrolment](#service-mesh-enrolment)

---

## Gateway API

### Why Gateway API

Gateway API is the successor to Ingress. The ingress-nginx controller was retired and archived in March 2026: existing clusters keep running it, but it gets no CVE fixes. The Ingress API remains supported but frozen. Key advantages:

| Feature | Ingress | Gateway API |
|---------|---------|-------------|
| Protocol support | HTTP/HTTPS only | HTTP, gRPC, TCP, UDP, TLS |
| Role separation | Single resource | Gateway (platform) + Route (team) |
| Header matching | Annotation-dependent | Native |
| Traffic splitting | Not built-in | Native (canary, blue-green) |
| Extensibility | Annotations (vendor-specific) | Policy attachment (standardized) |
| Status | API frozen; ingress-nginx retired | GA core resources (TCPRoute and UDPRoute are v1 since Gateway API 1.6); check the release and channel your controller supports |

### Gateway + HTTPRoute

```yaml
# Platform team creates the Gateway
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
  namespace: infra
spec:
  gatewayClassName: <class-of-your-controller>
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: wildcard-tls
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels: { gateway-access: "true" }
    - name: http
      protocol: HTTP
      port: 80
---
# App team creates HTTPRoute in their namespace
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
  namespace: app
spec:
  parentRefs:
    - name: main-gateway
      namespace: infra
  hostnames: ["api.example.com"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /v2 }
      backendRefs:
        - name: api-v2
          port: 80
          weight: 90
        - name: api-v2-canary
          port: 80
          weight: 10
    - matches:
        - path: { type: PathPrefix, value: / }
      backendRefs:
        - name: api
          port: 80
```

### GRPCRoute (GA)

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GRPCRoute
metadata:
  name: grpc-route
spec:
  parentRefs:
    - name: main-gateway
  hostnames: ["grpc.example.com"]
  rules:
    - matches:
        - method:
            service: mypackage.MyService
            method: GetItem
      backendRefs:
        - name: grpc-service
          port: 50051
```

### BackendTLSPolicy

Verifies backend TLS certificates (gateway-to-service encryption). It is GA in the standard channel since Gateway API 1.4 and served as `gateway.networking.k8s.io/v1` (the older `v1alpha3` is not served by the standard CRD). Check the versions your installed CRD serves (`kubectl get crd backendtlspolicies.gateway.networking.k8s.io -o jsonpath='{.spec.versions[*].name}'`) and confirm your controller implements it.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: BackendTLSPolicy
metadata:
  name: api-backend-tls
spec:
  targetRefs:
    - group: ""
      kind: Service
      name: api
  validation:
    caCertificateRefs:
      - name: ca-cert
        group: ""
        kind: ConfigMap
    hostname: api.internal.example.com
```

### Certificates with cert-manager

Issue Gateway certificates with cert-manager's Gateway API support (annotate the Gateway with an issuer, or reference a `Certificate` secret from the listener). For ACME HTTP-01, use a Gateway API solver (`gatewayHTTPRoute` with `parentRefs` to the Gateway) or a controller-neutral `ingressClassName` on the issuer, not a controller-specific annotation; use DNS-01 for wildcard certificates. Traffic splitting uses HTTPRoute `backendRefs` weights as shown above, not controller-specific canary annotations. Check the installed cert-manager version for Gateway API enablement.

### Migration from Ingress

```bash
# Automated conversion tool
ingress2gateway print --providers=ingress-nginx --namespace=production   # one namespace
ingress2gateway print --providers=ingress-nginx --all-namespaces         # every namespace

# Strategy (the ingress2gateway tool covers a subset of controller-specific annotations; review the output):
# 1. Install Gateway API CRDs + controller alongside existing Ingress
# 2. Convert one service at a time using ingress2gateway
# 3. Test with split traffic (both Ingress and HTTPRoute active)
# 4. Remove Ingress resources after validation
```

### Gateway Controller Selection

| Controller | Strengths |
|-----------|-----------|
| Envoy Gateway | Conformance-tested; check the conformance report for your Gateway API version |
| Istio | Service mesh integration, mTLS, Ambient mode |
| Cilium | eBPF-based, high performance, integrated CNI + Gateway |
| Traefik | Middleware ecosystem, simple config |
| NGINX Gateway Fabric | Familiar NGINX, transitioning from Ingress |

---

## Operators

### When to Use Operators vs Helm

| Criteria | Helm | Operator |
|----------|------|----------|
| Install/upgrade | Yes | Yes |
| Day-2 operations (backup, failover, scaling) | No | Yes |
| Continuous reconciliation | No | Yes (control loop) |
| Custom resources for config | No | Yes (CRDs) |
| Complexity | Low | High |

Use Helm for stateless apps. Use an operator for stateful workloads that need lifecycle automation (databases, brokers, monitoring stacks).

### Adopting an operator

- Pick maintained, widely used operators; check release cadence and the supported Kubernetes versions.
- Install CRDs and the operator through your normal delivery path (Helm or GitOps); pin versions and review CRD changes on upgrade, since Helm does not upgrade CRDs in `crds/`.
- Grant the operator least-privilege RBAC, and sign or verify its image.
- Test backup and restore of what it manages before relying on it.

### Writing an operator

Write one only when a stateful workload needs domain-specific day-2 automation that Helm and plain controllers cannot express. Use a framework (controller-runtime, Kubebuilder, Operator SDK, or a Java/Python equivalent) rather than raw API calls.

- **Reconcile is level-triggered and idempotent.** Read desired state (spec) and observed state, converge, return. Never rely on having seen a specific event; running the same reconcile twice must be harmless.
- **Keep reconciles small.** One concern per controller; requeue with backoff on transient errors instead of looping inside a call.
- **Watch, do not poll.** Use informers or watches with a shared cache, owner references so child objects trigger the parent, and event filters to skip no-op updates.
- **Leader election** for HA replicas: one active reconciler, others standby.
- **Report status.** Write `.status.conditions` (type, status, reason, message) and `observedGeneration` so users and tooling can tell whether the controller has seen the latest spec. Never write status into spec.
- **Finalizers** for cleanup of external resources; remove the finalizer only after cleanup succeeds. Owner references cover in-cluster children.
- **Least-privilege RBAC** generated from the controller's actual calls; no cluster-admin.
- **CRD versioning.** Serve multiple versions with one storage version and a conversion strategy; validate with OpenAPI schema and CEL rules; add defaulting server-side rather than in the controller where possible.
- **Test with a real API server** (envtest-style) for reconcile logic, plus an upgrade test for CRD and operator version changes.

---

## Advanced Autoscaling

### VPA (Vertical Pod Autoscaler)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  updatePolicy:
    updateMode: "Recreate"  # Off | Initial | Recreate | InPlaceOrRecreate | Auto
  resourcePolicy:
    containerPolicies:
      - containerName: api
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: "2"
          memory: 2Gi
        controlledResources: ["cpu", "memory"]
```

**VPA rules:**
- Install separately (not part of core Kubernetes)
- Do NOT use VPA + HPA on the same metric (conflicts)
- Use `updateMode: "Off"` to get recommendations without auto-applying
- `Recreate` evicts pods to apply new resource values (use a PDB for safety); `InPlaceOrRecreate` tries an in-place resize first and falls back to eviction (VPA 1.6+, Kubernetes 1.33+)

### KEDA (Event-Driven Autoscaler)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaler
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 0    # Scale to zero when idle
  maxReplicaCount: 50
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        consumerGroup: worker-group
        topic: tasks
        lagThreshold: "10"
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        query: sum(rate(http_requests_total{service="api"}[2m]))
        threshold: "100"
```

**KEDA features:**
- Scale to/from zero (unlike HPA which requires minReplicas >= 1)
- Many built-in scalers (Kafka, SQS, RabbitMQ, Prometheus, Cron, and more)
- Compatible with HPA -- KEDA creates HPA resources internally
- Supports `ScaledJob` for batch workloads
- OpenTelemetry integration for autoscaling observability

### Autoscaling Decision Guide

```
Workload type?
├── Stateless API → HPA (CPU/memory) + VPA in recommendation mode
├── Queue consumer → KEDA (queue depth trigger, scale-to-zero)
├── Scheduled batch → KEDA (Cron trigger) or CronJob
├── Database / stateful → VPA only (vertical scaling safer than horizontal)
└── Nodes → see Node Autoscaling below (managed autoscaler, Karpenter where a provider exists, or Cluster Autoscaler)
```

### HPA with Custom Metrics

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
```

---

## Node Autoscaling

```
Node autoscaler?
├── Managed offering from the cloud (node auto-provisioning, autopilot modes) → prefer it
├── A Karpenter provider exists for your cloud → Karpenter
└── Otherwise → Cluster Autoscaler on node groups
```

Karpenter (`karpenter.sh/v1` API, developed under `kubernetes-sigs`) provisions right-sized nodes directly instead of scaling fixed node groups, and offers consolidation, drift detection, and spot/on-demand mixes. Its README lists provider implementations for AWS, Azure, GCP, and a dozen other clouds; maturity and maintainers differ per provider, so read the provider's own documentation before relying on it. `consolidationPolicy` accepts `WhenEmpty`, `WhenEmptyOrUnderutilized`, and `Balanced`. Cluster Autoscaler stays simpler for static, predictable workloads and for environments that require strict node-group boundaries.

The example is AWS-specific (`NodePool` is generic; `EC2NodeClass` is the AWS provider's node class).

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand", "spot"]
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64", "arm64"]
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
  limits:
    cpu: "100"
    memory: 400Gi
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 30s
---
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: default
spec:
  amiSelectorTerms:
    - alias: al2023@v20250101      # pin an AMI release; roll it forward deliberately (avoid @latest)
  subnetSelectorTerms:
    - tags: { karpenter.sh/discovery: my-cluster }
  securityGroupSelectorTerms:
    - tags: { karpenter.sh/discovery: my-cluster }
  role: KarpenterNodeRole
```

Pinning the AMI alias makes node image changes a reviewed change; `@latest` rolls nodes through drift whenever a new image appears. Set PDBs so consolidation and drift replacement respect availability.

---

## Service Mesh Enrolment

Mesh concepts, mTLS, and the choice of mesh: `networking`. Kubernetes-side detail for Istio ambient mode, which uses a per-node `ztunnel` for L4 identity and mTLS and optional waypoint proxies for L7 policy, without per-pod sidecars:

```bash
# Enrol a namespace in the ambient mesh (no pod restarts, no injection)
kubectl label namespace app istio.io/dataplane-mode=ambient

# Add L7 processing for a namespace only where needed
istioctl waypoint apply -n app --enroll-namespace
```

Apply authorization policies after enrolment, and keep NetworkPolicies as the baseline since mesh policy does not replace them for non-mesh traffic. Sidecar mode remains available when custom proxy filters are needed.
