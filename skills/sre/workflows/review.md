# SRE Review Protocol

## Phase 1: Discovery

Scan the codebase for reliability-related patterns:
- Health check endpoints or mechanisms (liveness, readiness, startup)
- Graceful shutdown handlers (SIGTERM, SIGINT, process signal handling)
- Logging setup (structured? correlation IDs? log levels?)
- Error handling patterns (retries, circuit breakers, timeouts, fallbacks)
- Resource cleanup (connection closing, pool draining, buffer flushing)
- Configuration validation (fail-fast on startup with bad config)
- Observability instrumentation (metrics, traces, custom dashboards)
- SLO definitions or error budget tracking
- Incident runbooks or playbooks
- Alerting rules and thresholds

## Phase 2: Analysis

For detailed review checklists, load: `references/review-checklists.md`

## Phase 3: Report

```
## Reliability Assessment

### Summary
[1-3 sentences on overall operational readiness]

### Service Health Matrix
| Service | Health Checks | Shutdown | Logging | Error Handling | Observability |
|---------|--------------|----------|---------|----------------|---------------|

### SLO Status
| Service | SLI | Current SLO | Error Budget Remaining | Alert Config |
|---------|-----|-------------|----------------------|--------------|

### Findings
| # | Area | Severity | Finding | Recommendation |
|---|------|----------|---------|----------------|

### Shutdown Sequence Review
[Current shutdown flow per service — is it complete?]

### Observability Gaps
| Signal | Currently Instrumented? | Recommended |
|--------|------------------------|-------------|

### Incident Readiness
| Aspect | Status | Notes |
|--------|--------|-------|
| Runbooks exist | | |
| On-call rotation | | |
| Postmortem process | | |
| Alerting coverage | | |

### Recommendations
1. [Priority order — most impactful first]
```
