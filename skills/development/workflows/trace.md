# Trace an Extension

Use this workflow when a change adds a member to a family or changes how a family is dispatched, when reviewing such a change, or when someone asks whether a structure is open. It turns "is the design extensible" into a list of files.

## 1. Pick the family and the member

Name the family (payment providers, notification channels, document types, importers, entity kinds) and one realistic next member — the one a product request would most plausibly add. For a review, use the member the change added.

## 2. Write the expected touches

Before looking for the answer, write what adding the member should touch:

| Touch | Expected |
|---|---|
| the member's own module: behavior, presentation data, codec if it has state | yes |
| one registration at construction or decoding | yes |
| its assets, content, or configuration data | yes |
| a format or protocol version, when the member is persisted or sent | yes, with a migration |
| any consumer: service, controller, view, router, persistence orchestrator, other members | no |

## 3. Find the actual touches

Search the code for every place that names existing members or tests their type:

- comparisons with a kind or type tag (`kind === "…"`, `type == …`, `match` arms over the family);
- type tests (`instanceof`, `is`, `as?`, type switches);
- tables keyed by member outside the registration;
- fallbacks that would silently absorb a new member.

Each hit outside the expected touches is a place the new member must be added by hand. When the answer is not clear from reading and you may edit, add the member for real in a scratch copy and compare `git diff --stat` with the expected list. A read-only agent reports a reasoned trace instead. Ask before deleting branches or worktrees you created.

## 4. Report facts

```text
Family: <name> (<open | closed: evidence>)
Member traced: <name>
Expected touches: <list>
Actual touches: <list, file:line for each consumer hit>
Silent defaults found: <file:line or none>
Verdict: matches | consumers must change (<count>)
Evidence: <reasoned from code | executed in a scratch branch>
```

A consumer on the actual list is a finding against core rule 1; a silent default is a finding against core rule 2. Recommend moving the knowledge to the member, or — when a requirement says the set does not grow — an exhaustive dispatch with the requirement cited.
