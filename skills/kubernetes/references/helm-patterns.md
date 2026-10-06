# Helm Chart Patterns

Check the installed Helm major version first (`helm version`); commands below note where Helm 3 and Helm 4 differ.

## Table of Contents

- [Chart Structure](#chart-structure)
- [Values Organization](#values-organization)
- [Template Helpers](#template-helpers)
- [Template Patterns](#template-patterns)
- [Hooks](#hooks)
- [Testing](#testing)
- [Common Commands](#common-commands)
- [Helm 3 vs 4](#helm-3-vs-4)

---

## Chart Structure

```
my-chart/
├── Chart.yaml              # Chart metadata, dependencies
├── Chart.lock              # Locked dependency versions
├── values.yaml             # Default values
├── values-production.yaml  # Environment-specific overrides
├── templates/
│   ├── _helpers.tpl        # Template helpers (named templates)
│   ├── deployment.yaml     # Deployment manifest
│   ├── service.yaml        # Service manifest
│   ├── httproute.yaml      # Gateway API HTTPRoute (conditional)
│   ├── ingress.yaml        # Ingress (optional, legacy)
│   ├── hpa.yaml            # HPA (conditional)
│   ├── configmap.yaml      # ConfigMap
│   ├── secret.yaml         # Secret (if not using external)
│   ├── serviceaccount.yaml # ServiceAccount
│   ├── pdb.yaml            # PodDisruptionBudget
│   ├── NOTES.txt           # Post-install instructions
│   └── tests/
│       └── test-connection.yaml
└── charts/                 # Dependency charts
```

### Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: My application Helm chart
type: application
version: 0.1.0          # Chart version
appVersion: "1.2.3"     # Application version

dependencies:
  - name: <subchart>
    version: "<exact-or-bounded-version>"
    repository: "<subchart-repository>"      # OCI (oci://...) or an HTTPS chart repo you control or trust
    condition: <subchart>.enabled
```

Pin subchart versions and commit `Chart.lock`. Do not depend on third-party database charts for production; run databases through an operator or a managed service, and use a subchart only for dev and test.

---

## Values Organization

### Structured values.yaml

```yaml
# Image configuration
image:
  repository: registry.example.com/api
  tag: ""  # Defaults to appVersion
  pullPolicy: IfNotPresent

# Replica and scaling
replicaCount: 3

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 20
  targetCPUUtilization: 70

# Resources
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    memory: 512Mi

# Probes
readinessProbe:                # separate /readyz and /livez; liveness is optional (see `reliability`)
  httpGet:
    path: /readyz
    port: http
  periodSeconds: 5

livenessProbe: {}              # set only when a restart fixes the failure; never check dependencies

# Routing: Gateway API by default, Ingress optional
httpRoute:
  enabled: true
  parentRefs:
    - name: main-gateway
      namespace: infra
  hostnames: [api.example.com]

ingress:
  enabled: false
  className: ""                # your ingress class
  annotations: {}
  hosts: []
  tls: []

# Service
service:
  type: ClusterIP
  port: 80

# Environment
env:
  NODE_ENV: production
  LOG_LEVEL: info

# Secret references
secrets:
  dbPassword:
    secretName: db-credentials
    key: password

serviceAccount:
  create: true
  name: ""
  annotations: {}

podDisruptionBudget:
  enabled: true
  minAvailable: 2
```

---

## Template Helpers

### _helpers.tpl

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "my-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "my-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "my-app.labels" -}}
helm.sh/chart: {{ include "my-app.chart" . }}
{{ include "my-app.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "my-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "my-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the image reference
*/}}
{{- define "my-app.image" -}}
{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
{{- end }}
```

---

## Template Patterns

### Conditional Resources

```yaml
# hpa.yaml — only created when autoscaling is enabled
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "my-app.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilization }}
{{- end }}
```

### Environment Variables and Secrets from Values

Plain config goes in env; secrets are mounted as files (an existing Secret named in values), as `manifests-patterns.md` recommends.

```yaml
# In deployment.yaml container spec
env:
  {{- range $key, $value := .Values.env }}
  - name: {{ $key }}
    value: {{ $value | quote }}
  {{- end }}
{{- if .Values.secrets.dbPassword }}
volumeMounts:
  - { name: db-password, mountPath: /run/secrets/db, readOnly: true }
{{- end }}
# In the pod spec
{{- if .Values.secrets.dbPassword }}
volumes:
  - name: db-password
    secret:
      secretName: {{ .Values.secrets.dbPassword.secretName }}
      items:
        - { key: {{ .Values.secrets.dbPassword.key }}, path: password }
{{- end }}
```

### HTTPRoute (default routing)

```yaml
{{- if .Values.httpRoute.enabled }}
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  parentRefs:
    {{- toYaml .Values.httpRoute.parentRefs | nindent 4 }}
  hostnames:
    {{- toYaml .Values.httpRoute.hostnames | nindent 4 }}
  rules:
    - matches:
        - path: { type: PathPrefix, value: / }
      backendRefs:
        - name: {{ include "my-app.fullname" . }}
          port: {{ .Values.service.port }}
{{- end }}
```

An Ingress template stays optional behind `ingress.enabled` for clusters that have not migrated; it follows the same `range` pattern over `.Values.ingress.hosts` and `.Values.ingress.tls`.

---

## Hooks

Hooks run Jobs or Pods at points in a release. **A `pre-install` or `pre-upgrade` hook runs before the chart's regular resources exist or are updated**: a hook Job cannot rely on a ConfigMap, Secret, or ServiceAccount created by the same chart in that run, unless those are hooks too (with lower weights) or already exist.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "my-app.fullname" . }}-migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": hook-succeeded,before-hook-creation
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: {{ include "my-app.image" . }}
          command: ["npm", "run", "migrate"]
```

Weights order hooks of the same type (lowest first); they do not order across hook types.

| Phase | Hook | Typical use |
|-------|------|-------------|
| Before resources are applied | `pre-install`, `pre-upgrade` | Schema migrations (backward-compatible only: see `database`), prerequisite checks |
| After resources are applied | `post-install`, `post-upgrade` | Seed data, notifications |
| Release removal | `pre-delete`, `post-delete` | Cleanup, deregistration |
| Rollback | `pre-rollback`, `post-rollback` | Restore steps |
| On demand | `test` | `helm test` |

Run migrations as a hook only when they are safe against the old version still serving traffic during the rollout; otherwise run them as a separate pipeline step.

---

## Testing

### Connection Test

```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: {{ include "my-app.fullname" . }}-test
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox:1.37
      command: ['wget']
      args: ['{{ include "my-app.fullname" . }}:{{ .Values.service.port }}/readyz']
```

```bash
helm test my-release
```

---

## Common Commands

```bash
# Install / upgrade: --wait and --timeout decide failure behaviour; without them
# Helm returns as soon as resources are submitted
helm upgrade --install my-release ./my-chart \
  -f values-production.yaml \
  --set image.tag=1.2.3 \
  --namespace production --create-namespace \
  --wait --timeout 5m --rollback-on-failure      # Helm 3: --atomic (implies --wait)

# Dry run + diff
helm upgrade --install my-release ./my-chart --dry-run=server --debug
helm diff upgrade my-release ./my-chart          # requires the helm-diff plugin

# Rollback and history
helm history my-release
helm rollback my-release 1 --wait --timeout 5m

# Render and lint
helm template my-release ./my-chart -f values-production.yaml
helm lint ./my-chart -f values-production.yaml
```

---

## Helm 3 vs 4

- Helm 4 renames `--atomic` to `--rollback-on-failure` and `--force` to `--force-replace`; the old flags still work with deprecation warnings for now. Use the spelling of the major version in your CI image.
- Helm 4 can use server-side apply: new releases default to it, while existing releases keep the apply method they were created with (Helm 3 releases stay on client-side apply until `--server-side` is passed).
- Rollback is best effort and can fail when a revision conflicts with current cluster state; verify after rolling back.
- Pin the Helm version in CI and re-test the chart's hooks and `--wait` behaviour when moving majors.
