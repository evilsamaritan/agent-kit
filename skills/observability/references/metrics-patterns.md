# Metrics Patterns

RED/USE methods, Prometheus queries, histogram design, recording rules, and Grafana dashboards.

## Contents

- [RED Method Implementation](#red-method-implementation)
- [USE Method Implementation](#use-method-implementation)
- [Histogram Design](#histogram-design)
- [Prometheus Query Cookbook](#prometheus-query-cookbook)
- [Recording Rules](#recording-rules)
- [Alerting Rules](#alerting-rules)
- [Grafana Dashboard Patterns](#grafana-dashboard-patterns)
- [Custom Metrics Design](#custom-metrics-design)

---

## RED Method Implementation

### Instrument an HTTP Service

```python
from prometheus_client import Counter, Histogram

# Rate: total requests
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

# Errors: subset of requests with error status
# (Use the same counter, filter by status label)

# Duration: latency distribution
http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
)

# Middleware
@app.middleware
def metrics_middleware(request, handler):
    start = time.monotonic()
    response = handler(request)
    duration = time.monotonic() - start

    http_requests_total.labels(
        method=request.method,
        endpoint=request.path,
        status=response.status_code,
    ).inc()

    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=request.path,
    ).observe(duration)

    return response
```

### RED Queries

```promql
# Rate: requests per second
rate(http_requests_total[5m])

# Rate by endpoint
sum(rate(http_requests_total[5m])) by (endpoint)

# Error rate (percentage)
sum(rate(http_requests_total{status=~"5.."}[5m]))
/ sum(rate(http_requests_total[5m])) * 100

# Error rate by endpoint
sum(rate(http_requests_total{status=~"5.."}[5m])) by (endpoint)
/ sum(rate(http_requests_total[5m])) by (endpoint) * 100

# Duration: p50, p90, p99
histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.90, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Duration by endpoint
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
)
```

---

## USE Method Implementation

### Resource Metrics

```promql
# CPU Utilization (%)
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory Utilization (%)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disk I/O Utilization
rate(node_disk_io_time_seconds_total[5m]) * 100

# Network Utilization
rate(node_network_receive_bytes_total[5m])
rate(node_network_transmit_bytes_total[5m])
```

### Saturation Metrics

```promql
# CPU Saturation (load average vs CPU count)
node_load1 / count(node_cpu_seconds_total{mode="idle"}) by (instance)

# Memory Saturation (swap usage)
node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes

# Disk Saturation (I/O queue depth)
rate(node_disk_io_time_weighted_seconds_total[5m])

# Network Saturation (dropped packets)
rate(node_network_receive_drop_total[5m])
```

---

## Histogram Design

### Bucket Selection

```python
# Web API latency (most requests < 1s)
buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]

# Background job duration (seconds to minutes)
buckets = [1, 5, 10, 30, 60, 120, 300, 600, 1800]

# Database query latency (milliseconds)
buckets = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]

# File size (bytes)
buckets = [1024, 10240, 102400, 1048576, 10485760, 104857600]  # 1KB to 100MB
```

### Rules for Bucket Selection

1. Cover the range from best-case to worst-case expected values
2. More buckets around SLO thresholds (e.g., extra buckets near 200ms if SLO is 200ms)
3. Use exponential growth (each bucket ~2-5x the previous)
4. 10-15 buckets is typical; more than 20 adds overhead
5. Always include a bucket above your worst acceptable latency

### Histogram vs Counter + Gauge

```python
# USE HISTOGRAM when:
# - You need percentiles (p50, p90, p99)
# - Latency, request size, response size
http_duration = Histogram('http_request_duration_seconds', 'Latency', ['endpoint'])

# USE COUNTER when:
# - You need rate() (events per second)
# - Requests, errors, bytes transferred
http_requests = Counter('http_requests_total', 'Total requests', ['status'])

# USE GAUGE when:
# - Value goes up AND down
# - Current connections, queue depth, temperature
active_connections = Gauge('active_connections', 'Current connections')
```

---

## Prometheus Query Cookbook

### Rate and Increase

```promql
# Instantaneous rate (per-second) over 5 minutes
rate(http_requests_total[5m])

# Total increase over 1 hour
increase(http_requests_total[1h])

# Rate of rate (acceleration)
deriv(rate(http_requests_total[5m])[30m:1m])
```

### Aggregation

```promql
# Sum across all instances
sum(rate(http_requests_total[5m]))

# Group by label
sum(rate(http_requests_total[5m])) by (service, method)

# Top 5 endpoints by request rate
topk(5, sum(rate(http_requests_total[5m])) by (endpoint))

# Average across instances
avg(rate(http_requests_total[5m])) by (service)
```

### Joins and Math

```promql
# Error budget: % of error budget remaining
1 - (
  sum(rate(http_requests_total{status=~"5.."}[30d]))
  / sum(rate(http_requests_total[30d]))
) / (1 - 0.999)  # SLO = 99.9%

# Request duration as % of SLO
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
/ 0.200  # SLO = 200ms
```

### Absent and Dead-Man's Switch

```promql
# Alert if metric disappears (service down)
absent(up{job="order-service"})

# Dead-man's switch (should always fire -- if it doesn't, alerting is broken)
vector(1)
```

---

## Recording Rules

Precompute expensive queries for dashboard performance.

```yaml
# prometheus-rules.yml
groups:
  - name: red-metrics
    interval: 30s
    rules:
      # Request rate by service
      - record: service:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m])) by (service)

      # Error rate by service
      - record: service:http_errors:rate5m
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)

      # Error percentage by service
      - record: service:http_error_percentage:rate5m
        expr: |
          service:http_errors:rate5m
          / service:http_requests:rate5m * 100

      # P99 latency by service
      - record: service:http_duration:p99_5m
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          )

      # P50 latency by service
      - record: service:http_duration:p50_5m
        expr: |
          histogram_quantile(0.50,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          )
```

### Naming Convention

```
level:metric_name:operation_window
  |       |            |
  |       |            +-- rate5m, sum, p99_5m
  |       +-- original metric name
  +-- aggregation level (service, instance, cluster)

Examples:
  service:http_requests:rate5m
  instance:cpu_utilization:avg5m
  cluster:memory_available:sum
```

---

## Alerting Rules

```yaml
groups:
  - name: service-alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: service:http_error_percentage:rate5m > 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.service }}: error rate {{ $value | humanizePercentage }}"
          runbook: "https://wiki/runbooks/high-error-rate"

      # High latency
      - alert: HighLatency
        expr: service:http_duration:p99_5m > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.service }}: p99 latency {{ $value | humanizeDuration }}"

      # No traffic (service may be down)
      - alert: NoTraffic
        expr: service:http_requests:rate5m == 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.service }}: no traffic for 10 minutes"

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          (container_memory_working_set_bytes / container_spec_memory_limit_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.pod }}: memory usage above 90%"
```

---

## Grafana Dashboard Patterns

### Dashboard Organization

| Dashboard | Purpose | Audience |
|-----------|---------|----------|
| Service Overview | RED metrics per service | On-call engineer |
| Infrastructure | USE metrics per host/container | SRE / DevOps |
| Business Metrics | Orders, revenue, user activity | Product / Engineering |
| SLO Dashboard | Error budget burn, compliance | SRE / Management |
| Debug Dashboard | Detailed per-endpoint breakdown | Developer debugging |

---

## Custom Metrics Design

### Business Metrics

```python
# Order processing
orders_processed = Counter('orders_processed_total', 'Orders completed', ['status', 'payment_method'])
order_value = Histogram('order_value_dollars', 'Order value', buckets=[10, 25, 50, 100, 250, 500, 1000])

# User engagement
active_users = Gauge('active_users_current', 'Currently active users')
signups = Counter('user_signups_total', 'New user registrations', ['source'])
```

### Label Best Practices

```python
# GOOD: Low cardinality (bounded set of values)
http_requests.labels(method="GET", status="200", endpoint="/api/orders")

# BAD: High cardinality (unbounded, unique per request)
http_requests.labels(user_id="u123", request_id="req-abc")  # DON'T DO THIS

# Rule of thumb: cardinality = product of all label values
# method (5) * status (5) * endpoint (20) = 500 time series -- OK
# method (5) * user_id (100K) = 500K time series -- Prometheus will crash
```

### Metric Naming Conventions

```
# Format: namespace_subsystem_name_unit
# Units: seconds, bytes, total, ratio, info

# Good names:
http_request_duration_seconds         # histogram, unit in name
http_requests_total                   # counter, _total suffix
http_active_connections               # gauge, no suffix needed
process_resident_memory_bytes         # gauge, unit in name

# Bad names:
request_latency                       # missing unit, missing namespace
http_request_count                    # use _total for counters
http_request_duration_milliseconds    # use seconds (Prometheus convention)
```
