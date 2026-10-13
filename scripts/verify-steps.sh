#!/usr/bin/env bash
# Verifies main and every workshop step branch from a fresh clone, the way an attendee would:
#
#   1. fresh clone + checkout
#   2. the four setup commands: npm install, npx prisma generate, npx prisma db seed, npm run dev
#   3. the dev server serves the dashboard, the invoices page and the API
#   4. lint, typecheck and the Cursor file validator
#   5. unit + integration tests (Vitest) and end-to-end tests (Playwright)
#   6. the results match the step: [filter-bug] tests fail on main/step-1/step-2 and pass from
#      step-3; [resolve-dispute] tests exist and pass only from step-5
#
# Usage: scripts/verify-steps.sh [branch ...]
#   REPO=<url or path>   repository to clone (default: the GitHub repo)
#   WORK_DIR=<dir>       where to clone (default: a temp dir)
#   KEEP=1               keep the clones afterwards
set -uo pipefail

REPO="${REPO:-https://github.com/agrimsingh/cursor-201-workshop.git}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="${WORK_DIR:-$(mktemp -d -t tally-verify-XXXXXX)}"
DEV_PORT="${DEV_PORT:-3210}"
ALL_BRANCHES=(main step-1-context step-2-rules-skills step-3-mcp-plugin step-4-models step-5-multitask step-6-cloud-bugbot)
if [ "$#" -gt 0 ]; then BRANCHES=("$@"); else BRANCHES=("${ALL_BRANCHES[@]}"); fi

step_of() {
  case "$1" in
    main) echo 0 ;;
    step-[1-6]-*) echo "${1:5:1}" ;;
    *) echo "unknown" ;;
  esac
}

declare -a SUMMARY=()
overall=0

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

run() {
  local label="$1"; shift
  local logfile="$LOG_DIR/${label// /-}.log"
  if "$@" >"$logfile" 2>&1; then
    echo "  ✓ $label"
    return 0
  fi
  echo "  ✗ $label (see $logfile)"
  tail -n 25 "$logfile" | sed 's/^/      /'
  return 1
}

check_dev_server() {
  local pidfile="$LOG_DIR/dev.pid"
  (setsid npm run dev -- --port "$DEV_PORT" >"$LOG_DIR/dev-server.log" 2>&1 & echo $! >"$pidfile")
  local ok=1
  for _ in $(seq 1 90); do
    if curl -fsS "http://localhost:$DEV_PORT/" -o /dev/null 2>/dev/null; then ok=0; break; fi
    sleep 1
  done
  if [ "$ok" -eq 0 ]; then
    curl -fsS "http://localhost:$DEV_PORT/invoices" -o /dev/null &&
      curl -fsS "http://localhost:$DEV_PORT/collections" -o /dev/null &&
      curl -fsS "http://localhost:$DEV_PORT/api/invoices?pageSize=1" | grep -q '"total"' || ok=1
  fi
  local pid; pid="$(cat "$pidfile")"
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null
  sleep 2
  return "$ok"
}

for branch in "${BRANCHES[@]}"; do
  step="$(step_of "$branch")"
  dir="$WORK_DIR/$branch"
  LOG_DIR="$dir/.verify-steps"
  log "$branch (step $step)"
  rm -rf "$dir"
  if ! git clone --quiet --branch "$branch" --single-branch "$REPO" "$dir"; then
    SUMMARY+=("$branch|clone failed")
    overall=1
    continue
  fi
  mkdir -p "$LOG_DIR"
  cd "$dir" || exit 1
  echo "  commit $(git rev-parse --short HEAD): $(git log -1 --format=%s)"

  status="ok"
  run "npm install" npm install --no-audit --no-fund || status="setup failed"
  [ "$status" = ok ] && { run "npx prisma generate" npx prisma generate || status="setup failed"; }
  [ "$status" = ok ] && { run "npx prisma db seed" npx prisma db seed || status="setup failed"; }
  [ "$status" = ok ] && { run "npx playwright install chromium" npx playwright install chromium || status="setup failed"; }
  if [ "$status" != ok ]; then
    SUMMARY+=("$branch|$status")
    overall=1
    continue
  fi

  dev="✓"; check_dev_server && echo "  ✓ npm run dev serves /, /invoices, /collections and /api/invoices" || { echo "  ✗ dev server check (see $LOG_DIR/dev-server.log)"; dev="✗"; }
  lint="✓"; run "npm run lint" npm run lint || lint="✗"
  types="✓"; run "npm run typecheck" npm run typecheck || types="✗"
  cursor="✓"; run "validate Cursor files" node scripts/validate-cursor-files.mjs --step "$step" || cursor="✗"
  tail -n 1 "$LOG_DIR/validate-Cursor-files.log" | sed 's/^/      /'

  npx vitest run --reporter=default --reporter=json --outputFile="$LOG_DIR/vitest.json" >"$LOG_DIR/vitest.log" 2>&1
  vitest_exit=$?
  echo "  • vitest (unit + integration) exited $vitest_exit: $(grep -aE '^\s+Tests' "$LOG_DIR/vitest.log" | tail -1 | xargs)"
  PLAYWRIGHT_JSON_OUTPUT_NAME="$LOG_DIR/playwright.json" npx playwright test --reporter=list,json >"$LOG_DIR/playwright.log" 2>&1
  e2e_exit=$?
  echo "  • playwright (e2e) exited $e2e_exit: $(grep -aE '^\s+[0-9]+ (passed|failed)' "$LOG_DIR/playwright.log" | xargs)"

  expect="✓"
  node "$SCRIPT_DIR/check-test-results.mjs" --step "$step" --vitest "$LOG_DIR/vitest.json" --playwright "$LOG_DIR/playwright.json" | sed 's/^/  /'
  [ "${PIPESTATUS[0]}" -eq 0 ] || expect="✗"

  for result in "$dev" "$lint" "$types" "$cursor" "$expect"; do [ "$result" = "✓" ] || overall=1; done
  SUMMARY+=("$branch|setup ✓|dev $dev|lint $lint|typecheck $types|cursor files $cursor|tests as expected $expect")
  cd "$WORK_DIR" || exit 1
done

log "Summary"
for row in "${SUMMARY[@]}"; do
  printf '  %s\n' "${row//|/  }"
done
[ "${KEEP:-0}" = 1 ] && echo "  clones kept in $WORK_DIR" || rm -rf "$WORK_DIR"
[ "$overall" -eq 0 ] && echo "  ALL BRANCHES VERIFIED" || echo "  SOME CHECKS FAILED"
exit "$overall"
