const {launch,URL,FIXTURE}=require('./_harness');
const ok=[],bad=[];
function chk(n,c,d){ (c?ok:bad).push(n+(d?' — '+d:'')); }
(async()=>{
  const b=await launch();
  const p=await b.newPage({viewport:{width:1560,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(()=>{const g=document.getElementById('auth-gate');if(g)g.remove();try{localStorage.setItem('memo_author_name','박정주');}catch(e){}});
  await p.setInputFiles('#file-input',FIXTURE); await p.waitForTimeout(4500);
  await p.click('.tab[data-tab="lowsales"]'); await p.waitForTimeout(1500);

  const F=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const cos=[...new Set(rows.map(r=>r.cos))][0];
    const f=window._lsFirms[0].firm, i=info[f];
    const f2=window._lsFirms[1].firm, i2=info[f2];
    const D=d=>new Date(Date.now()-d*86400000).toISOString();
    const kA=f+'|||'+i.cos+'|||'+i.ind;
    window.LS_MGMT[kA]={checked:false,memo:'저매출 시트에서 쓴 원래 메모',memoDate:D(20),memoBy:'박정주',comments:[]};
    window.LS_MGMT['region_'+cos]={checked:false,memo:'코스 전체 방문 계획',memoDate:D(8),memoBy:'박정주',comments:[]};
    window.LS_MGMT['region_'+f2]={checked:false,memo:'거래처 메모만 있는 곳',memoDate:D(6),memoBy:'박정주',comments:[]};
    lsSave();
    return {firm:f,cos:i.cos,ind:i.ind,kA:kA,cosName:cos,firm2:f2};
  });

  // ── (a) _actByFromKey ──
  const A=await p.evaluate(f=>({
    byFirmKey:_actByFromKey('region_'+f.firm),
    byCosKey:_actByFromKey('region_'+f.cosName),
    byPipe:_actByFromKey(f.kA),
    byHs:_actByFromKey('hs_'+f.kA)
  }), F);
  chk('region_거래처 → 담당 코스가 나온다', A.byFirmKey===F.cos, JSON.stringify(A.byFirmKey)+' vs '+F.cos);
  chk('region_코스 → 담당 없음(빈 값)', A.byCosKey==='', JSON.stringify(A.byCosKey));
  chk('|||키 회귀', A.byPipe===F.cos, A.byPipe);
  chk('hs_키 회귀', A.byHs===F.cos, A.byHs);

  // ── (b) 기존 메모 키 우선 ──
  await p.evaluate(f=>window.regFirmMemo(f.firm, f.cos, 'light'), F);
  await p.waitForTimeout(600);
  const B1=await p.evaluate(()=>(document.getElementById('ls-memo-input')||{}).value||'');
  chk('regFirmMemo 가 기존 메모를 연다', B1.indexOf('저매출 시트에서 쓴 원래 메모')>=0, JSON.stringify(B1));
  await p.evaluate(()=>{ const i=document.getElementById('ls-memo-input'); i.value='상품별 팝업에서 고친 메모'; document.getElementById('ls-memo-save').click(); });
  await p.waitForTimeout(700);
  const B2=await p.evaluate(f=>{
    const M=window.LS_MGMT, out={};
    Object.keys(M).forEach(k=>{ if(k.indexOf(f.firm)>=0 && M[k]&&M[k].memo) out[k]=M[k].memo; });
    return out;
  }, F);
  chk('저장 후 키가 갈라지지 않는다', Object.keys(B2).length===1 && !!B2[F.kA], JSON.stringify(B2));

  await p.evaluate(f=>window.searchFirmMemo(f.firm, f.cos), F); await p.waitForTimeout(600);
  const B3=await p.evaluate(()=>(document.getElementById('ls-memo-input')||{}).value||'');
  chk('searchFirmMemo 도 기존 메모를 연다', B3.indexOf('상품별 팝업에서 고친 메모')>=0, JSON.stringify(B3));
  await p.evaluate(()=>{const m=document.getElementById('ls-memo-modal');if(m)m.remove();});

  // 메모가 없는 거래처는 region_ 신규 생성 (회귀)
  const B4=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const none=[...new Set(rows.map(r=>r.firm))].find(f=>!(_firmMemoIndex()||{})[f]);
    window.regFirmMemo(none,'','light');
    const k=(function(){ const i=document.getElementById('ls-memo-input'); return i?'opened':'no'; })();
    return {firm:none, opened:k};
  });
  await p.evaluate(()=>{ const i=document.getElementById('ls-memo-input'); if(i){i.value='신규 메모'; document.getElementById('ls-memo-save').click();} });
  await p.waitForTimeout(600);
  const B5=await p.evaluate(f=>!!(window.LS_MGMT['region_'+f]&&window.LS_MGMT['region_'+f].memo), B4.firm);
  chk('메모 없는 거래처는 region_ 신규 생성(회귀)', B5, B4.firm);

  // ── (c) 메모 시트 코스 행에 ＋제안 숨김 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  await p.evaluate(()=>{ if(document.body.innerText.indexOf('▶')>=0) window.memoToggleAllDates(); });
  await p.waitForTimeout(900);
  const C=await p.evaluate(f=>{
    const links=[...document.querySelectorAll('.act-pick-link')].map(x=>x.getAttribute('data-actkey'));
    // 코스 행 자체는 표에 있어야 한다 (숨긴 건 링크뿐)
    const rowsTxt=document.getElementById('memo-sheet-tbody').innerText;
    return { links:links, hasCosKey:links.indexOf('region_'+f.cosName)>=0,
             cosRowShown:rowsTxt.indexOf('코스 전체 방문 계획')>=0,
             hasFirmKey:links.indexOf('region_'+f.firm2)>=0 };
  }, F);
  chk('코스 메모 행에 ＋제안 링크 없음', !C.hasCosKey, JSON.stringify(C.links));
  chk('코스 메모 행 자체는 그대로 보인다', C.cosRowShown);
  chk('거래처 메모 행에는 ＋제안 유지', C.hasFirmKey, JSON.stringify(C.links));

  // 거래처 메모에 등록 → 담당이 채워지는지
  const D2=await p.evaluate(f=>{
    const k='region_'+f.firm2;
    const el=[...document.querySelectorAll('.act-pick-link')].find(x=>x.getAttribute('data-actkey')===k);
    if(!el) return 'no-link';
    window.actPickOpen(k, el);
    const c=document.querySelector('#act-pick-pop .act-pick-chip[data-grp="조명"]');
    if(!c) return 'no-pop'; c.click();
    const a=(window.LS_MGMT[k].actions||[])[0]||{};
    return {by:a.by, grp:a.grp, date:a.date, memoDate:(window.LS_MGMT[k].memoDate||'').slice(0,10)};
  }, F);
  chk('거래처 메모 제안 등록 시 담당이 채워짐', D2 && D2.by && D2.by.length>0, JSON.stringify(D2));
  chk('등록일 = 오늘', D2 && D2.date===new Date().toISOString().slice(0,10), JSON.stringify(D2));
  chk('메모 작성일은 건드리지 않음', D2 && D2.memoDate && D2.memoDate!==D2.date, JSON.stringify(D2));
  // 총 건수가 아니라 "코스 키에 제안이 붙었는가"를 직접 본다
  //   (#5 regFirmMemo 가 품목 자동 등록을 하게 되면서 정상적인 제안 건수는 늘어난다)
  const S=await p.evaluate(()=>{
    const M=window.LS_MGMT||{}, cosKeys=[], firmKeys=[];
    const rows=(window._allRows||GDATA.allRows||[]);
    const cosSet=new Set(rows.map(r=>r.cos));
    Object.keys(M).forEach(k=>{
      if(!((M[k]||{}).actions||[]).length) return;
      if(k.indexOf('region_')===0 && cosSet.has(k.slice(7))) cosKeys.push(k); else firmKeys.push(k);
    });
    return {cosKeys, firmKeys, stats:actStats()};
  });
  chk('코스 키에는 제안이 없다', S.cosKeys.length===0, JSON.stringify(S.cosKeys));
  chk('제안은 전부 거래처 키', S.firmKeys.length===S.stats.open, JSON.stringify(S.firmKeys)+' vs open='+S.stats.open);

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
