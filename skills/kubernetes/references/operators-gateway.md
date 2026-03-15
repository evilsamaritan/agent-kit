# Operators, Gateway API, Autoscaling & Service Mesh

## Table of Contents

- [Gateway API](#gateway-api)
- [Operators](#operators)
- [Advanced Autoscaling](#advanced-autoscaling)
- [Karpenter Node Autoscaling](#karpenter-node-autoscaling)
- [Service Mesh: Istio Ambient Mode](#service-mesh-istio-ambient-mode)

---

## Gateway API

### Why Gateway API

Gateway API is the successor to Ingress. Ingress NGINX is retiring (best-effort only from March 2026, archived after). Key advantages:

| Feature | Ingress | Gateway API |
|---------|---------|-------------|
| Protocol support | HTTP/HTTPS only | HTTP, gRPC, TCP, UDP, TLS |
| Role separation | Single resource | Gateway (platform) + Route (team) |
| Header matching | Annotation-dependent | Native |
| Traffic splitting | Not built-in | Native (canary, blue-green) |
| Extensibility | Annotations (vendor-specific) | Policy attachment (standardized) |
| Status | Retiring March 2026 | GA v1.4+ (production standard) |

### Gateway + HTTPRoute

```yaml
# Platform team creates the Gateway
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
  namespace: infra
spec:
  gatewayClassName: envoy  # or istio, nginx, traefik, cilium
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

```yaml
# Verify backend TLS certificates (service-to-service encryption)
apiVersion: gateway.networking.k8s.io/v1alpha3
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

### Migration from Ingress

```bash
# Automated conversion tool
ingress2gateway print --providers=ingress-nginx \
  --namespace=production \
  --all-namespaces

# Strategy:
# 1. Install Gateway API CRDs + controller alongside existing Ingress
# 2. Convert one service at a time using ingress2gateway
# 3. Test with split traffic (both Ingress and HTTPRoute active)
# 4. Remove Ingress resources after validation
```

### Gateway Controller Selection

| Controller | Strengths |
|-----------|-----------|
| Envoy Gateway | Reference implementation, full GA conformance |
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
| Day-2 operations (backup, scaling) | No | Yes |
| Self-healing / reconciliation | No | Yes (control loop) |
| Custom resources for config | No | Yes (CRDs) |
| Complexity | Low | High |

Use Helm for stateless apps. Use operators for stateful workloads needing lifecycle automation (databases, message queues, monitoring stacks).

### Operator Pattern

```yaml
# Custom Resource Definition
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.example.com
spec:
  group: example.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine: { type: string, enum: [postgres, mysql] }
                version: { type: string }
                replicas: { type: integer, minimum: 1 }
                storage: { type: string }
  scope: Namespaced
  names:
    plural: databases
    singular: database
    kind: Database
    shortNames: [db]
---
# Custom Resource instance
apiVersion: example.com/v1
kind: Database
metadata:
  name: app-db
spec:
  engine: postgres
  version: "17"
  replicas: 3
  storage: 100Gi
```

### Operator Best Practices

- One operator per application -- do not bundle unrelated apps
- Reconcile small, atomic changes -- avoid large updates that risk inconsistencies
- Use Kubernetes Informers -- not high-frequency polling of the API server
- Leader election -- required for HA deployments (only one active reconciler)
- Least-privilege RBAC -- only the verbs and resources the operator actually needs
- Sign operator images -- use Sigstore/cosign for supply chain integrity
- Status conditions -- report reconciliation state via `.status.conditions`

### Production Operators

| Operator | Manages |
|----------|---------|
| CloudNativePG | PostgreSQL clusters |
| Strimzi | Apache Kafka |
| Prometheus Operator | Monitoring stack |
| cert-manager | TLS certificates |
| External Secrets Operator | Secret synchronization |
| Crossplane | Infrastructure as CRDs |

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
    updateMode: "Auto"  # Off | Initial | Auto
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
- VPA restarts pods to apply new resource values (use PDB for safety)

### KEDA (Event-Driven Autoscaler, CNCF Graduated)

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
- 70+ built-in scalers (Kafka, SQS, RabbitMQ, Prometheus, Cron, etc.)
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
└── Nodes → Karpenter (see below)
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

## Karpenter Node Autoscaling

Karpenter (GA v1.0+, CNCF incubating) replaces Cluster Autoscaler for node provisioning. Provisions right-sized nodes in seconds (vs minutes for Cluster Autoscaler), supports spot/on-demand mix, consolidation, and drift detection.

### NodePool + EC2NodeClass

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
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "r"]  # Compute, general, memory
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
    - alias: al2023@latest
  subnetSelectorTerms:
    - tags: { karpenter.sh/discovery: my-cluster }
  securityGroupSelectorTerms:
    - tags: { karpenter.sh/discovery: my-cluster }
  role: KarpenterNodeRole
```

### Karpenter vs Cluster Autoscaler

| Feature | Cluster Autoscaler | Karpenter |
|---------|-------------------|-----------|
| Provisioning speed | Minutes (node group bound) | Seconds (direct API) |
| Instance selection | Fixed per node group | Dynamic, right-sized per pod |
| Spot handling | Basic | Native spot interruption, fallback |
| Consolidation | None | Automatic bin-packing |
| Drift detection | None | Automatic (AMI, config changes) |
| Multi-arch | Manual node groups | Native (amd64 + arm64 mix) |

### When NOT to use Karpenter

- Non-AWS clusters (Karpenter core is cloud-agnostic but mature providers are AWS-only; Azure preview exists)
- Clusters with static, predictable workloads (Cluster Autoscaler is simpler)
- Environments requiring strict node group boundaries for compliance

---

## Service Mesh: Istio Ambient Mode

Istio Ambient mode eliminates per-pod sidecars, replacing them with a two-layer architecture:

### Architecture

```
┌─────────────────────────────────────────────┐
│  Node                                        │
│  ┌────────────────────────────────────────┐  │
│  │ ztunnel (DaemonSet, per-node)          │  │
│  │ L4: mTLS, identity, basic auth policy  │  │
│  └────────────────────────────────────────┘  │
│  ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │ Pod  │ │ Pod  │ │ Pod  │  ← No sidecars   │
│  └──────┘ └──────┘ └──────┘                  │
└─────────────────────────────────────────────┘

┌──────────────────────────────────┐
│ Waypoint Proxy (per-namespace    │
│ or per-service, optional)        │
│ L7: request routing, retries,    │
│ rate limiting, authz policies    │
└──────────────────────────────────┘
```

- **ztunnel**: per-node DaemonSet, handles L4 mTLS and identity. 90%+ memory reduction vs sidecar model.
- **Waypoint proxy**: optional, deployed only for services needing L7 features (routing, retries, auth policies).
- Zero-config mTLS for all pods in ambient mesh -- no injection, no restarts.

### When to Use Ambient vs Sidecar vs eBPF Mesh

```
Service mesh need?
├── mTLS + identity only (L4) → Istio Ambient (ztunnel only, minimal overhead)
├── L7 policies (routing, retries, rate limiting) → Istio Ambient + Waypoint proxies
├── Full L4-L7 + custom Envoy filters → Istio sidecar mode (traditional)
└── eBPF-native networking + mesh → Cilium Service Mesh (no proxy at all for L4)
```
