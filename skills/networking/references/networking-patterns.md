# Networking Patterns

Detailed configuration examples for DNS, TLS, load balancing, CDN, service mesh, and firewall.

---

## Contents

- [DNS Configuration Patterns](#dns-configuration-patterns)
- [TLS Configuration](#tls-configuration)
- [mTLS and Zero Trust Patterns](#mtls-and-zero-trust-patterns)
- [Load Balancer Configuration](#load-balancer-configuration)
- [CDN Configuration](#cdn-configuration)
- [Service Mesh Patterns](#service-mesh-patterns)
- [Firewall Patterns](#firewall-patterns)
- [Troubleshooting Commands](#troubleshooting-commands)

---

## DNS Configuration Patterns

### Zone File Example

```
$ORIGIN example.com.
$TTL 3600

; SOA record
@   IN  SOA   ns1.example.com. admin.example.com. (
            2024010101  ; Serial
            3600        ; Refresh
            900         ; Retry
            604800      ; Expire
            300         ; Negative TTL
        )

; Nameservers
@       IN  NS    ns1.example.com.
@       IN  NS    ns2.example.com.

; A records
@       IN  A     93.184.216.34
www     IN  A     93.184.216.34
api     IN  A     93.184.216.35

; CNAME (aliases)
blog    IN  CNAME example.netlify.app.
docs    IN  CNAME example.readthedocs.io.

; MX records (priority ordering)
@       IN  MX    10  mail1.example.com.
@       IN  MX    20  mail2.example.com.

; TXT records
@       IN  TXT   "v=spf1 include:_spf.google.com ~all"
_dmarc  IN  TXT   "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"

; CAA (restrict certificate authorities)
@       IN  CAA   0 issue "letsencrypt.org"
@       IN  CAA   0 issuewild ";"  ; no wildcard certs

; HTTPS/SVCB records (service binding + HTTP/3 + ECH)
@       IN  HTTPS 1 . alpn="h3,h2" ech="..." ipv4hint=93.184.216.34
```

### DNSSEC Setup

Generate ZSK and KSK with `dnssec-keygen -a ECDSAP256SHA256`, then sign with `dnssec-signzone`. Use ECDSAP256SHA256 (not RSA) for smaller records and faster validation.

### Encrypted DNS (DoH / DoT)

- **DoH** (port 443): blends with HTTPS traffic. Configure resolver URL in application or OS settings.
- **DoT** (port 853): dedicated TLS connection. Configure in systemd-resolved: `DNSOverTLS=yes`
- DNSSEC validates authenticity; DoH/DoT encrypts the transport. Use both together.

### DNS Failover Pattern

Use low TTL (60s) for failover records. Add both primary and secondary IPs. DNS providers can health-check endpoints and auto-remove unhealthy records.

---

## TLS Configuration

### TLS 1.3 Server Configuration (nginx example)

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name api.example.com;

    # Certificates
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # TLS 1.3 only (or 1.2 minimum)
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;  # Let client choose in TLS 1.3

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/api.example.com/chain.pem;

    # Session resumption
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;  # Better forward secrecy

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
}
```

### Post-Quantum TLS Readiness

Hybrid key exchange in TLS 1.3 combines classical ECDHE with ML-KEM (FIPS 203):
- `X25519MLKEM768` — X25519 + ML-KEM-768 (most common)
- `SecP256r1MLKEM768` — secp256r1 + ML-KEM-768
- `SecP384r1MLKEM1024` — secp384r1 + ML-KEM-1024

Impact: ~1600 additional bytes per handshake, ~80-150us extra compute. Test with your CDN/load balancer to verify compatibility. Major cloud providers and CDNs support hybrid PQ key exchange.

---

## mTLS and Zero Trust Patterns

### mTLS Server Configuration (nginx example)

```nginx
server {
    listen 443 ssl;

    # Server certificate
    ssl_certificate     /etc/ssl/server.crt;
    ssl_certificate_key /etc/ssl/server.key;

    # Client certificate verification
    ssl_client_certificate /etc/ssl/ca.crt;  # CA that signed client certs
    ssl_verify_client on;                     # Require client cert
    ssl_verify_depth 2;

    # Pass client cert info to upstream
    location / {
        proxy_pass http://backend;
        proxy_set_header X-Client-CN $ssl_client_s_dn_cn;
        proxy_set_header X-Client-Verify $ssl_client_verify;
    }
}
```

### SPIFFE/SPIRE Identity Pattern

```
Architecture:
  SPIRE Server (central authority)
    |
    +-> SPIRE Agent (per node)
          |
          +-> Workload A (attested via K8s SA, receives SVID)
          +-> Workload B (attested via AWS instance ID, receives SVID)

Identity format: spiffe://trust-domain/path
Example:         spiffe://example.com/ns/production/sa/api-server

Certificate lifecycle:
  1. Workload starts -> SPIRE agent attests via platform signal
  2. Agent requests SVID from SPIRE server
  3. Workload receives short-lived X.509 cert (hours, not months)
  4. Cert auto-rotates before expiry — no manual intervention
  5. mTLS established using SVIDs — both sides verify identity
```

### Automated Certificate Management with ACME

```yaml
# cert-manager ClusterIssuer (Kubernetes example)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

---

## Load Balancer Configuration

### HAProxy Configuration

```
global
    maxconn 50000
    log stdout format raw local0

defaults
    mode http
    timeout connect 5s
    timeout client 30s
    timeout server 30s
    option httplog
    option forwardfor

frontend http
    bind *:80
    redirect scheme https if !{ ssl_fc }

frontend https
    bind *:443 ssl crt /etc/ssl/certs/combined.pem
    default_backend api_servers

    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny deny_status 429 if { sc_http_req_rate(0) gt 100 }

backend api_servers
    balance leastconn
    option httpchk GET /healthz
    http-check expect status 200

    server api1 10.0.1.1:8080 check inter 5s fall 3 rise 2
    server api2 10.0.1.2:8080 check inter 5s fall 3 rise 2
    server api3 10.0.1.3:8080 check inter 5s fall 3 rise 2
```

### nginx Upstream Configuration

```nginx
upstream api_backend {
    least_conn;

    server 10.0.1.1:8080 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.2:8080 weight=2 max_fails=3 fail_timeout=30s;
    server 10.0.1.3:8080 weight=1 max_fails=3 fail_timeout=30s backup;

    keepalive 32;  # Keep-alive connections to upstream
}

server {
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";  # Enable keepalive
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;

        # Retry on failure
        proxy_next_upstream error timeout http_502 http_503;
        proxy_next_upstream_tries 2;
    }
}
```

---

## CDN Configuration

### Cache Rule Strategy (conceptual, provider-agnostic)

```
# Static assets — aggressive caching
Path: /static/*
Cache: everything at edge
Edge TTL: 1 month
Browser TTL: 1 year

# API — no caching
Path: /api/*
Cache: bypass
Security: high

# HTML pages — revalidate
Path: /*
Cache: standard
Edge TTL: 4 hours
```

### Cache-Control Strategy Table

| Content Type | Cache-Control | Why |
|-------------|--------------|-----|
| Versioned assets (`app.abc123.js`) | `public, max-age=31536000, immutable` | Hash in filename = safe to cache forever |
| Unversioned assets (`logo.png`) | `public, max-age=86400, stale-while-revalidate=604800` | Cache 1 day, serve stale for 1 week |
| HTML pages | `no-cache` | Always revalidate (may serve 304) |
| API responses (public) | `public, max-age=60, stale-while-revalidate=300` | Short cache, background refresh |
| API responses (private) | `private, no-cache` | User-specific, revalidate |
| Auth endpoints | `no-store` | Never cache |

---

## Service Mesh Patterns

### Traffic Splitting (Canary) — Istio example

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api
spec:
  hosts: [api]
  http:
    - route:
        - destination:
            host: api
            subset: stable
          weight: 90
        - destination:
            host: api
            subset: canary
          weight: 10
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api
spec:
  host: api
  subsets:
    - name: stable
      labels: { version: v1 }
    - name: canary
      labels: { version: v2 }
```

### Circuit Breaker — Istio example

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api
spec:
  host: api
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: DEFAULT
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

---

## Firewall Patterns

### nftables Rules (Linux — recommended)

nftables is the modern replacement for iptables. Default on modern Linux distributions.

```bash
#!/usr/sbin/nft -f
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Allow established/related connections
        ct state established,related accept

        # Allow loopback
        iif lo accept

        # Allow SSH (restricted to admin network)
        ip saddr 10.0.0.0/8 tcp dport 22 accept

        # Allow HTTP/HTTPS
        tcp dport { 80, 443 } accept

        # Rate limit new HTTPS connections
        tcp dport 443 ct state new limit rate 20/minute accept
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
```

### iptables (Legacy)

Still widely used; migrate to nftables with `iptables-translate` for new deployments. Same concepts: default deny, allow established, allow loopback, restrict SSH by source, allow HTTP/HTTPS, rate-limit new connections.

### Cloud Security Group Pattern (provider-agnostic)

```
# Web tier
Inbound:  TCP 443 from 0.0.0.0/0          (HTTPS from internet)
Inbound:  TCP 80  from 0.0.0.0/0          (HTTP redirect)
Outbound: TCP 8080 to app-tier-sg          (to application)

# App tier
Inbound:  TCP 8080 from web-tier-sg        (from web tier only)
Outbound: TCP 5432 to db-tier-sg           (to database)
Outbound: TCP 6379 to cache-tier-sg        (to cache)
Outbound: TCP 443  to 0.0.0.0/0           (external APIs)

# DB tier
Inbound:  TCP 5432 from app-tier-sg        (from app tier only)
Outbound: None                             (no external access)
```

---

## Troubleshooting Commands

| Task | Command |
|------|---------|
| DNS lookup / trace | `dig example.com +short` / `dig +trace example.com` |
| DNS HTTPS record | `dig example.com HTTPS +short` |
| TLS cert check / expiry | `openssl s_client -connect example.com:443 -servername example.com` |
| TLS 1.3 verification | `openssl s_client -connect example.com:443 -tls1_3` |
| TCP connectivity | `nc -zv example.com 443` |
| HTTP timing | `curl -w "@curl-format.txt" -o /dev/null -s https://example.com` |
| HTTP/3 check | `curl --http3-only https://example.com -I` |
| Route trace / MTU | `mtr example.com` / `ping -M do -s 1472 example.com` |
| Port scan / bandwidth | `nmap -sT -p 80,443 example.com` / `iperf3 -c server-ip` |
| QUIC connectivity | `curl --http3 -v https://example.com 2>&1 | grep QUIC` |
