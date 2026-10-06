# Tracing Patterns

OpenTelemetry SDK setup, span attributes, sampling, context propagation, collector deployment, and instrumentation patterns.

Check the project's SDK major version and semantic-convention version before copying any snippet here. Setup APIs and attribute names changed between majors. Code blocks are sketches: they omit imports, error handling, and application types.

## Contents

- [OpenTelemetry SDK Setup](#opentelemetry-sdk-setup)
- [Custom Span Creation](#custom-span-creation)
- [Context Propagation](#context-propagation)
- [Sampling Configuration](#sampling-configuration)
- [Collector Deployment](#collector-deployment)
- [Instrumentation Patterns](#instrumentation-patterns)
- [Debugging Traces](#debugging-traces)
- [Volatile Status](#volatile-status)

---

## OpenTelemetry SDK Setup

### Node.js

```javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');  // JS SDK 2.x; 1.x used `new Resource(...)`

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector:4318/v1/traces',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://otel-collector:4318/v1/metrics',
    }),
    exportIntervalMillis: 30000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  resource: resourceFromAttributes({
    'service.name': 'order-service',
    'service.version': '1.2.0',
    'deployment.environment.name': 'production',
  }),
});

sdk.start();
```

**Auto-Instrumentation Coverage (Node.js):**
- HTTP client/server (express, fastify, fetch, axios)
- Database clients (pg, mysql, redis, mongodb)
- Message brokers (kafka, rabbitmq, amqp)
- gRPC, GraphQL, DNS, net

### Python

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

resource = Resource.create({
    "service.name": "order-service",
    "service.version": "1.2.0",
    "deployment.environment.name": "production",
})

provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(
    OTLPSpanExporter(endpoint="http://otel-collector:4317"),
    max_queue_size=2048,
    max_export_batch_size=512,
    schedule_delay_millis=5000,
)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Auto-instrument libraries
FlaskInstrumentor().instrument()
RequestsInstrumentor().instrument()
SQLAlchemyInstrumentor().instrument(engine=db_engine)
```

### Go / Java / Other Runtimes

The pattern is the same across all runtimes:

1. Create an OTLP exporter pointing to `otel-collector:4317` (gRPC) or `:4318` (HTTP)
2. Create a `Resource` with `service.name`, `service.version`, `deployment.environment.name`
3. Initialize a `TracerProvider` with batch span processor and sampler
4. Set as the global tracer provider
5. Call `shutdown()` on exit to flush pending spans

**Go:** `go.opentelemetry.io/otel` + `otlptracegrpc` exporter + `sdktrace.NewTracerProvider`
**Java (Spring Boot):** use one stack, not both. Either the OpenTelemetry Java agent or starter, configured with `otel.*` properties, or Spring Boot's Micrometer Tracing with its OTLP export support, whose endpoint and sampling property names depend on the project's Boot version (check that version's docs).

---

## Custom Span Creation

### Wrapping Business Logic

Sketch: `items`, `check_inventory`, and `parent_span_context` stand for application code.

```python
tracer = trace.get_tracer("order-service")

@tracer.start_as_current_span("process_order")
def process_order(order_id, amount, items, parent_span_context):
    span = trace.get_current_span()

    # Add business context as attributes
    span.set_attribute("order.id", order_id)
    span.set_attribute("order.amount", amount)

    # Child span for sub-operation
    with tracer.start_as_current_span("validate_inventory") as child:
        child.set_attribute("product.count", len(items))
        inventory = check_inventory(items)

    # Link to a related trace (for example the span that triggered this work)
    span.add_link(trace.Link(parent_span_context, attributes={"relationship": "triggered_by"}))

    return inventory
```

Point-in-time annotations (`span.add_event(...)`) still work but are being replaced by log-based events; see [Volatile Status](#volatile-status).

### Span Attribute Conventions

```python
# HTTP (OTel semantic conventions -- stable)
"http.request.method": "POST",          # was http.method
"url.full": "https://api.example.com/orders",  # was http.url
"http.response.status_code": 200,       # was http.status_code
"http.request.body.size": 1234,         # development status, not yet stable

# Database (stable database conventions; older names in parentheses)
"db.system.name": "postgresql",          # was db.system
"db.namespace": "orders_db",             # was db.name
"db.operation.name": "SELECT",           # was db.operation
"db.query.text": "SELECT * FROM orders WHERE id = $1",  # was db.statement; parameterized or sanitized only

# Messaging (development status: names can still change)
"messaging.system": "kafka",
"messaging.destination.name": "orders",  # was messaging.destination
"messaging.operation.type": "publish",   # was messaging.operation

# Custom business attributes
"order.id": "o123",
"order.total": 99.99,
"customer.tier": "premium",
# NEVER: customer.email, credit_card, password, PII
```

### Error Recording

Intent: record the failure, set span status `ERROR`, and make sure an error log carrying the same `trace_id` exists. Leave status unset on success unless you need to override an earlier error.

```python
from opentelemetry.trace import StatusCode

try:
    result = process_payment(order)
except PaymentDeclinedError as e:
    span.set_status(StatusCode.ERROR, "Payment declined")
    span.set_attribute("payment.decline_reason", e.reason)
    span.record_exception(e)   # see caveat below
    raise
except Exception as e:
    span.set_status(StatusCode.ERROR, str(e))
    span.record_exception(e)
    raise
```

Caveat: `record_exception` and `add_event` are being deprecated in favor of emitting exceptions and events through the Logs API, correlated with the active span. They work today; what the SDK does with them depends on its version and opt-in settings. Check the SDK before choosing.

---

## Context Propagation

### HTTP Propagation

```python
# Automatic (with instrumentation libraries)
# requests, httpx, aiohttp auto-inject traceparent header

# Manual propagation
from opentelemetry.propagate import inject, extract

# Inject into outgoing request headers
headers = {}
inject(headers)
response = requests.get("http://service-b/api", headers=headers)

# Extract from incoming request
ctx = extract(request.headers)
with tracer.start_as_current_span("handle_request", context=ctx):
    process_request()
```

### Message Queue Propagation

```python
# Producer: inject trace context into message headers
from opentelemetry.propagate import inject

carrier = {}
inject(carrier)

producer.send(
    topic="orders",
    value=order_data,
    headers=[(k, v.encode()) for k, v in carrier.items()],
)

# Consumer: extract trace context from message headers
from opentelemetry.propagate import extract

carrier = {k: v.decode() for k, v in message.headers}
ctx = extract(carrier)

with tracer.start_as_current_span("process_message", context=ctx,
    kind=trace.SpanKind.CONSUMER):
    handle_message(message)
```

### Baggage (Cross-Service Context)

```python
from opentelemetry import baggage

# Service A: set baggage
ctx = baggage.set_baggage("tenant.id", "t123")
ctx = baggage.set_baggage("request.priority", "high")
# Baggage propagates automatically via headers

# Service B: read baggage
tenant_id = baggage.get_baggage("tenant.id")    # "t123"
```

**Warning:** Baggage is sent with every request. Keep it small and non-sensitive.

---

## Sampling Configuration

### OpenTelemetry Collector Tail Sampling

Tail sampling decides after the trace has been collected, so every span of a trace must reach the same collector instance. With more than one gateway replica, put a load-balancing tier in front that routes by trace ID, then run tail sampling behind it. Without that, each replica sees part of a trace and makes wrong decisions. `decision_wait` and `num_traces` bound the memory cost. Policies are evaluated independently and a trace is kept if any policy matches (OR), so a broad probabilistic policy adds to, not filters, the error and latency policies.

Tier 1: load-balancing collectors (route by trace ID).

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }

exporters:
  loadbalancing:
    routing_key: traceID
    protocol:
      otlp: { tls: { insecure: true } }   # use real TLS outside local development
    resolver:
      dns: { hostname: otel-gateway-headless }

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [loadbalancing]
```

Tier 2: sampling gateways (the replicas behind the headless service).

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }

processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow-traces
        type: latency
        latency: { threshold_ms: 2000 }
      - name: normal-traffic
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }
      - name: critical-services
        type: string_attribute
        string_attribute:
          key: service.name
          values: [payment-service, auth-service]
  batch: {}

exporters:
  otlp/backend:
    endpoint: "your-backend:4317"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [tail_sampling, batch]
      exporters: [otlp/backend]
```

---

## Collector Deployment

### Agent vs Gateway Mode

| Mode | Deploy As | Use When |
|------|-----------|----------|
| **Agent** | Sidecar / DaemonSet alongside app | Local buffering, low-latency export, per-node processing |
| **Gateway** | Standalone service | Centralized sampling, cross-service tail sampling, data enrichment |

**Recommendation:** Agent mode for collection plus a gateway for tail sampling and routing, for anything beyond a single service or local development.

### Collector Config (Minimal, single replica)

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: "0.0.0.0:4317" }
      http: { endpoint: "0.0.0.0:4318" }

processors:
  batch:
    timeout: 5s
    send_batch_size: 512

exporters:
  otlp:
    endpoint: "your-backend:4317"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
```

Configure exporters for your chosen backend (Jaeger, Tempo, Datadog, Honeycomb, New Relic, etc.) -- all accept OTLP natively or via adapter.

---

## Instrumentation Patterns

Instrument at service boundaries and meaningful business operations. Auto-instrumentation covers HTTP, database, and messaging libraries. Add manual spans for business logic.

```python
# Manual span around DB queries (when auto-instrumentation isn't available)
def query_with_tracing(sql, params):
    with tracer.start_as_current_span("db.query", kind=SpanKind.CLIENT) as span:
        span.set_attribute("db.system.name", "postgresql")
        span.set_attribute("db.query.text", sanitize_sql(sql))
        span.set_attribute("db.operation.name", sql.split()[0].upper())
        result = db.execute(sql, params)
        return result
```

---

## Debugging Traces

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Missing spans | Sampling dropped them | Check sampling config, use AlwaysOn for debugging |
| Disconnected spans | Context not propagated | Verify traceparent header in requests |
| Missing attributes | Auto-instrumentation gap | Add manual span attributes |
| High latency in traces | Too many spans | Reduce instrumentation granularity |
| Collector dropping data | Buffer full | Increase queue size, add backpressure handling |

### Debug Checklist

1. Verify SDK is initialized: check for startup logs
2. Check collector connectivity: `curl http://collector:4318/v1/traces`
3. Verify propagation: inspect `traceparent` header in requests
4. Check sampling: temporarily set to AlwaysOn
5. Inspect collector logs: look for export errors
6. Check backend: verify traces appear in Jaeger/Tempo/vendor UI

---

## Volatile Status

Checked October 2026 against opentelemetry.io (status page, semantic conventions, project blog). Re-check before relying on it.

- **Signals:** the tracing, metrics, and logs specifications are stable (metrics SDK parts are mixed), and language SDK maturity differs by signal, so check the project's SDK on the OpenTelemetry status page. Profiles entered public alpha on 26 March 2026: the project says the signal should not be used for critical production workloads, production-ready backends have not emerged, and most language SDKs have no profiles support. Use a vendor-neutral continuous-profiling agent in production now and treat OTel profiles as an emerging option. Profile samples can already carry `trace_id` and `span_id` for profile-to-trace correlation; adopt it when the signal stabilizes.
- **Span events:** the Span Event API (`Span.AddEvent`, `Span.RecordException`) is being deprecated in favor of events emitted as logs through the Logs API and correlated with the active span. Existing span-event data and views keep working. New code should prefer the Logs API where the project's SDK supports it.
- **Semantic conventions:** HTTP (`http.request.method`, `url.full`, `http.response.status_code`) and database client conventions (`db.system.name`, `db.namespace`, `db.operation.name`, `db.query.text`) are stable. Messaging conventions and `http.request.body.size` are still in development. `deployment.environment` was renamed `deployment.environment.name` (stable). Instrumentation libraries may emit old or new names depending on version and the `OTEL_SEMCONV_STABILITY_OPT_IN` setting.
- **JS SDK:** 2.x (first released February 2025) constructs resources with `resourceFromAttributes`; 1.x used `new Resource`.
