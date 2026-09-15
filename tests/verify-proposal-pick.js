const {launch,URL,FIXTURE}=require('./_harness');
const ok=[], bad=[];
function chk(n,c,d){ (c?ok:bad).push(n+(d?' — '+d:'')); }
(async()=>{
  const b=await launch();
  const p=await b.newPage({viewport:{width:1560,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(()=>{const g=document.getElementById('auth-gate'); if(g)g.remove(); try{localStorage.setItem('memo_author_name','박정주');}catch(e){}});
  await p.setInputFiles('#file-input',FIXTURE); await p.waitForTimeout(4500);
  await p.click('.tab[data-tab="lowsales"]'); await p.waitForTimeout(1500);

  // 45일 전 일반 메모 2건 (품목 정보 없음)
  const F=await p.evaluate(()=>{
    const rows=(window._allRows||window.GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const D=d=>new Date(Date.now()-d*86400000).toISOString();
    const f1=window._lsFirms[0].firm, f2=window._lsFirms[1].firm, f3=window._lsFirms[2].firm;
    const k1=f1+'|||'+info[f1].cos+'|||'+info[f1].ind;
    const k2=f2+'|||'+info[f2].cos+'|||'+info[f2].ind;
    const k3=f3+'|||'+info[f3].cos+'|||'+info[f3].ind;
    window.LS_MGMT[k1]={checked:false,memo:'담당자 변경됨 · 재연락 필요',memoDate:D(45),memoBy:'박정주',comments:[]};
    window.LS_MGMT[k2]={checked:false,memo:'재고 확인 후 회신 예정',memoDate:D(20),memoBy:'장주운',comments:[]};
    window.LS_MGMT[k3]={checked:false,memo:'분기 미팅 일정 조율 중',memoDate:D(30),memoBy:'박정주',comments:[]};
    lsSave();
    return {k1:k1,k2:k2,k3:k3,f1:f1,f2:f2,cos1:info[f1].cos, memoDate1:window.LS_MGMT[k1].memoDate};
  });

  // ══ 1) 메모 편집 모달 — 품목 칩 ══
  await p.evaluate(k=>lsOpenMemo(k, k.split('|||')[0]), F.k1); await p.waitForTimeout(700);
  const A1=await p.evaluate(()=>({
    chips:[...document.querySelectorAll('.ls-act-chip')].map(c=>c.getAttribute('data-grp')),
    autoToggle:!!document.getElementById('ls-act-on'),
    txt:(document.querySelector('#ls-memo-modal')||{innerText:''}).innerText.replace(/\n/g,' ')
  }));
  chk('기존 메모에 품목 칩 4개 노출', A1.chips.length===4, JSON.stringify(A1.chips));
  chk('자동 토글은 안 뜸(품목 모르는 경로)', !A1.autoToggle);
  chk('안내 문구', /품목을 고르면 진행 중으로 등록/.test(A1.txt));

  await p.evaluate(()=>{const m=document.getElementById('ls-memo-modal'); if(m)m.remove();});

  // 아무것도 안 고르고 저장 → 제안 안 생김 (회귀) — 별도 메모(k3)로 검증
  await p.evaluate(k=>lsOpenMemo(k, k.split('|||')[0]), F.k3); await p.waitForTimeout(600);
  await p.click('#ls-memo-save'); await p.waitForTimeout(700);
  const A2=await p.evaluate(k=>((window.LS_MGMT[k]||{}).actions||[]).length, F.k3);
  chk('칩 미선택 저장 → 제안 생성 안 됨', A2===0, 'actions='+A2);

  // 칩 선택 후 저장 → 제안 생성 (k1 은 아직 45일 전 작성일 그대로)
  await p.evaluate(k=>lsOpenMemo(k, k.split('|||')[0]), F.k1); await p.waitForTimeout(600);
  await p.click('.ls-act-chip[data-grp="조명"]'); await p.waitForTimeout(300);
  const A3=await p.evaluate(()=>{
    const c=document.querySelector('.ls-act-chip[data-grp="조명"]');
    const o=document.querySelector('.ls-act-chip[data-grp="MRO"]');
    return { sel:c.style.background, other:o.style.background };
  });
  chk('선택한 칩만 강조', /rgb\(26, 115, 232\)|#1a73e8/.test(A3.sel) && !/rgb\(26, 115, 232\)/.test(A3.other), A3.sel+' / '+A3.other);
  await p.click('#ls-memo-save'); await p.waitForTimeout(900);
  const A4=await p.evaluate(k=>{ const a=(window.LS_MGMT[k]||{}).actions||[]; return {n:a.length, last:a[a.length-1]||null}; }, F.k1);
  chk('칩 선택 저장 → actions 1건', A4.n===1 && A4.last && A4.last.st==='open', JSON.stringify(A4.last));
  chk('품목 = 고른 값(조명)', A4.last && A4.last.grp==='조명', (A4.last||{}).grp);
  chk('담당 = 키의 코스', A4.last && A4.last.by===F.cos1, (A4.last||{}).by+' vs '+F.cos1);
  const _today=new Date().toISOString().slice(0,10);
  chk('등록일 = 오늘(메모 작성일 아님)', A4.last && A4.last.date===_today, (A4.last||{}).date+' vs 오늘 '+_today);
  const A4b=await p.evaluate(k=>((window.LS_MGMT[k]||{}).memoDate||'').slice(0,10), F.k1);
  chk('기존 메모 작성일은 유지', A4b===F.memoDate1.slice(0,10), A4b+' vs '+F.memoDate1.slice(0,10));

  // 재편집 시엔 읽기 전용 배지
  await p.evaluate(k=>lsOpenMemo(k, k.split('|||')[0]), F.k1); await p.waitForTimeout(600);
  const A5=await p.evaluate(()=>({ chips:document.querySelectorAll('.ls-act-chip').length,
                                   badge:document.querySelectorAll('#ls-memo-modal .act-badge').length,
                                   txt:(document.querySelector('#ls-memo-modal')||{innerText:''}).innerText.replace(/\n/g,' ') }));
  chk('등록된 제안은 배지로, 남은 품목만 칩으로', A5.badge===1 && A5.chips===3, 'chips='+A5.chips+' badge='+A5.badge);
  chk('등록 내역 표기', /등록된 제안 1/.test(A5.txt) && /제안 추가/.test(A5.txt), A5.txt.slice(0,70));
  const A5b=await p.evaluate(()=>[...document.querySelectorAll('.ls-act-chip')].map(c=>c.getAttribute('data-grp')));
  chk('이미 등록한 조명은 칩에서 빠짐', A5b.indexOf('조명')<0, JSON.stringify(A5b));
  await p.evaluate(()=>{const m=document.getElementById('ls-memo-modal'); if(m)m.remove();});

  // ══ 2) 메모 관리 시트 — ＋제안 링크 → 팝오버 ══
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>{ if(document.body.innerText.indexOf('▶')>=0) window.memoToggleAllDates(); });
  await p.waitForTimeout(900);
  const B0=await p.evaluate(()=>({ links:document.querySelectorAll('.act-pick-link').length,
                                   badges:document.querySelectorAll('#memo-sheet-tbody .act-badge').length }));
  chk('제안 없는 행에 ＋제안 링크', B0.links>0, 'links='+B0.links+' badges='+B0.badges);

  await p.locator('.act-pick-link').first().click(); await p.waitForTimeout(600);
  const B1=await p.evaluate(()=>{
    const pop=document.getElementById('act-pick-pop');
    return { open:!!pop, chips:pop?pop.querySelectorAll('.act-pick-chip').length:0,
             txt:pop?pop.innerText.replace(/\n/g,' '):'' };
  });
  chk('팝오버 열림 + 남은 품목만 노출', B1.open && B1.chips>0 && B1.chips<=4, 'chips='+B1.chips);
  chk('팝오버 안내 문구', /등록일은 오늘 날짜/.test(B1.txt), B1.txt.slice(0,60));

  const K2=await p.evaluate(()=>{ const k=document.querySelector('.act-pick-link').getAttribute('data-actkey');
    return { key:k, memoDate:((window.LS_MGMT[k]||{}).memoDate||'').slice(0,10) }; });
  const KEY2=K2.key;
  await p.evaluate(()=>document.querySelector('#act-pick-pop .act-pick-chip[data-grp="부자재"]').click());
  await p.waitForTimeout(900);
  const B2=await p.evaluate(k=>{ const a=(window.LS_MGMT[k]||{}).actions||[];
    return { n:a.length, last:a[a.length-1]||null,
             popGone:!document.getElementById('act-pick-pop'),
             badges:document.querySelectorAll('#memo-sheet-tbody .act-badge').length }; }, KEY2);
  chk('팝오버에서 등록 → 부자재 제안이 붙음', B2.n>=1 && B2.last.grp==='부자재' && B2.last.st==='open', 'n='+B2.n+' '+JSON.stringify(B2.last));
  chk('팝오버 등록일 = 오늘', B2.last && B2.last.date===new Date().toISOString().slice(0,10), B2.last.date);
  const B2b=await p.evaluate(k=>((window.LS_MGMT[k]||{}).memoDate||'').slice(0,10), KEY2);
  chk('팝오버 등록 후에도 메모 작성일 유지', B2b===K2.memoDate, B2b+' vs '+K2.memoDate);
  chk('팝오버 닫힘 + 표에 배지 반영', B2.popGone && B2.badges>0, 'badges='+B2.badges);

  // ══ 3) 재구매 제안 문구에 제품군 ══
  await p.click('.tab[data-tab="light"]'); await p.waitForTimeout(1800);
  const C=await p.evaluate(()=>{
    // 조명 상세표 → 카테고리 → 대분류 → 중분류 → 상품 → 거래처 순으로 내려간다
    function firstRow(sel){ return document.querySelector(sel); }
    var r=document.querySelector('#panel-light .cat-row')||document.querySelector('#panel-light tbody tr');
    if(!r) return 'no-cat';
    r.click(); return 'ok';
  });
  await p.waitForTimeout(900);
  let depth=0, reached=false;
  for(let i=0;i<4;i++){
    const st=await p.evaluate(()=>{
      if(document.querySelector('#drill-sub') && /미거래처 일괄 메모/.test(document.getElementById('drill-sub').innerText)) return 'firms';
      const tr=document.querySelector('#drill-tbody tr'); if(!tr) return 'end';
      tr.click(); return 'down';
    });
    await p.waitForTimeout(800);
    depth++;
    if(st==='firms'){ reached=true; break; }
    if(st==='end') break;
  }
  if(reached){
    await p.evaluate(()=>openZeroBulkMemo()); await p.waitForTimeout(800);
    const C1=await p.evaluate(()=>({ v:(document.getElementById('sbulk-text')||{}).value||'' }));
    const grpNames=['전선','조명','부자재','MRO'];
    chk('재구매 제안 문구에 제품군 포함', /^\[재구매 제안\] /.test(C1.v) && grpNames.some(g=>C1.v.indexOf('] '+g+' · ')===0-1+2+g.length-g.length+9 || C1.v.indexOf('] '+g+' · ')>0), JSON.stringify(C1.v));
    await p.evaluate(()=>{const m=document.getElementById('bulk-memo-modal'); if(m)m.remove();});
  } else {
    chk('재구매 제안 문구에 제품군 포함', false, '거래처 팝업까지 도달 실패(depth='+depth+')');
  }

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close();
  process.exit(bad.length?1:0);
})();
