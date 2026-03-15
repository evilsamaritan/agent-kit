# Tracing Patterns

OpenTelemetry SDK setup, span attributes, sampling, context propagation, collector deployment, and instrumentation patterns.

## Contents

- [OpenTelemetry SDK Setup](#opentelemetry-sdk-setup)
- [Custom Span Creation](#custom-span-creation)
- [Context Propagation](#context-propagation)
- [Sampling Configuration](#sampling-configuration)
- [Collector Deployment](#collector-deployment)
- [Instrumentation Patterns](#instrumentation-patterns)
- [Debugging Traces](#debugging-traces)

---

## OpenTelemetry SDK Setup

### Node.js

```javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');

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
  resource: new Resource({
    'service.name': 'order-service',
    'service.version': '1.2.0',
    'deployment.environment': 'production',
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
    "deployment.environment": "production",
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
2. Create a `Resource` with `service.name`, `service.version`, `deployment.environment`
3. Initialize a `TracerProvider` with batch span processor and sampler
4. Set as the global tracer provider
5. Call `shutdown()` on exit to flush pending spans

**Go:** `go.opentelemetry.io/otel` + `otlptracegrpc` exporter + `sdktrace.NewTracerProvider`
**Java (Spring Boot):** Set `otel.exporter.otlp.endpoint` and `management.tracing.sampling.probability` in `application.yml`; add `opentelemetry-api` + `micrometer-tracing-bridge-otel` dependencies

---

## Custom Span Creation

### Wrapping Business Logic

```python
tracer = trace.get_tracer("order-service")

@tracer.start_as_current_span("process_order")
def process_order(order_id, amount):
    span = trace.get_current_span()

    # Add business context as attributes
    span.set_attribute("order.id", order_id)
    span.set_attribute("order.amount", amount)

    # Child span for sub-operation
    with tracer.start_as_current_span("validate_inventory") as child:
        child.set_attribute("product.count", len(items))
        inventory = check_inventory(items)

    # Add event (point-in-time annotation)
    span.add_event("payment_initiated", {
        "payment.provider": "stripe",
        "payment.amount": amount,
    })

    # Link to related traces
    span.add_link(trace.Link(
        related_trace_context,
        attributes={"relationship": "triggered_by"},
    ))

    return result
```

### Span Attribute Conventions

```python
# HTTP (OTel semantic conventions -- stable)
"http.request.method": "POST",          # was http.method
"url.full": "https://api.example.com/orders",  # was http.url
"http.response.status_code": 200,       # was http.status_code
"http.request.body.size": 1234,

# Database
"db.system": "postgresql",
"db.name": "orders_db",
"db.operation": "SELECT",
"db.statement": "SELECT * FROM orders WHERE id = $1",  # Sanitized!

# Messaging
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

```python
try:
    result = process_payment(order)
    span.set_status(StatusCode.OK)
except PaymentDeclinedError as e:
    span.set_status(StatusCode.ERROR, "Payment declined")
    span.record_exception(e)
    span.set_attribute("payment.decline_reason", e.reason)
    raise
except Exception as e:
    span.set_status(StatusCode.ERROR, str(e))
    span.record_exception(e)
    raise
```

---

## Context Propagation

### HTTP Propagation

```python
# Automatic (with instrumentation libraries)
# requests, httpx, aiohttp auto-inject traceparent header

# Manual propagation
from opentelemetry.propagators import inject, extract
from opentelemetry import context

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
from opentelemetry.propagators import inject

carrier = {}
inject(carrier)

producer.send(
    topic="orders",
    value=order_data,
    headers=[(k, v.encode()) for k, v in carrier.items()],
)

# Consumer: extract trace context from message headers
from opentelemetry.propagators import extract

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

```yaml
# otel-collector-config.yaml
processors:
  tail_sampling:
    decision_wait: 10s
    num_traces: 100000
    policies:
      # Always keep errors
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }

      # Always keep slow traces (> 2 seconds)
      - name: slow-traces
        type: latency
        latency: { threshold_ms: 2000 }

      # Sample 10% of normal traces
      - name: normal-traffic
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

      # Always keep traces from critical services
      - name: critical-services
        type: string_attribute
        string_attribute:
          key: service.name
          values: [payment-service, auth-service]

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [tail_sampling, batch]
      exporters: [otlp/jaeger]
```

---

## Collector Deployment

### Agent vs Gateway Mode

| Mode | Deploy As | Use When |
|------|-----------|----------|
| **Agent** | Sidecar / DaemonSet alongside app | Local buffering, low-latency export, per-node processing |
| **Gateway** | Standalone service | Centralized sampling, cross-service tail sampling, data enrichment |

**Recommendation:** Agent mode for collection + gateway for tail sampling and routing. Never export directly from application to backend.

### Collector Config (Minimal)

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
        span.set_attribute("db.system", "postgresql")
        span.set_attribute("db.statement", sanitize_sql(sql))
        span.set_attribute("db.operation", sql.split()[0].upper())
        result = db.execute(sql, params)
        span.set_attribute("db.rows_affected", result.rowcount)
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
