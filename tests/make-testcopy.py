#!/usr/bin/env python3
"""검증용 대시보드 사본 생성기.

실제 HTML 에서 팀 Firebase 로 나가는 통로를 끊고, CDN 을 로컬 사본으로 바꾼다.
테스트가 절대 팀 데이터에 닿지 않게 하는 안전장치다.

사용:  python3 tests/make-testcopy.py
출력:  tests/.fixture/test_dash.html   (.gitignore 대상)
"""
import re, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC  = os.path.join(ROOT, "Firebase_실시간버전", "매출대시보드_Firebase.html")
OUT  = os.path.join(HERE, ".fixture", "test_dash.html")

if not os.path.exists(SRC):
    sys.exit(f"대시보드 HTML 을 찾을 수 없습니다: {SRC}")

s = open(SRC, encoding="utf-8").read()

# 1) Firebase SDK 로드를 제거 → 인증·동기화가 아예 뜨지 않는다
s, n_sdk = re.subn(r'\s*<script src="https://www\.gstatic\.com/firebasejs/[^"]+"></script>', "", s)

# 2) databaseURL 무력화 → syncEnabled() 가 false 가 되어 로컬에만 저장
s, n_db = re.subn(r'databaseURL: "https://[^"]+"', 'databaseURL: "DISABLED_FOR_TEST"', s)

# 3) CDN → 로컬 node_modules (오프라인에서도 돌게)
cdn = {
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js":
        "../../node_modules/xlsx/dist/xlsx.full.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js":
        "../../node_modules/chart.js/dist/chart.umd.js",
}
n_cdn = 0
for a, b in cdn.items():
    s, k = re.subn(re.escape(a), b, s)
    n_cdn += k

if n_db == 0:
    sys.exit("databaseURL 을 찾지 못했습니다. 원본 구조가 바뀐 것 같으니 확인이 필요합니다.")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(s)
print(f"생성 완료: {OUT}")
print(f"  Firebase SDK 제거 {n_sdk}건 · databaseURL 무력화 {n_db}건 · CDN 치환 {n_cdn}건")
