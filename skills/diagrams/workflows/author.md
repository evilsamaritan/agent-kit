# Author One Diagram

## Step 1: Fix the question

Write the question the diagram answers in one line, its scope, and its status (current, proposed, transitional). If the question needs a design decision nobody has made, stop and route it to `architecture` or the domain owner.

## Step 2: Collect the model

List the entities and relationships from the owner's model or from the code: stable ID, label, relationship kind and verb, direction, order or cardinality, status, failure paths. Mark anything inferred or unknown. For existing code, confirm each edge in the source.

## Step 3: Choose view and language

Use the SKILL.md decision tree and [selection.md](../references/selection.md). Follow an existing source or project convention. Name the missing capability when a specialized notation is needed.

## Step 4: Write the source

Follow the language reference. One source per view, in a fence or a sidecar next to its consumer ([source-contract.md](../references/source-contract.md)). Add the title, takeaway, legend if styles carry meaning, and a textual equivalent.

## Step 5: Check meaning

Compare the source with the list from Step 2 edge by edge: endpoints, direction, kind, label, order or cardinality, status, failure paths. Remove anything not in the model. A crowded view is split, not trimmed.

## Step 6: Compile and look

When the tool is available: validate, compile with the project's pinned version, check the exit status, and inspect the output for overlaps, detached arrowheads, clipped labels, and crossings that hide a relationship. Produce theme or compact variants from the same source only if a consumer needs them.

## Step 7: Hand off

Report the source location, what was verified (syntax, compile, visual inspection, host rendering), and open questions. When a document or a web artifact is next, pass the source itself to `documentation` or `playground`.
