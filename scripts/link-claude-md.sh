#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  set -- .
fi

created=0
present=0
conflicts=0

for root in "$@"; do
  if [[ ! -d "$root" ]]; then
    printf 'SKIP  %s (not a directory)\n' "$root" >&2
    conflicts=$((conflicts + 1))
    continue
  fi

  while IFS= read -r -d '' agents_file; do
    directory=${agents_file%/AGENTS.md}
    claude_file="$directory/CLAUDE.md"

    if [[ -L "$claude_file" ]]; then
      if [[ "$(readlink "$claude_file")" == "AGENTS.md" ]]; then
        printf 'OK    %s\n' "$claude_file"
        present=$((present + 1))
      else
        printf 'SKIP  %s (symlink points to %s)\n' \
          "$claude_file" "$(readlink "$claude_file")" >&2
        conflicts=$((conflicts + 1))
      fi
    elif [[ -e "$claude_file" ]]; then
      printf 'SKIP  %s (existing non-symlink)\n' "$claude_file" >&2
      conflicts=$((conflicts + 1))
    else
      ln -s AGENTS.md "$claude_file"
      printf 'LINK  %s -> AGENTS.md\n' "$claude_file"
      created=$((created + 1))
    fi
  done < <(
    find "$root" \
      \( -type d \( -name .git -o -name node_modules -o -name vendor -o -name target \) -prune \) \
      -o -type f -name AGENTS.md -print0
  )
done

printf 'Created: %d, already correct: %d, conflicts: %d\n' \
  "$created" "$present" "$conflicts"

if [[ "$conflicts" -gt 0 ]]; then
  exit 1
fi
