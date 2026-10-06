# Recovery: RPO, RTO, Backups, Restore Drills

Recovery is what happens when prevention failed: data lost or corrupted, a zone or region gone, a bad change that cannot be rolled back. Start from requirements, then pick the cheapest design that meets them. Database-specific backup and point-in-time recovery mechanics are in `database`.

## Contents

- [Requirements first](#requirements-first)
- [Failover tiers](#failover-tiers)
- [Backups](#backups)
- [Restore verification](#restore-verification)
- [Runbooks and drills](#runbooks-and-drills)
- [Common failures](#common-failures)

---

## Requirements first

| Term | Meaning | Who sets it |
|------|---------|-------------|
| **RPO** (recovery point objective) | Maximum acceptable data loss, measured in time | Business, per data set |
| **RTO** (recovery time objective) | Maximum acceptable time from failure to service restored | Business, per service |

- Set them per service and per data class. A payments ledger and a cache have different values.
- They are requirements with a cost. Halving either usually multiplies cost; get the number agreed before choosing technology.
- Include the dependencies: a service cannot recover faster than the slowest thing it needs (identity, DNS, secrets, the database).
- Define the disaster scenarios you design for: instance, zone, region, operator error or malicious deletion, corrupted data replicated everywhere, loss of a vendor or account.

## Failover tiers

Pick the lowest tier that meets the RPO and RTO.

| Tier | Design | Typical RPO / RTO | Cost |
|------|--------|-------------------|------|
| Backup and restore | Periodic backups in another failure domain; rebuild on demand | Hours to days | Lowest |
| Pilot light | Data replicated continuously; compute provisioned only on failover | Minutes / hours | Low |
| Warm standby | Scaled-down copy running and receiving data; scale up on failover | Minutes / minutes to an hour | Medium |
| Active-active | Multiple regions serve traffic; each can absorb the other | Near zero / near zero | Highest, plus data-consistency complexity |

Replication is not backup. Replicas copy deletions and corruption within seconds. Keep point-in-time or versioned backups that a bad write cannot reach.

## Backups

- **Frequency follows RPO.** If RPO is 15 minutes, daily snapshots are not enough; use continuous log shipping or point-in-time recovery.
- **Separate failure domain.** Another account or project, another region, with separate credentials. Ransomware and mistaken deletions should not be able to reach both production and backups.
- **Immutability.** Use write-once or retention-locked storage for at least one copy.
- **Encryption and key recovery.** Backups are encrypted; the keys are recoverable independently of the system being restored.
- **Cover everything stateful:** databases, object storage, queues that hold unprocessed work, search indexes (or the means to rebuild them), configuration, secrets, infrastructure definitions.
- **Retention** by recovery need and legal requirement; deletion requests interact with backups (see `compliance`).

## Restore verification

A backup that has never been restored is a hope, not a backup.

- Restore on a schedule into an isolated environment and run integrity checks and a smoke test against the restored data.
- Measure the real restore time and compare it to the RTO. Growth in data size silently breaks RTO.
- Alert when a backup job fails or its age exceeds the RPO, and when a restore test fails.
- Verify the restored system, not just the files: it starts, the application connects, and a known record is present.

## Runbooks and drills

- Write the recovery runbook before it is needed: decision criteria for declaring a disaster, who decides, ordered steps, how to verify, how to fail back.
- Keep the runbook and its prerequisites (access, credentials, contact lists) reachable when the primary environment is down.
- Rehearse: table-top for decisions, game day for the technical failover. Time it. Record gaps and fix them, as with postmortem action items.
- Practice failing back, not only failing over.

## Common failures

| Failure | Consequence | Fix |
|---------|-------------|-----|
| Backups never restored | Corrupt or incomplete backup found during the incident | Scheduled restore tests |
| Backup credentials or keys live only in the failed system | Cannot decrypt or reach backups | Independent key and credential recovery |
| Replica treated as a backup | Deletion replicated everywhere | Point-in-time or versioned backups |
| RTO assumed, never measured | Restore takes days | Timed drills |
| Dependencies forgotten (DNS, identity, secrets) | Service restored but unreachable | Dependency map with recovery order |
| Failover path untested or manual-only knowledge | Failover fails or depends on one person | Rehearsed runbook, automation where possible |
