# Backend Service Review Protocol

4-phase audit for backend services. Adapt checklists to the project's actual stack.

---

## Phase 1: Service Structure Scan

Map the service topology before reviewing details.

1. Identify entry points, bootstrap order, and shutdown hooks
2. Map dependency injection approach (container, module system, manual wiring)
3. Identify config loading and validation strategy
4. Map inter-service communication (HTTP, message queue, events, gRPC)
5. Identify external API integrations
6. Map database connections and pooling per service
7. Check for health endpoints (liveness vs readiness probes)

---

## Phase 2: API Audit

### Consistency
- [ ] All endpoints follow the same JSON property naming convention
- [ ] All endpoints use consistent response envelope shape
- [ ] All error responses follow the error contract (error, message, code, requestId)
- [ ] All list endpoints support pagination (or have a bounded default limit)
- [ ] All endpoints return appropriate HTTP status codes
- [ ] Content-Type headers set correctly

### Resource Design
- [ ] URLs are resource-oriented (nouns, not verbs)
- [ ] Relationships modeled as sub-resources (`/items/:id/comments`)
- [ ] No deeply nested routes (max 2 levels)
- [ ] Singular vs plural used correctly (plural for collections)
- [ ] IDs validated before database queries

### Input Validation
- [ ] Request body validated against a schema before business logic
- [ ] Query parameters validated and typed
- [ ] Path parameters validated (numeric IDs are numbers, UUIDs match format)
- [ ] Validation errors return 400 with field-level details
- [ ] Content-Type enforced for POST/PATCH/PUT

### Error Handling
- [ ] All errors return structured JSON (not HTML or plain text)
- [ ] Error responses include machine-readable code
- [ ] No stack traces in production responses
- [ ] 404 for missing resources (not 200 with null body)
- [ ] 409 for state conflicts (e.g., publishing already-published resource)
- [ ] 422 for valid input that fails business rules

---

## Phase 3: Service Code Review

### Dependency Injection
- [ ] Services wired via DI (container, module, or constructor injection) — not manually instantiated
- [ ] Singletons for stateful resources (DB connections, message queues, loggers)
- [ ] Constructor injection preferred (no service locator / global registry access)
- [ ] No circular dependencies
- [ ] Container types exported for type-safe access (in typed languages)

### Configuration
- [ ] Schema validates all required environment variables at startup
- [ ] Defaults provided for optional config
- [ ] Config loaded once at startup (not re-read per request)
- [ ] No hardcoded values that should be configurable
- [ ] Secrets not logged or included in error responses

### Message Queue Integration (if applicable)
- [ ] Consumer group ID is unique and meaningful
- [ ] Offsets/acks committed after successful processing (not before)
- [ ] Dead letter queue configured for unprocessable messages
- [ ] Consumer stopped before DB connection closed (shutdown order)
- [ ] Producer disconnected in shutdown hook

### Database Access
- [ ] Repository/DAO pattern: DB access encapsulated, not scattered through handlers
- [ ] Parameterized queries or query builder (no string interpolation for SQL)
- [ ] Transactions used for multi-step writes
- [ ] Connection pool bounded (no unbounded parallel queries)

### Structured Logging
- [ ] Significant operations logged with correlation IDs (requestId, traceId)
- [ ] Log level appropriate (debug for hot paths, info for state changes, error for failures)
- [ ] No PII or secrets in log fields
- [ ] Error logs include error object for debugging

### Graceful Shutdown
- [ ] Shutdown hooks registered for SIGTERM/SIGINT
- [ ] Shutdown order: stop accepting work → drain in-flight → flush → close resources
- [ ] Timeout on shutdown to prevent hanging
- [ ] Resources closed in reverse order of initialization

---

## Phase 4: Report

```
## Backend Service Assessment

### Summary
[2-3 sentences: service health, API consistency, notable issues]

### Service Structure
| Component | Pattern | Notes |
|-----------|---------|-------|
| Entry point | | |
| DI approach | | |
| Config | | |
| Message queue | | |
| Health check | | |

### API Endpoint Inventory
| Method | URL | Auth | Validates Input | Response Shape | Status Codes |
|--------|-----|------|----------------|---------------|-------------|

### Consistency Audit
| Dimension | Status | Notes |
|-----------|--------|-------|
| Naming convention | | |
| Response shape | | |
| Error contract | | |
| Pagination | | |
| Status codes | | |

### DI Review
| Service | Lifetime | Dependencies | Issues |
|---------|----------|-------------|--------|

### Findings
| # | Area | Severity | Finding | Location | Recommendation |
|---|------|----------|---------|----------|----------------|

### Recommendations
1. [Priority order]
```
