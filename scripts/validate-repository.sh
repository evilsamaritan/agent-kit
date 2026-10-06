#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
errors=0
checked=0

err() {
  printf 'ERROR [%s]: %s\n' "$1" "$2" >&2
  errors=$((errors + 1))
}

fm_field() {
  local file="$1" field="$2"
  awk -v f="$field" '
    BEGIN { in_fm=0 }
    /^---[[:space:]]*$/ { in_fm = !in_fm; next }
    in_fm && $1 == f ":" { sub(/^[^:]*:[[:space:]]*/, ""); print; exit }
  ' "$file"
}

# A missing tool must fail the run, never skip a check: a command that is absent inside an
# `if` condition evaluates as false and the check silently passes.
for tool in node jq grep awk; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'ERROR [runtime]: %s is required to validate the repository\n' "$tool" >&2
    exit 1
  fi
done

bash "$repo_root/scripts/validate-plugin-manifests.sh"

if [[ -e "$repo_root/.claude/agents" || -e "$repo_root/.claude/skills" ]]; then
  err "packaging" "project-local .claude agents/skills must not be shipped by the plugin repository"
fi
# Hosts load CLAUDE.md / AGENTS.md (case-insensitively on macOS) as instructions for a
# directory; a reference with that name would leak into maintainers' sessions.
while IFS= read -r instruction_file; do
  err "packaging" "${instruction_file#"$repo_root"/} is named like a host instruction file; rename it"
done < <(find "$repo_root/skills" "$repo_root/profiles" "$repo_root/scripts" "$repo_root/docs" \( -iname 'claude.md' -o -iname 'claude.local.md' -o -iname 'agents.md' \) 2>/dev/null)
if [[ -e "$repo_root/.agents/plugins/marketplace.json" ]]; then
  err "packaging" "use the shared .claude-plugin/marketplace.json instead of a duplicate .agents catalog"
fi

for script in "$repo_root"/scripts/*.mjs "$repo_root"/scripts/profile-runtimes/*.mjs "$repo_root"/skills/agent-creator/scripts/*.mjs; do
  node --check "$script"
done
node "$repo_root/scripts/generate-profiles.mjs" --check
node --test "$repo_root"/scripts/tests/*.test.mjs

profile_count=0
for profile_file in "$repo_root"/profiles/*/PROFILE.md; do
  profile=$(basename "$(dirname "$profile_file")")
  profile_count=$((profile_count + 1))
  [[ -f "$repo_root/profiles/$profile/claude.yaml" ]] || err "$profile" "missing claude.yaml"
  [[ -f "$repo_root/profiles/$profile/codex.yaml" ]] || err "$profile" "missing codex.yaml"
  [[ -f "$repo_root/skills/agent-orchestrator/references/profiles/$profile.md" ]] || err "$profile" "missing generated orchestrator reference"
done
printf 'Profile library OK: %d profile(s).\n' "$profile_count"

project_test_dir=$(mktemp -d)
collision_test_dir=$(mktemp -d)
trap 'rm -rf "$project_test_dir" "$collision_test_dir"' EXIT

mkdir -p "$project_test_dir/.agent-kit" "$project_test_dir/.claude/agents"
printf 'manual project agent\n' > "$project_test_dir/.claude/agents/manual.md"
jq -n '{
  schema_version: 1,
  agents: [
    {
      name: "backend-developer",
      profile: "developer",
      skills: ["backend", "api-design", "database", "rust"],
      runtimes: ["claude", "codex", "kimi"],
      codex: {effort: "high"}
    },
    {
      name: "tester",
      profile: "tester",
      skills: ["testing"]
    },
    {
      name: "reviewer",
      profile: "reviewer",
      runtimes: ["codex"],
      access: "read-only"
    }
  ]
}' > "$project_test_dir/.agent-kit/agents.json"

node "$repo_root/skills/agent-creator/scripts/materialize-agents.mjs" --project-root "$project_test_dir"
node "$repo_root/skills/agent-creator/scripts/materialize-agents.mjs" --project-root "$project_test_dir" --check

