# Networking Patterns

Configuration examples for DNS, TLS, load balancing, CDN topology, Gateway API and service mesh, and firewall. Examples are sketches: adapt names, addresses, and versions. Addresses use documentation ranges.

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
- [Volatile Facts](#volatile-facts)

---

## DNS Configuration Patterns

### Zone File Example

```
$ORIGIN example.com.
$TTL 3600

; SOA record (serial: any increasing number, commonly YYYYMMDDnn)
@   IN  SOA   ns1.example.com. hostmaster.example.com. (
            2026010101  ; Serial
            3600        ; Refresh
            900         ; Retry
            604800      ; Expire
            300         ; Negative TTL
        )

; Nameservers
@       IN  NS    ns1.example.com.
@       IN  NS    ns2.example.com.

; Address records (documentation ranges)
@       IN  A     203.0.113.10
www     IN  A     203.0.113.10
api     IN  A     203.0.113.11
api     IN  AAAA  2001:db8::11

; CNAME (aliases to a hosted service; remove when the service is released)
blog    IN  CNAME site.hosting.example.net.

; MX records (priority ordering)
@       IN  MX    10  mail1.example.com.
@       IN  MX    20  mail2.example.com.

; TXT records
@       IN  TXT   "v=spf1 include:_spf.mail.example.net ~all"
_dmarc  IN  TXT   "v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com"

; CAA (restrict which CAs may issue; use your CA's published identifier)
@       IN  CAA   0 issue "ca.example.net"
@       IN  CAA   0 issuewild ";"  ; no wildcard certs

; HTTPS/SVCB record (service binding, HTTP/3, ECH)
@       IN  HTTPS 1 . alpn="h3,h2" ipv4hint=203.0.113.10
```

### DNSSEC

DNSSEC lets resolvers validate that answers came from the zone owner. Use the DNS provider's managed signing, or an automated signer with a key-rollover policy (for example BIND's `dnssec-policy` or the equivalent in your server), and publish the DS record at the parent. Prefer ECDSA P-256 over RSA for smaller responses. Hand-run signing tools with manual key handling cause expiry outages.

### Encrypted DNS (DoH / DoT)

These protect the client-to-resolver hop and are configured on clients and recursive resolvers (for example `DNSOverTLS=yes` in systemd-resolved), not on authoritative servers. DNSSEC and DoH/DoT address different threats and are independent decisions.

### DNS Failover Pattern

Use low TTL (60s) for failover records. Add both primary and secondary IPs. DNS providers can health-check endpoints and auto-remove unhealthy records.

---

## TLS Configuration

### TLS Server Configuration (nginx example)

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/ssl/live/api.example.com/privkey.pem;

    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # No ssl_stapling by default: enable it only if your CA still publishes OCSP responders.
    # Otherwise nginx logs "ssl_stapling ignored, no OCSP responder URL".

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # HSTS: one year with subdomains. Add "preload" only after every subdomain is HTTPS
    # and you accept that removal from browser preload lists takes months.
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Optional HTTP/3 (nginx built with QUIC): also open UDP 443.
    # listen 443 quic reuseport;
    # add_header Alt-Svc 'h3=":443"; ma=86400' always;
}
```

Header values and policy decisions beyond this sample are owned by `web` and `security`.

### Post-Quantum TLS Readiness

Hybrid key exchange in TLS 1.3 combines classical ECDHE with ML-KEM (FIPS 203), for example `X25519MLKEM768`. It enlarges the handshake by roughly a kilobyte or more, so test load balancers, firewalls, and middleboxes that inspect or limit handshake size. Inventory endpoints and libraries first.

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
        proxy_pass https://backend;   # re-encrypt to the backend
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

ACME is for public web certificates. For mTLS and client authentication use a private CA (cloud-managed private CA, SPIRE, or a mesh CA).

```yaml
# cert-manager ClusterIssuer using a Gateway API HTTP-01 solver (Kubernetes example)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: acme-public
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: acme-public-account-key
    solvers:
      - http01:
          gatewayHTTPRoute:
            parentRefs:
              - kind: Gateway
                name: public-gateway
                namespace: infra
