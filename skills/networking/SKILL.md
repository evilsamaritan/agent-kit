---
name: networking
description: "Design or review network infrastructure. Use for DNS, CDN edge, TLS and certificate lifecycle, mTLS, load balancers, reverse proxies, service mesh, and firewall or segmentation rules."
user-invocable: true
---

# Networking

Infrastructure transport: how traffic is named, encrypted, balanced, and segmented. Volatile facts (certificate lifetime limits, CA behavior, post-quantum rollout, controller status) are in [networking-patterns.md](references/networking-patterns.md#volatile-facts); check them before giving dates or limits.

## Scope and boundaries

**Owns:** DNS, CDN topology (edge, origin shield), TLS termination and certificate lifecycle, mTLS, load balancing, proxies, service mesh choice, firewalls and segmentation, zero-trust network model.

**Does not own:**
- HTTP semantics, CORS, CSP, cookie and header mechanics, browser behavior → `web`
- Cache-Control policy and invalidation → `caching`
- Application security controls and audit → `security`
- Cluster networking objects (NetworkPolicy, Ingress, Gateway API resources) → `kubernetes`
- Container networking → `docker`
- Retry, breaker, and timeout policy → `reliability`

## Decision trees

### Where does TLS end?

```
Client-facing traffic
├── Public service → terminate at the edge or load balancer with an automated public certificate
│   └── Backend leg: re-encrypt to the backend (TLS, mTLS where the backend must identify the proxy)
└── Internal service-to-service
    ├── Need caller identity → mTLS with a private CA (see below)
    └── Encryption only → TLS at library, sidecar, or node level
```

### Which CA issues what?

```
Certificate for ...
├── Public web endpoint → public CA via ACME, automated, short lifetime
├── Client authentication or service-to-service mTLS → private CA only
│   ├── Kubernetes / orchestrator → workload identity (SPIFFE/SPIRE, mesh CA, cloud-managed private CA)
│   └── Otherwise → private CA with ACME or SPIFFE-style issuance, lifetime of hours to days
└── Internal HTTPS tool → private CA, automated
```

Public CAs are removing the client-authentication usage from certificates; do not use public-CA certificates for client auth. Design for automated renewal: public certificate lifetimes keep shrinking (limits in the volatile reference), so any manual step eventually breaks.

### Do I need a service mesh?

```
Many services, several teams, or several trust zones?
├── No (a few services, one trust zone) → library or platform TLS; no mesh
└── Yes
    ├── Need L7 policy or routing (retries, traffic splitting, header routing, per-route authorization)?
    │   ├── Yes → L7 data plane: sidecar, ambient with L7 waypoints, or proxyless (gRPC/xDS)
    │   └── No (identity, encryption, L4 policy only)
    │       └── CNI or node-level encryption and network policy, or an ambient mesh's L4 layer
    └── Then pick the overhead profile: sidecars (full L7 per workload, most memory), ambient (per-node L4,
        L7 opt-in), proxyless (library-level, language-limited)
```

eBPF-based CNIs give kernel-level L3/L4 policy and visibility; L7 features still need a proxy, and mutual-authentication features in eBPF CNIs vary in maturity, so verify the specific product and version. Figures such as memory savings are product- and version-specific; take them from current benchmarks, not from this skill.

### Load balancing

| Algorithm | Best for | Trade-off |
|-----------|----------|-----------|
| Round-robin / weighted | Equal / mixed-capacity backends | Ignores load |
| Least connections | Variable request duration | Needs connection tracking |
| Consistent hashing | Caches, affinity, minimal reshuffle | Uneven load if keys skew |
| Power of two choices | Large pools, good balance at low cost | Needs load signal |
| IP hash | Affinity without cookies | Uneven behind NAT |

Health checks: active (probe) plus passive (observed failures); eject after a few consecutive failures. What a health endpoint should check is `reliability` policy.

## Reverse proxies, certificate renewal, and traffic switching

- **Reverse proxy** (nginx, Caddy, Traefik, HAProxy, Envoy): terminates TLS, routes by host and path, sets timeouts and body limits, and forwards the client address in a trusted header only from known proxies. Pick by operating model (static config, automatic TLS, dynamic discovery); sample configs in [networking-patterns.md](references/networking-patterns.md#reverse-proxy-configuration).
- **Renewal monitoring:** automate issuance, then monitor it. Alert on days until expiry of the certificate actually served (probe the endpoint, not the file) and on renewal failures, with a threshold well inside the renewal window.
- **Traffic switching:** shift traffic by weight at the load balancer, gateway, or weighted DNS (DNS shifts lag by TTL and resolver caching). Keep the old target warm and drain connections before removing it. Rollout and rollback strategy: `release-engineering`.

## DNS essentials

- Short TTL (60 s) before migrations and for failover records; longer (300 s to hours) for stable records. Lower the TTL ahead of the change, not during it.
- No CNAME at the zone apex; use an alias-type record or the provider's flattening.
- CAA restricts which CAs may issue for the domain.
- HTTPS/SVCB records advertise protocols (`alpn`), addresses, and Encrypted Client Hello keys.
- **DNSSEC** authenticates answers: the zone operator signs, resolvers validate. Use managed signing or an automated key policy; manual key handling is the same anti-pattern as manual certificate rotation.
- **DoH/DoT** encrypt the client-to-resolver hop. That is a client or resolver decision, not something an authoritative operator deploys.
- **Subdomain takeover** comes from dangling CNAMEs and unreleased cloud resources. Inventory records and remove them when the target resource is deleted.

## TLS essentials

- TLS 1.3 preferred, 1.2 as the minimum. TLS 1.0/1.1 off.
- Serve the full chain (leaf plus intermediates).
- **Revocation:** the ecosystem is moving to short-lived certificates and CRLs. Use OCSP stapling only if your CA still publishes OCSP responders; a stapling directive against a CA that does not will log errors.
- ECH hides the SNI using keys published in DNS; it needs DNS HTTPS records and server support.
- Post-quantum: hybrid key exchange (classical plus ML-KEM) is being rolled out; inventory endpoints and test middleboxes against larger handshakes.
- 0-RTT resumption has replay risk; allow it only for idempotent requests.

## HTTP/2 and HTTP/3

HTTP/3 runs over QUIC on **UDP**. If you enable it: open UDP 443 in firewalls and security groups next to TCP 443, advertise it with `Alt-Svc` (the usual discovery path) and optionally the HTTPS DNS record, and keep HTTP/2 over TCP as the fallback because some networks block UDP. Prioritize HTTP/3 for mobile and high-latency clients.

## CDN

Topology patterns: edge caching, origin shield (an intermediate cache that reduces origin load), stale serving during revalidation, bypass for dynamic content. Purge and invalidation: `caching`. **Header policy (Cache-Control) is owned by `caching`**; header mechanics by `web`.

## Zero-trust network model

Network location grants no implicit trust. This skill owns the model; `security` links here.

1. **Identity** — every workload has a cryptographic identity, not a shared secret.
2. **Authentication** — mTLS between services; verify at every hop.
3. **Authorization** — policy per service pair, default deny.
4. **Encryption** — all traffic encrypted in transit, including inside the network and from load balancer to backend.
5. **Segmentation** — each service reaches only its declared dependencies.

## Firewall rules

```
Inbound: default deny. Allow only required flows.
Outbound: default deny where flows can be enumerated (cloud security groups, Kubernetes
          NetworkPolicy); otherwise allow by default and restrict at the network layer.

# Security group pattern (cloud-agnostic)
Ingress: TCP 443 and UDP 443 from 0.0.0.0/0   # HTTPS, plus QUIC if HTTP/3 is enabled
Ingress: TCP 8443 from LB security group       # backend TLS; plaintext only as a documented exception
Egress:  TCP 5432 to DB security group
Egress:  TCP 443 to 0.0.0.0/0                  # external APIs
```

On Linux hosts prefer nftables over iptables for new deployments. Test remote rule changes with a timed rollback to avoid locking yourself out. Sample ruleset: [networking-patterns.md](references/networking-patterns.md#firewall-patterns).

## Context Adaptation

- **Platform work:** DNS and TTL strategy, load balancers and health checks, CDN edge rules, proxy configuration, certificate automation.
- **Security work:** TLS configuration, mTLS and workload identity, segmentation, DDoS and rate limiting at the edge.
- **Operations:** measure DNS, TLS handshake, and time to first byte separately; mesh telemetry feeds `observability`.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Correct Approach |
|-------------|-------------|-----------------|
| TLS 1.0/1.1 enabled | Known weaknesses, audit failures | TLS 1.3, 1.2 minimum |
| Dangling CNAME or unreleased cloud resource | Subdomain takeover | Inventory and remove records with the resource |
| Public-CA certificates for client auth | Public CAs are dropping that usage | Private CA |
| Manual certificate rotation or manual DNSSEC keys | Expiry outages | Automated issuance and renewal |
| HTTP/3 enabled but UDP 443 blocked | Silent fallback, no benefit | Open UDP 443, keep TCP fallback |
| No health checks on the load balancer | Traffic to dead backends | Active plus passive checks |
| Single point of failure (one LB, one DNS provider) | One failure takes the service down | Redundancy at each layer |
| Hardcoded IPs | Break on infrastructure change | DNS names, service discovery |
| Plaintext from load balancer to backend as the default | Breaks the no-plaintext rule | Re-encrypt, or document the exception |
| Perimeter-only security | Breach means lateral access | Zero trust: identity, mTLS, segmentation |
| Mesh for a handful of services | Overhead without benefit | Library or platform TLS |

## Related Knowledge

- `web` — HTTP semantics, CORS, CSP, cookies, header mechanics
- `caching` — Cache-Control and CDN cache policy
- `security` — application controls; links here for zero trust
- `kubernetes` — Ingress/Gateway API, NetworkPolicy, mesh integration, cert-manager
- `docker` — container networking
- `reliability` — retries, breakers, health-check policy
- `ci-cd` — pipeline network requirements

## References

- [networking-patterns.md](references/networking-patterns.md) — DNS zone, TLS and mTLS configs, load balancer configs, CDN topology, Gateway API and mesh examples, nftables sample, troubleshooting commands, volatile facts
