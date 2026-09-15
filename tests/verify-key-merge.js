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

  // ── 고매출 시트가 이제 거래처 키를 쓰는가 ──
  await p.click('.tab[data-tab="highsales"]'); await p.waitForTimeout(1600);
  const K=await p.evaluate(()=>{
    const btn=document.querySelector('.hs-memo-btn');
    if(!btn) return null;
    const k=btn.getAttribute('data-lskey'), f=btn.getAttribute('data-firm');
    const rows=(window._allRows||GDATA.allRows||[]); const r=rows.find(x=>x.firm===f);
    return {key:k, firm:f, plain:f+'|||'+r.cos+'|||'+r.ind};
  });
  chk('고매출 시트에 메모 버튼 존재', !!K, JSON.stringify(K&&K.firm));
  chk('고매출 키에 hs_ 접두사 없음', K && K.key.indexOf('hs_')!==0, K&&K.key);
  chk('저매출 계열과 같은 키', K && K.key===K.plain, K&&(K.key+' vs '+K.plain));

  // ── 옛 hs_ 데이터가 합쳐지는가 (본문 충돌 포함) ──
  const M=await p.evaluate(f=>{
    const rows=(window._allRows||GDATA.allRows||[]); const r=rows.find(x=>x.firm===f);
    const plain=f+'|||'+r.cos+'|||'+r.ind, hs='hs_'+plain;
    const D=d=>new Date(Date.now()-d*86400000).toISOString();
    window.LS_MGMT[plain]={checked:false,memo:'관리 시트에서 쓴 메모',memoDate:D(10),memoBy:'박정주',
      comments:[{id:'c1',name:'장주운',text:'단가표 보냈습니다',date:D(9)}],
      actions:[{id:'a1',grp:'조명',by:r.cos,date:D(10).slice(0,10),st:'open',stAt:D(10)}]};
    window.LS_MGMT[hs]={checked:false,memo:'고매출 시트에서 쓴 다른 메모',memoDate:D(30),memoBy:'장주운',
      comments:[{id:'c2',name:'박정주',text:'방문 예정',date:D(29)}],
      actions:[{id:'a2',grp:'전선',by:r.cos,date:D(30).slice(0,10),st:'won',stAt:D(25)},
               {id:'a3',grp:'조명',by:r.cos,date:D(40).slice(0,10),st:'lost',stAt:D(38)}]};
    _syncOrigSave ? _syncOrigSave() : lsSave();
    const moved=_migrateHsKeys();
    const e=window.LS_MGMT[plain];
    return {moved:moved, hsGone:!window.LS_MGMT[hs], plain:plain,
      memo:e.memo, cmts:(e.comments||[]).map(c=>c.text),
      acts:(e.actions||[]).map(a=>a.grp+':'+a.st)};
  }, K.firm);
  chk('마이그레이션 실행됨', M.moved===true);
  chk('hs_ 키 제거됨', M.hsGone);
  chk('최신 메모가 본문으로 남음', M.memo==='관리 시트에서 쓴 메모', JSON.stringify(M.memo));
  chk('밀려난 고매출 메모는 댓글로 보존', M.cmts.some(t=>/고매출 시트에 있던 메모/.test(t)&&/고매출 시트에서 쓴 다른 메모/.test(t)), JSON.stringify(M.cmts));
  chk('양쪽 댓글 모두 보존', M.cmts.some(t=>/단가표/.test(t)) && M.cmts.some(t=>/방문 예정/.test(t)), JSON.stringify(M.cmts));
  chk('제안은 품목당 하나로', M.acts.length===2, JSON.stringify(M.acts));
  chk('같은 품목은 최신 상태가 남음(조명=진행 중)', M.acts.indexOf('조명:open')>=0 && M.acts.indexOf('전선:won')>=0, JSON.stringify(M.acts));

  // ── 한쪽만 있을 때는 그대로 이동 ──
  const M2=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const r=rows[30], plain=r.firm+'|||'+r.cos+'|||'+r.ind, hs='hs_'+plain;
    delete window.LS_MGMT[plain];
    window.LS_MGMT[hs]={checked:false,memo:'고매출 메모만 있는 경우',memoDate:new Date().toISOString(),memoBy:'박정주',comments:[]};
    _migrateHsKeys();
    return {moved:!!window.LS_MGMT[plain], memo:(window.LS_MGMT[plain]||{}).memo, hsGone:!window.LS_MGMT[hs]};
  });
  chk('짝이 없으면 그대로 옮겨짐', M2.moved && M2.memo==='고매출 메모만 있는 경우' && M2.hsGone, JSON.stringify(M2));

  // ── 거래처 이력이 한 줄로 합쳐졌는가 ──
  const H=await p.evaluate(f=>{
    const h=_firmHistory(f);
    return {memos:h.filter(x=>x.t==='memo').length, srcs:[...new Set(h.map(x=>x.src))]};
  }, K.firm);
  chk('거래처 이력의 메모가 1건으로', H.memos===1, 'memos='+H.memos+' srcs='+JSON.stringify(H.srcs));

  // ── 메모 시트 구분 배지가 매출로 정해지는가 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>{ if(document.body.innerText.indexOf('▶')>=0) window.memoToggleAllDates(); });
  await p.waitForTimeout(800);
  const B=await p.evaluate(f=>{
    const tr=[...document.querySelectorAll('#memo-sheet-tbody tr')].find(r=>r.innerText.indexOf(f)>=0);
    const rows=(window._allRows||GDATA.allRows||[]);
    let tc=0; rows.forEach(r=>{ if(r.firm===f) tc+=r.tc||0; });
    return {txt:tr?tr.innerText.replace(/\t/g,'|'):'', tc:tc};
  }, K.firm);
  chk('고매출 거래처는 고매출 배지', /고매출/.test(B.txt), 'tc='+B.tc.toLocaleString()+' | '+B.txt.slice(0,70));

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
