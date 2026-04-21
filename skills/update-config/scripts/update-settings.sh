#!/bin/bash
# update-settings.sh — single writer of Claude Code harness settings
# Merges via jq, validates JSON, creates .bak before overwriting.
#
# Usage:
#   update-settings.sh <scope> <action> [args...]
#   update-settings.sh show
#   update-settings.sh --help
#
# Scopes:
#   user    → ~/.claude/settings.json        (commands dir: ~/.claude/commands)
#   project → .claude/settings.json          (commands dir: .claude/commands)
#   local   → .claude/settings.local.json    (commands dir: .claude/commands — shared with project)
#
# Actions:
#   allow <pattern>                     — append to permissions.allow
#   deny  <pattern>                     — append to permissions.deny
#   remove-allow <pattern>              — remove from permissions.allow (no-op if absent)
#   remove-deny  <pattern>              — remove from permissions.deny  (no-op if absent)
#   env <key> <value>                   — set env.<key>
#   unset-env <key>                     — delete env.<key>
#   hook <event> <command> [matcher]    — append a {matcher?, hooks:[{type,command}]} block
#                                         matcher is honoured by PreToolUse / PostToolUse /
#                                         PermissionRequest; ignored elsewhere by the harness
#   remove-hook <event> <command>       — remove matching hook command (prunes empty blocks)
#   slash <name> <body>                 — write .claude/commands/<name>.md (file-based command)
#   remove-slash <name>                 — delete .claude/commands/<name>.md (no-op if absent)

set -euo pipefail

usage() {
  sed -n '2,29p' "$0" | sed 's|^# \{0,1\}||'
  exit "${1:-0}"
}

[ "${1:-}" = "--help" ] && usage 0
[ "${1:-}" = "-h" ]     && usage 0

command -v jq >/dev/null || { echo "ERROR: jq is required" >&2; exit 1; }

scope_path() {
  case "$1" in
    user)    echo "$HOME/.claude/settings.json" ;;
    project) echo ".claude/settings.json" ;;
    local)   echo ".claude/settings.local.json" ;;
    *) echo "ERROR: unknown scope '$1' (user|project|local)" >&2; return 1 ;;
  esac
}

commands_dir() {
  case "$1" in
    user)          echo "$HOME/.claude/commands" ;;
    project|local) echo ".claude/commands" ;;
    *) echo "ERROR: unknown scope '$1' (user|project|local)" >&2; return 1 ;;
  esac
}

ensure_file() {
  local f="$1"
  local dir
  dir=$(dirname "$f")
  mkdir -p "$dir"
  [ -s "$f" ] || echo '{}' > "$f"
  if ! jq empty "$f" 2>/dev/null; then
    echo "ERROR: existing $f is not valid JSON" >&2
    return 1
  fi
}

# Ensure .claude/settings.local.json is gitignored whenever it's touched inside a git repo
ensure_gitignore() {
  local f="$1"
  case "$f" in
    .claude/settings.local.json)
      if [ -d .git ] || [ -f .gitignore ]; then
        [ -f .gitignore ] || touch .gitignore
        grep -qxF ".claude/settings.local.json" .gitignore 2>/dev/null || \
          echo ".claude/settings.local.json" >> .gitignore
      fi
      ;;
  esac
}

merge_write() {
  local f="$1" expr="$2"
  shift 2
  # Remaining args are jq --arg / --argjson pairs forwarded verbatim.
  ensure_file "$f"
  cp "$f" "$f.bak"
  local tmp
  tmp=$(mktemp)
  if jq "$@" "$expr" "$f" > "$tmp" && jq empty "$tmp" 2>/dev/null; then
    mv "$tmp" "$f"
    ensure_gitignore "$f"
    echo "OK    wrote $f (backup: $f.bak)"
  else
    rm -f "$tmp"
    mv "$f.bak" "$f"
    echo "ERROR: jq expression failed; restored from .bak" >&2
    return 1
  fi
}

show_all() {
  for s in user project local; do
    local f; f=$(scope_path "$s")
    echo "=== $s settings ($f) ==="
    if [ -f "$f" ]; then
      jq . "$f"
    else
      echo "(not present)"
    fi
    echo ""
  done
  for s in user project; do
    local d; d=$(commands_dir "$s")
    echo "=== $s slash commands ($d) ==="
    if [ -d "$d" ]; then
      # List markdown files without duplicate entries
      find "$d" -maxdepth 1 -type f -name "*.md" 2>/dev/null | sort | sed 's|.*/|  /|; s|\.md$||'
    else
      echo "(not present)"
    fi
    echo ""
  done
}

if [ "${1:-}" = "show" ]; then
  show_all
  exit 0
fi

SCOPE="${1:-}"; ACTION="${2:-}"
[ -z "$SCOPE" ] && usage 1
[ -z "$ACTION" ] && usage 1
shift 2

