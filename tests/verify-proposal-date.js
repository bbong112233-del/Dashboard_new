const {launch,URL,FIXTURE}=require('./_harness');
const ok=[],bad=[];
function chk(n,c,d){ (c?ok:bad).push(n+(d?' — '+d:'')); }
(async()=>{
  const b=await launch();
  const p=await b.newPage({viewport:{width:1560,height:940}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(()=>{const g=document.getElementById('auth-gate');if(g)g.remove();try{localStorage.setItem('memo_author_name','박정주');}catch(e){}});
  await p.setInputFiles('#file-input',FIXTURE); await p.waitForTimeout(4500);
  await p.click('.tab[data-tab="lowsales"]'); await p.waitForTimeout(1400);

  const TODAY=await p.evaluate(()=>new Date().toISOString().slice(0,10));
  // 고정 날짜를 쓰면 시간이 흘러 '지난 메모'(1개월 초과)로 접히면서 테스트가 깨진다.
  // 오늘 기준 상대 날짜로 둔다.
  const OLD=await p.evaluate(()=>new Date(Date.now()-20*86400000).toISOString().slice(0,10));
  const F=await p.evaluate(o=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const mk=n=>{const f=window._lsFirms[n].firm,i=info[f];return {k:f+'|||'+i.cos+'|||'+i.ind, firm:f};};
    const a=mk(0), b2=mk(1), c=mk(2), d=mk(3);
    [a,b2,c,d].forEach(x=>{ window.LS_MGMT[x.k]={checked:false,memo:'8월 10일에 쓴 기존 메모',
      memoDate:o+'T09:00:00.000Z',memoBy:'박정주',comments:[]}; });
    lsSave(); return {a:a, b:b2, c:c, d:d};
  }, OLD);

  // ── A. 본문 그대로 + 칩만 선택 → 메모 날짜 유지, 제안은 오늘 ──
  await p.evaluate(k=>lsOpenMemo(k,k.split('|||')[0]), F.a.k); await p.waitForTimeout(600);
  await p.evaluate(()=>{ document.querySelector('.ls-act-chip[data-grp="조명"]').click();
                         document.getElementById('ls-memo-save').click(); });
  await p.waitForTimeout(800);
  const A=await p.evaluate(k=>{const m=window.LS_MGMT[k],a=(m.actions||[])[0]||{};
    return {memoDate:(m.memoDate||'').slice(0,10), memo:m.memo, actDate:a.date, by:a.memoBy};}, F.a.k);
  chk('A 기존 메모 작성일 유지', A.memoDate===OLD, A.memoDate+' (기대 '+OLD+')');
  chk('A 제안 등록일 = 오늘', A.actDate===TODAY, A.actDate+' (기대 '+TODAY+')');
  chk('A 본문 그대로', A.memo==='8월 10일에 쓴 기존 메모', JSON.stringify(A.memo));

  // ── B. 본문을 실제로 고치면 작성일은 갱신 ──
  await p.evaluate(k=>lsOpenMemo(k,k.split('|||')[0]), F.b.k); await p.waitForTimeout(600);
  await p.evaluate(()=>{ document.getElementById('ls-memo-input').value='9월 10일에 고친 내용';
                         document.querySelector('.ls-act-chip[data-grp="전선"]').click();
                         document.getElementById('ls-memo-save').click(); });
  await p.waitForTimeout(800);
  const B=await p.evaluate(k=>{const m=window.LS_MGMT[k],a=(m.actions||[])[0]||{};
    return {memoDate:(m.memoDate||'').slice(0,10), actDate:a.date};}, F.b.k);
  chk('B 본문 수정 시 작성일 갱신', B.memoDate===TODAY, B.memoDate);
  chk('B 제안 등록일 = 오늘', B.actDate===TODAY, B.actDate);

  // ── C. 열었다 그냥 저장 → 아무것도 안 바뀜 (기존 결함) ──
  await p.evaluate(k=>lsOpenMemo(k,k.split('|||')[0]), F.c.k); await p.waitForTimeout(600);
  await p.evaluate(()=>document.getElementById('ls-memo-save').click());
  await p.waitForTimeout(700);
  const C=await p.evaluate(k=>{const m=window.LS_MGMT[k];
    return {memoDate:(m.memoDate||'').slice(0,10), acts:(m.actions||[]).length};}, F.c.k);
  chk('C 열었다 저장만 → 작성일 그대로', C.memoDate===OLD, C.memoDate);
  chk('C 칩 미선택이면 제안 안 생김(회귀)', C.acts===0, 'acts='+C.acts);

  // ── D. 메모 시트 ＋제안 팝오버 → 메모 날짜 유지, 제안은 오늘 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>{ if(document.body.innerText.indexOf('▶')>=0) window.memoToggleAllDates(); });
  await p.waitForTimeout(800);
  const POP=await p.evaluate(f=>{
    const tr=[...document.querySelectorAll('#memo-sheet-tbody tr')].find(r=>r.innerText.indexOf(f.d.firm)>=0);
    if(!tr) return 'no-row';
    const l=tr.querySelector('.act-pick-link'); if(!l) return 'no-link';
    l.click(); return 'ok';
  }, F);
  await p.waitForTimeout(600);
  const PT=await p.evaluate(()=>{const x=document.getElementById('act-pick-pop');
    return x?x.innerText.replace(/\n/g,' '):'';});
  chk('팝오버 안내가 오늘 날짜로 바뀜', /등록일은 오늘 날짜/.test(PT), PT.slice(0,60));
  await p.evaluate(()=>document.querySelector('#act-pick-pop .act-pick-chip[data-grp="MRO"]').click());
  await p.waitForTimeout(700);
  const D=await p.evaluate(k=>{const m=window.LS_MGMT[k],a=(m.actions||[])[0]||{};
    return {memoDate:(m.memoDate||'').slice(0,10), actDate:a.date};}, F.d.k);
  chk('D 팝오버 등록 후 메모 작성일 유지', D.memoDate===OLD, D.memoDate+' (기대 '+OLD+')');
  chk('D 팝오버 제안 등록일 = 오늘', D.actDate===TODAY, D.actDate);

  // ── E. 제안 뷰에서 경과 0일로 보인다 ──
  await p.evaluate(()=>document.querySelector('.memo-view-btn[data-view="act"]').click());
  await p.waitForTimeout(800);
  const E=await p.evaluate(()=>[...document.querySelectorAll('#memo-sheet-tbody tr')].map(tr=>{
    const td=tr.querySelectorAll('td');
    return {date:td[4].innerText.trim(), days:td[5].innerText.trim(), color:td[5].querySelector('b').style.color};
  }));
  chk('제안 뷰 등록일이 전부 오늘', E.length>0 && E.every(r=>r.date===TODAY), JSON.stringify(E.map(r=>r.date)));
  chk('경과 0일 · 회색', E.every(r=>r.days==='0일' && /95, 99, 104/.test(r.color)), JSON.stringify(E.map(r=>r.days+' '+r.color)));

  // ── F. 코스 메모도 같은 규칙 ──
  const G=await p.evaluate(o=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const cos=[...new Set(rows.map(r=>r.cos))][0];
    window.LS_MGMT['region_'+cos]={checked:false,memo:'코스 메모 원본',memoDate:o+'T09:00:00.000Z',memoBy:'박정주'};
    lsSave(); window.cosMemoOpen(cos);
    document.getElementById('ls-memo-save').click();
    return {cos:cos, memoDate:(window.LS_MGMT['region_'+cos].memoDate||'').slice(0,10)};
  }, OLD);
  chk('코스 메모도 열었다 저장 시 작성일 유지', G.memoDate===OLD, G.memoDate);

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
