#!/usr/bin/env bash
# Fire a hook command with a synthetic stdin payload.
# Usage: dry-run-hook.sh <event> '<command>' [fixture.json]
#
# Examples:
#   dry-run-hook.sh PreToolUse 'jq .'
#   dry-run-hook.sh Stop '.claude/hooks/require-tests.sh' my-fixture.json

set -euo pipefail

event="${1:-}"
cmd="${2:-}"
fixture="${3:-}"

if [ -z "$event" ] || [ -z "$cmd" ]; then
  cat <<'EOF' >&2
Usage: dry-run-hook.sh <event> '<command>' [fixture.json]

Events: PreToolUse, PostToolUse, UserPromptSubmit, PreCompact, SessionStart,
        SessionEnd, Stop, SubagentStop, Notification, TeammateIdle, TaskCompleted

If fixture.json is omitted, a minimal synthetic payload is generated for the event.
EOF
  exit 1
fi

# Minimal synthetic payloads per event
synth() {
  case "$1" in
    PreToolUse|PostToolUse)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "transcript_path": "/tmp/dry-run-transcript.jsonl",
  "cwd": ".",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "src/example.ts",
    "old_string": "foo",
    "new_string": "bar"
  },
  "tool_response": {"success": true}
}
JSON
      ;;
    UserPromptSubmit)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "prompt": "fix the failing test in auth.spec.ts"
}
JSON
      ;;
    Stop|SubagentStop)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "transcript_path": "/tmp/dry-run-transcript.jsonl",
  "stop_hook_active": false
}
JSON
      ;;
    PreCompact)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "transcript_path": "/tmp/dry-run-transcript.jsonl"
}
JSON
      ;;
    SessionStart)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "source": "user"
}
JSON
      ;;
    SessionEnd)
      cat <<'JSON'
{
  "session_id": "dry-run-session"
}
JSON
      ;;
    Notification)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "message": "Build complete"
}
JSON
      ;;
    TeammateIdle)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "teammate_name": "frontend-builder"
}
JSON
      ;;
    TaskCompleted)
      cat <<'JSON'
{
  "session_id": "dry-run-session",
  "task_id": "task-42",
  "agent": "backend-implementer"
}
JSON
      ;;
    *)
      echo "Unknown event: $1" >&2
      exit 1
      ;;
  esac
}

# Build payload
if [ -n "$fixture" ]; then
  if [ ! -f "$fixture" ]; then
    echo "Fixture file not found: $fixture" >&2
    exit 1
  fi
  payload=$(cat "$fixture")
else
  payload=$(synth "$event")
fi

# Validate payload is JSON
if ! echo "$payload" | jq empty 2>/dev/null; then
  echo "Payload is not valid JSON" >&2
  exit 1
fi

echo "=== EVENT: $event ===" >&2
echo "=== STDIN PAYLOAD ===" >&2
echo "$payload" | jq . >&2
echo "" >&2
echo "=== RUNNING COMMAND ===" >&2
echo "$cmd" >&2
echo "" >&2

# Execute
set +e
echo "$payload" | bash -c "$cmd"
exit_code=$?
set -e

echo "" >&2
echo "=== EXIT CODE: $exit_code ===" >&2
case "$exit_code" in
  0) echo "→ Hook would PASS (allow event to continue)" >&2 ;;
  2) echo "→ Hook would BLOCK (exit 2 — Claude sees stderr as feedback)" >&2 ;;
  *) echo "→ Hook ERRORED (logged but does NOT block)" >&2 ;;
esac

exit 0
