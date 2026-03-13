# Deployment Patterns

## Contents

- [Deployment Strategies](#deployment-strategies)
- [VPS / Single Server Deployment](#vps--single-server-deployment)
- [Container Orchestration Deployment](#container-orchestration-deployment)
- [Serverless Deployment](#serverless-deployment)
- [Reverse Proxy Patterns](#reverse-proxy-patterns)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Rollback Strategies](#rollback-strategies)
- [IaC and GitOps Concepts](#iac-and-gitops-concepts)
- [Server Hardening](#server-hardening)
- [Common Deployment Failures](#common-deployment-failures)

---

## Deployment Strategies

| Strategy | How It Works | Rollback Speed | Risk | Best For |
|----------|-------------|----------------|------|----------|
| Rolling update | Replace instances one at a time | Medium | Low-medium | Most services |
| Blue-green | Run old and new side by side, switch traffic | Fast (switch back) | Low (full old env available) | Critical services |
| Canary | Route small % of traffic to new version | Fast (route back) | Low (limited blast radius) | High-traffic services |
| Recreate | Stop old, start new | Slow (redeploy old) | High (downtime) | Dev/staging only |
| Feature flags | Deploy code inactive, enable per-feature | Instant (toggle off) | Low | Gradual rollouts |

---

## VPS / Single Server Deployment

### SSH-Based Deploy Script

```bash
#!/bin/bash
set -euo pipefail
TAG="${1:?Usage: deploy.sh <tag>}"

ssh deploy@server "
  cd /opt/app && \
  export TAG=$TAG && \
  docker compose pull && \
  docker compose up -d --remove-orphans && \
  sleep 5 && \
  curl -sf http://localhost:3000/health || \
    (docker compose down && docker compose up -d --remove-orphans && echo 'ROLLBACK executed' && exit 1)
"
echo "Deploy $TAG successful"
```

### Server Setup Essentials

| Component | Configuration |
|-----------|---------------|
| Process management | systemd unit for Docker Compose (auto-restart on reboot) |
| Log rotation | Docker json-file driver with max-size/max-file, or logrotate |
| Disk cleanup | Scheduled `docker system prune` (cron or systemd timer) |
| Backups | Database dumps, volume snapshots (scheduled, tested) |

### Systemd Unit Pattern

```ini
[Unit]
Description=App Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/app
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
```

---

## Container Orchestration Deployment

### Kubernetes

- Deployments with rolling update strategy
- Readiness/liveness probes for health gating
- Resource requests and limits per container
- Horizontal Pod Autoscaler for scaling
- Helm or Kustomize for templating

### Nomad

- Job definitions with rolling update stanza
- Health checks for canary promotion
- Resource constraints (memory, CPU, network)

### ECS / Cloud Run

- Task definitions with desired count
- ALB target groups with health checks
- Auto-scaling policies

The universal principles apply regardless of orchestrator: immutable tags, health gates, resource limits, rollback capability.

---

## Serverless Deployment

| Platform | Deploy Method | Cold Start | Scaling |
|----------|--------------|------------|---------|
| AWS Lambda | SAM / CDK / Terraform | Yes (mitigate with provisioned) | Automatic |
| Cloud Functions | gcloud CLI / Terraform | Yes | Automatic |
| Fly.io | `fly deploy` | Minimal (Firecracker) | Configurable |
| Railway | Git push | No (always running) | Configurable |
| Cloudflare Workers | Wrangler CLI | No (V8 isolates) | Automatic, edge |

Serverless trade-offs: simpler ops, but less control over runtime, harder to debug, vendor lock-in risk.

---

## Reverse Proxy Patterns

### nginx

```nginx
upstream app {
    server 127.0.0.1:3000;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade
    location /ws {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Caddy

```
app.example.com {
    reverse_proxy localhost:3000

    # WebSocket path
    @ws path /ws
    reverse_proxy @ws localhost:3000

    # Rate limiting (via plugin or middleware)
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
    }
}
```

Caddy handles SSL/TLS automatically via built-in ACME. No certbot setup needed.

### Traefik (Docker-native)

```yaml
# docker-compose.yml labels
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(`app.example.com`)"
      - "traefik.http.routers.app.tls.certresolver=letsencrypt"
      - "traefik.http.services.app.loadbalancer.server.port=3000"

  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
```

Traefik auto-discovers services via Docker labels. No manual proxy config updates when adding services.

### Security Headers (Universal)

| Header | Value | Purpose |
|--------|-------|---------|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | Force HTTPS |
| X-Frame-Options | `DENY` or `SAMEORIGIN` | Prevent clickjacking |
| X-Content-Type-Options | `nosniff` | Prevent MIME sniffing |
| Content-Security-Policy | App-specific | Prevent XSS, injection |
| Referrer-Policy | `strict-origin-when-cross-origin` | Control referrer leakage |
| Permissions-Policy | `camera=(), microphone=()` | Restrict browser APIs |

---

## SSL/TLS Configuration

| Method | Setup | Renewal | Best For |
|--------|-------|---------|----------|
| Certbot + nginx | `certbot --nginx` | Cron/timer auto-renewal | nginx on VPS |
| Caddy built-in | Automatic | Automatic | Caddy deployments |
| Traefik ACME | Config in Traefik | Automatic | Docker-native setups |
| Cloud provider | Managed certificates | Automatic | Cloud deployments |
| cert-manager | Kubernetes operator | Automatic | Kubernetes clusters |

Critical: always verify auto-renewal is working. Certificate expiry is a common, preventable outage.

---

## Rollback Strategies

| Strategy | Method | Speed | Requirements |
|----------|--------|-------|-------------|
| Image rollback | Deploy previous image tag | Fast | Immutable tags, tag history |
| Git revert + redeploy | Revert commit, trigger pipeline | Medium | CI pipeline must be fast |
| Blue-green switch | Route traffic back to old environment | Instant | Two environments running |
| Feature flag toggle | Disable feature remotely | Instant | Feature flag system |
| Database rollback | Run reverse migration | Slow, risky | Reversible migrations |

Rules:
- Tag every production deploy with an immutable identifier
- Keep at least 3 previous versions available for rollback
- Test rollback procedure before you need it
- Database migrations must be backward-compatible (old code must work with new schema)

---

## IaC and GitOps Concepts

### Infrastructure as Code

Define infrastructure in version-controlled files, not manual console clicks.

| Tool | Language | Best For |
|------|----------|----------|
| Terraform / OpenTofu | HCL | Multi-cloud, provider ecosystem |
| Pulumi | TypeScript/Python/Go | Developers who prefer real languages |
| Ansible | YAML | Configuration management, server setup |
| CloudFormation | JSON/YAML | AWS-native |
| CDK | TypeScript/Python | AWS with type safety |

### GitOps

Declarative infrastructure with git as the source of truth.

```
Git repo (desired state)
  |
  v (sync)
GitOps operator (ArgoCD, Flux)
  |
  v (reconcile)
Live infrastructure (actual state)
```

Principles:
- All infrastructure defined declaratively in git
- Changes go through pull requests (audit trail)
- Automated sync from git to infrastructure
- Drift detection and auto-reconciliation

---

## Server Hardening

| Check | Action |
|-------|--------|
| SSH access | Key-only auth, disable password login, non-root user |
| SSH port | Consider non-standard port (not required, reduces noise) |
| Firewall | Only expose 80, 443, SSH. Deny all else by default. |
| Fail2ban | Block IPs after repeated failed SSH attempts |
| Updates | Unattended security updates enabled |
| Users | Separate deploy user with minimal sudo permissions |
| Audit logs | Log all SSH sessions and sudo commands |

---

## Common Deployment Failures

| Failure | Cause | Prevention |
|---------|-------|------------|
| Deploy during active operations | Service restarts mid-transaction | Graceful shutdown, drain connections |
| No health check gate | Broken version deployed, no rollback | Verify health before marking deploy success |
| Secrets in image layers | .env copied into Docker build | Runtime injection, .dockerignore |
| No log rotation | Disk fills in days | Configure max-size and rotation |
| `latest` tag in prod | Cannot rollback, cannot audit | Immutable tags (git SHA, semver) |
| Flat network | All containers on default bridge | Network segmentation, internal networks |
| No migration lock | Concurrent migrations on deploy | Migration lock or single-pod migration job |
| Certificate expiry | Renewal cron not configured | Auto-renewal with monitoring |
| Config drift | Manual changes diverge from IaC | GitOps reconciliation, no manual edits |
