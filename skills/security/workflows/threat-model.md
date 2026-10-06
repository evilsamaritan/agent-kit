# Threat Modelling Procedure

Use at design time or before a major change. Output: a short list of abuse cases and the controls that answer them.

1. **Assets.** What is worth attacking: data (by classification), credentials and keys, money movement, privileged actions, availability of a critical function.
2. **Boundaries.** Draw the data flow: actors, components, stores, and the lines where control or privilege changes. Each line is a boundary.
3. **Abuse cases.** For each flow crossing a boundary, ask what a malicious or compromised party could do: spoof an identity, tamper with data, repudiate an action, read what they should not, exhaust a resource, gain privilege. Include the insider and the compromised dependency or integration.
4. **Controls.** For each abuse case choose a control from the "which control for this input" tree, authorization design (`auth`), network controls (`networking`), or monitoring (`observability`). Prefer removing the capability to guarding it.
5. **Residual risk.** Rank what is left by likelihood and impact; decide fix now, accept with an owner, or monitor.
6. **Record and revisit.** Keep the model next to the design (an ADR or design doc) and revisit when a boundary, data class, or integration changes.

Keep it to one page for a feature; depth should match the asset value.
