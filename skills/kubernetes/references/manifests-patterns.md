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
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: api
          image: registry.example.com/api:1.2.3
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: NODE_ENV
              value: production
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
          envFrom:
            - configMapRef:
                name: api-config
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 512Mi  # CPU limit omitted — let HPA handle
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 30  # 5 * 30 = 150s max startup time
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 5"]  # Allow LB to drain
```

### Probe Decision Guide

| Probe | Purpose | When to Use |
|-------|---------|-------------|
| `readinessProbe` | Gate traffic routing | Always — prevents traffic to unready pods |
| `livenessProbe` | Restart stuck processes | Always — auto-recovers hung containers |
| `startupProbe` | Slow-start applications | When app takes >10s to initialize |

**Rules:**
- Startup probe runs first (disables liveness during startup)
- Readiness failure removes pod from Service endpoints (no restart)
- Liveness failure restarts the container
- Never use the same endpoint for liveness and readiness if the readiness check is expensive

---

## Native Sidecar Containers

Kubernetes 1.33+ (GA) supports native sidecar containers via `initContainers` with `restartPolicy: Always`.

### Full Example with Sidecar

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
    spec:
      initContainers:
        # Native sidecar — starts before main, runs alongside, stops after
        - name: log-shipper
          image: fluent-bit:3.2
          restartPolicy: Always
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { memory: 128Mi }
          volumeMounts:
            - name: shared-logs
              mountPath: /var/log/app
        # Regular init container (runs to completion before main starts)
        - name: db-migrate
          image: registry.example.com/api:1.2.3
          command: ["npm", "run", "migrate"]
      containers:
        - name: api
          image: registry.example.com/api:1.2.3
          volumeMounts:
            - name: shared-logs
              mountPath: /var/log/app
      volumes:
        - name: shared-logs
          emptyDir: {}
```

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
apiVersion: external-secrets.io/v1beta1
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

---

## Ingress Patterns (Legacy)

> **Note:** Ingress NGINX is retiring March 2026. For new projects, use Gateway API instead. See [operators-gateway.md](operators-gateway.md) for Gateway API patterns. Both can coexist during migration.

### nginx Ingress with TLS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  ingressClassName: nginx
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
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
    services: "20"
```

### Default Container Limits

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: team-a
spec:
  limits:
    - type: Container
      default:
        memory: 256Mi
        cpu: 250m
      defaultRequest:
        memory: 128Mi
        cpu: 100m
      max:
        memory: 2Gi
        cpu: "2"
```

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
| `baseline` | Prevents known privilege escalations |
| `restricted` | Hardened, best practice (non-root, no host access, read-only root) |
