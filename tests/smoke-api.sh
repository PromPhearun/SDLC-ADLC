#!/bin/bash
# Smoke test for V3 ADLC Engine API
set -e
BASE="http://localhost:3000"
PASS=0
FAIL=0

check() {
  local name="$1" url="$2" method="${3:-GET}" data="$4" expect_status="${5:-200}"
  if [ "$method" = "POST" ]; then
    STATUS=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$data")
  else
    STATUS=$(curl -s -o /tmp/resp.json -w "%{http_code}" "$url")
  fi
  BODY=$(cat /tmp/resp.json)
  if [ "$STATUS" = "$expect_status" ]; then
    echo "✅ $name (HTTP $STATUS)"
    PASS=$((PASS + 1))
  else
    echo "❌ $name — expected HTTP $expect_status, got $STATUS"
    echo "   Body: $BODY"
    FAIL=$((FAIL + 1))
  fi
}

echo "╔══════════════════════════════════════════╗"
echo "║   V3 ADLC Engine — API Smoke Test        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

check "Health" "$BASE/api/health"
check "List Specs" "$BASE/api/specs"
check "Audit" "$BASE/api/audit"
check "Digest (demo)" "$BASE/api/notifications/digest?demo=true"
check "Get Spec (404)" "$BASE/api/specs/nonexistent" GET "" 404
check "Spec Generate (validation)" "$BASE/api/specs/generate" POST '{}' 400
check "Build (validation)" "$BASE/api/build/oneshot" POST '{}' 400
check "Bugs Scan (validation)" "$BASE/api/bugs/scan" POST '{}' 400
check "Features Add (validation)" "$BASE/api/features/add" POST '{}' 400

echo ""
echo "════════════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
if [ $FAIL -eq 0 ]; then
  echo "🎉 All smoke tests passed!"
else
  echo "⚠️  Some tests failed."
fi
