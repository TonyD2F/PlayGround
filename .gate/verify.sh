#!/usr/bin/env bash
# .gate/verify.sh template — copy into a project as .gate/verify.sh and extend
# with the project's own checks (tests, build, lint). Prints a SUMMARY line
# for the @gatekeeper packet. Exit 0 only when every check passes.
set -u
WEB=""
if [[ "${1:-}" == "--web" ]]; then WEB="${2:-}"; fi
FAIL=0
SKIPPED=()
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }
skip() { echo "SKIP: $1"; SKIPPED+=("$1"); }

CFG="$HOME/.config/opencode/oh-my-opencode-slim.json"
if [[ -f "$CFG" ]]; then
  FORBIDDEN='minimax-m3 minimax-m2.7 qwen3.7-max qwen3.8-max qwen3.7-plus deepseek-v4-flash deepseek-v4-pro deepseek-v4.1-flash kimi-k2.7-code kimi-k3 kimi-k2.6 glm-5 glm-5.2 glm-5.3 glm-5.3-flash mimo-v2.5 mimo-v2.6-flash grok-4.7 gpt-6-luna gpt-5.6-luna'
  HIT=""
  for id in $FORBIDDEN; do
    if grep -q "opencode-go/$id\"" "$CFG" 2>/dev/null; then HIT="$HIT $id"; fi
  done
  # DeepSeek / Kimi / GLM families are retired for this install in any form.
  for fam in deepseek kimi glm-; do
    if grep -qi "opencode-go/$fam" "$CFG" 2>/dev/null; then HIT="$HIT family:$fam"; fi
  done
  if [[ -z "$HIT" ]]; then pass "slim config names no paid or retired Go model"; else fail "slim config still names:$HIT"; fi
else
  skip "slim config absent at $CFG"
fi

if command -v npx >/dev/null 2>&1; then
  if npx -y oh-my-opencode-slim@latest doctor 2>&1 | tail -n 5; then
    pass "doctor ran"
  else
    fail "doctor errored"
  fi
else
  skip "npx unavailable for doctor"
fi

if [[ -n "$WEB" ]]; then
  if [[ -f "$WEB" || "$WEB" =~ ^https?:// ]]; then
    pass "web target present: $WEB (screenshot review happens in G7)"
    echo "G7 UNVERIFIED - screenshots at 390x844 and 1440x900 still require @observer review"
  else
    fail "web target missing: $WEB"
  fi
else
  skip "no --web target (non-UI work)"
fi

if [[ $FAIL -eq 0 ]]; then
  echo "SUMMARY: ALL CHECKS PASSED; skipped: ${SKIPPED[*]:-none}"
else
  echo "SUMMARY: CHECKS FAILED; skipped: ${SKIPPED[*]:-none}"
fi
exit $FAIL
