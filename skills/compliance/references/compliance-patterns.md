# Compliance Patterns — Implementation Deep Dive

## Contents

- [Audit Trail Architecture](#audit-trail-architecture)
- [PII Detection and Masking](#pii-detection-and-masking)
- [GDPR Data Export (Right of Access / Portability)](#gdpr-data-export-right-of-access--portability)
- [Right to Erasure (GDPR Article 17)](#right-to-erasure-gdpr-article-17)
- [Consent Management](#consent-management)
- [Data Retention Policy Automation](#data-retention-policy-automation)
- [SOC2 Evidence Collection](#soc2-evidence-collection)

---

## Audit Trail Architecture

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id      TEXT NOT NULL,           -- who (user ID, system, API key)
  actor_type    TEXT NOT NULL,           -- user, admin, system, api
  action        TEXT NOT NULL,           -- create, read, update, delete
  resource_type TEXT NOT NULL,           -- user, order, payment
  resource_id   TEXT NOT NULL,           -- specific resource
  changes       JSONB,                  -- { field: { old, new } }
  ip_address    INET,
  user_agent    TEXT,
  request_id    TEXT,                   -- correlation ID
  metadata      JSONB                  -- additional context
);

-- Indexes for common queries
CREATE INDEX idx_audit_actor ON audit_logs (actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs (resource_type, resource_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs (action, timestamp DESC);
CREATE INDEX idx_audit_timestamp ON audit_logs (timestamp DESC);

-- CRITICAL: Make immutable
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
GRANT INSERT, SELECT ON audit_logs TO app_user;
```

### Audit Logging Middleware

```typescript
interface AuditEntry {
  actorId: string;
  actorType: 'user' | 'admin' | 'system' | 'api';
  action: 'create' | 'read' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

class AuditLogger {
  constructor(private db: Database) {}

  async log(entry: AuditEntry, context: RequestContext) {
    await this.db.auditLogs.create({
      data: {
        ...entry,
        timestamp: new Date(),
        ipAddress: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
    });
  }

  // Helper for tracking entity changes
  async logUpdate(
    actor: { id: string; type: string },
    resourceType: string,
    resourceId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    context: RequestContext
  ) {
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const key of Object.keys(newData)) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = { old: oldData[key], new: newData[key] };
      }
    }

    if (Object.keys(changes).length === 0) return; // no changes

    await this.log({
      actorId: actor.id,
      actorType: actor.type as AuditEntry['actorType'],
      action: 'update',
      resourceType,
      resourceId,
      changes: this.redactSensitiveFields(changes),
    }, context);
  }

  private redactSensitiveFields(
    changes: Record<string, { old: unknown; new: unknown }>
  ) {
    const sensitive = ['password', 'ssn', 'creditCard', 'token'];
    const redacted = { ...changes };

    for (const field of sensitive) {
      if (redacted[field]) {
        redacted[field] = { old: '[REDACTED]', new: '[REDACTED]' };
      }
    }

    return redacted;
  }
}
```

---

## PII Detection and Masking

### Log Masking Middleware

```typescript
const PII_PATTERNS: Array<{ name: string; regex: RegExp; mask: string }> = [
  { name: 'email', regex: /[\w.-]+@[\w.-]+\.\w+/g, mask: '[EMAIL]' },
  { name: 'phone', regex: /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, mask: '[PHONE]' },
  { name: 'ssn', regex: /\d{3}-\d{2}-\d{4}/g, mask: '[SSN]' },
  { name: 'credit_card', regex: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, mask: '[CARD]' },
  { name: 'ip_v4', regex: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, mask: '[IP]' },
];

function maskPII(text: string): string {
  let masked = text;
  for (const pattern of PII_PATTERNS) {
    masked = masked.replace(pattern.regex, pattern.mask);
  }
  return masked;
}

// Logger wrapper
function createSafeLogger(baseLogger: Logger): Logger {
  return {
    info: (msg: string, ...args: unknown[]) =>
      baseLogger.info(maskPII(msg), ...args.map(a =>
        typeof a === 'string' ? maskPII(a) : a
      )),
    error: (msg: string, ...args: unknown[]) =>
      baseLogger.error(maskPII(msg), ...args.map(a =>
        typeof a === 'string' ? maskPII(a) : a
      )),
    // ... other log levels
  };
}
```

### PII Detection in CI

```yaml
# .github/workflows/pii-scan.yml
name: PII Scan
on: pull_request

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Scan for hardcoded PII
        run: |
          # Check for email patterns in non-test files
          ! grep -rn --include='*.ts' --include='*.js' \
            --exclude-dir=test --exclude-dir=__tests__ \
            -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' \
            src/ || echo "WARNING: Possible hardcoded email found"

          # Check for hardcoded secrets
          ! grep -rn --include='*.ts' --include='*.js' \
            -E '(password|secret|api_key|token)\s*[:=]\s*["\x27][^"\x27]{8,}' \
            src/ || (echo "ERROR: Possible hardcoded secret" && exit 1)
```

---

## GDPR Data Export (Right of Access / Portability)

```typescript
async function exportUserData(userId: string): Promise<UserDataExport> {
  const [user, orders, activities, consents, auditLogs] = await Promise.all([
    db.users.findUnique({ where: { id: userId } }),
    db.orders.findMany({ where: { userId } }),
    db.activities.findMany({ where: { userId } }),
    db.consents.findMany({ where: { userId } }),
    db.auditLogs.findMany({
      where: { actorId: userId, actorType: 'user' },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: 'GDPR Article 15/20 Data Export',
    personalData: {
      name: user?.name,
      email: user?.email,
      phone: user?.phone,
      createdAt: user?.createdAt,
    },
    orders: orders.map(o => ({
      id: o.id, date: o.createdAt, total: o.totalCents, status: o.status,
    })),
    activityLog: activities.map(a => ({
      action: a.action, timestamp: a.createdAt, details: a.metadata,
    })),
    consents: consents.map(c => ({
      purpose: c.purpose, granted: c.granted, date: c.updatedAt,
    })),
    accessLog: auditLogs.map(l => ({
      action: l.action, resource: l.resourceType, timestamp: l.timestamp,
    })),
  };
}
```

---

## Right to Erasure (GDPR Article 17)

```typescript
async function deleteUserData(userId: string): Promise<DeletionReport> {
  const report: DeletionReport = { userId, deletedAt: new Date(), sections: [] };

  // 1. Check for legal holds (tax records, active disputes)
  const holds = await checkLegalHolds(userId);
  if (holds.length > 0) {
    // Cannot fully delete — anonymize instead
    report.partialDeletion = true;
    report.retainedReasons = holds;
  }

  // 2. Delete or anonymize in each system
  await db.$transaction(async (tx) => {
    // Anonymize orders (must retain for tax/accounting)
    await tx.orders.updateMany({
      where: { userId },
      data: { customerName: '[DELETED]', customerEmail: '[DELETED]' },
    });
    report.sections.push({ name: 'orders', action: 'anonymized' });

    // Delete personal data
    await tx.userProfiles.deleteMany({ where: { userId } });
    report.sections.push({ name: 'profile', action: 'deleted' });

    // Delete activities
    await tx.activities.deleteMany({ where: { userId } });
    report.sections.push({ name: 'activities', action: 'deleted' });

    // Delete consents
    await tx.consents.deleteMany({ where: { userId } });
    report.sections.push({ name: 'consents', action: 'deleted' });

    // Anonymize the user record (keep for referential integrity)
    await tx.users.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        name: '[DELETED USER]',
        phone: null,
        deletedAt: new Date(),
      },
    });
    report.sections.push({ name: 'user', action: 'anonymized' });
  });

  // 3. Delete from external systems
  await Promise.allSettled([
    deleteFromSearchIndex(userId),
    deleteFromAnalytics(userId),
    deleteFromEmailProvider(userId),
    deleteFromFileStorage(userId),
  ]);
  report.sections.push({ name: 'external_systems', action: 'deletion_requested' });

  // 4. Audit the deletion itself (audit logs survive deletion)
  await auditLogger.log({
    actorId: 'system',
    actorType: 'system',
    action: 'delete',
    resourceType: 'user',
    resourceId: userId,
    metadata: { reason: 'gdpr_erasure_request', report },
  });

  return report;
}
```

---

## Consent Management

### Consent Schema

```sql
CREATE TABLE user_consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id),
  purpose     TEXT NOT NULL,    -- 'analytics', 'marketing', 'personalization'
  granted     BOOLEAN NOT NULL,
  version     TEXT NOT NULL,    -- privacy policy version
  ip_address  INET,
  user_agent  TEXT,
  granted_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, purpose)
);
```

### Cookie Consent API

- **POST /api/consent**: Accept `{ purposes: { analytics: true, marketing: false } }`. Upsert each purpose into `user_consents` with current privacy policy version, IP, user agent. Set `grantedAt`/`revokedAt` timestamps accordingly.
- **requireConsent middleware**: Check `user_consents` for the required purpose before tracking. Set `req.trackingAllowed` flag for downstream handlers.

---

## Data Retention Policy Automation

```typescript
interface RetentionPolicy {
  table: string;
  retentionDays: number;
  dateColumn: string;
  action: 'delete' | 'anonymize';
  condition?: string; // additional WHERE clause
}

const RETENTION_POLICIES: RetentionPolicy[] = [
  { table: 'sessions', retentionDays: 30, dateColumn: 'created_at', action: 'delete' },
  { table: 'activities', retentionDays: 90, dateColumn: 'created_at', action: 'delete' },
  { table: 'audit_logs', retentionDays: 2555, dateColumn: 'timestamp', action: 'delete' }, // 7 years
  { table: 'temp_uploads', retentionDays: 1, dateColumn: 'created_at', action: 'delete' },
  {
    table: 'orders',
    retentionDays: 2555, // 7 years (tax requirement)
    dateColumn: 'created_at',
    action: 'anonymize',
  },
];

// Run daily via cron job
async function enforceRetentionPolicies() {
  for (const policy of RETENTION_POLICIES) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - policy.retentionDays);

    if (policy.action === 'delete') {
      const result = await db.$executeRawUnsafe(
        `DELETE FROM ${policy.table} WHERE ${policy.dateColumn} < $1 ${policy.condition ?? ''}`,
        cutoff
      );
      console.log(`Retention: deleted ${result} rows from ${policy.table}`);
    }
    // Handle anonymize similarly
  }
}
```

---

## SOC2 Evidence Collection

### Key Trust Services Criteria

| Criteria | Category | Evidence Examples |
|----------|----------|-------------------|
| CC6.1 | Logical Access | Access control lists, RBAC configuration |
| CC6.2 | Credentials | Password policy, MFA enforcement rate |
| CC6.3 | Access Removal | Offboarding automation, access review logs |
| CC7.1 | Monitoring | Alert configurations, SIEM dashboards |
| CC7.2 | Anomaly Detection | Intrusion detection logs, anomaly alerts |
| CC8.1 | Change Management | PR review requirements, deploy approvals |
| A1.2 | Availability | Uptime metrics, incident response procedures |

### Automated Evidence Collection

Collect for each reporting period: access controls (total users, MFA rate, access reviews), change management (deploy count, approval rate, PR review rate), incident response (incident count, MTTD, MTTR), and availability (uptime, SLO compliance). Automate via scheduled job that queries DB and monitoring APIs.