case "$ACTION" in
  allow)
    FILE=$(scope_path "$SCOPE")
    PATTERN="${1:?pattern required}"
    merge_write "$FILE" \
      '.permissions //= {} | .permissions.allow //= [] | if (.permissions.allow | index($p)) then . else .permissions.allow += [$p] end' \
      --arg p "$PATTERN"
    ;;
  deny)
    FILE=$(scope_path "$SCOPE")
    PATTERN="${1:?pattern required}"
    merge_write "$FILE" \
      '.permissions //= {} | .permissions.deny //= [] | if (.permissions.deny | index($p)) then . else .permissions.deny += [$p] end' \
      --arg p "$PATTERN"
    ;;
  remove-allow)
    FILE=$(scope_path "$SCOPE")
    PATTERN="${1:?pattern required}"
    merge_write "$FILE" \
      'if (.permissions?.allow // null) == null then . else .permissions.allow |= map(select(. != $p)) end' \
      --arg p "$PATTERN"
    ;;
  remove-deny)
    FILE=$(scope_path "$SCOPE")
    PATTERN="${1:?pattern required}"
    merge_write "$FILE" \
      'if (.permissions?.deny // null) == null then . else .permissions.deny |= map(select(. != $p)) end' \
      --arg p "$PATTERN"
    ;;
  env)
    FILE=$(scope_path "$SCOPE")
    KEY="${1:?key required}"; VAL="${2:?value required}"
    merge_write "$FILE" \
      '.env //= {} | .env[$k] = $v' \
      --arg k "$KEY" --arg v "$VAL"
    ;;
  unset-env)
    FILE=$(scope_path "$SCOPE")
    KEY="${1:?key required}"
    merge_write "$FILE" \
      'if (.env // null) == null then . else del(.env[$k]) end' \
      --arg k "$KEY"
    ;;
  hook)
    FILE=$(scope_path "$SCOPE")
    EVENT="${1:?event required}"; CMD="${2:?command required}"
    MATCHER="${3:-}"
    # Schema: .hooks.<event> is an array of {matcher?, hooks:[{type,command}]} blocks.
    # The harness honours `matcher` only on PreToolUse / PostToolUse / PermissionRequest —
    # on other events it is ignored, so we still accept it as an optional arg for uniformity.
    # Dedupe by exact command across all blocks of this event. For matcher merging: when a block
    # with the same matcher exists, we extend its hooks array instead of creating a new block.
    merge_write "$FILE" \
      '.hooks //= {}
       | .hooks[$e] //= []
       | if ([.hooks[$e][]?.hooks[]?.command] | index($c)) != null then .
         else
           if ($m | length) > 0 then
             if (.hooks[$e] | map(.matcher? // "") | index($m)) != null then
               .hooks[$e] |= map(
                 if (.matcher? // "") == $m
                 then .hooks = ((.hooks // []) + [{type: "command", command: $c}])
                 else . end
               )
             else
               .hooks[$e] += [{matcher: $m, hooks: [{type: "command", command: $c}]}]
             end
           else
             .hooks[$e] += [{hooks: [{type: "command", command: $c}]}]
           end
         end' \
      --arg e "$EVENT" --arg c "$CMD" --arg m "$MATCHER"
    ;;
  remove-hook)
    FILE=$(scope_path "$SCOPE")
    EVENT="${1:?event required}"; CMD="${2:?command required}"
    # Strip the matching command from every block's inner hooks.
    # Drop blocks whose inner hooks array becomes empty after the purge, then prune the event key
    # if nothing remains — keeps settings.json tidy and idempotent.
    merge_write "$FILE" \
      'if (.hooks // null) == null or (.hooks[$e] // null) == null then .
       else
         .hooks[$e] |=
           (map(.hooks = ((.hooks // []) | map(select(.command != $c))))
            | map(select((.hooks // []) | length > 0)))
         | if (.hooks[$e] | length) == 0 then del(.hooks[$e]) else . end
       end' \
      --arg e "$EVENT" --arg c "$CMD"
    ;;
  slash)
    # Slash commands live as files in .claude/commands/<name>.md (project) or
    # ~/.claude/commands/<name>.md (user). settings.json does NOT hold them.
    NAME_RAW="${1:?name required}"; BODY="${2:?body required}"
    NAME="${NAME_RAW#/}"               # strip leading slash if user passed /foo
    DIR=$(commands_dir "$SCOPE")
    TARGET="$DIR/${NAME}.md"
    mkdir -p "$DIR"
    [ -f "$TARGET" ] && cp "$TARGET" "$TARGET.bak"
    printf '%s\n' "$BODY" > "$TARGET"
    echo "OK    wrote $TARGET (file-based slash command: /$NAME)"
    ;;
  remove-slash)
    NAME_RAW="${1:?name required}"
    NAME="${NAME_RAW#/}"
    DIR=$(commands_dir "$SCOPE")
    TARGET="$DIR/${NAME}.md"
    if [ -f "$TARGET" ]; then
      cp "$TARGET" "$TARGET.bak"
      rm "$TARGET"
      echo "OK    removed $TARGET (backup: $TARGET.bak)"
    else
      echo "NOOP  $TARGET does not exist"
    fi
    ;;
  *)
    echo "ERROR: unknown action '$ACTION'" >&2
    usage 1
    ;;
esac
