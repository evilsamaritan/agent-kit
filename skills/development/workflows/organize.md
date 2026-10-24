# Organize an Existing Tree

Use this workflow to audit how existing code is laid out and plan its reorganization: a folder that keeps turning into a dump, a module before a large feature, a review that found grab-bags, or a request to clean up structure. It produces a target tree and a move table; the moves themselves run as behavior-preserving slices through [change.md](change.md) in Refactor mode. The tests, the container check, and the smell catalog are in [organization.md](../references/organization.md).

## Contents

- [1. Scope](#1-scope)
- [2. Inventory](#2-inventory)
- [3. Concept map](#3-concept-map)
- [4. Findings](#4-findings)
- [5. Target tree](#5-target-tree)
- [6. Move table](#6-move-table)
- [7. Slices](#7-slices)
- [8. Report](#8-report)

## 1. Scope

1. Name the tree under audit and why now: a repeated dump, an upcoming change in that area, a review finding.
2. Read the organization choices the project recorded (glossary, suffixes, forms, thresholds). They take precedence over defaults; the shape of the current tree does not.
3. Note the levels fixed by a methodology or framework; the audit works inside them.

## 2. Inventory

For every folder in scope, list its files. For every file, record its top-level declarations with the concept each names, and who imports it. Collect these with the stack's own means — listings, outlines, searches. For a large tree, a throwaway script in a scratch directory speeds this up; it is not committed and not left in the project.

```text
<folder>/
  <file>  declarations: <name — concept>, …  imported by: <files>
```

## 3. Concept map

Turn the inventory around: for each concept, the declarations that serve it and the files where they live.

```text
<concept>: <declaration> (<file>), <declaration> (<file>), …
```

A concept whose declarations sit in several files across trees is split. A file that appears under several concepts is a dump. A declaration that sits in a file of another concept is at its consumer. Name concepts in the project's words; a concept nobody can name is usually two.

## 4. Findings

Run the [container check](../references/organization.md#container-check) for each folder and file. Name each finding with a smell from the [catalog](../references/organization.md#smell-catalog), with `file:line` evidence. Group findings by cause: one grab-bag folder often explains several dump files; one missing concept home explains a split concept and a declaration at its consumer.

## 5. Target tree

Draw the tree concept-first, with a root file named after each concept. Give a role a separate file only when it [gets its own file](../references/organization.md#when-a-role-gets-its-own-file); otherwise keep it in the root. A concept with several files gets a folder named after it. Next to each folder, its phrase; next to each file, its one-line description. A folder whose phrase you cannot write, or a file whose description needs "and", is not finished.

```text
<concept>/          everything here is about <concept>
  <concept>         root: model, invariants, operations
  <conceptRole>     <role>, only when the condition above holds
```

Keep the tree as small as the concepts allow; a folder per file is as wrong as one folder for everything.

## 6. Move table

One row per moved declaration or file:

| From | To | Why (concept) | Contract change |
|---|---|---|---|
| `<file>:<declaration>` | `<new home>` | `<concept it describes>` | none / entry point / persisted name |

A row that changes a public entry point, a persisted or wire name, or another module's imports is a decision: present it with options ([proportion.md](../references/proportion.md#presenting-options)).

## 7. Slices

Order the moves into slices, each one group that belongs together, by dependency: first the groups that depend on nothing still waiting to move, then the groups that depend on them, so each slice lands on homes that already exist. Each slice follows [restructuring without changing behavior](../references/refactoring.md): checks green before, verbatim moves, a temporary re-export when consumers are many, checks green after, one slice per commit. Remove the temporary re-exports in a final slice. Behavior changes found along the way go to separate changes.

## 8. Report

1. The target tree with phrases.
2. The move table, with decisions marked.
3. The slices in order, each with its checks.
4. The organization choices to record in the project's instructions, if the audit settled any.
5. What was not inventoried: folders out of scope, languages read without an outline, consumers that cannot be found by search (dynamic imports, reflection, configuration).

A read-only agent stops at the report. An agent asked to reorganize executes the slices one by one and reports each.