jq '.note = "unsupported"' "$project_test_dir/.agent-kit/agents.json" > "$project_test_dir/.agent-kit/invalid-agents.json"
if node "$repo_root/skills/agent-creator/scripts/materialize-agents.mjs" \
  --project-root "$project_test_dir" \
  --config "$project_test_dir/.agent-kit/invalid-agents.json" \
  --check >/dev/null 2>&1; then
  err "materializer" "accepted an unsupported top-level config field"
fi

[[ -f "$project_test_dir/.claude/agents/backend-developer.md" ]] || err "materializer" "Claude target missing"
[[ -f "$project_test_dir/.codex/agents/backend-developer.toml" ]] || err "materializer" "Codex backend target missing"
[[ -f "$project_test_dir/.codex/agents/reviewer.toml" ]] || err "materializer" "Codex reviewer target missing"
[[ ! -f "$project_test_dir/.claude/agents/reviewer.md" ]] || err "materializer" "runtime filtering failed"
kimi_target="$project_test_dir/.kimi-code/agents/backend-developer.md"
[[ -f "$kimi_target" ]] || err "materializer" "Kimi target missing"
grep -q '${agents_md}' "$kimi_target" && grep -q '${skills}' "$kimi_target" || err "materializer" "Kimi target lost project or skill context"
grep -q '^tools: \[.*"Bash"' "$kimi_target" || err "materializer" "Kimi full access tools missing"
[[ -f "$project_test_dir/.codex/agents/tester.toml" && ! -e "$project_test_dir/.kimi-code/agents/tester.md" ]] || err "materializer" "omitted runtimes must mean Claude and Codex only"
[[ $(<"$project_test_dir/.claude/agents/manual.md") == "manual project agent" ]] || err "materializer" "manual agent was modified"

grep -q 'sandbox_mode = "read-only"' "$project_test_dir/.codex/agents/reviewer.toml" || err "materializer" "read-only access did not reach Codex sandbox"
grep -q 'agent-kit:backend' "$project_test_dir/.codex/agents/backend-developer.toml" || err "materializer" "Codex target does not name its library skills"
grep -q '^skills: \["agent-kit:development", "agent-kit:backend"' "$project_test_dir/.claude/agents/backend-developer.md" || err "materializer" "Claude target does not preload required and library skills by qualified id"

mkdir -p "$collision_test_dir/.agent-kit" "$collision_test_dir/.claude/agents"
jq -n '{schema_version: 1, agents: [{name: "backend", profile: "developer", runtimes: ["claude"]}]}' > "$collision_test_dir/.agent-kit/agents.json"
printf 'owned by user; mentions Generated by agent-kit only as prose\n' > "$collision_test_dir/.claude/agents/backend.md"
if node "$repo_root/skills/agent-creator/scripts/materialize-agents.mjs" --project-root "$collision_test_dir" >/dev/null 2>&1; then
  err "materializer" "overwrote or accepted a colliding non-generated agent"
fi

jq '.agents = [.agents[] | select(.name == "reviewer")]' "$project_test_dir/.agent-kit/agents.json" > "$project_test_dir/.agent-kit/agents.next.json"
mv "$project_test_dir/.agent-kit/agents.next.json" "$project_test_dir/.agent-kit/agents.json"
node "$repo_root/skills/agent-creator/scripts/materialize-agents.mjs" --project-root "$project_test_dir" --prune
[[ ! -e "$project_test_dir/.claude/agents/backend-developer.md" ]] || err "materializer" "prune left obsolete Claude target"
[[ ! -e "$project_test_dir/.codex/agents/backend-developer.toml" ]] || err "materializer" "prune left obsolete Codex target"
[[ ! -e "$kimi_target" ]] || err "materializer" "prune left obsolete Kimi target"
[[ -f "$project_test_dir/.claude/agents/manual.md" ]] || err "materializer" "prune removed manual agent"
node "$repo_root/skills/agent-creator/scripts/materialize-agents.mjs" --project-root "$project_test_dir" --check

