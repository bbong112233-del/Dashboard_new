// 전역 이름 충돌 · 구문 오류 검사 (브라우저 없이 소스만 읽는다)
//
// 왜 필요한가 — 대시보드는 한 파일에 <script> 블록이 여러 개이고 전역이 300개 가까이 된다.
// 같은 이름을 두 곳에서 선언하면 브라우저는 조용히 나중 것으로 덮어쓴다. 오류도, 경고도 없다.
// 실제로 한 번 물린 적이 있다 (본문 "JS 함수 재정의로 인한 덮어쓰기 버그 해결" 주석 참고).
// 사람이 눈으로 잡을 수 있는 종류가 아니라서 테스트로 막는다.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const SRC = path.resolve(__dirname, '..', 'Firebase_실시간버전', '매출대시보드_Firebase.html');

// 일부러 덮어쓰는 것들. 이유를 적어 두어야 나중에 "이건 왜 허용이지?" 로 시간 쓰지 않는다.
const ALLOW_REASSIGN = {
  lsSave: '동기화 훅 — 원본 저장을 감싸 변경분 ts 기록 + 원격 업로드를 덧붙인다'
};

const ok = [], bad = [];
function chk(n, c, d) { (c ? ok : bad).push(n + (d ? ' — ' + d : '')); }

const html = fs.readFileSync(SRC, 'utf8');

// src= 가 붙은 외부 스크립트(CDN·Firebase SDK)는 우리 소스가 아니므로 제외한다.
const blocks = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(html))) {
  blocks.push({ body: m[1], line: html.slice(0, m.index).split('\n').length });
}
chk('인라인 script 블록을 찾음', blocks.length > 0, blocks.length + '개');

// ── 1) 구문 검사 ── 커밋 전에 손으로 돌리던 node --check 를 자동화한다.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dupchk-'));
let syntaxBad = [];
blocks.forEach((b, i) => {
  const f = path.join(tmp, 'block' + i + '.js');
  fs.writeFileSync(f, b.body);
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) {
    const msg = String(e.stderr || e.message).split('\n').filter(Boolean)[1] || '';
    syntaxBad.push('블록' + (i + 1) + '(' + b.line + '행~): ' + msg.trim());
  }
});
fs.rmSync(tmp, { recursive: true, force: true });
chk('모든 script 블록이 구문 오류 없음', syntaxBad.length === 0, syntaxBad.join(' | '));

// ── 2) 이름 수집 ──
// 이 파일은 최상위 선언을 들여쓰기 없이 쓴다. 줄 첫 칸 기준이면 함수 안쪽 지역 선언에
// 걸리지 않으면서 최상위만 정확히 집어낼 수 있다.
const fnDecl = {}, reassign = {}, varDecl = {};
function add(map, name, line) { (map[name] = map[name] || []).push(line); }

blocks.forEach(b => {
  b.body.split('\n').forEach((ln, i) => {
    const L = b.line + i;
    let x = ln.match(/^function\s+([A-Za-z_$][\w$]*)/);
    if (x) add(fnDecl, x[1], L);
    x = ln.match(/^(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*function\b/);
    if (x) add(reassign, x[1], L);
    x = ln.match(/^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (x) add(varDecl, x[1], L);
  });
});

const nFn = Object.keys(fnDecl).length, nVar = Object.keys(varDecl).length;
chk('최상위 이름을 수집함', nFn > 100 && nVar > 10, 'function ' + nFn + '개 · 변수 ' + nVar + '개');

function dupes(map) {
  return Object.entries(map).filter(([, v]) => v.length > 1)
               .map(([k, v]) => k + '(' + v.join(',') + '행)');
}

// ── 3) 같은 종류 안에서의 중복 ──
const d1 = dupes(fnDecl);
chk('같은 함수 이름을 두 번 선언하지 않음', d1.length === 0, d1.join(' / '));

const d2 = dupes(varDecl);
chk('같은 최상위 변수를 두 번 선언하지 않음', d2.length === 0, d2.join(' / '));

const d3 = dupes(reassign);
chk('같은 이름에 함수를 두 번 재할당하지 않음', d3.length === 0, d3.join(' / '));

// ── 4) 종류가 엇갈리는 충돌 ──
// function 으로 만든 것을 나중에 = function 으로 갈아끼우면 먼저 것이 통째로 사라진다.
// 의도한 훅만 허용하고, 새로 생기면 즉시 알린다.
const crossed = Object.keys(reassign).filter(k => fnDecl[k] && !ALLOW_REASSIGN[k])
                      .map(k => k + '(선언 ' + fnDecl[k].join(',') + '행 → 재할당 ' + reassign[k].join(',') + '행)');
chk('허용 목록에 없는 함수 재정의가 없음', crossed.length === 0, crossed.join(' / '));

const fnVar = Object.keys(varDecl).filter(k => fnDecl[k])
                    .map(k => k + '(var ' + varDecl[k].join(',') + '행 · function ' + fnDecl[k].join(',') + '행)');
chk('같은 이름을 변수와 함수로 동시에 쓰지 않음', fnVar.length === 0, fnVar.join(' / '));

// ── 5) 허용 목록이 낡지 않았는지 ──
// 훅을 걷어냈는데 허용 목록만 남으면, 다음에 같은 이름을 실수로 재정의해도 통과해 버린다.
const stale = Object.keys(ALLOW_REASSIGN).filter(k => !(reassign[k] && fnDecl[k]));
chk('허용 목록에 죽은 항목이 없음', stale.length === 0, stale.join(', ') + ' 은 더 이상 재정의되지 않음 → 목록에서 빼세요');

console.log('\n=== PASS ==='); ok.forEach(x => console.log('  ✓', x));
console.log('\n=== FAIL ==='); bad.length ? bad.forEach(x => console.log('  ✗', x)) : console.log('  (없음)');
process.exit(bad.length ? 1 : 0);
