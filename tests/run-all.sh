#!/usr/bin/env bash
# 회귀 검증 일괄 실행.  사용:  ./tests/run-all.sh  [스위트이름...]
set -u
cd "$(dirname "$0")/.."
FX=tests/.fixture
PORT="${TEST_PORT:-8899}"

command -v node >/dev/null || { echo "node 가 필요합니다"; exit 1; }
[ -d node_modules/playwright ] || { echo "먼저 'npm install' 을 실행하세요"; exit 1; }

echo "▸ 가상 데이터 · 테스트 사본 생성"
python3 tests/make-fixture.py  "$FX/sample.xlsx" >/dev/null || exit 1
python3 tests/make-testcopy.py                   >/dev/null || exit 1

echo "▸ 로컬 서버 :$PORT"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
sleep 2

SUITES=("$@")
[ ${#SUITES[@]} -eq 0 ] && SUITES=(tests/verify-*.js)

PASS=0; FAIL=0; BAD=()
for f in "${SUITES[@]}"; do
  out=$(node "$f" 2>&1)
  p=$(printf '%s' "$out" | grep -c '✓' || true)
  x=$(printf '%s' "$out" | grep -c '✗' || true)
  PASS=$((PASS+p)); FAIL=$((FAIL+x))
  printf '  %-34s 통과 %3d  실패 %2d\n' "$(basename "$f")" "$p" "$x"
  if [ "$x" != "0" ] || [ "$p" = "0" ]; then
    BAD+=("$f"); printf '%s\n' "$out" | grep -E '✗|Error|error:' | sed 's/^/      /' | head -8
  fi
done

echo "────────────────────────────────────────────"
printf '  합계  통과 %d  실패 %d\n' "$PASS" "$FAIL"
[ ${#BAD[@]} -eq 0 ] && { echo "  ✅ 전부 통과"; exit 0; }
echo "  ❌ 실패한 스위트: ${BAD[*]}"; exit 1
