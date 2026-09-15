// 조용한 실패가 화면에 보이는지 — 일부러 고장을 내고 사용자가 알아차릴 수 있는지 확인한다.
//   ① localStorage 저장 실패  ② 스크립트 오류  ③ 로그인 SDK 미로딩
const { launch, URL, FIXTURE } = require('./_harness');
const ok = [], bad = [];
function chk(n, c, d) { (c ? ok : bad).push(n + (d ? ' — ' + d : '')); }

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1560, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(() => { const g = document.getElementById('auth-gate'); if (g) g.remove(); });
  await p.setInputFiles('#file-input', FIXTURE); await p.waitForTimeout(4500);

  // ══ ① 저장 실패 ══ 용량 초과를 흉내 내어 setItem 이 던지게 만든다.
  await p.evaluate(() => {
    window.__origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k) {
      if (k === 'ls_mgmt_state') { const e = new Error('exceeded the quota'); e.name = 'QuotaExceededError'; throw e; }
      return window.__origSet.apply(null, arguments);
    };
    lsSave();
  });
  await p.waitForTimeout(300);
  const A = await p.evaluate(() => {
    const el = document.getElementById('ls-save-warn');
    return { on: !!el, txt: el ? el.innerText.replace(/\n/g, ' ') : '', bk: !!document.getElementById('ls-save-warn-bk') };
  });
  chk('저장 실패 시 경고가 화면에 뜸', A.on, A.txt.slice(0, 50));
  chk('무슨 일이 생겼는지 설명함', /저장하지 못했습니다/.test(A.txt) && /사라질 수 있습니다/.test(A.txt), A.txt.slice(0, 70));
  chk('실패 사유를 함께 보여줌', /QuotaExceededError/.test(A.txt), A.txt.slice(-60));
  chk('바로 백업할 수단을 제공함', A.bk);

  // 경고가 쌓이지 않는다
  await p.evaluate(() => { lsSave(); lsSave(); }); await p.waitForTimeout(200);
  const A2 = await p.evaluate(() => document.querySelectorAll('#ls-save-warn').length);
  chk('저장이 계속 실패해도 경고는 하나만', A2 === 1, 'count=' + A2);

  // 저장이 다시 되면 스스로 사라진다 — 고쳐졌는데 빨간 띠가 남아 있으면 안 된다
  await p.evaluate(() => { localStorage.setItem = window.__origSet; lsSave(); }); await p.waitForTimeout(300);
  const A3 = await p.evaluate(() => !!document.getElementById('ls-save-warn'));
  chk('저장이 복구되면 경고가 사라짐', !A3);

  // ══ ② 스크립트 오류 ══ 처리되지 않은 오류가 흔적을 남기는지
  const before = await p.evaluate(() => !!document.getElementById('err-chip'));
  chk('오류가 없을 땐 표시도 없음', !before);

  await p.evaluate(() => { setTimeout(() => { throw new Error('일부러 낸 오류 A'); }, 0); });
  await p.waitForTimeout(400);
  const B = await p.evaluate(() => {
    const c = document.getElementById('err-chip');
    return { on: !!c, txt: c ? c.textContent : '' };
  });
  chk('처리되지 않은 오류가 화면에 남음', B.on, B.txt);

  // 같은 오류가 반복돼도 한 건으로 묶인다 (화면을 더럽히지 않는다)
  await p.evaluate(() => {
    setTimeout(() => { throw new Error('일부러 낸 오류 A'); }, 0);
    setTimeout(() => { throw new Error('일부러 낸 오류 A'); }, 0);
  });
  await p.waitForTimeout(400);
  const B2 = await p.evaluate(() => document.getElementById('err-chip').textContent);
  chk('같은 오류는 한 건으로 묶음', /오류 1건/.test(B2), B2);

  // 다른 오류는 따로 센다
  await p.evaluate(() => { Promise.reject(new Error('일부러 낸 오류 B')); });
  await p.waitForTimeout(400);
  const B3 = await p.evaluate(() => document.getElementById('err-chip').textContent);
  chk('처리되지 않은 Promise 오류도 잡음', /오류 2건/.test(B3), B3);

  // 눌러서 내용을 확인하고 복사할 수 있다
  await p.click('#err-chip'); await p.waitForTimeout(300);
  const B4 = await p.evaluate(() => {
    const pop = document.getElementById('err-pop');
    return { on: !!pop, txt: pop ? pop.innerText.replace(/\n/g, ' ') : '', copy: !!document.getElementById('err-copy') };
  });
  chk('클릭하면 오류 내용을 보여줌', B4.on && /일부러 낸 오류 A/.test(B4.txt) && /일부러 낸 오류 B/.test(B4.txt), B4.txt.slice(0, 80));
  chk('그대로 전달하도록 복사 버튼 제공', B4.copy);
  await p.click('#err-close'); await p.waitForTimeout(200);
  chk('닫을 수 있음', await p.evaluate(() => !document.getElementById('err-pop')));

  await p.close();

  // ══ ③ 로그인 SDK 미로딩 ══ 실제 배포본은 Firebase SDK 를 CDN 에서 받는다.
  // 테스트 사본은 SDK 태그가 빠져 있어 'firebase 가 없는 상태' 그 자체다 — 사내망 차단과 같은 상황.
  const p2 = await b.newPage({ viewport: { width: 1000, height: 800 } });
  await p2.goto(URL); await p2.waitForTimeout(600);
  const C0 = await p2.evaluate(() => {
    if (typeof firebase !== 'undefined') return 'sdk-present';
    // 동기화가 꺼져 있으면 fbInit 은 즉시 빠져나간다. 켜진 상태를 만들어 준다.
    window.syncEnabled = function () { return true; };
    fbInit();
    return 'started';
  });
  chk('테스트 사본에는 SDK 가 없음(차단 상황 재현)', C0 === 'started', C0);

  const C1 = await p2.evaluate(() => {
    const g = document.getElementById('auth-gate');
    return { shown: !!g, txt: g ? g.innerText.replace(/\n/g, ' ') : '' };
  });
  chk('8초 전에는 실패라고 단정하지 않음', !/연결하지 못했습니다/.test(C1.txt), C1.txt.slice(0, 50));

  await p2.waitForTimeout(9000);
  const C2 = await p2.evaluate(() => {
    const g = document.getElementById('auth-gate');
    const btn = document.getElementById('auth-gate-login');
    return { txt: g ? g.innerText.replace(/\n/g, ' ') : '', btn: btn ? btn.style.display : '' };
  });
  chk('8초가 지나면 연결 실패를 알림', /연결하지 못했습니다/.test(C2.txt), C2.txt.slice(0, 60));
  chk('짐작 가는 원인을 알려줌', /사내망|보안 프로그램/.test(C2.txt), C2.txt.slice(0, 90));
  chk('회복되면 돌아온다고 안내', /자동으로/.test(C2.txt), C2.txt.slice(0, 110));
  chk('로그인 버튼은 눌러볼 수 있게 남김', C2.btn !== 'none', 'display=' + C2.btn);

  await b.close();
  console.log('\n=== PASS ==='); ok.forEach(x => console.log('  ✓', x));
  console.log('\n=== FAIL ==='); bad.length ? bad.forEach(x => console.log('  ✗', x)) : console.log('  (없음)');
  // 일부러 낸 오류 2건은 예상된 것이므로 제외한다
  const real = errs.filter(m => !/일부러 낸 오류/.test(m));
  console.log('\nPAGE ERRORS:', real);
  process.exit(bad.length || real.length ? 1 : 0);
})();
