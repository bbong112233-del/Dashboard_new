// 제안 메모·실패 사유·상태 변경 이력
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

  // ── 신규 제안에 note/history 가 생기는가 ──
  const F=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const f=window._lsFirms[0].firm, i=info[f], k=f+'|||'+i.cos+'|||'+i.ind;
    window.LS_MGMT[k]={checked:false,memo:'거래처 원래 메모',memoDate:new Date().toISOString(),memoBy:'박정주',comments:[]};
    actAdd(k,'조명',i.cos); lsSave();
    const a=window.LS_MGMT[k].actions[0];
    return {k, firm:f, id:a.id, note:a.note, hist:(a.history||[]).map(h=>h.st)};
  });
  chk('신규 제안에 note 필드', F.note==='', JSON.stringify(F.note));
  chk('신규 제안에 등록 이력 1건', JSON.stringify(F.hist)===JSON.stringify(['open']), JSON.stringify(F.hist));

  // ── 상태를 바꾸면 이력이 쌓인다 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>document.querySelector('.memo-view-btn[data-view="act"]').click());
  await p.waitForTimeout(800);
  await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').click());
  await p.waitForTimeout(600);
  const H1=await p.evaluate(f=>{const a=actFind(f.k,f.id);return {st:a.st,hist:(a.history||[]).map(h=>h.st)};},F);
  chk('진행 중 → 성사 시 이력 누적', H1.st==='won' && JSON.stringify(H1.hist)===JSON.stringify(['open','won']), H1.st+' '+JSON.stringify(H1.hist));

  // ── 실패로 바꾸면 사유 팝오버가 뜬다 ──
  await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').click());
  await p.waitForTimeout(700);
  const R=await p.evaluate(()=>{
    const x=document.getElementById('act-reason-pop');
    return {open:!!x, chips:x?x.querySelectorAll('.act-rsn-chip').length:0,
            skip:!!document.getElementById('act-rsn-skip'), txt:x?x.innerText.replace(/\n/g,' '):''};
  });
  chk('실패 전환 시 사유 팝오버', R.open && R.chips>=4, 'chips='+R.chips);
  chk('건너뛰기 버튼 있음(선택 사항)', R.skip);
  chk('사유 팝오버 안내', /실패 사유/.test(R.txt), R.txt.slice(0,40));
  await p.evaluate(()=>{ document.getElementById('act-rsn-txt').value='타사 단가 우위';
                         document.getElementById('act-rsn-save').click(); });
  await p.waitForTimeout(700);
  const H2=await p.evaluate(f=>{const a=actFind(f.k,f.id);
    return {st:a.st, note:a.note, hist:(a.history||[]).map(h=>h.st), popGone:!document.getElementById('act-reason-pop')};},F);
  chk('사유가 제안에 저장됨', H2.note==='타사 단가 우위', JSON.stringify(H2.note));
  chk('이력 3단계 누적', JSON.stringify(H2.hist)===JSON.stringify(['open','won','lost']), JSON.stringify(H2.hist));
  chk('팝오버 닫힘', H2.popGone);

  // ── 진행 중·성사로 바꿀 때는 안 묻는다 ──
  await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').click());
  await p.waitForTimeout(600);
  const R2=await p.evaluate(()=>({pop:!!document.getElementById('act-reason-pop'),
                                   st:document.querySelector('#memo-sheet-tbody .act-badge').title}));
  chk('진행 중 복귀 시엔 안 물음', !R2.pop, R2.st.slice(0,20));

  // ── 제안 메모 칸에서 직접 편집 ──
  const C=await p.evaluate(()=>{
    const cell=document.querySelector('#memo-sheet-tbody .act-note-cell');
    return {exists:!!cell, txt:cell?cell.textContent.trim():''};
  });
  chk('제안 메모 칸 존재', C.exists, JSON.stringify(C.txt));
  await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-note-cell').click());
  await p.waitForTimeout(600);
  await p.evaluate(()=>{ document.getElementById('act-rsn-txt').value='9월 3주차 재방문 예정';
                         document.getElementById('act-rsn-save').click(); });
  await p.waitForTimeout(700);
  const C2=await p.evaluate(f=>({note:actFind(f.k,f.id).note,
    cellTxt:(document.querySelector('#memo-sheet-tbody .act-note-cell')||{}).textContent||''}),F);
  chk('메모 칸으로 제안 메모 수정', C2.note==='9월 3주차 재방문 예정', JSON.stringify(C2.note));
  chk('화면에 반영됨', /재방문 예정/.test(C2.cellTxt), JSON.stringify(C2.cellTxt.trim()));
  const C3=await p.evaluate(()=>{
    const tr=document.querySelector('#memo-sheet-tbody tr');
    return tr.innerText.replace(/\n/g,' | ');
  });
  chk('거래처 메모도 같이 보임', /거래처 메모 · 거래처 원래 메모/.test(C3), C3.slice(0,90));

  // ── 동기화 병합에서 이력·메모가 살아남는가 ──
  const M=await p.evaluate(f=>{
    const local=JSON.parse(JSON.stringify(window.LS_MGMT[f.k]));
    // 다른 PC에서 같은 제안을 '성사'로 바꾸고 메모를 적은 상황
    const remote={}; const ra=JSON.parse(JSON.stringify(local));
    const a=ra.actions[0];
    a.st='won'; a.stAt=new Date(Date.now()+60000).toISOString();
    a.history=[{st:'open',at:a.history[0].at,by:a.by},{st:'won',at:a.stAt,by:a.by}];
    a.note='원격에서 적은 메모'; a.noteAt=new Date(Date.now()+60000).toISOString();
    remote[f.k]=ra;
    fbMergeMemos(remote);
    const m=actFind(f.k,f.id);
    return {st:m.st, note:m.note, hist:(m.history||[]).map(h=>h.st)};
  }, F);
  chk('병합 후 최신 상태 채택', M.st==='won', M.st);
  chk('병합 후 이력 합집합 유지', M.hist.length>=3 && M.hist.indexOf('lost')>=0, JSON.stringify(M.hist));
  chk('병합 후 최신 메모 채택', M.note==='원격에서 적은 메모', JSON.stringify(M.note));

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
