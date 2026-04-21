#!/usr/bin/env bash
# Static safety analyzer for Claude Code hook commands.
# Usage: validate-hook.sh '<command-string>'
# Output: WARNING / DANGER lines to stderr; exit 0 always (advisory).

set -euo pipefail

if [ "$#" -lt 1 ]; then
  cat <<'EOF' >&2
Usage: validate-hook.sh '<command>'

Static analysis of a hook command. Emits WARNING and DANGER findings.
Always exits 0 — this is advisory, not a gate. Review findings manually.
EOF
  exit 1
fi

cmd="$1"
warnings=0
dangers=0

warn() { echo "WARNING: $1" >&2; warnings=$((warnings+1)); }
danger() { echo "DANGER:  $1" >&2; dangers=$((dangers+1)); }

# DANGER: eval / bash -c "$VAR" / curl | sh
if echo "$cmd" | grep -qE '\beval\b'; then
  danger "uses 'eval' — never safe with payload data"
fi
if echo "$cmd" | grep -qE 'bash -c[[:space:]]+"\$|sh -c[[:space:]]+"\$'; then
  danger "passes \$VAR to 'bash -c' / 'sh -c' — command injection vector"
fi
if echo "$cmd" | grep -qE 'curl[^|]*\|[[:space:]]*sh|wget[^|]*\|[[:space:]]*sh'; then
  danger "pipes network output into shell ('curl|sh') — supply chain risk"
fi

# DANGER: raw $CLAUDE_TOOL_INPUT interpolation
if echo "$cmd" | grep -qE '\$CLAUDE_TOOL_INPUT[^|]'; then
  danger "interpolates \$CLAUDE_TOOL_INPUT directly — parse via jq instead"
fi

# WARNING: backticks (legacy command substitution, often unsafe)
if echo "$cmd" | grep -qE '`[^`]+`'; then
  warn "uses backtick command substitution — prefer \$(...) and quote properly"
fi

# WARNING: missing timeout for command-like patterns
if ! echo "$cmd" | grep -qE '^[[:space:]]*timeout[[:space:]]'; then
  if echo "$cmd" | grep -qE '\b(npm|npx|node|python|go|cargo|bash|sh|make|pytest|jest)\b'; then
    warn "no 'timeout N' wrapper — long-running command can hang the harness"
  fi
fi

# WARNING: network calls in hook
if echo "$cmd" | grep -qE '\b(curl|wget|nc|ncat|fetch)\b'; then
  warn "performs network call — adds latency and exfiltration risk"
fi

# WARNING: hardcoded home/absolute paths
if echo "$cmd" | grep -qE '/Users/|/home/|/root/'; then
  warn "hardcoded user-home path — use \${CLAUDE_PROJECT_DIR} or relative paths"
fi

# WARNING: --no-verify or --force in commit/push commands
if echo "$cmd" | grep -qE '(--no-verify|--force\b|-f\b.*push|push.*-f)'; then
  warn "uses --no-verify or --force — bypasses safety checks; reconsider"
fi

# WARNING: unquoted variable expansion (heuristic — flags simple cases)
if echo "$cmd" | grep -qE '\$[A-Z_][A-Z0-9_]*[^"a-zA-Z0-9_/]'; then
  warn "appears to use unquoted variable expansion — wrap in double quotes"
fi

# Summary
echo "" >&2
echo "Summary: $dangers DANGER, $warnings WARNING" >&2
if [ "$dangers" -gt 0 ]; then
  echo "→ Fix DANGER items before deploying this hook." >&2
elif [ "$warnings" -gt 0 ]; then
  echo "→ Review WARNING items with the user." >&2
else
  echo "→ No issues found by static checks (still review manually)." >&2
fi

exit 0
