#!/usr/bin/env python3
"""검증용 가상 데이터(xlsx) 생성기.

실제 매출 파일과 '구조'만 같고 내용은 전부 지어낸 값이다.
회원사명·코스명·상품명은 누가 봐도 가상인 형태로 만들고, 금액은 난수다.
실제 자료는 저장소에 올리지 않는다 — 이 스크립트로 매번 새로 만들어 쓴다.

사용:  python3 tests/make-fixture.py [출력경로]
기본:  tests/.fixture/sample.xlsx   (.gitignore 대상)
"""
import random, sys, os
try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl 이 필요합니다:  pip install openpyxl")

SEED = int(os.environ.get("FIXTURE_SEED", "20260915"))
random.seed(SEED)

OUT = sys.argv[1] if len(sys.argv) > 1 else \
    os.path.join(os.path.dirname(os.path.abspath(__file__)), ".fixture", "sample.xlsx")

# ── 축 정의 ─────────────────────────────────────────────
# 코스는 A/B 파트 판별을 위해 접미사 (A)/(B) 를 쓴다
COURSES = [f"코스{n}({p})" for n, p in
           [("가", "A"), ("나", "A"), ("다", "A"), ("라", "A"),
            ("마", "B"), ("바", "B"), ("사", "B"), ("아", "B")]]
INDS  = ["공구", "공사", "유통"]          # 대시보드가 이 세 값을 기대한다
BRANDS = [f"브랜드{c}" for c in "ABCDEF"]

# 제품군 → (열 기준 위치, 카테고리, 상품)
GROUPS = [
    ("전선",   14, [("전선카테고리1", ["전선상품1", "전선상품2", "전선상품3"]),
                    ("전선카테고리2", ["전선상품4", "전선상품5"])]),
    ("조명",   19, [("조명카테고리1", ["조명상품1", "조명상품2", "조명상품3"]),
                    ("조명카테고리2", ["조명상품4", "조명상품5", "조명상품6"])]),
    ("부자재", 24, [("부자재카테고리1", ["부자재상품1", "부자재상품2"]),
                    ("부자재카테고리2", ["부자재상품3", "부자재상품4"])]),
    ("MRO",    29, [("MRO카테고리1", ["MRO상품1", "MRO상품2"]),
                    ("MRO카테고리2", ["MRO상품3", "MRO상품4"])]),
]
NCOL = 34

def header_rows():
    h1 = [None] * NCOL
    h1[9] = "총합계"
    for name, base, _ in GROUPS:
        h1[base] = name
    h2 = ["코스", "업종군", "거래처명", "카테고리", "규격", "상품명", "브랜드", "중분류", "대분류"]
    for _ in range(5):
        h2 += ["매출액", "비교매출액", "증감", "매출수량", "비교매출수량"]
    return h1, h2

def firm_plan(n_firms):
    """회원사마다 매출 구간을 섞는다.
    저매출(300~499만) · 고매출(500만 이상) · 휴면(올해 0원) 시트가 모두 채워지도록."""
    plan = []
    for i in range(n_firms):
        band = ("dormant" if i % 10 == 0 else
                "low"     if i % 10 in (1, 2, 3) else
                "high"    if i % 10 in (4, 5) else "mid")
        # 취급 제품군을 일부만 주어 '품목 확대 기회'가 생기게 한다
        k = 4 if i % 7 == 0 else random.choice([1, 2, 2, 3])
        plan.append((band, random.sample(range(len(GROUPS)), k)))
    return plan

def amount(band):
    if band == "dormant": return 0
    if band == "low":     return random.randint(3_000_000, 4_900_000)
    if band == "high":    return random.randint(5_000_000, 40_000_000)
    return random.randint(200_000, 2_900_000)

def build(n_firms=150):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "pivot"
    h1, h2 = header_rows()
    ws.append(h1); ws.append(h2)
    plan = firm_plan(n_firms)
    n_rows = 0
    for i, (band, gidx) in enumerate(plan, start=1):
        firm = f"거래처-{i:03d}"
        cos  = COURSES[i % len(COURSES)]
        ind  = INDS[i % len(INDS)]
        total = amount(band)
        # 올해 0원이어도 전년 매출은 있어야 '휴면'으로 잡힌다
        total_prev = random.randint(3_000_000, 20_000_000) if band == "dormant" \
                     else int(total * random.uniform(0.5, 1.6))
        per = max(1, len(gidx))
        for gi in gidx:
            gname, base, cats = GROUPS[gi]
            cat, prods = random.choice(cats)
            for prod in random.sample(prods, min(len(prods), random.choice([1, 2]))):
                cur  = total // per // 2
                prev = total_prev // per // 2
                row = [None] * NCOL
                row[0:9] = [cos, ind, firm, cat, f"규격{random.randint(1,4)}", prod,
                            random.choice(BRANDS), f"{gname}중분류", f"{gname}대분류"]
                def put(b, c, p):
                    row[b]   = c
                    row[b+1] = p
                    row[b+2] = c - p
                    row[b+3] = max(0, c // 10000)
                    row[b+4] = max(0, p // 10000)
                put(9, cur, prev)      # 총합계
                put(base, cur, prev)   # 해당 제품군에만 값을 넣는다
                ws.append(row); n_rows += 1
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    wb.save(OUT)
    return n_rows, n_firms

if __name__ == "__main__":
    rows, firms = build()
    print(f"생성 완료: {OUT}")
    print(f"  회원사 {firms}개 · 데이터 {rows}행 · seed {SEED}")
    print("  이름·금액은 전부 지어낸 값이다 (실제 자료 아님)")
