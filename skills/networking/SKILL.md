---
name: networking
description: Review and implement network infrastructure — DNS, CDN, TLS/mTLS, load balancing, service mesh, firewalls. Use when working with DNS, CDN, TLS/mTLS, HTTP/2-3, load balancing, service mesh, or firewalls. Do NOT use for application-level HTTP (web) or K8s networking (kubernetes).
allowed-tools: Read, Grep, Glob, WebSearch, WebFetch
user-invocable: true
---

# Networking — Infrastructure Network Specialist

## DNS Record Types

| Type | Purpose | Example |
|------|---------|---------|
| A | IPv4 address | `api.example.com -> 93.184.216.34` |
| AAAA | IPv6 address | `api.example.com -> 2606:2800:220:1:...` |
| CNAME | Alias to another name | `www -> api.example.com` (no CNAME at apex) |
| MX | Mail server | `example.com -> mail.example.com` (priority 10) |
| TXT | Verification, SPF, DKIM | `v=spf1 include:_spf.google.com ~all` |
| SRV | Service location + port | `_sip._tcp.example.com -> sip.example.com:5060` |
| CAA | Certificate authority restriction | `example.com CAA 0 issue "letsencrypt.org"` |
| NS | Delegated nameserver | `example.com -> ns1.provider.com` |
| HTTPS/SVCB | Service binding + parameters | `example.com HTTPS 1 . alpn="h3,h2" ech=...` |

**TTL guidance:** Low (60s) during migrations, moderate (300s) for dynamic services, high (3600s+) for stable records.

**DNS security layers:**
- DNSSEC — authenticates responses (prevents spoofing)
- DoH (port 443) / DoT (port 853) — encrypts transport (prevents eavesdropping)
- Use both together. DNSSEC validates; DoH/DoT encrypts.

---

## CDN Patterns

| Pattern | Description |
|---------|-------------|
| Edge caching | Cache static assets at PoPs close to users |
| Origin shield | Intermediate cache between edge and origin — reduces origin load |
| Cache invalidation | Purge by URL, tag, or prefix; prefer versioned URLs over purging |
| Stale-while-revalidate | Serve stale content while fetching fresh in background |
| Dynamic content | Cache-Control: no-store, or vary by cookie/header |

**Cache-Control header cheat sheet:**
```
Static assets:    Cache-Control: public, max-age=31536000, immutable
HTML pages:       Cache-Control: no-cache (revalidate every time)
API responses:    Cache-Control: private, max-age=60
Sensitive data:   Cache-Control: no-store
```

---

## TLS & Certificate Management

**TLS 1.3 improvements:** 1-RTT handshake (vs 2-RTT in 1.2), removed weak ciphers, 0-RTT resumption (with replay risk).

**Certificate chain:** Leaf cert -> Intermediate CA -> Root CA. Always serve the full chain (leaf + intermediates).

**OCSP stapling:** Server fetches certificate status and includes it in TLS handshake — faster than client checking separately.

**Encrypted Client Hello (ECH):** Encrypts the SNI field in TLS handshake via keys published in DNS HTTPS/SVCB records. Prevents network observers from seeing which hostname the client connects to. Requires HTTPS DNS record type with `ech` parameter.

**Post-quantum readiness:** TLS 1.3 hybrid key exchange combines classical ECDHE with ML-KEM (FIPS 203). Adds ~1600 bytes to handshake and ~100us latency. Major cloud providers and CDNs are deploying hybrid PQ key exchange. Plan migration: inventory endpoints, test hybrid handshakes, monitor handshake sizes.

### mTLS Pattern

```
Client                          Server
  |--- ClientHello ------------->|
  |<-- ServerHello + ServerCert --|
  |--- ClientCert + Verify ----->|   <- Client also authenticates
  |<-- Finished -----------------|
```

Use mTLS for: service-to-service auth, zero-trust networks, API client authentication.

### mTLS Automation Decision Tree

```
Need service-to-service mTLS?
|
+-> Running in Kubernetes/orchestrator?
|   +-> Yes -> Use platform-native identity (SPIFFE/SPIRE, mesh-managed certs)
|   +-> No  -> Use ACME-based CA with short-lived certs (hours/days, not months)
|
+-> Certificate lifecycle:
    +-> Manual rotation -> Anti-pattern. Automate with cert manager or SPIFFE agent.
    +-> Auto-rotation with short TTL -> Correct. Prefer re-issuance over CRL/OCSP revocation.
```

**SPIFFE/SPIRE pattern:** Workloads receive cryptographic identity (SVID) automatically. SPIRE agent on each node attests workloads via platform signals (K8s service accounts, AWS instance metadata). Short-lived X.509 certs rotate transparently. No secrets in code, no manual certificate management.

---

## Load Balancing Algorithms

| Algorithm | Best For | Trade-off |
|-----------|----------|-----------|
| Round-robin | Equal-capacity backends | Ignores load |
| Weighted round-robin | Mixed-capacity backends | Manual weight tuning |
| Least connections | Variable request duration | Requires connection tracking |
| IP hash | Session affinity without cookies | Uneven if clients skew |
| Consistent hashing | Distributed caches, minimal reshuffling | More complex to implement |
| Random-two-choices | Large pools, good balance | Slightly higher latency |

Health checks: Active (periodic probe) vs passive (track failures). Use both. Remove unhealthy backends within 2-3 failed checks.

---

## HTTP/2 vs HTTP/3

| Feature | HTTP/2 | HTTP/3 |
|---------|--------|--------|
| Transport | TCP + TLS 1.2+ | QUIC (UDP + TLS 1.3) |
| Multiplexing | Yes (head-of-line blocking at TCP level) | Yes (no head-of-line blocking) |
| Handshake | TCP + TLS = 2-3 RTT | QUIC = 1 RTT (0-RTT resumption) |
| Connection migration | No (new connection on IP change) | Yes (connection ID survives IP change) |
| Adoption | Universal | Majority of top websites, all major browsers + CDNs |

