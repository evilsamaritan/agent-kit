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

| Level | When | Alert? | Production |
|-------|------|--------|------------|
| ERROR | Unexpected failure, needs attention | Yes | Enabled |
| WARN | Degraded operation, recoverable | Monitor trends | Enabled |
| INFO | Significant business events | No | Enabled |
| DEBUG | Developer troubleshooting detail | No | Disabled |

### Level Selection Rules

- **ERROR**: Something broke that shouldn't have. Requires human investigation. Examples: unhandled exceptions, failed retries after exhaustion, data corruption detected.
- **WARN**: System is working but in a degraded state. Examples: fallback to cache, retry attempt, approaching quota limit.
- **INFO**: Normal but significant operations. Examples: order placed, user login, deployment started. One INFO log per business operation (not per step).
- **DEBUG**: Detailed internal state for troubleshooting. Examples: SQL queries, cache hit/miss, config loaded. High volume -- disabled in production.

---

## Trace Correlation

### Injecting Trace Context into Logs

```javascript
const { context, trace } = require('@opentelemetry/api');

function getTraceContext() {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const ctx = span.spanContext();
  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
    trace_flags: ctx.traceFlags,
  };
}

// Use in logger
const logger = createLogger({
  defaultMeta: { service: 'order-service' },
  format: format.combine(
    format.timestamp(),
    format((info) => ({ ...info, ...getTraceContext() }))(),
    format.json(),
  ),
});
```

```python
import logging
from opentelemetry import trace

class TraceContextFilter(logging.Filter):
    def filter(self, record):
        span = trace.get_current_span()
        if span and span.is_recording():
            ctx = span.get_span_context()
            record.trace_id = format(ctx.trace_id, '032x')
            record.span_id = format(ctx.span_id, '016x')
        else:
            record.trace_id = ''
            record.span_id = ''
        return True

logger = logging.getLogger('order-service')
logger.addFilter(TraceContextFilter())

formatter = logging.Formatter(
    '{"timestamp":"%(asctime)s","level":"%(levelname)s",'
    '"service":"order-service","trace_id":"%(trace_id)s",'
    '"span_id":"%(span_id)s","message":"%(message)s"}'
)
```

---

## Sensitive Data Redaction

### Field-Level Redaction

```javascript
const sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'ssn', 'authorization'];

function redactSensitive(obj) {
  const redacted = { ...obj };
  for (const key of Object.keys(redacted)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitive(redacted[key]);
    }
  }
  return redacted;
}
```

### Common Sensitive Fields to Redact

- `password`, `passwd`, `secret`
- `token`, `api_key`, `authorization`
- `credit_card`, `card_number`, `cvv`
- `ssn`, `social_security`
- `email` (depending on privacy requirements)
- `ip_address` (depending on jurisdiction -- GDPR)

### Rules

1. Redact at the logging layer, not at the application layer
2. Never log raw request/response bodies without redaction
3. Redact before serialization to avoid accidental exposure
4. Use allowlists (log only known-safe fields) rather than denylists for high-security contexts

---

## Logger Setup

### Node.js (Winston + OpenTelemetry)

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console(),
  ],
});
```

### Python (structlog)

```python
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

log = structlog.get_logger("order-service")
log.info("order_placed", order_id="o123", amount=99.99)
```
