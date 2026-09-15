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

  const F=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const f=window._lsFirms[0].firm, i=info[f];
    const f2=window._lsFirms[1].firm, i2=info[f2];
    const D=d=>new Date(Date.now()-d*86400000).toISOString();
    const k=f+'|||'+i.cos+'|||'+i.ind, k2=f2+'|||'+i2.cos+'|||'+i2.ind;
    window.LS_MGMT[k]={checked:false,memo:'여러 품목 제안 대상',memoDate:D(20),memoBy:'박정주',comments:[]};
    window.LS_MGMT[k2]={checked:false,memo:'한 품목만',memoDate:D(10),memoBy:'박정주',comments:[]};
    lsSave(); return {firm:f, cos:i.cos, k:k, k2:k2, firm2:f2};
  });

  // ── 1) 첫 제안: 칩 4개 ──
  await p.evaluate(k=>lsOpenMemo(k,k.split('|||')[0]), F.k); await p.waitForTimeout(600);
  const A1=await p.evaluate(()=>({chips:[...document.querySelectorAll('.ls-act-chip')].map(c=>c.getAttribute('data-grp')),
                                  txt:document.getElementById('ls-memo-modal').innerText.replace(/\n/g,' ')}));
  chk('제안 0건 → 칩 4개', A1.chips.length===4, JSON.stringify(A1.chips));
  chk('문구는 "제안으로 등록"', /제안으로 등록/.test(A1.txt) && !/제안 추가/.test(A1.txt));
  await p.evaluate(()=>{ document.querySelector('.ls-act-chip[data-grp="조명"]').click();
                         document.getElementById('ls-memo-save').click(); });
  await p.waitForTimeout(800);

  // ── 2) 두 번째 제안: 배지 1 + 남은 칩 3 ──
  await p.evaluate(k=>lsOpenMemo(k,k.split('|||')[0]), F.k); await p.waitForTimeout(600);
  const A2=await p.evaluate(()=>({chips:[...document.querySelectorAll('.ls-act-chip')].map(c=>c.getAttribute('data-grp')),
    badges:document.querySelectorAll('#ls-memo-modal .act-badge').length,
    txt:document.getElementById('ls-memo-modal').innerText.replace(/\n/g,' ')}));
  chk('등록된 제안 배지 1개 표시', A2.badges===1, 'badges='+A2.badges);
  chk('이미 쓴 조명은 칩에서 빠짐', A2.chips.length===3 && A2.chips.indexOf('조명')<0, JSON.stringify(A2.chips));
  chk('문구가 "제안 추가"로 바뀜', /제안 추가/.test(A2.txt) && /등록된 제안 1/.test(A2.txt), A2.txt.slice(0,70));
  await p.evaluate(()=>{ document.querySelector('.ls-act-chip[data-grp="부자재"]').click();
                         document.getElementById('ls-memo-save').click(); });
  await p.waitForTimeout(800);
  const A3=await p.evaluate(k=>((window.LS_MGMT[k]||{}).actions||[]).map(a=>({grp:a.grp,st:a.st,by:a.by})), F.k);
  chk('한 거래처에 제안 2건', A3.length===2 && A3[0].grp==='조명' && A3[1].grp==='부자재', JSON.stringify(A3));
  chk('두 건 모두 담당 채워짐', A3.every(a=>a.by===F.cos), JSON.stringify(A3.map(a=>a.by)));

  // ── 3) 같은 품목 중복 방지 ──
  const D1=await p.evaluate(k=>{ const r=actAdd(k,'조명','x'); return {r:r, n:(window.LS_MGMT[k].actions||[]).length}; }, F.k);
  chk('같은 품목 재등록은 거부', D1.r===false && D1.n===2, JSON.stringify(D1));

  // ── 4) 네 품목 다 채우면 추가 UI가 사라진다 ──
  await p.evaluate(k=>{ actAdd(k,'전선','c'); actAdd(k,'MRO','c'); lsSave(); }, F.k);
  await p.evaluate(k=>lsOpenMemo(k,k.split('|||')[0]), F.k); await p.waitForTimeout(600);
  const A4=await p.evaluate(()=>({chips:document.querySelectorAll('.ls-act-chip').length,
    badges:document.querySelectorAll('#ls-memo-modal .act-badge').length,
    auto:!!document.getElementById('ls-act-on')}));
  chk('4품목 다 등록 → 칩 없음, 배지 4개', A4.chips===0 && A4.badges===4 && !A4.auto, JSON.stringify(A4));
  await p.evaluate(()=>{const m=document.getElementById('ls-memo-modal'); if(m)m.remove();});

  // ── 5) 집계가 모든 건을 센다 ──
  const S=await p.evaluate(()=>actStats());
  chk('집계 = 제안 4건 (키 1개 아님)', S.open===4, JSON.stringify(S));

  // ── 6) 메모 시트: 배지 여러 개 + ＋ 링크 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>{ if(document.body.innerText.indexOf('▶')>=0) window.memoToggleAllDates(); });
  await p.waitForTimeout(800);
  const M=await p.evaluate(f=>{
    const tr=[...document.querySelectorAll('#memo-sheet-tbody tr')].find(r=>r.innerText.indexOf(f.firm)>=0);
    const tr2=[...document.querySelectorAll('#memo-sheet-tbody tr')].find(r=>r.innerText.indexOf(f.firm2)>=0);
    return { full:tr?tr.querySelectorAll('.act-badge').length:-1,
             fullAdd:tr?tr.querySelectorAll('.act-pick-link').length:-1,
             emptyAdd:tr2?tr2.querySelectorAll('.act-pick-link').length:-1 };
  }, F);
  chk('메모 시트에 배지 4개', M.full===4, 'badges='+M.full);
  chk('4품목 다 찬 행엔 ＋ 링크 없음', M.fullAdd===0, 'add='+M.fullAdd);
  chk('제안 없는 행엔 ＋ 제안 링크', M.emptyAdd===1, 'add='+M.emptyAdd);

  // ── 7) 팝오버도 남은 품목만 ──
  await p.evaluate(f=>{
    const tr=[...document.querySelectorAll('#memo-sheet-tbody tr')].find(r=>r.innerText.indexOf(f.firm2)>=0);
    tr.querySelector('.act-pick-link').click();
  }, F);
  await p.waitForTimeout(600);
  const P1=await p.evaluate(()=>document.querySelectorAll('#act-pick-pop .act-pick-chip').length);
  chk('팝오버 칩 4개(제안 0건 거래처)', P1===4, 'chips='+P1);
  await p.evaluate(()=>document.querySelector('#act-pick-pop .act-pick-chip[data-grp="MRO"]').click());
  await p.waitForTimeout(700);
  await p.evaluate(f=>{
    const tr=[...document.querySelectorAll('#memo-sheet-tbody tr')].find(r=>r.innerText.indexOf(f.firm2)>=0);
    const l=tr.querySelector('.act-pick-link'); if(l) l.click();
  }, F);
  await p.waitForTimeout(600);
  const P2=await p.evaluate(()=>[...document.querySelectorAll('#act-pick-pop .act-pick-chip')].map(c=>c.getAttribute('data-grp')));
  chk('두 번째 팝오버는 MRO 빠진 3개', P2.length===3 && P2.indexOf('MRO')<0, JSON.stringify(P2));
  await p.evaluate(()=>{const x=document.getElementById('act-pick-pop'); if(x)x.remove();});

  // ── 8) 제안 뷰: 한 거래처가 여러 줄 ──
  await p.evaluate(()=>document.querySelector('.memo-view-btn[data-view="act"]').click());
  await p.waitForTimeout(800);
  const V=await p.evaluate(f=>{
    const rows=[...document.querySelectorAll('#memo-sheet-tbody tr')];
    const mine=rows.filter(r=>r.innerText.indexOf(f.firm)>=0);
    return { total:rows.length, mine:mine.length,
             grps:mine.map(r=>r.querySelectorAll('td')[1].innerText.trim()),
             count:document.getElementById('memo-sheet-count').textContent };
  }, F);
  chk('제안 뷰 총 5줄 (4+1)', V.total===5, 'total='+V.total+' '+V.count);
  chk('한 거래처가 품목별 4줄', V.mine===4, JSON.stringify(V.grps));

  // ── 9) 배지를 눌러도 그 건만 바뀐다 ──
  const B0=await p.evaluate(()=>[...document.querySelectorAll('#memo-sheet-tbody .act-badge')].map(x=>x.getAttribute('data-actid')));
  chk('제안 뷰 배지에 actid가 각각', new Set(B0).size===B0.length && B0.every(x=>!!x), JSON.stringify(B0.length));
  const before=await p.evaluate(k=>(window.LS_MGMT[k].actions||[]).map(a=>a.st), F.k);
  await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').click());
  await p.waitForTimeout(700);
  const after=await p.evaluate(k=>(window.LS_MGMT[k].actions||[]).map(a=>a.st), F.k);
  const diff=before.map((v,i)=>v!==after[i]).filter(Boolean).length;
  chk('한 건만 상태 변경', diff===1, JSON.stringify(before)+' → '+JSON.stringify(after));

  // ── 10) 품목확대 시트 ──
  await p.click('.tab[data-tab="whitespace"]'); await p.waitForTimeout(1600);
  const W=await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('#ws-content .ws-row')];
    let withBadge=0, both=0;
    rows.forEach(r=>{ const b=r.querySelectorAll('.act-badge').length, btn=r.querySelectorAll('.ws-propose-btn').length;
      if(b) withBadge++; if(b&&btn) both++; });
    return {rows:rows.length, withBadge, both};
  });
  chk('품목확대 시트에 배지 렌더', W.rows>0, JSON.stringify(W));

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
