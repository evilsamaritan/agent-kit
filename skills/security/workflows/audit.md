# Security Audit Procedure

Use when reviewing code, a change, or a service for security defects.

1. **Scope.** What is under review (diff, service, repo), what it exposes, and what is out of scope. Identify entry points and sensitive assets (credentials, personal data, money, admin functions).
2. **Trust boundaries.** List where control of the data changes (see SKILL.md). Mark each boundary with what validates and authorizes there.
3. **Walk the rubric.** Go through [../references/owasp-top10.md](../references/owasp-top10.md) category by category for the code in scope. Use the "which control for this input" tree in SKILL.md for every untrusted flow.
4. **Check the cross-cutting items:** secrets in code or history, dependency and build risk, logging of security events and absence of secrets in logs, error paths that fail open or leak detail.
5. **Verify, don't assume.** Confirm each suspected finding by reading the code path to the sink; note the precondition (who can reach it, with what privilege).
6. **Rate severity** by exploitability, reachability, and impact; classes in [../references/security-patterns.md](../references/security-patterns.md#severity-classification).
7. **Report.**

```
## Security Findings

### Summary
[scope, overall posture, count by severity]

### Findings
| # | Severity | Category (rubric) | Location | Finding | Precondition | Fix |
|---|----------|-------------------|----------|---------|--------------|-----|

### Not reviewed / assumptions
[anything out of scope or unverified]
```

Findings are ordered by severity; each has a file and line and a concrete fix.
