# Compliance Patterns

Contracts each piece must meet, not production code. Language-neutral. Code practice (error handling, parameterized queries, ownership of async work) follows `development` and `security`; log redaction follows `observability`; database mechanics follow `database`. Retention periods below are labelled as examples: the real value is whatever the applicable law and contract require.

## Contents

- [Audit trail](#audit-trail)
- [Consent events](#consent-events)
- [Data subject requests](#data-subject-requests)
- [Erasure checklist](#erasure-checklist)
- [Retention policy](#retention-policy)
- [PII in logs and code](#pii-in-logs-and-code)
- [SOC2 evidence](#soc2-evidence)

---

## Audit trail

### Event fields

| Field | Notes |
|-------|-------|
| `event_id`, `timestamp` (UTC) | Unique ID and server-assigned time |
| `actor_id`, `actor_type` | Pseudonymous ID (user, admin, system, API client); not name or email |
| `action` | Create, read, update, delete, export, login, permission change, and so on |
| `resource_type`, `resource_id` | What was acted on |
| `changes` | Field names with old and new values only where needed; never secrets or raw PII |
| `request_id` / `trace_id` | Correlation with logs and traces |
| `source` | Service or client; network address only if it is justified against minimization |
| `outcome` | Success, denied, failed |

### Contract

- **Append-only.** The application role can insert and select, not update or delete. Enforce in the store, not in application code.
- **Retention is a separate, privileged job** with its own role, which is the only identity allowed to delete expired rows. The app connection that is denied DELETE must not be the one that runs retention.
- **Keep personal data out of the immutable log.** Use pseudonymous IDs resolvable only via a table that supports erasure, or encrypt per-subject fields with a per-subject key that is destroyed on erasure.
- **Tamper evidence:** hash chaining or write-once storage for high-assurance needs.
- **Write failures are not silent.** A security-relevant action whose audit write failed is surfaced (fail the action or raise an alert), per the rule that errors are not swallowed.

---

## Consent events

Store every decision as an append-only event; derive current state from the events. A single row per user and purpose loses history and cannot prove what was shown or accepted at a given time.

```sql
-- Sketch. Subject is a user ID, or an anonymous visitor ID until login.
CREATE TABLE consent_events (
  event_id       UUID PRIMARY KEY,
  subject_id     TEXT NOT NULL,        -- visitor ID before login, user ID after (link at login)
  purpose        TEXT NOT NULL,        -- analytics, marketing, personalization
  decision       TEXT NOT NULL,        -- granted | withdrawn
  policy_version TEXT NOT NULL,        -- notice and wording version shown
  source         TEXT NOT NULL,        -- banner, settings page, API, imported
  occurred_at    TIMESTAMPTZ NOT NULL
);
-- Current state per (subject_id, purpose) = the latest event.
```

Rules:
- The anonymous visitor ID is the subject until login; link it to the user at login without discarding history.
- **Client-side gating:** non-essential cookies, tags, and trackers load only after the stored decision allows them, and not at all before a decision. A server-side database check alone cannot stop a tracker from running in the browser.
- Reject is as easy as accept; withdrawal is as easy as granting and takes effect immediately for new processing.
- Do not store more than evidence needs: justify any IP address or user-agent retention against minimization, and prefer a hash or a truncated value.
- Show the decision history in the subject access export.

---

## Data subject requests

1. **Verify identity** before disclosing or erasing anything. Use the existing authenticated session, or an equivalent check proportionate to the data.
2. **Log the request** with receipt time; the response clock is one month (extendable by two for complex requests, with notice).
3. **Fan out to every system** that holds the subject's data: primary databases, replicas, search indexes, analytics, email and messaging providers, file storage, backups, and processors.
4. **Respond with evidence:** what was done in each system, or why not (legal exception).

### Access and portability export checklist

- Data the person provided and data observed about them; derived data where required for portability.
- Consent history and the processing purposes.
- Machine-readable format (JSON or CSV), delivered through a secure channel.
- Excludes other people's data and trade secrets; redact accordingly.

---

## Erasure checklist

Per request, track a status per system; never report completion on a request that has failures.

| Step | Contract |
|------|----------|
| Identity verified | Before anything is deleted |
| Legal holds and retention duties checked | Tax, accounting, disputes, regulatory duties: **branch on the result**. Data under a hold is retained (restricted and minimized), not deleted, and only the non-held data is erased; the reason is recorded |
| Primary store | Delete, or anonymize where records must remain for integrity or law (orders for tax) |
| Derived and secondary stores | Search indexes, caches, analytics, data warehouse, ML features |
| Third parties and processors | Deletion request sent; confirmation tracked; failures queued for retry with an owner and a deadline |
| Files and media | Object storage, attachments |
| Backups | Documented policy: expire on the normal cycle, and make sure restored data re-applies erasures |
| Consent and request records | Keep what is needed as evidence, minimized |
| Audit entry | Record that erasure happened, with the per-system outcome |

Sketch of the state to keep:

```
erasure_request { id, subject_id, received_at, identity_verified_at,
                  holds: [...],
                  systems: [ { name, status: pending|done|retained|failed, reason, last_attempt } ],
                  completed_at (set only when no system is pending or failed) }
```

Failures from external deletions are surfaced and retried, not swallowed. "Requested" is not "deleted".

---

## Retention policy

A table, owned and reviewed, not constants in code.

| Data set | Retention (example) | Basis for keeping | Owner | Action at expiry |
|----------|--------------------|-------------------|-------|------------------|
| Session and auth logs | Short (weeks) | Security | Platform | Delete |
| Behavioral analytics | Months | Consent / legitimate interest | Product | Delete or aggregate |
| Orders and invoices | Per applicable accounting and tax law | Legal obligation | Finance | Anonymize personal fields |
| Audit logs | Per policy and regulation | Accountability / legal | Security | Delete via privileged job |
| Temporary uploads | Days | Contract | Platform | Delete |

Rules:
- Retention is expressed "per applicable law"; the numbers above are illustrative.
- The retention job runs under its own privileged role, on a schedule, and logs what it removed (counts, not content).
- Build the delete statement from an allowlist of table and column identifiers and bind values as parameters; never interpolate a policy string into SQL.
- Backups and replicas expire on their own cycle; document it.

---

## PII in logs and code

- Redaction of logs: the rule and logger setup are in `observability` (allowlist at the call site plus a final-stage scrubber).
- Regex masking of free text is a safety net with false positives and negatives (phone-like digit runs, card numbers without a checksum test); it never replaces not logging the data.
- Hardcoded secrets and PII in source: use a maintained secret scanner with push protection (`security`), not ad hoc grep.

---

## SOC2 evidence

SOC2 is an attestation report from an independent auditor. Engineering supplies evidence for each period.

| Criteria | Category | Evidence examples |
|----------|----------|-------------------|
| CC6.1 | Logical access | Access lists, role definitions |
| CC6.2 | Credentials | Password policy, MFA enforcement rate |
| CC6.3 | Access removal | Offboarding automation, access review records |
| CC7.1 | Monitoring | Alert configuration, monitoring dashboards |
| CC7.2 | Anomaly detection | Intrusion and anomaly alerts, their handling |
| CC8.1 | Change management | Review requirements, deploy approvals |
| A1.2 | Availability | Uptime, incident response, recovery tests |

Collect per period: access (users, MFA coverage, reviews), change management (deploy count, review rate), incidents (count, time to detect and mitigate), availability (uptime, SLO compliance). Automate collection from source systems so evidence is reproducible.
