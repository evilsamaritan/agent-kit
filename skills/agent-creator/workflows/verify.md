# Verify Profiles and Project Agents

## Step 1: Choose scope

- `.agent-kit/agents.json` or generated project targets named → verify the consuming project.
- `profiles/<name>/` or profile library named → verify the Agent Kit source.
- Ambiguous inside Agent Kit → verify both the library and one temporary project materialization.

## Step 2: Load the checklist

Read `../references/verification-checklist.md` in full.

## Step 3: Verify a consuming project

1. Read `.agent-kit/agents.json` and every referenced native target.
2. Run the installed materializer with `--check`.
3. Parse generated Codex targets as TOML.
4. Validate Claude frontmatter and selected skills.
5. Verify generated paths match each entry's runtime list.
6. Verify non-generated agent files were not modified.

## Step 4: Verify the profile library

1. Read `PROFILE.md`, `claude.yaml`, and `codex.yaml` for each target profile.
2. Run `node scripts/generate-profiles.mjs --check`.
3. Confirm every declared role has one exact body section and every default skill exists.
4. Confirm generated Claude agents and orchestrator references match their profiles.
5. Run `bash scripts/validate-repository.sh`.

## Step 5: Report and fix

Lead with failures, including file paths and the violated contract. When the user requested a fix or completion, repair safe in-scope issues, regenerate, and rerun every failed check. Do not treat a green narrow check as proof of the full cross-runtime contract.