# Freshness: a changed setting is drift; --dry-run reports it and never writes.
materialize=("node" "$repo_root/skills/agent-creator/scripts/materialize-agents.mjs" "--project-root" "$project_test_dir")
reviewer_target="$project_test_dir/.codex/agents/reviewer.toml"
sed 's/model_reasoning_effort = "high"/model_reasoning_effort = "low"/' "$reviewer_target" > "$reviewer_target.next" && mv "$reviewer_target.next" "$reviewer_target"
"${materialize[@]}" --dry-run | grep -q 'effort: low → high' || err "freshness" "setting drift was not reported"
grep -q 'model_reasoning_effort = "low"' "$reviewer_target" || err "freshness" "--dry-run wrote a target"
if "${materialize[@]}" --check >/dev/null 2>&1; then err "freshness" "--check accepted a setting change"; fi
"${materialize[@]}" >/dev/null
"${materialize[@]}" --check >/dev/null || err "freshness" "refresh did not restore an up-to-date target"
grep -q '^# agent-kit-metadata: {"inputs":' "$reviewer_target" || err "freshness" "composition fingerprint missing"
if grep -q '"kit":' "$reviewer_target"; then err "freshness" "target records the kit version"; fi
printf 'Project materialization OK: Claude, Codex, Kimi, collision, drift, prune, and freshness cases.\n'

for file in "$repo_root"/skills/*/SKILL.md; do
  skill=$(basename "$(dirname "$file")")
  checked=$((checked + 1))

  if [[ $(head -n 1 "$file") != '---' ]]; then
    err "$skill" 'missing opening YAML frontmatter delimiter'
    continue
  fi

  name=$(fm_field "$file" name)
  description=$(fm_field "$file" description)
  user_invocable=$(fm_field "$file" user-invocable)
  line_count=$(wc -l < "$file" | tr -d ' ')

  if [[ -z "$name" ]]; then
    err "$skill" "missing name"
  elif [[ "$name" != "$skill" ]]; then
    err "$skill" "frontmatter name '$name' does not match directory"
  elif [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || (( ${#name} > 64 )); then
    err "$skill" "name must be lowercase kebab-case and at most 64 characters"
  fi

  if [[ -z "$description" ]]; then
    err "$skill" "missing single-line description"
  elif [[ "$description" = '|' || "$description" = '>' ]]; then
    err "$skill" "description must be a single line"
  elif (( ${#description} > 1024 )); then
    err "$skill" "description exceeds 1024 characters"
  fi

  if [[ -n "$user_invocable" && "$user_invocable" != 'true' && "$user_invocable" != 'false' ]]; then
    err "$skill" "user-invocable must be true or false"
  fi

  # Claude and Kimi substitute $N / $ARGUMENTS[N] when a skill is invoked.
  if grep -qE '\$[0-9]' "$file"; then
    err "$skill" "SKILL.md contains a dollar-digit sequence that skill invocation would substitute; write amounts as USD 10 or 10 dollars"
  fi

  if (( line_count > 550 )); then
    err "$skill" "SKILL.md has $line_count lines; ceiling is about 550"
  fi

  if awk '
    BEGIN { in_fm=0 }
    /^---[[:space:]]*$/ { in_fm = !in_fm; next }
    in_fm && /^meta:[[:space:]]*/ { found=1 }
    END { exit found ? 0 : 1 }
  ' "$file"; then
    err "$skill" "unknown top-level meta field; use metadata"
  fi
done

if grep -rqE 'team-creator|team-orchestrator|agent-runner|\.claude/teams|scripts/generate-agents\.mjs|agents/[^/ ]+/AGENT\.md' \
  "$repo_root/AGENTS.md" "$repo_root/README.md" "$repo_root/skills" "$repo_root/scripts" \
  --exclude='validate-repository.sh'; then
  err "stale-reference" "removed team runtime or pre-profile agent path is still referenced"
fi

