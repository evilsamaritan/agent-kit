# Maintain a Reusable Profession Profile

Run this workflow only in the Agent Kit source repository. Project users configure profile instances through `.agent-kit/agents.json`; they do not fork profession bodies.

## Step 1: Identify the operation

Choose create, improve, rename, or delete from the user's request. Before rename or delete, search project docs, generated targets, and meta-skills for references.

## Step 2: Select role behavior

1. Read the relevant files under `templates/`.
2. Pick one to three behavioral roles.
3. Adapt each role into the profession's language under an exact `## Role — <role>` heading.
4. Keep templates domain-neutral and the profile domain-specific. Do not paste template prose wholesale.

## Step 3: Select defaults

1. Choose a small default skill set that represents the profession broadly.
2. Set portable `effort` and `access` in `PROFILE.md`.
3. Set runtime model defaults in `claude.yaml` and `codex.yaml`.
4. Keep runtime-specific settings out of the core.

Use [../references/profile-template.md](../references/profile-template.md) for the source format.

## Step 4: Write the profile source

Create or edit:

```text
profiles/<name>/
├── PROFILE.md
├── claude.yaml
└── codex.yaml
```

Never edit `.claude-plugin/agents/` or `skills/agent-orchestrator/references/profiles/` directly.

## Step 5: Generate and verify

1. Run `node scripts/generate-profiles.mjs`.
2. Run `node scripts/generate-profiles.mjs --check`.
3. Run `bash scripts/validate-repository.sh`.
4. Apply the verification checklist.
5. Test at least one materialized project instance when changing renderer behavior or field semantics.
