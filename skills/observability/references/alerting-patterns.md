# Alerting Patterns

Symptom-based alerting, severity levels, alert templates, and noise reduction.

## Contents

- [Symptom-Based Alerting](#symptom-based-alerting)
- [Severity Levels](#severity-levels)
- [Alert Templates](#alert-templates)
- [Noise Reduction](#noise-reduction)
- [Runbook Structure](#runbook-structure)

---

## Symptom-Based Alerting

Alert on what users experience, not on internal system causes.

```
BAD:  Alert on CPU > 90%              (cause, not symptom)
BAD:  Alert on thread count > 500     (cause, not symptom)
BAD:  Alert on GC pause > 200ms       (cause, not symptom)

GOOD: Alert on error rate > 1%         (user-facing symptom)
GOOD: Alert on p99 latency > 2s        (user-facing symptom)
GOOD: Alert on success rate < 99.9%    (SLO violation)
```

### Why Symptom-Based

- **Fewer alerts**: one symptom replaces dozens of cause-based alerts
- **Actionable**: user impact is clear from the alert itself
- **Stable**: cause-based thresholds need constant tuning as infrastructure changes
- **Composable**: cause investigation happens in dashboards, not alert rules

### When Cause-Based Is OK

- **Capacity planning**: disk 80% full (predictable, time to act before symptom)
- **Cost management**: cloud spend approaching budget
- **Security**: failed login rate spike

---

## Severity Levels

| Severity | Response Time | Example | Action |
|----------|---------------|---------|--------|
| Critical (P1) | Immediate (page on-call) | Service down, data loss risk | Wake someone up |
| High (P2) | Within 1 hour | Error rate elevated but partial | Investigate promptly |
| Warning (P3) | Next business day | Disk 80% full, lag growing | Schedule fix |
| Info | No action needed | Deploy completed, scaling event | Record for context |

### Routing by Severity

```yaml
# Alertmanager routing
route:
  receiver: 'default-slack'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-oncall'
      repeat_interval: 5m
    - match:
        severity: high
      receiver: 'slack-urgent'
      repeat_interval: 30m
    - match:
        severity: warning
      receiver: 'slack-warnings'
      repeat_interval: 4h
```

---

## Alert Templates

### High Error Rate

```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
for: 5m
labels:
  severity: critical
  team: backend
annotations:
  summary: "Error rate above 1% for {{ $labels.service }}"
  description: "Current error rate: {{ $value | humanizePercentage }}"
  runbook: "https://wiki.example.com/runbooks/high-error-rate"
  dashboard: "https://grafana.example.com/d/service-overview"
```

### High Latency

```yaml
alert: HighLatency
expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)) > 2
for: 5m
labels:
  severity: warning
annotations:
  summary: "P99 latency above 2s for {{ $labels.service }}"
  description: "Current p99: {{ $value | humanizeDuration }}"
  runbook: "https://wiki.example.com/runbooks/high-latency"
```

### SLO Burn Rate

```yaml
alert: ErrorBudgetBurnRate
expr: |
  (
    sum(rate(http_requests_total{status=~"5.."}[1h])) by (service)
    / sum(rate(http_requests_total[1h])) by (service)
  ) > 14.4 * (1 - 0.999)
for: 5m
labels:
  severity: critical
annotations:
  summary: "{{ $labels.service }}: burning error budget 14.4x faster than allowed"
  description: "At this rate, 30-day error budget will be exhausted in ~2 hours"
```

### Service Down

```yaml
alert: ServiceDown
expr: up{job="order-service"} == 0
for: 2m
labels:
  severity: critical
annotations:
  summary: "{{ $labels.instance }}: service is down"
```

---

## Noise Reduction

### `for` Duration

Require the condition to persist before firing. Avoids flapping alerts.

```yaml
# BAD: fires on momentary spike
expr: error_rate > 0.01

# GOOD: must persist for 5 minutes
expr: error_rate > 0.01
for: 5m
```

Guidelines: 2-5min for critical, 5-15min for warnings.

### Alert Grouping

```yaml
# Alertmanager: group related alerts into one notification
route:
  group_by: ['service', 'alertname']
  group_wait: 30s        # Wait before sending first notification
  group_interval: 5m     # Wait before sending updates
```

### Inhibition

Suppress downstream alerts when the root cause is already alerting.

```yaml
inhibit_rules:
  - source_match:
      alertname: 'ServiceDown'
    target_match_re:
      alertname: 'High(ErrorRate|Latency)'
    equal: ['service']
```

### Silencing

Mute during planned maintenance.

```bash
# Alertmanager API
amtool silence add \
  --alertmanager.url=http://alertmanager:9093 \
  --author="deploy-bot" \
  --comment="Planned maintenance window" \
  --duration=2h \
  service="order-service"
```

---

## Runbook Structure

Every alert should link to a runbook. Minimal template:

```markdown
# Alert: HighErrorRate

## What it means
Error rate for this service exceeds 1% over 5 minutes.

## Impact
Users may see HTTP 500 errors or degraded functionality.

## Investigation steps
1. Check Grafana dashboard: [link]
2. Look at recent deployments: `kubectl rollout history`
3. Check dependent services: [links]
4. Review error logs: `grep trace_id=<from-alert>`

## Remediation
- If recent deploy: rollback with `kubectl rollout undo`
- If dependency failure: check dependency status page
- If traffic spike: scale horizontally

## Escalation
- On-call SRE: [PagerDuty schedule link]
- Service owner: @team-backend
```
