const {launch,URL,FIXTURE}=require('./_harness');
const ok=[], bad=[];
function chk(n,c,d){ (c?ok:bad).push(n+(d?' — '+d:'')); }
(async()=>{
  const b=await launch();
  const p=await b.newPage({viewport:{width:1560,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(()=>{const g=document.getElementById('auth-gate'); if(g)g.remove();});
  await p.evaluate(()=>{try{localStorage.setItem('memo_author_name','박정주');}catch(e){}});
  await p.setInputFiles('#file-input',FIXTURE); await p.waitForTimeout(4000);

  await p.click('.tab[data-tab="whitespace"]'); await p.waitForTimeout(1500);

  // 1) 버튼 존재
  const btn=p.locator('#ws-filter button:has-text("일괄 메모")');
  chk('일괄 메모 버튼 표시', await btn.count()===1, '개수='+await btn.count());

  // 2) 기본 필터(MRO 미취급)에서 열기 — 문구 자동 입력 / 초기 선택 0
  const rowsBefore=await p.locator('#ws-content .ws-row').count();
  await btn.click(); await p.waitForTimeout(600);
  let st=await p.evaluate(()=>({
    open:!!document.getElementById('bulk-memo-modal'),
    title:(document.querySelector('#bulk-memo-modal div div')||{}).textContent||'',
    desc:(document.querySelectorAll('#bulk-memo-modal div div')[1]||{}).textContent||'',
    items:document.querySelectorAll('#sbulk-list .sbulk-chk').length,
    checked:document.querySelectorAll('#sbulk-list .sbulk-chk:checked').length,
    text:(document.getElementById('sbulk-text')||{}).value,
    info:(document.getElementById('sbulk-info')||{}).textContent,
  }));
  chk('모달 열림', st.open);
  chk('제목에 필터 표기', /품목 확대 기회/.test(st.title)&&/MRO/.test(st.title), st.title);
  chk('목록 개수 = 표 행 수', st.items===rowsBefore, st.items+' vs '+rowsBefore);
  chk('초기 선택 0개', st.checked===0 && /0개 선택/.test(st.info||''), 'checked='+st.checked+' / '+st.info);
  chk('문구 자동 입력', st.text==='[품목 제안] MRO — ', JSON.stringify(st.text));

  // 3) 키 체계가 lsMgmtKey와 일치하는지
  const keyOk=await p.evaluate(()=>{
    const first=window._wsSorted[0];
    const dom=document.querySelector('#sbulk-list .sbulk-chk').getAttribute('data-k');
    return {expect:lsMgmtKey(first.firm,first.cos,first.ind), got:dom};
  });
  chk('메모 키 = lsMgmtKey', keyOk.expect===keyOk.got, keyOk.expect+' / '+keyOk.got);

  // 4) 2개 선택 후 저장 → LS_MGMT 반영 + 📝 갱신
  const target=await p.evaluate(()=>{
    const chks=[...document.querySelectorAll('#sbulk-list .sbulk-chk')].slice(0,2);
    chks.forEach(c=>{ c.checked=true; c.dispatchEvent(new Event('change')); });
    return chks.map(c=>c.getAttribute('data-k'));
  });
  await p.fill('#sbulk-text','[품목 제안] MRO — 9월 방문 시 절삭공구 카탈로그 전달');
  await p.click('#sbulk-save'); await p.waitForTimeout(1200);
  const saved=await p.evaluate((keys)=>({
    modalGone:!document.getElementById('bulk-memo-modal'),
    memos:keys.map(k=>({k:k, memo:(window.LS_MGMT[k]||{}).memo||'', by:(window.LS_MGMT[k]||{}).memoBy||''})),
    memoIcons:[...document.querySelectorAll('#ws-content .ws-row')].filter(r=>r.lastElementChild.textContent.trim()==='📝').length,
  }), target);
  chk('모달 닫힘', saved.modalGone);
  chk('메모 2건 저장', saved.memos.every(m=>m.memo.indexOf('절삭공구')>=0), JSON.stringify(saved.memos.map(m=>m.memo.slice(0,20))));
  chk('작성자 기록', saved.memos.every(m=>m.by==='박정주'), JSON.stringify(saved.memos.map(m=>m.by)));
  chk('표의 📝 갱신됨', saved.memoIcons>=2, '아이콘='+saved.memoIcons);

  // 5) 필터·정렬 유지 확인
  const keep=await p.evaluate(()=>({filter:window._wsFilter, sort:JSON.stringify(window._wsSort), rows:document.querySelectorAll('#ws-content .ws-row').length}));
  chk('저장 후 필터 유지', keep.filter==='mro', keep.filter);
  chk('저장 후 행 수 유지', keep.rows===rowsBefore, keep.rows+' vs '+rowsBefore);

  // 6) 재저장 시 기존 메모는 댓글로 붙는지
  await btn.click(); await p.waitForTimeout(500);
  await p.evaluate((k)=>{ const c=document.querySelector('#sbulk-list .sbulk-chk[data-k="'+k.replace(/"/g,'\\"')+'"]'); if(c){c.checked=true;c.dispatchEvent(new Event('change'));} }, target[0]);
  await p.fill('#sbulk-text','방문 완료 · 견적 요청 받음');
  await p.click('#sbulk-save'); await p.waitForTimeout(1000);
  const cm=await p.evaluate((k)=>{ const e=window.LS_MGMT[k]||{}; return {memo:e.memo||'', n:(e.comments||[]).length, last:((e.comments||[]).slice(-1)[0]||{}).text||''}; }, target[0]);
  chk('본문 덮어쓰지 않음', cm.memo.indexOf('절삭공구')>=0, cm.memo.slice(0,25));
  chk('댓글로 추가됨', cm.n===1 && cm.last==='방문 완료 · 견적 요청 받음', 'n='+cm.n+' / '+cm.last);

  // 7) 「전체」 필터에서는 문구 빈칸
  await p.click('#ws-filter .ws-chip:has-text("전체")'); await p.waitForTimeout(900);
  await btn.click(); await p.waitForTimeout(600);
  const allf=await p.evaluate(()=>({text:(document.getElementById('sbulk-text')||{}).value, title:(document.querySelector('#bulk-memo-modal div div')||{}).textContent||'', items:document.querySelectorAll('#sbulk-list .sbulk-chk').length}));
  chk('전체 필터: 문구 빈칸', allf.text==='', JSON.stringify(allf.text));
  chk('전체 필터: 제목 표기', /전체/.test(allf.title), allf.title);
  await p.click('#sbulk-cancel'); await p.waitForTimeout(300);

  // 8) 회귀: 기존 3개 시트 일괄 메모
  for(const [tab,fn,label] of [['lowsales','ls','저매출'],['growth','gs','성장가능'],['highsales','hs','고매출']]){
    await p.click('.tab[data-tab="'+tab+'"]'); await p.waitForTimeout(1300);
    await p.evaluate(w=>openSheetBulkMemo(w), fn); await p.waitForTimeout(500);
    const s=await p.evaluate(()=>({open:!!document.getElementById('bulk-memo-modal'), items:document.querySelectorAll('#sbulk-list .sbulk-chk').length, checked:document.querySelectorAll('#sbulk-list .sbulk-chk:checked').length}));
    chk(label+' 일괄 메모 정상', s.open&&s.items>0&&s.checked===0, 'items='+s.items+' checked='+s.checked);
    await p.evaluate(()=>{const m=document.getElementById('bulk-memo-modal'); if(m)m.remove();});
  }

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close();
  process.exit(bad.length?1:0);
})();