```

Check the cert-manager version's Gateway API support and the maintenance status of whichever ingress or gateway controller is in use. If you must use the legacy Ingress solver, set the controller's `ingressClassName` instead of hardcoding one product's class.

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
    option httpchk GET /readyz
    http-check expect status 200

    # Re-encrypt to the backend and verify its certificate
    default-server ssl verify required ca-file /etc/ssl/ca.crt check inter 5s fall 3 rise 2
    server api1 10.0.1.1:8443
    server api2 10.0.1.2:8443
    server api3 10.0.1.3:8443
```

### nginx Upstream Configuration

```nginx
upstream api_backend {
    least_conn;

    server 10.0.1.1:8443 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.2:8443 weight=2 max_fails=3 fail_timeout=30s;
    server 10.0.1.3:8443 weight=1 max_fails=3 fail_timeout=30s backup;

    keepalive 32;  # Keep-alive connections to upstream
}

server {
    location / {
        proxy_pass https://api_backend;      # re-encrypt to the backend
        proxy_ssl_verify on;
        proxy_ssl_trusted_certificate /etc/ssl/ca.crt;
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

### Reverse Proxy Configuration

Caddy (automatic public certificates, short config):

```caddyfile
app.example.com {
    reverse_proxy app1:8080 app2:8080 {
        lb_policy least_conn
        health_uri /readyz
    }
}
```

Traefik (dynamic discovery; file provider shown):

```yaml
http:
  routers:
    app:
      rule: Host(`app.example.com`)
      service: app
      tls: { certResolver: acme-public }
  services:
    app:
      loadBalancer:
        servers: [{ url: "http://app1:8080" }, { url: "http://app2:8080" }]
        healthCheck: { path: /readyz, interval: 10s }
```

Certificate expiry check against the served endpoint (alert below your renewal-window threshold):

```bash
echo | openssl s_client -connect app.example.com:443 -servername app.example.com 2>/dev/null | openssl x509 -noout -enddate
```

---

## CDN Configuration

### CDN Topology (conceptual, provider-agnostic)

```
Client -> edge PoP -> origin shield (optional second-tier cache) -> origin

