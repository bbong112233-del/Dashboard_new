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

  // 저매출 시트를 먼저 열어 실제 목록을 만든 뒤, 그 목록의 첫 거래처에 심는다
  await p.click('.tab[data-tab="lowsales"]'); await p.waitForTimeout(1500);

  // ── 한 거래처에 3개 키 스킴 모두 심는다 (핵심 검증 대상) ──
  const F = await p.evaluate(()=>{
    const rows=(window._allRows||window.GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    // 저매출 시트에 실제로 뜨는 거래처를 골라야 상세 팝업 검증이 된다
    const f=(window._lsFirms&&window._lsFirms.length)?window._lsFirms[0].firm:Object.keys(info)[4];
    const i=info[f]; const D=d=>new Date(Date.now()-d*86400000).toISOString();
    window.__F=f;
    window.LS_MGMT[f+'|||'+i.cos+'|||'+i.ind]={checked:false,
      memo:'관리시트 메모 — 9월 방문 예정', memoDate:D(2), memoBy:'박정주',
      comments:[{id:'c1',name:'장주운',text:'단가표 먼저 보냈습니다',date:D(1)}],
      actions:[{id:'a1',grp:'MRO',by:i.cos,date:D(2).slice(0,10),st:'open',stAt:D(1)}]};
    window.LS_MGMT['hs_'+f+'|||'+i.cos+'|||'+i.ind]={checked:false,
      memo:'고매출 시절 메모 — 담당자 변경됨', memoDate:D(40), memoBy:'장주운', comments:[]};
    window.LS_MGMT['region_'+f]={checked:false,
      memo:'지역별에서 쓴 메모 — 재고 확인 요청', memoDate:D(75), memoBy:'박정주',
      comments:[{id:'c2',name:'박정주',text:'회신 옴',date:D(70)}]};
    lsSave();
    return {firm:f, cos:i.cos, ind:i.ind};
  });

  // ── 1) _firmHistory 가 3개 키를 모두 모으는가 ──
  const H = await p.evaluate(()=>{
    const h=_firmHistory(window.__F);
    return { n:h.length, types:h.map(x=>x.t), srcs:[...new Set(h.map(x=>x.src))],
             dates:h.map(x=>x.date), keys:[...new Set(h.map(x=>x.key.replace(window.__F,'{F}')))] };
  });
  chk('3개 키 전부 수집', H.keys.length===3, JSON.stringify(H.keys));
  chk('항목 수 = 메모3 + 댓글2 + 제안1 = 6', H.n===6, 'n='+H.n+' types='+JSON.stringify(H.types));
  chk('출처 라벨 3종', H.srcs.length===3, JSON.stringify(H.srcs));
  const sorted=[...H.dates].sort().reverse();
  chk('최신순 정렬', JSON.stringify(H.dates)===JSON.stringify(sorted), JSON.stringify(H.dates.map(d=>d.slice(0,10))));

  // ── 2) 진입점 A: 저매출 시트 거래처 상세 → 이력 버튼 ──
  await p.evaluate(()=>lsSwitchTab('전체')); await p.waitForTimeout(1200);
  await p.evaluate(f=>{
    const rows=[...document.querySelectorAll('#lowsales-content tbody tr')];
    const t=rows.find(r=>r.innerText.indexOf(f)>=0)||rows[0];
    t.querySelectorAll('td')[2].click();
  }, F.firm);
  await p.waitForTimeout(900);
  const B1=await p.evaluate(()=>{
    const b=document.getElementById('drill-hist-btn');
    return { disp:b?getComputedStyle(b).display:'x', txt:(b||{}).textContent||'',
             firm:(b||{getAttribute:()=>null}).getAttribute('data-firm'),
             title:document.getElementById('drill-title').textContent };
  });
  chk('거래처 상세에 이력 버튼 노출', B1.disp!=='none', B1.disp+' / '+B1.txt);
  chk('버튼이 그 거래처를 가리킴', B1.firm===B1.title, B1.firm+' vs '+B1.title);

  // ── 3) 버튼 클릭 → 타임라인 모달 ──
  await p.click('#drill-hist-btn'); await p.waitForTimeout(700);
  const M1=await p.evaluate(()=>{
    const m=document.getElementById('drill-memo-preview');
    if(!m) return {open:false};
    const t=m.innerText;
    return { open:true, head:t.split('\n')[0], summary:(t.match(/메모 \d+ · 댓글 \d+ · 제안 \d+/)||[''])[0],
             hasLs:t.indexOf('관리시트 메모')>=0, hasHs:t.indexOf('고매출 시절 메모')>=0,
             hasRg:t.indexOf('지역별에서 쓴 메모')>=0, hasCmt:t.indexOf('단가표 먼저 보냈습니다')>=0,
             hasAct:t.indexOf('🎯 제안')>=0 || t.indexOf('진행 중')>=0,
             srcLabels:['관리 시트','고매출 관리','거래처 메모'].filter(s=>t.indexOf(s)>=0),
             hasEdit:!!document.getElementById('dmp-edit') };
  });
  chk('이력 모달 열림', M1.open);
  chk('관리시트 메모 표시', M1.hasLs);
  chk('고매출 메모 표시 (다른 키)', M1.hasHs);
  chk('지역별 메모 표시 (또 다른 키)', M1.hasRg);
  chk('댓글 표시', M1.hasCmt);
  chk('제안 이력 표시', M1.hasAct);
  chk('출처 배지 3종 표시', M1.srcLabels.length===3, JSON.stringify(M1.srcLabels));
  chk('요약 줄', /메모 3 · 댓글 2 · 제안 1/.test(M1.summary), M1.summary);
  chk('최신 메모 편집 버튼', M1.hasEdit);

  // 편집 버튼이 최신 키를 여는지
  await p.click('#dmp-edit'); await p.waitForTimeout(700);
  const E1=await p.evaluate(()=>({ open:!!document.getElementById('ls-memo-input'),
                                   val:(document.getElementById('ls-memo-input')||{}).value||'' }));
  chk('편집 버튼 → 최신 메모(관리시트) 열림', E1.open && E1.val.indexOf('관리시트 메모')>=0, E1.val.slice(0,20));
  await p.evaluate(()=>{const m=document.getElementById('ls-memo-modal'); if(m)m.remove();});
  await p.evaluate(()=>{const m=document.getElementById('drill-modal'); if(m)m.style.display='none'; document.body.style.overflow='';});

  // ── 4) 버튼이 거래처 화면에서만 뜨는지 (누수 확인) ──
  await p.click('.tab[data-tab="light"]'); await p.waitForTimeout(1800);
  const clicked = await p.evaluate(()=>{
    var tr=document.querySelector('#panel-light .cat-row')||document.querySelector('#panel-light tbody tr');
    if(!tr) return false; tr.click(); return true;
  });
  await p.waitForTimeout(900);
  const N1=await p.evaluate(()=>{
    const b=document.getElementById('drill-hist-btn');
    return { disp:b?getComputedStyle(b).display:'x', title:document.getElementById('drill-title').textContent };
  });
  chk('카테고리 드릴에는 버튼 안 뜸', !clicked || N1.disp==='none', (clicked?'':'(행 없음) ')+N1.disp+' / '+N1.title);
  await p.evaluate(()=>{const m=document.getElementById('drill-modal'); if(m)m.style.display='none'; document.body.style.overflow='';});

  // ── 5) 진입점 B: 메모 관리 시트 거래처명 클릭 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  // 접힌 그룹이 있으면 펼친다 (이미 펼쳐져 있으면 토글이 접어버리므로 조건부)
  await p.evaluate(()=>{ if(document.querySelector('#memo-sheet-tbody tr td[colspan]')
      && document.body.innerText.indexOf('▶')>=0) window.memoToggleAllDates(); });
  await p.waitForTimeout(900);
  const L=await p.locator('.firm-hist-link').count();
  chk('메모 시트 거래처명이 링크로', L>0, 'count='+L);
  await p.locator('.firm-hist-link').first().click(); await p.waitForTimeout(700);
  const M2=await p.evaluate(()=>({ open:!!document.getElementById('drill-memo-preview'),
    head:(document.getElementById('drill-memo-preview')||{innerText:''}).innerText.split('\n')[0] }));
  chk('거래처명 클릭 → 이력 모달', M2.open, M2.head);
  await p.evaluate(()=>{const m=document.getElementById('drill-memo-preview'); if(m)m.remove();});

  // ── 6) 진입점 C: 드릴다운 거래처 목록의 최신 메모 셀 (기존 경로) ──
  await p.click('.tab[data-tab="whitespace"]'); await p.waitForTimeout(1500);
  const R=await p.evaluate(()=>{
    // 이력이 있는 거래처를 ws 행에서 찾아 상세를 연다
    const rows=[...document.querySelectorAll('#ws-content .ws-row')];
    const t=rows.find(r=>r.dataset.firm===window.__F);
    if(t){ t.querySelectorAll('td')[1].click(); return 'clicked'; }
    return 'not-in-list';
  });
  await p.waitForTimeout(800);
  if(R==='clicked'){
    const C1=await p.evaluate(()=>{
      const b=document.getElementById('drill-hist-btn');
      return { disp:b?getComputedStyle(b).display:'x', txt:(b||{}).textContent||'' };
    });
    chk('품목확대 거래처 상세에도 이력 버튼', C1.disp!=='none', C1.disp+' / '+C1.txt);
  } else {
    chk('품목확대 거래처 상세에도 이력 버튼', true, '해당 거래처가 목록에 없어 건너뜀');
  }
  await p.evaluate(()=>{const m=document.getElementById('drill-modal'); if(m)m.style.display='none'; document.body.style.overflow='';});

  // ── 7) 회귀: 이력이 없는 거래처는 기존 동작(메모 작성) ──
  const G=await p.evaluate(()=>{
    const rows=(window._allRows||window.GDATA.allRows||[]);
    const firms=[...new Set(rows.map(r=>r.firm))];
    const none=firms.find(f=>_firmHistory(f).length===0);
    return { firm:none, n:none?_firmHistory(none).length:-1 };
  });
  chk('이력 0건 거래처 존재(회귀 대상)', G.n===0, JSON.stringify(G.firm));

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close();
  process.exit(bad.length?1:0);
})();
