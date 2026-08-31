#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
claude_manifest="$repo_root/.claude-plugin/plugin.json"
claude_marketplace="$repo_root/.claude-plugin/marketplace.json"
codex_manifest="$repo_root/.codex-plugin/plugin.json"
agents_instructions="$repo_root/AGENTS.md"

for file in \
  "$claude_manifest" \
  "$claude_marketplace" \
  "$codex_manifest"; do
  jq empty "$file"
done

claude_name=$(jq -er '.name' "$claude_manifest")
claude_version=$(jq -er '.version' "$claude_manifest")
claude_marketplace_name=$(jq -er '.plugins[0].name' "$claude_marketplace")
claude_marketplace_version=$(jq -er '.plugins[0].version' "$claude_marketplace")
codex_name=$(jq -er '.name' "$codex_manifest")
codex_version=$(jq -er '.version' "$codex_manifest")
codex_skills=$(jq -er '.skills' "$codex_manifest")
agents_version=$(sed -n '1s/^# agent-kit v//p' "$agents_instructions")

if [[ "$claude_name" != "$codex_name" || \
      "$claude_name" != "$claude_marketplace_name" ]]; then
  printf 'Plugin names differ between manifests and marketplaces.\n' >&2
  exit 1
fi

if [[ "$claude_version" != "$codex_version" || \
      "$claude_version" != "$claude_marketplace_version" || \
      "$claude_version" != "$agents_version" ]]; then
  printf 'Plugin versions differ between manifests, marketplace metadata, and AGENTS.md.\n' >&2
  exit 1
fi

if [[ "$codex_skills" != "./skills/" ]]; then
  printf 'Codex manifest must expose the canonical ./skills/ directory.\n' >&2
  exit 1
fi

printf 'Plugin manifests OK: %s v%s\n' "$claude_name" "$claude_version"
