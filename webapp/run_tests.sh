#!/bin/bash
set -e

# ── Config ─────────────────────────────────────────────────────────────────────
# All credentials come from the environment (or webapp/.env.local). Never hard-code them.
cd "$(dirname "$0")"
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi

: "${DATABASE_URL:?Set DATABASE_URL (see webapp/.env.example)}"
: "${ENCRYPTION_KEY:?Set ENCRYPTION_KEY (see webapp/.env.example)}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
# Integration suites that send via SES also need: SES_EVENT_QUEUE_URL, AWS_KEY, AWS_SECRET

# ── Checks ──────────────────────────────────────────────────────────────────────
echo "Checking prerequisites..."

redis-cli ping > /dev/null 2>&1 || { echo "❌ Redis not running — start with: redis-server"; exit 1; }

if ! curl -s http://localhost:3000/api/auth/session > /dev/null 2>&1; then
  echo "Dev server not running — starting..."
  npm run dev > /tmp/outreachai-dev.log 2>&1 &
  until curl -s http://localhost:3000/api/auth/session > /dev/null 2>&1; do sleep 2; done
  # Warm up routes
  curl -s http://localhost:3000/login > /dev/null
  curl -s http://localhost:3000/api/auth/csrf > /dev/null
  curl -s http://localhost:3000/marketing > /dev/null
  sleep 3
  echo "✅ Server ready"
else
  echo "✅ Server already running"
fi

# ── Suite selector ─────────────────────────────────────────────────────────────
SUITE="${1:-all}"

run_ui() {
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  Suite 1: UI Phases 1–3"
  echo "════════════════════════════════════════════════"
  node scripts/test-ui-phases-1-3.mjs
}

run_metrics() {
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  Suite 2: Real Email Metrics"
  echo "════════════════════════════════════════════════"
  node scripts/test-real-email-metrics.mjs
}

run_integration() {
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  Suite 3: Phase 2 Integration (SES send)"
  echo "════════════════════════════════════════════════"
  npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register \
    scripts/test-phase2-integration.ts
}

run_phase3() {
  echo ""
  echo "════════════════════════════════════════════════"
  echo "  Suite 4: Phase 3 Full (36 tests)"
  echo "════════════════════════════════════════════════"
  npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register \
    scripts/test-phase3-full.ts
}

case "$SUITE" in
  ui)          run_ui ;;
  metrics)     run_metrics ;;
  integration) run_integration ;;
  phase3)      run_phase3 ;;
  all)
    run_integration
    run_phase3
    run_ui
    run_metrics
    echo ""
    echo "✅ All suites complete"
    ;;
  *)
    echo "Usage: ./run_tests.sh [ui|metrics|integration|phase3|all]"
    echo "  ui          — Browser UI test (Phases 1–3, 37 checks)"
    echo "  metrics     — Real SES send + metrics capture"
    echo "  integration — Phase 2 SES integration (8 checks)"
    echo "  phase3      — Phase 3 full event tracking (36 checks)"
    echo "  all         — Run everything (default)"
    exit 1
    ;;
esac
