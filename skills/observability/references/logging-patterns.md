# Logging Patterns

Structured logging, log correlation with traces, log levels, and sensitive data redaction.

## Contents

- [Structured Log Format](#structured-log-format)
- [Log Level Guidelines](#log-level-guidelines)
- [Trace Correlation](#trace-correlation)
- [Sensitive Data Redaction](#sensitive-data-redaction)
- [Logger Setup](#logger-setup)

---

## Structured Log Format

Every log entry should be JSON with consistent fields for machine parsing and correlation.

```json
{
  "timestamp": "2026-01-15T10:30:00.000Z",
  "level": "error",
  "service": "order-service",
  "trace_id": "abc123def456",
  "span_id": "789ghi",
  "request_id": "req-xyz",
  "user_id": "u123",
  "message": "Payment processing failed",
  "error": {
    "type": "PaymentGatewayError",
    "message": "Timeout after 30s",
    "stack": "..."
  },
  "context": {
    "order_id": "o456",
    "amount": 99.99,
    "retry_count": 2
  }
}
```

### Required Fields

| Field | Purpose |
|-------|---------|
| `timestamp` | ISO 8601 UTC -- enables time-range queries |
| `level` | Severity -- enables filtering |
| `service` | Source service -- enables per-service filtering |
| `message` | Human-readable description |
| `trace_id` | Links log to distributed trace |

### Optional But Recommended

| Field | Purpose |
|-------|---------|
| `span_id` | Links to specific span within trace |
| `request_id` | Application-level correlation |
| `user_id` | Identify affected user (non-PII identifier) |
| `error` | Structured error object with type, message, stack |
| `context` | Business-relevant key-value pairs |

---

## Log Level Guidelines

| Level | When | Page? | Production |
|-------|------|-------|------------|
| ERROR | Unexpected failure, needs investigation | No: feeds error-rate metrics and tickets | Enabled |
| WARN | Degraded operation, recoverable | No: watch trends | Enabled |
| INFO | Significant business events | No | Enabled |
| DEBUG | Developer troubleshooting detail | No | Disabled |

Paging comes from symptom and burn-rate alerts (policy in `reliability`), never from a log line. A spike of ERROR logs should show up as an error-rate metric first.

### Level Selection Rules

- **ERROR**: Something broke that shouldn't have. Examples: unhandled exceptions, failed retries after exhaustion, data corruption detected.
- **WARN**: Working but degraded. Examples: fallback to cache, retry attempt, approaching quota limit.
- **INFO**: Normal but significant operations. One INFO log per business operation (not per step).
- **DEBUG**: Detailed internal state. High volume; disabled in production.

---

## Trace Correlation

Prefer the OpenTelemetry logging integration for the language in use: it stamps `trace_id` and `span_id` on each record from the active span, so application code does not read span context itself. Check the SDK version for the current package and opt-in.

Manual fallback when no integration exists (Node sketch):

```javascript
const { context, trace } = require('@opentelemetry/api');

function getTraceContext() {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const { traceId, spanId, traceFlags } = span.spanContext();
  return { trace_id: traceId, span_id: spanId, trace_flags: traceFlags };
}
// Add getTraceContext() output in a logger format step, after timestamp and before JSON serialization.
```

---

## Sensitive Data Redaction

One rule, owned here (`compliance` and `security` link to it):

1. **Allowlist at the call site.** Log named, known-safe fields; do not dump request bodies, headers, or whole objects.
2. **Scrub as the final stage.** A logger processor or pipeline (collector) stage redacts known-sensitive keys (`password`, `token`, `secret`, `authorization`, `api_key`, `card_number`, `cvv`, `ssn`) and values with strong signatures, after serialization rules are applied. It is a safety net for mistakes, not a substitute for the allowlist.
3. **Treat email, IP address, and user identifiers as personal data** where privacy law applies: log a pseudonymous ID instead, and follow retention rules from `compliance`.
4. **Never log credentials, even in DEBUG.**

```javascript
const sensitive = ['password', 'token', 'secret', 'authorization', 'credit_card', 'card_number', 'cvv', 'ssn'];

function redact(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) =>
    sensitive.some(f => k.toLowerCase().includes(f)) ? [k, '[REDACTED]'] : [k, redact(v)]));
}
```

---

## Logger Setup

One setup per language. Both emit JSON from a real serializer; never build JSON with format strings, because a quote or newline in a message produces invalid JSON.

### Node.js (winston)

```javascript
const winston = require('winston');

const addTrace = winston.format((info) => ({ ...info, ...getTraceContext() }));

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    addTrace(),
    winston.format.json(),
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'unknown' },
  transports: [new winston.transports.Console()],
});
```

### Python (structlog)

structlog processors run on the event dict before any standard-library record exists, so IDs attached to records later never reach them. Add the IDs with a processor that reads the current span.

```python
import structlog
from opentelemetry import trace


def add_trace_context(logger, method, event_dict):
    ctx = trace.get_current_span().get_span_context()
    if ctx.is_valid:
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    return event_dict


structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.format_exc_info,
        add_trace_context,
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

log = structlog.get_logger("order-service")
log.info("order_placed", order_id="o123", amount=99.99)
```

Never hand-format trace IDs into message strings; keep them as separate fields.
