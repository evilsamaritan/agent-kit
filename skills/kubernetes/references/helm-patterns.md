# Helm Chart Patterns

## Table of Contents

- [Chart Structure](#chart-structure)
- [Values Organization](#values-organization)
- [Template Helpers](#template-helpers)
- [Template Patterns](#template-patterns)
- [Hooks](#hooks)
- [Testing](#testing)
- [Common Commands](#common-commands)

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
│   ├── ingress.yaml        # Ingress (conditional)
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
  - name: postgresql
    version: "15.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

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
readinessProbe:
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5

livenessProbe:
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: 15
  periodSeconds: 10

# Ingress
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: api-tls
      hosts: [api.example.com]

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

# Feature flags
postgresql:
  enabled: false  # Use external DB by default

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

### Environment Variables from Values

```yaml
# In deployment.yaml container spec
env:
  {{- range $key, $value := .Values.env }}
  - name: {{ $key }}
    value: {{ $value | quote }}
  {{- end }}
  {{- if .Values.secrets.dbPassword }}
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: {{ .Values.secrets.dbPassword.secretName }}
        key: {{ .Values.secrets.dbPassword.key }}
  {{- end }}
```

### Ingress with Multiple Hosts

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - secretName: {{ .secretName }}
      hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "my-app.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
```

---

## Hooks

### Pre-Install / Pre-Upgrade Migration

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

### Hook Ordering

| Weight | Hook | Purpose |
|--------|------|---------|
| -5 | pre-install | Create external resources |
| 0 | pre-install | Run migrations |
| 5 | post-install | Seed data, send notifications |

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
      image: busybox
      command: ['wget']
      args: ['{{ include "my-app.fullname" . }}:{{ .Values.service.port }}/healthz']
```

```bash
helm test my-release
```

---

## Common Commands

```bash
# Install / upgrade
helm upgrade --install my-release ./my-chart \
  -f values-production.yaml \
  --set image.tag=1.2.3 \
  --namespace production \
  --create-namespace

# Dry run + diff
helm upgrade --install my-release ./my-chart --dry-run --debug
helm diff upgrade my-release ./my-chart  # requires helm-diff plugin

# Rollback
helm rollback my-release 1  # revision number
helm history my-release      # see revisions

# Template rendering (debug)
helm template my-release ./my-chart -f values-production.yaml

# Lint
helm lint ./my-chart -f values-production.yaml
```