HTTP/3 is production-ready and widely deployed. CDNs enable it by default. Prioritize for mobile and high-latency networks. Enable via DNS HTTPS record with `alpn="h3,h2"` for protocol discovery.

---

## Service Mesh Decision Tree

```
Need service-to-service security + observability?
|
+-> Need only mTLS + L4 policy?
|   +-> Yes -> eBPF-based CNI (kernel-level, no proxy overhead)
|   +-> No  -> Need L7 features (traffic splitting, retries, header routing)?
|              +-> Yes -> Sidecar mesh OR ambient/sidecarless mesh
|              +-> No  -> eBPF-based CNI is sufficient
|
+-> Concerned about resource overhead?
    +-> High overhead tolerance -> Sidecar-based mesh (full L7 per pod)
    +-> Low overhead required  -> Ambient mesh (per-node L4 + optional L7 waypoints)
    +-> Minimal overhead       -> eBPF-based (kernel-level, no proxy)
```

### Architecture Comparison

| Approach | How It Works | Trade-off |
|----------|-------------|-----------|
| Sidecar-based | Proxy per pod intercepts all traffic | Full L7 control, higher memory per pod |
| Ambient / sidecarless | Per-node agent for L4 mTLS + optional L7 waypoint proxies | ~90% memory savings, gradual L7 opt-in |
| eBPF-based | Kernel-level networking, no proxy | Lowest overhead, Linux kernel dependency |

Key capabilities across all approaches: mTLS mesh, traffic splitting (canary), circuit breaking, distributed tracing, rate limiting.

---

## Zero Trust Network Architecture

**Core principle:** Never trust, always verify. Network location grants no implicit trust.

**Implementation layers:**
1. **Identity** — Every workload gets a cryptographic identity (SPIFFE SVIDs, platform-managed certs). No shared secrets.
2. **Authentication** — mTLS for every service-to-service call. Verify identity at every hop.
3. **Authorization** — Policy-based access control per service pair. Default deny, explicit allow.
4. **Encryption** — All traffic encrypted in transit. No plaintext within the network.
5. **Microsegmentation** — Network policies restrict lateral movement. Each service can only reach its declared dependencies.

---

## Firewall Rules

```
# Zero-trust model
Default: DENY ALL inbound + outbound
Allow: Only explicitly required flows

# Security group pattern (cloud-agnostic)
Ingress: Allow TCP 443 from 0.0.0.0/0        # HTTPS from internet
Ingress: Allow TCP 80 from LB security group  # HTTP from load balancer only
Egress:  Allow TCP 5432 to DB security group  # Database access only
Egress:  Allow TCP 443 to 0.0.0.0/0           # HTTPS to external APIs
```

**Linux firewalls:** Prefer nftables over iptables for new deployments (default on modern distributions). nftables offers unified syntax, atomic rule updates, and better performance.

---

## Context Adaptation

### DevOps
- DNS record management, TTL strategy, DNSSEC + HTTPS/SVCB records
- Load balancer setup, health checks, SSL termination
- CDN configuration, cache rules, WAF integration
- Reverse proxy configuration

### Security
- TLS 1.3 enforcement, cipher suite selection, certificate management
- mTLS for service-to-service authentication, SPIFFE/SPIRE identity
- Firewall rules, security groups, zero-trust network architecture
- DDoS mitigation, WAF rules, rate limiting at network edge
- Post-quantum TLS migration planning

### SRE
- Latency profiling (DNS resolution, TLS handshake, TTFB)
- Service mesh observability (distributed tracing, golden signals)
- Circuit breaking and retry budgets
- Connection pool tuning, keep-alive configuration

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| TLS 1.0/1.1 in production | Known vulnerabilities, compliance failures | TLS 1.3 (or 1.2 minimum) |
| Wildcard DNS without DNSSEC | DNS spoofing, subdomain takeover | DNSSEC + CAA records |
| No health checks on load balancer | Traffic routed to dead backends | Active + passive health checks |
| Single point of failure | One LB/DNS failure takes down service | Redundant LBs, multi-provider DNS |
| Hardcoded IPs | Fragile, breaks on infrastructure change | DNS names, service discovery |
| Plaintext DNS without DoH/DoT | DNS queries visible to eavesdroppers | DoH or DoT + DNSSEC |
| iptables on new Linux deployments | Legacy, fragmented syntax, no atomic updates | nftables (unified, atomic, performant) |
| Manual certificate rotation | Human error, expired certs, outages | Automated cert management with short TTLs |
| Network-perimeter-only security | Breached perimeter = full lateral access | Zero trust with mTLS + microsegmentation |
| Sidecar mesh for L4-only needs | Unnecessary resource overhead for basic mTLS | eBPF-based CNI or ambient mesh |

---

## Related Knowledge

- **kubernetes** — Ingress controllers, NetworkPolicy, service mesh integration, cert-manager
- **docker** — Container networking (bridge, host, overlay), port mapping, DNS resolution
- **devops** — Reverse proxy config, CI/CD network requirements
- **security** — TLS hardening, zero-trust architecture, WAF, DDoS mitigation
- **sre** — Latency profiling, connection pool tuning, circuit breaking
- **web** — HTTP protocol semantics, fetch API, CORS (boundary: web handles application-level HTTP; networking handles transport/infrastructure)

---

## References

- [networking-patterns.md](references/networking-patterns.md) — Detailed configuration examples for DNS zones, TLS setup, load balancers, CDN rules, service mesh config, and firewall patterns

Load references when you need detailed configuration examples or protocol deep dives.