Path /static/*  : cache at edge and shield; versioned URLs, purge rarely
Path /api/*     : bypass cache unless the response policy allows it
Everything else : follow origin headers
Purge           : by URL, tag, or prefix; versioned asset URLs make purging unnecessary
Origin access   : allow only the CDN's ranges or authenticated origin pulls
```

Which Cache-Control values to send for each content type, and edge versus browser TTL decisions, are owned by `caching` (see its CDN reference). Header mechanics are in `web`.

---

## Service Mesh Patterns

### Traffic Splitting (Canary) — Gateway API

Gateway API is the standard route for ingress and, in meshes that implement it, for east-west traffic. Weights live in `backendRefs`.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
spec:
  parentRefs:
    - name: public-gateway
  hostnames: ["api.example.com"]
  rules:
    - backendRefs:
        - name: api-stable
          port: 8080
          weight: 90
        - name: api-canary
          port: 8080
          weight: 10
```

Istio's own variant uses `VirtualService` and `DestinationRule` (`networking.istio.io/v1`) with subsets; use it when a mesh feature has no Gateway API equivalent.

### Circuit Breaker — Istio example

```yaml
apiVersion: networking.istio.io/v1
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

### nftables Rules (Linux, recommended)

nftables is the modern replacement for iptables and the default on current distributions.

Design notes:
- Use a **uniquely named table** and replace only that table (`delete table` then re-add, in one file, applied atomically). Do not `flush ruleset` on hosts running Docker or Kubernetes: container runtimes and CNIs create their own tables and the flush removes them.
- Every table with a chain at the same hook is evaluated, and a drop in any of them drops the packet. On container hosts, do not add a `forward` chain with `policy drop`; the runtime owns forwarding.
- ICMP and ICMPv6 are required: IPv6 neighbour discovery, router advertisements, and path-MTU discovery break if ICMPv6 is dropped.
- Put rate limits **before** the broad accept, and give them a drop for the excess; a limit placed after an accept never runs.
- Output policy here is `accept`: egress is restricted at the network layer (security groups, NetworkPolicy). Set `policy drop` and enumerate flows if the host must enforce egress itself.
- **Avoid lockout:** validate with `nft -c -f file`, and before applying remotely schedule a timed rollback (for example a delayed job that deletes the table), then cancel it once a new session proves access.

```bash
#!/usr/sbin/nft -f
table inet host_fw
delete table inet host_fw

table inet host_fw {
    chain input {
        type filter hook input priority filter; policy drop;

        ct state invalid drop
        ct state established,related accept
        iif lo accept

        # ICMP / ICMPv6: diagnostics, neighbour discovery, path-MTU discovery
        ip protocol icmp icmp type { destination-unreachable, time-exceeded, parameter-problem, echo-request } limit rate 10/second accept
        ip6 nexthdr icmpv6 icmpv6 type { destination-unreachable, packet-too-big, time-exceeded, parameter-problem, echo-request, nd-router-advert, nd-neighbor-solicit, nd-neighbor-advert } accept

        # SSH only from the admin network
        ip saddr 10.0.0.0/8 tcp dport 22 accept

        # Rate-limit new web connections first; the excess is dropped
        tcp dport { 80, 443 } ct state new limit rate over 200/second burst 400 packets drop
        tcp dport { 80, 443 } accept
        udp dport 443 accept   # QUIC / HTTP/3
    }

    chain output {
        type filter hook output priority filter; policy accept;
    }
}
```

### iptables (Legacy)

Still widely used; `iptables-translate` helps migrate. Same concepts: default deny, allow established and loopback, allow required ICMP, restrict SSH by source, rate-limit before the broad accept.

### Cloud Security Group Pattern (provider-agnostic)

```
# Edge / load balancer tier
Inbound:  TCP 443 from 0.0.0.0/0          (HTTPS)
Inbound:  UDP 443 from 0.0.0.0/0          (QUIC, only if HTTP/3 is enabled)
Inbound:  TCP 80  from 0.0.0.0/0          (redirect to HTTPS only)
Outbound: TCP 8443 to app-tier-sg         (TLS to the application)

# App tier
Inbound:  TCP 8443 from lb-tier-sg        (from the load balancer only)
Outbound: TCP 5432 to db-tier-sg
Outbound: TCP 6379 to cache-tier-sg
Outbound: TCP 443 to 0.0.0.0/0            (external APIs)

# DB tier
Inbound:  TCP 5432 from app-tier-sg
Outbound: none
```

A plaintext leg from the load balancer to the backend contradicts the no-plaintext rule; if one exists, record it as an exception with its reason.

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

---

## Volatile Facts

Checked October 2026 against CA/Browser Forum ballot SC-081, Let's Encrypt announcements, and the Kubernetes blog. Re-check before stating dates or limits.

- **Public certificate lifetime:** the CA/Browser Forum schedule reduces the maximum lifetime in steps (ballot SC-081: 200 days for certificates issued from 15 March 2026, 100 days from 15 March 2027, 47 days from 15 March 2029). Some CAs already issue shorter certificates. Design renewal for the end state: fully automated, no manual steps, alerts on renewal failure.
- **Revocation:** Let's Encrypt removed OCSP URLs from new certificates on 7 May 2025 (Must-Staple requests fail since then) and turned off its OCSP responders on 6 August 2025; it relies on short lifetimes and CRLs. Stapling only helps with CAs that still publish OCSP.
- **Client authentication:** Chrome's root program set a June 2026 deadline to split TLS client and server authentication into separate PKIs, so public CAs are dropping the client-auth extended key usage. Let's Encrypt removed it from its default `classic` profile on 11 February 2026 and stopped issuing it entirely when the `tlsclient` profile ended on 8 July 2026. Use a private CA for mTLS.
- **Ingress controllers:** the Kubernetes ingress-nginx project ended best-effort maintenance in March 2026: no further releases, bug fixes, or security fixes. Existing deployments keep running. Check the maintenance status of any ingress or gateway controller before recommending it, and prefer Gateway API for new work.
- **Post-quantum key exchange:** hybrid ML-KEM groups are broadly available in browsers, CDNs, and TLS libraries; check the specific library and load balancer versions.
