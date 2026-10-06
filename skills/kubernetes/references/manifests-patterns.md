# Kubernetes Manifest Patterns

## Table of Contents

- [Labeling Conventions](#labeling-conventions)
- [Deployment Patterns](#deployment-patterns)
- [Native Sidecar Containers](#native-sidecar-containers)
- [Service Patterns](#service-patterns)
- [ConfigMap and Secret Patterns](#configmap--secret-patterns)
- [Ingress Patterns (Legacy)](#ingress-patterns-legacy)
- [Job and CronJob Patterns](#job--cronjob-patterns)
- [PodDisruptionBudget](#poddisruptionbudget)
- [Resource Quotas and LimitRanges](#resource-quotas--limitranges)
- [Pod Security Standards](#pod-security-standards)

---

## Labeling Conventions

### Standard Labels

```yaml
metadata:
  labels:
    app.kubernetes.io/name: api
    app.kubernetes.io/instance: api-production
    app.kubernetes.io/version: "1.2.3"
    app.kubernetes.io/component: backend
    app.kubernetes.io/part-of: my-platform
    app.kubernetes.io/managed-by: helm
```

Use standard labels consistently. They enable filtering, monitoring dashboards, and service mesh policies.

---

## Deployment Patterns

### Production Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app.kubernetes.io/name: api
spec:
  replicas: 3
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: api
  template:
    metadata:
      labels:
        app.kubernetes.io/name: api
    spec:
      serviceAccountName: api-sa
      terminationGracePeriodSeconds: 30     # must exceed preStop delay + app drain time
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        fsGroup: 10001
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: api
          image: registry.example.com/api:1.2.3@sha256:<digest>
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: http
          securityContext:
            allowPrivilegeEscalation: false
            capabilities: { drop: ["ALL"] }
            readOnlyRootFilesystem: true      # recommended extra; mount emptyDir where the app writes
          env:
            - name: LOG_LEVEL
              value: info
          envFrom:
            - configMapRef:
                name: api-config
          volumeMounts:
            - { name: db-credentials, mountPath: /run/secrets/db, readOnly: true }
            - { name: tmp, mountPath: /tmp }
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 512Mi
          readinessProbe:
            httpGet: { path: /readyz, port: http }
            periodSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet: { path: /readyz, port: http }
            periodSeconds: 5
            failureThreshold: 30              # 5 * 30 = 150s max startup time
          lifecycle:
            preStop:
              sleep: { seconds: 5 }           # native sleep: works on shell-less images
      volumes:
        - name: db-credentials
          secret: { secretName: db-credentials }
        - name: tmp
          emptyDir: {}
```

Prefer mounting secrets as files over `secretKeyRef` env vars: env vars leak into crash dumps, child processes, and `describe` output, and do not update without a restart. Encrypt Secrets in etcd at rest (API server encryption configuration or a KMS provider).

### Graceful Shutdown

On termination the pod is removed from endpoints while `SIGTERM` is sent, and the two race: load balancers and kube-proxy may keep sending traffic for a few seconds. A short `preStop` delay lets endpoint removal propagate before the app starts refusing connections; the app then drains in-flight work on `SIGTERM`.

- `preStop: { sleep: { seconds: N } }` is the native form (beta and on by default since 1.30, GA in 1.34). It needs no shell, so it works on distroless and scratch images. On older clusters, fall back to `exec: { command: ["sh", "-c", "sleep 5"] }`, which fails on shell-less images.
- Set `terminationGracePeriodSeconds` greater than `preStop` delay plus the app's drain time; the preStop time counts against it.
- Shutdown semantics (readiness flip, drain order, timeouts): `reliability`; app-side handling: `backend`.

### Probe Guide

| Probe | Purpose | Use |
|-------|---------|-----|
| `startupProbe` | Gates the other probes during boot | Slow starters (more than about 10s) |
| `readinessProbe` | Gates traffic routing | Always; checks "can serve", not shared dependencies |
| `livenessProbe` | Restarts a wedged process | Optional; only for failures a restart fixes; never check dependencies |

- Startup runs first and disables liveness and readiness until it succeeds.
- Readiness failure removes the pod from Service endpoints without a restart.
- Liveness failure restarts the container, so a liveness check that touches a database turns a database outage into a restart storm.
- Use `/livez` and `/readyz` as separate endpoints. Policy and design: `reliability`.

---

## Native Sidecar Containers

Native sidecar containers (GA since Kubernetes 1.33) are declared via `initContainers` with `restartPolicy: Always`.

### Full Example with Sidecar

The snippet shows only the sidecar wiring; add the pod and container `securityContext`, probes, and `serviceAccountName` from the production example above so it passes the `restricted` standard.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels: { app.kubernetes.io/name: api }
  template:
    metadata:
      labels: { app.kubernetes.io/name: api }
    spec:
      securityContext:
        runAsNonRoot: true
        seccompProfile: { type: RuntimeDefault }
      initContainers:
        # Regular init container: runs to completion before the main container starts
        - name: fetch-config
          image: registry.example.com/config-fetcher:1.4.0@sha256:<digest>
          args: ["--out", "/etc/app"]
          securityContext:
            allowPrivilegeEscalation: false
            capabilities: { drop: ["ALL"] }
          volumeMounts:
            - { name: app-config, mountPath: /etc/app }
        # Native sidecar: restartPolicy Always keeps it running beside the main container
        - name: log-shipper
          image: registry.example.com/log-shipper:2.1.0@sha256:<digest>
          restartPolicy: Always
          securityContext:
            allowPrivilegeEscalation: false
            capabilities: { drop: ["ALL"] }
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { memory: 128Mi }
          volumeMounts:
            - { name: shared-logs, mountPath: /var/log/app, readOnly: true }
      containers:
        - name: api
          image: registry.example.com/api:1.2.3@sha256:<digest>
          securityContext:
            allowPrivilegeEscalation: false
            capabilities: { drop: ["ALL"] }
          volumeMounts:
            - { name: shared-logs, mountPath: /var/log/app }
            - { name: app-config, mountPath: /etc/app, readOnly: true }
      volumes:
        - name: shared-logs
          emptyDir: {}
        - name: app-config
          emptyDir: {}
```

Do not run schema migrations in an init container: every replica would migrate on every start. Run them once as a Job or pipeline step (see Database Migration Job below and `database`).

**Lifecycle order:** native sidecars (`restartPolicy: Always`) start first, then regular init containers run to completion, then main containers start. On shutdown, main containers stop first, then native sidecars.

**Common sidecar use cases:** log shippers, metrics collectors, proxy agents (Vault, Envoy), file syncing.

---

## Service Patterns

### ClusterIP (Internal)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: api
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
```

### Headless Service (StatefulSet DNS)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db-headless
spec:
  type: ClusterIP
  clusterIP: None  # Headless — returns pod IPs directly
  selector:
    app.kubernetes.io/name: db
  ports:
    - port: 5432
```

Each pod gets a DNS entry: `db-0.db-headless.namespace.svc.cluster.local`

---

## ConfigMap & Secret Patterns

### ConfigMap from Files

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  DATABASE_HOST: db.default.svc.cluster.local
  DATABASE_PORT: "5432"
  LOG_LEVEL: info
---
# Mount as file
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  nginx.conf: |
    server {
      listen 80;
      location / { proxy_pass http://api:8080; }
    }
```

### External Secrets (Recommended for Production)

```yaml
# Using External Secrets Operator
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: db-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-credentials
  data:
    - secretKey: password
      remoteRef:
        key: production/db
        property: password
```

ESO API versions track the operator release: `v1beta1` stopped being served in v0.17.0, so use `external-secrets.io/v1` for `ExternalSecret`, `SecretStore`, and `ClusterSecretStore`, and check the installed CRD versions (`kubectl get crd externalsecrets.external-secrets.io -o jsonpath='{.spec.versions[*].name}'`).

---

## Ingress Patterns (Legacy)

> **Note:** the ingress-nginx controller was retired and archived in March 2026: existing installs keep running but receive no further fixes, including security fixes. The Ingress API itself remains supported but frozen. Use Gateway API for new work; see [operators-gateway.md](operators-gateway.md) for migration. Both can coexist during migration.

### Ingress with TLS (existing clusters)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    # controller-specific annotations (rate limits, rewrites) are not portable
spec:
  ingressClassName: <your-ingress-class>
  tls:
    - hosts: [api.example.com]
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port: { number: 80 }
```

### Path-Based Routing

```yaml
rules:
  - host: example.com
    http:
      paths:
        - path: /api
          pathType: Prefix
          backend:
            service: { name: api, port: { number: 80 } }
        - path: /
          pathType: Prefix
          backend:
            service: { name: frontend, port: { number: 80 } }
```

---

## Job & CronJob Patterns

### Database Migration Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate-v1.2.3
spec:
  backoffLimit: 3
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: registry.example.com/api:1.2.3
          command: ["npm", "run", "migrate"]
          envFrom:
            - secretRef: { name: db-credentials }
```

### Scheduled Backup CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: postgres:17
              command: ["pg_dump", "-Fc", "-f", "/backups/backup.dump"]
              volumeMounts:
                - name: backups
                  mountPath: /backups
          volumes:
            - name: backups
              persistentVolumeClaim: { claimName: backup-pvc }
```

---

## PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
spec:
  minAvailable: 2        # Or use maxUnavailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: api
```

Always create PDBs for production workloads. Prevents node drain from taking down too many replicas.

---

## Resource Quotas & LimitRanges

### Namespace Resource Quota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.memory: 40Gi
    pods: "50"
    services: "20"
```

A quota on `limits.cpu` forces every container to declare a CPU limit; quota `requests.cpu` and memory limits instead unless CPU limits are wanted.

### Default Container Requests and Memory Limits

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-a
spec:
  limits:
    - type: Container
      defaultRequest:
        memory: 128Mi
        cpu: 100m
      default:
        memory: 256Mi
      max:
        memory: 2Gi
```

Do not set `default` or `max` for CPU unless CPU limits are intended: they inject a CPU limit into every container that lacks one.

---

## Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

| Level | Restrictions |
|-------|-------------|
| `privileged` | No restrictions |
| `baseline` | Blocks known privilege escalations (host namespaces, privileged containers, most capabilities) |
| `restricted` | Hardened: `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, drop `ALL` capabilities (only `NET_BIND_SERVICE` may be added), seccomp `RuntimeDefault` or `Localhost`, restricted volume types, no host access |

A read-only root filesystem is not required by `restricted`; it is a recommended extra. The `enforce`, `audit`, and `warn` modes can use different levels, so roll out with `warn` and `audit` first.