# Relative Markdown links in shipped text must resolve.
broken_links=$(node -e '
  const fs = require("fs"); const path = require("path"); const out = []
  const check = (file) => {
    const text = fs.readFileSync(file, "utf8").replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "")
    for (const m of text.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(m[1])) continue
      if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) out.push(`${path.relative(process.argv[1], file)} -> ${m[1]}`)
    }
  }
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p); else if (p.endsWith(".md")) check(p)
  })
  walk(path.join(process.argv[1], "skills"))
  for (const f of ["README.md", "AGENTS.md"]) check(path.join(process.argv[1], f))
  console.log(out.join("\n"))' "$repo_root")
if [[ -n "$broken_links" ]]; then
  while IFS= read -r link; do err "links" "broken relative link: $link"; done <<<"$broken_links"
fi

# Code practice has one owner. Principle vocabulary elsewhere means a skill or
# profile re-teaches it instead of pointing to `development`.
practice_hits=$(node -e '
  const fs = require("fs"); const path = require("path"); const out = []
  const terms = /\b(SOLID|YAGNI|DRY)\b|Single Responsibility|Open\/Closed|Liskov|Interface Segregation|Dependency Inversion/
  const owner = path.join(process.argv[1], "skills", "development")
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name)
    if (p === owner) return
    if (e.isDirectory()) return walk(p)
    if (!p.endsWith(".md")) return
    fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      if (terms.test(line)) out.push(`${path.relative(process.argv[1], p)}:${i + 1}`)
    })
  })
  walk(path.join(process.argv[1], "skills")); walk(path.join(process.argv[1], "profiles"))
  console.log(out.join("\n"))' "$repo_root")
if [[ -n "$practice_hits" ]]; then
  while IFS= read -r hit; do err "practice" "$hit uses principle vocabulary owned by skills/development; point there instead"; done <<<"$practice_hits"
fi

node "$repo_root/skills/playground/scripts/check-shell-contract.mjs" || err "playground" "shared assets fail the playground contract"
node "$repo_root/skills/playground/scripts/check-theme-contrast.mjs" >/dev/null || err "playground" "theme tokens fail the contrast check"

# Every D2 example in skill text must compile with the installed d2.
if command -v d2 >/dev/null 2>&1; then
  d2_dir=$(mktemp -d)
  node -e '
    const fs = require("fs"); const path = require("path"); let n = 0
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (p.endsWith(".md")) for (const m of fs.readFileSync(p, "utf8").matchAll(/```d2\n([\s\S]*?)```/g)) fs.writeFileSync(path.join(process.argv[2], `${n++}.d2`), `# ${p}\n${m[1]}`)
    })
    walk(process.argv[1])' "$repo_root/skills" "$d2_dir"
  for example in "$d2_dir"/*.d2; do
    [[ -e "$example" ]] || continue
    d2 validate "$example" >/dev/null 2>&1 || err "d2" "invalid D2 example from $(head -1 "$example" | sed "s#^\# $repo_root/##")"
  done
  rm -rf "$d2_dir"
  # The gallery's 32 SVGs must regenerate byte-for-byte with the pinned D2.
  if [[ $(d2 --version 2>/dev/null) == "v0.9.0" || $(d2 --version 2>/dev/null) == "0.9.0" ]]; then
    node "$repo_root/skills/playground/scripts/render-d2-preview.mjs" --check >/dev/null || err "playground" "gallery SVGs drifted from their D2 sources"
  else
    printf 'WARN: D2 0.9.0 (pinned for the gallery) not installed; skipped gallery drift check.\n' >&2
  fi
else
  printf 'WARN: d2 not found; skipped D2 example validation.\n' >&2
fi

if command -v claude >/dev/null 2>&1; then
  claude plugin validate "$repo_root" --strict
else
  printf 'WARN: claude CLI not found; skipped native plugin validation.\n' >&2
fi

if (( errors > 0 )); then
  printf 'Repository validation failed: %d error(s).\n' "$errors" >&2
  exit 1
fi

printf 'Repository validation OK: %d skills checked.\n' "$checked"
