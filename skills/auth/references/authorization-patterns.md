# Authorization Patterns

Deciding what an authenticated caller may do. Policy engines named here are examples; check the project's stack before choosing one.

## Contents

- [Models](#models)
- [Enforcement Points](#enforcement-points)
- [Multi-Tenancy](#multi-tenancy)
- [Relationship-Based Access](#relationship-based-access)
- [Policy Engines](#policy-engines)
- [Change and Revocation](#change-and-revocation)
- [Testing Authorization](#testing-authorization)

---

## Models

| Model | Decision inputs | Fits | Breaks down when |
|-------|-----------------|------|------------------|
| RBAC | Caller's roles → permissions | Few stable roles; access does not depend on the record | Per-record sharing, ownership, tenants |
| ABAC | Attributes of caller, resource, action, context | Ownership, department, region, time, risk | Rules span chains of relationships |
| ReBAC | Relationship graph (user → member → team → owner → folder → parent → document) | Sharing, nested hierarchies, inherited access | Pure attribute rules; adds a graph store |

Real systems combine them: roles grant permissions; ownership and tenant attributes narrow them; relationships handle sharing.

```
canUpdate(caller, invoice):
  caller.hasPermission("invoice:update")          # RBAC: role → permission
  and invoice.tenantId == caller.tenantId          # tenant boundary
  and (invoice.ownerId == caller.id or caller.hasPermission("invoice:update:any"))
  and invoice.status in {draft}                    # state-dependent rule
```

Check permissions, never role names (`if role == "admin"`): roles change, permissions are what code needs.

---

## Enforcement Points

```
request ─▶ gateway / middleware ─▶ handler ─▶ service / domain ─▶ data access
            coarse: authenticated?          object-level policy   tenant filter
            scope present?                  (the decision)        (defence in depth)
```

- **The decision lives in the service or domain layer**, which every entry point calls: HTTP, GraphQL resolvers, RPC, queue consumers, scheduled jobs, admin tools.
- **Middleware and directives** check coarse conditions (authenticated, has scope `invoices:write`) and fail early.
- **Data access** applies tenant and visibility filters so a missed check returns nothing instead of another tenant's data.
- **Lists and search:** filter in the query (`WHERE tenant_id = ? AND (owner_id = ? OR shared_with @> ?)`), not by loading rows and filtering in code; counts and facets must use the same filter.
- **Not found vs forbidden:** return 404 for records the caller may not know exist; 403 when existence is not secret.
- **Background work** runs with an explicit principal (the user who requested it, or a service identity with its own permissions), not with implicit superuser rights.

---

## Multi-Tenancy

- Every tenant-owned row carries `tenant_id`; every query includes it, enforced by the data access layer or by database row-level security.
- Derive the tenant from the authenticated principal, never from a request parameter the caller controls.
- Cross-tenant operations (support staff, platform admins) use separate permissions, are audited, and are time-limited.
- Caches, search indexes, file storage paths, and queues are tenant-scoped too; a cache key without the tenant leaks data.

---

## Relationship-Based Access

```
tuples:
  document:roadmap#parent@folder:planning
  folder:planning#viewer@team:product#member
  team:product#member@user:ana

check(user:ana, viewer, document:roadmap) → true (via folder → team)
```

- Model relations and how they inherit (`viewer` of a document includes `viewer` of its parent folder).
- Write tuples in the same transaction as the domain change, or through an outbox, so the graph does not drift from the data (pattern: `architecture`).
- Consistency: a check right after a sharing change must see it; use the engine's consistency token or read-your-writes mode.
- Examples: Zanzibar-style services such as OpenFGA and SpiceDB.

---

## Policy Engines

```
Are rules simple and owned by one service?
├─ yes → policy functions in code, unit-tested; no engine
└─ no → Must several services or languages share the same rules, or must non-developers review them?
        ├─ yes → a policy engine with policies in version control
        └─ no → policy module shared as a library
```

Examples: OPA/Rego and Cedar for attribute policies; Casbin for model-driven RBAC/ABAC in-process. Engines evaluate; your code still supplies correct, fresh attributes.

---

## Change and Revocation

- Role or membership changes must reach sessions and tokens: keep access tokens short, re-load permissions per request from a cached source with a version, or revoke sessions on change.
- Long-lived connections (WebSocket, SSE, subscriptions) re-check on permission change or periodically; close or downgrade the channel when access is lost (`realtime`).
- Decision caches are keyed by subject, object, action, and policy version, with short TTLs.

---

## Testing Authorization

- A matrix test per resource: roles/relations × actions × ownership × tenant, asserting allow and deny.
- For every endpoint and resolver, a test that a second user in another tenant gets 404/403 on the first user's object.
- A test that lists, counts, exports, and search results exclude objects the caller cannot see.
- Fail closed: a missing policy or an engine error denies, logs, and alerts.
