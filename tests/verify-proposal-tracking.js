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

  // ══ A. 보관(숨김) — 삭제되지 않는지 ══
  await p.evaluate(()=>{
    const rows=(window._allRows||window.GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const F=Object.keys(info); const D=d=>new Date(Date.now()-d*86400000).toISOString();
    const put=(n,memo,day)=>{ const f=F[n], i=info[f]; const k=f+'|||'+i.cos+'|||'+i.ind;
      window.LS_MGMT[k]={checked:false,memo:memo,memoDate:D(day),memoBy:'박정주',comments:[]}; return k; };
    window.__K_new  = put(2,'최근 메모 (5일 전)',5);
    window.__K_past = put(5,'지난 메모 (45일 전)',45);
    window.__K_arc  = put(8,'보관 메모 (130일 전 · 3개월 초과)',130);
    lsSave();
    // 공지: 오늘 1건 + 4개월 전 1건
    const n={ na:{id:'na',text:'오늘 공지',level:'안내',name:'박정주',date:D(0)},
              nb:{id:'nb',text:'4개월 전 공지 — 보관 대상',level:'중요',name:'장주운',date:D(130)} };
    try{ localStorage.setItem('ls_notices_state', JSON.stringify(n)); }catch(e){}
  });
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>window.memoToggleAllDates()); await p.waitForTimeout(800);

  const A1=await p.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('ls_mgmt_state'))||{};
    const g=k=>({memo:(d[k]||{}).memo||'', date:(d[k]||{}).memoDate||null});
    return { arc:g(window.__K_arc), past:g(window.__K_past),
             bodyHasArc: document.body.innerText.indexOf('보관 메모 (130일 전')>=0,
             bodyHasNew: document.body.innerText.indexOf('최근 메모 (5일 전')>=0 };
  });
  chk('보관 메모가 삭제되지 않음(localStorage 원문 유지)', A1.arc.memo.indexOf('보관 메모')>=0 && !!A1.arc.date, JSON.stringify(A1.arc.memo));
  chk('최근 보기에 보관 메모 안 보임', !A1.bodyHasArc);
  chk('최근 보기에 최근 메모 보임', A1.bodyHasNew);

  // 지난 메모 보기 → 보관함 줄 확인
  await p.locator('#memo-past-btn').click(); await p.waitForTimeout(1000);
  await p.evaluate(()=>{ if(!document.body.innerText.match(/▼/)) window.memoToggleAllDates(); }); await p.waitForTimeout(700);
  const A2=await p.evaluate(()=>({
    hasArcLine: document.body.innerText.indexOf('3개월 이전') >= 0,
    showsPast: document.body.innerText.indexOf('지난 메모 (45일 전')>=0,
    showsArc: document.body.innerText.indexOf('보관 메모 (130일 전')>=0 }));
  chk('지난 메모 보기: 1~3개월 메모 표시', A2.showsPast);
  chk('지난 메모 보기: 보관 메모는 접혀 있음', !A2.showsArc);
  chk('보관함 줄 노출', A2.hasArcLine);

  await p.evaluate(()=>window.memoToggleArc()); await p.waitForTimeout(900);
  await p.evaluate(()=>{ var open=(document.body.innerText.match(/▼/g)||[]).length, all=(document.body.innerText.match(/[▼▶]/g)||[]).length; if(open<all) window.memoToggleAllDates(); }); await p.waitForTimeout(700);
  const A3=await p.evaluate(()=>({ showsArc: document.body.innerText.indexOf('보관 메모 (130일 전')>=0 }));
  chk('보관함 펼치면 3개월 이전 메모 표시', A3.showsArc);
  await p.evaluate(()=>{window.memoToggleArc(); window.memoTogglePast();}); await p.waitForTimeout(900);

  // 공지 보관
  const A4=await p.evaluate(()=>{
    const raw=JSON.parse(localStorage.getItem('ls_notices_state'))||{};
    const el=document.getElementById('notice-list');
    return { rawKept: !raw.nb.deleted && !!raw.nb.text,
             visible: el.innerText.indexOf('4개월 전 공지')>=0,
             hasArcLine: el.innerText.indexOf('3개월 이전 공지')>=0,
             todayShown: el.innerText.indexOf('오늘 공지')>=0 };
  });
  chk('공지: 4개월 전 공지가 삭제 표시되지 않음', A4.rawKept);
  chk('공지: 기본 화면에서 숨겨짐', !A4.visible);
  chk('공지: 보관함 줄 노출', A4.hasArcLine);
  chk('공지: 오늘 공지는 그대로 표시', A4.todayShown);
  await p.evaluate(()=>window.noticeToggleArc()); await p.waitForTimeout(700);
  const A5=await p.evaluate(()=>({ v: document.getElementById('notice-list').innerText.indexOf('4개월 전 공지')>=0 }));
  chk('공지: 보관함 펼치면 표시', A5.v);
  await p.evaluate(()=>window.noticeToggleArc()); await p.waitForTimeout(500);

  // ══ B. 제안 등록 (진행 중) ══
  await p.click('.tab[data-tab="whitespace"]'); await p.waitForTimeout(1600);
  const B0=await p.evaluate(()=>({ btns:document.querySelectorAll('#ws-content .ws-propose-btn').length,
                                   badges:document.querySelectorAll('#ws-content .act-badge').length,
                                   th:[...document.querySelectorAll('#ws-content thead th')].map(t=>t.textContent.trim()) }));
  chk('초기: 제안 버튼만 있고 배지 없음', B0.btns>0 && B0.badges===0, 'btn='+B0.btns+' badge='+B0.badges);
  chk('헤더가 "제안 · 상태"', B0.th.some(t=>t.indexOf('제안')>=0 && t.indexOf('상태')>=0), JSON.stringify(B0.th.slice(-3)));

  await p.locator('#ws-content .ws-propose-btn').first().click(); await p.waitForTimeout(800);
  const B1=await p.evaluate(()=>({ row:!!document.getElementById('ls-act-row'),
                                   checked:(document.getElementById('ls-act-on')||{}).checked,
                                   text:(document.getElementById('ls-memo-input')||{}).value,
                                   info:(document.getElementById('ls-act-row')||{}).innerText||'' }));
  chk('제안 등록 토글 노출 + 기본 켜짐', B1.row && B1.checked===true);
  chk('토글에 품목·담당·등록일 자동 표기', /품목/.test(B1.info)&&/담당/.test(B1.info)&&/등록일/.test(B1.info), B1.info.replace(/\n/g,' ').slice(0,90));
  chk('메모 문구 자동 입력', /^\[품목 제안\]/.test(B1.text||''), JSON.stringify(B1.text));

  const KEY=await p.evaluate(()=>document.querySelector('#ws-content .ws-propose-btn').getAttribute('data-mkey'));
  await p.fill('#ls-memo-input','[품목 제안] MRO — 9월 방문 시 절삭공구 카탈로그 전달');
  await p.click('#ls-memo-save'); await p.waitForTimeout(1000);
  const B2=await p.evaluate(k=>{ const a=(window.LS_MGMT[k]||{}).actions||[];
    return { n:a.length, last:a[a.length-1]||null, memo:(window.LS_MGMT[k]||{}).memo||'' }; }, KEY);
  chk('actions 1건 생성 · st=open', B2.n===1 && B2.last && B2.last.st==='open', JSON.stringify(B2.last));
  chk('grp·by·date 자동 입력', B2.last && B2.last.grp && B2.last.by && /^\d{4}-\d{2}-\d{2}$/.test(B2.last.date), JSON.stringify(B2.last));
  chk('메모 본문도 정상 저장', B2.memo.indexOf('절삭공구')>=0);

  const B3=await p.evaluate(()=>{ const b=document.querySelector('#ws-content .act-badge');
    return { badges:document.querySelectorAll('#ws-content .act-badge').length, txt:b?b.title:'' }; });
  chk('목록에 배지로 바뀜', B3.badges===1 && /진행 중/.test(B3.txt||''), JSON.stringify(B3));

  // ══ C. 상태 순환 ══
  await p.locator('#ws-content .act-badge').first().click(); await p.waitForTimeout(500);
  const C1=await p.evaluate(k=>({ st:(window.LS_MGMT[k].actions.slice(-1)[0]||{}).st,
                                  txt:document.querySelector('#ws-content .act-badge').title }), KEY);
  chk('클릭 1회 → 성사', C1.st==='won' && /성사/.test(C1.txt||''), JSON.stringify(C1));
  await p.locator('#ws-content .act-badge').first().click(); await p.waitForTimeout(400);
  const C2=await p.evaluate(k=>({ st:(window.LS_MGMT[k].actions.slice(-1)[0]||{}).st }), KEY);
  chk('클릭 2회 → 실패', C2.st==='lost', C2.st);
  await p.locator('#ws-content .act-badge').first().click(); await p.waitForTimeout(400);
  const C3=await p.evaluate(k=>({ st:(window.LS_MGMT[k].actions.slice(-1)[0]||{}).st }), KEY);
  chk('클릭 3회 → 진행 중 (순환)', C3.st==='open', C3.st);

  const C4=await p.evaluate(()=>{ const r=document.querySelector('#ws-content .ws-row');
    const before=document.querySelectorAll('#ws-content .ws-row').length;
    wsSetSort('tc'); const after=document.querySelectorAll('#ws-content .ws-row').length;
    return { badges:document.querySelectorAll('#ws-content .act-badge').length, before, after }; });
  chk('정렬 후에도 배지 유지', C4.badges===1, JSON.stringify(C4));

  // ══ D. 메모 관리 시트 집계·컬럼 ══
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  const D1=await p.evaluate(()=>{
    const st=document.getElementById('memo-act-stats');
    const ths=[...document.querySelectorAll('#memo-sheet-tbody')[0].closest('table').querySelectorAll('thead th')].map(t=>t.textContent.trim());
    return { statsShown:st && st.style.display==='flex', statsText:(st||{}).innerText||'',
             hasCol: ths.indexOf('제안 상태')>=0, ths:ths,
             badges:document.querySelectorAll('#memo-sheet-tbody .act-badge').length };
  });
  chk('집계 카드 표시', D1.statsShown, (D1.statsText||'').replace(/\n/g,' ').slice(0,70));
  chk('제안 상태 컬럼 추가', D1.hasCol, JSON.stringify(D1.ths));
  await p.evaluate(()=>{ if(!window._memoAllOpen) window.memoToggleAll&&window.memoToggleAll(); });
  await p.waitForTimeout(600);

  // 컬럼 수 = 헤더 수 확인 (레이아웃 깨짐 방지)
  const D2=await p.evaluate(()=>{
    const tbl=document.querySelector('#memo-sheet-tbody').closest('table');
    const n=tbl.querySelectorAll('thead th').length;
    const bad=[...tbl.querySelectorAll('#memo-sheet-tbody tr')].filter(tr=>{
      let c=0; [...tr.children].forEach(td=>c+=(parseInt(td.getAttribute('colspan'))||1));
      return c!==n;
    }).length;
    return {n, bad, rows:tbl.querySelectorAll('#memo-sheet-tbody tr').length};
  });
  chk('모든 행의 셀 수가 헤더와 일치', D2.bad===0, '헤더'+D2.n+'칸 / 불일치 '+D2.bad+'행 / 총 '+D2.rows+'행');

  // ══ E. Firebase 병합에서 actions 보존 ══
  const E1=await p.evaluate(k=>{
    const local=JSON.parse(JSON.stringify(window.LS_MGMT[k]));
    const remote={}; remote[k]={ memo:'다른 PC에서 쓴 최신 메모', memoDate:new Date().toISOString(),
      ts:new Date(Date.now()+60000).toISOString(), comments:[], actions:[] };
    fbMergeMemos(remote);
    const a=(window.LS_MGMT[k]||{}).actions||[];
    return { n:a.length, st:(a.slice(-1)[0]||{}).st, memo:(window.LS_MGMT[k]||{}).memo };
  }, KEY);
  chk('원격이 최신이어도 내 actions 보존', E1.n===1 && E1.st==='open', JSON.stringify(E1));

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close();
  process.exit(bad.length?1:0);
})();
