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

  // ══ #2 성장가능 시트 — 칩 ══
  await p.click('.tab[data-tab="growth"]'); await p.waitForTimeout(1800);
  const G0=await p.evaluate(()=>{
    const btn=document.querySelector('.gs-memo-btn');
    if(!btn) return null;
    return {key:btn.getAttribute('data-gskey'), firm:btn.getAttribute('data-firm')};
  });
  chk('성장가능 시트에 메모 버튼 존재', !!G0, JSON.stringify(G0));
  if(G0){
    await p.evaluate(g=>gsOpenMemo(g.key,g.firm), G0); await p.waitForTimeout(600);
    const G1=await p.evaluate(()=>({chips:document.querySelectorAll('.ls-act-chip').length,
      auto:!!document.getElementById('ls-act-on'), open:!!document.getElementById('ls-memo-input')}));
    chk('#2 gsOpenMemo — 칩 4개', G1.open && G1.chips===4 && !G1.auto, JSON.stringify(G1));
    await p.evaluate(()=>{ document.getElementById('ls-memo-input').value='성장가능 메모';
      document.querySelector('.ls-act-chip[data-grp="부자재"]').click();
      document.getElementById('ls-memo-save').click(); });
    await p.waitForTimeout(800);
    const G2=await p.evaluate(k=>{const a=(window.LS_MGMT[k]||{}).actions||[];return a[a.length-1]||null;}, G0.key);
    chk('#2 저장 → 제안 생성 + 담당 채워짐', G2&&G2.grp==='부자재'&&G2.by&&G2.by.length>0, JSON.stringify(G2));
    const G3=await p.evaluate(k=>{const btn=document.querySelector('.gs-memo-btn[data-gskey="'+k+'"]');
      return btn?btn.textContent:'없음';}, G0.key);
    chk('#2 목록의 메모 버튼 아이콘 갱신', G3 && G3!=='없음', JSON.stringify(G3));
  }

  // ══ #5 상품별 드릴 거래처 메모 — 품목 자동 ══
  await p.click('.tab[data-tab="light"]'); await p.waitForTimeout(1800);
  const R0=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const r=rows.find(x=>(x.lc||0)>0);
    if(!r) return null;
    window.showRegFirmGrpProds(r.firm, r.cos, 'light');
    if(typeof _openDrillModal==='function') _openDrillModal();   // 실제로는 드릴 안에서 열리는 화면
    return {firm:r.firm, cos:r.cos};
  });
  await p.waitForTimeout(900);
  const R1=await p.evaluate(()=>({ btn:!!document.querySelector('.regfirm-memo-btn') }));
  chk('상품별 드릴에 거래처 메모 버튼', R1.btn, JSON.stringify(R0));
  if(R1.btn){
    await p.click('.regfirm-memo-btn'); await p.waitForTimeout(700);
    const R2=await p.evaluate(()=>({ auto:!!document.getElementById('ls-act-on'),
      chips:document.querySelectorAll('.ls-act-chip').length,
      txt:(document.querySelector('#ls-memo-modal')||{innerText:''}).innerText.replace(/\n/g,' ') }));
    chk('#5 품목 자동(조명) — 체크박스, 칩 아님', R2.auto && R2.chips===0, 'auto='+R2.auto+' chips='+R2.chips);
    chk('#5 안내에 품목 조명 표기', /품목 조명/.test(R2.txt), R2.txt.slice(0,90));
    await p.evaluate(()=>{ document.getElementById('ls-memo-input').value='상품별에서 남긴 제안 메모';
      document.getElementById('ls-memo-save').click(); });
    await p.waitForTimeout(900);
    const R3=await p.evaluate(f=>{
      const M=window.LS_MGMT; const hit=Object.keys(M).filter(k=>k.indexOf(f.firm)>=0 && M[k]&&(M[k].actions||[]).length);
      return hit.map(k=>({key:k, a:M[k].actions[M[k].actions.length-1]}));
    }, R0);
    chk('#5 제안 1건만 생성(중복 없음)', R3.length===1, JSON.stringify(R3));
    chk('#5 품목=조명 · 담당 채워짐', R3[0]&&R3[0].a.grp==='조명'&&R3[0].a.by, JSON.stringify(R3[0]));
    chk('#5 저장 후 드릴 화면 유지', await p.evaluate(()=>getComputedStyle(document.getElementById('drill-modal')).display!=='none'));
  }
  await p.evaluate(()=>{const m=document.getElementById('drill-modal'); if(m)m.style.display='none'; document.body.style.overflow='';});

  // ══ #4 인사이트 상품 팝업 — 품목 자동 판별 ══
  await p.click('.tab[data-tab="insight"]'); await p.waitForTimeout(1800);
  const I0=await p.evaluate(()=>{
    const row=document.querySelector('.ins-row[data-ins-prod]');
    if(!row) return null; const nm=row.dataset.insProd; row.click(); return nm;
  });
  await p.waitForTimeout(900);
  chk('인사이트 상품 팝업 열림', !!I0, JSON.stringify(I0));
  if(I0){
    const I1=await p.evaluate(()=>({hint:window._drillGrpHint, btn:!!document.querySelector('.drill-firm-memo')}));
    chk('#4 제품군 자동 판별됨', !!I1.hint, JSON.stringify(I1.hint));
    chk('#4 목록에 메모 버튼', I1.btn);
    await p.click('.drill-firm-memo'); await p.waitForTimeout(700);
    const I2=await p.evaluate(()=>({auto:!!document.getElementById('ls-act-on'),
      chips:document.querySelectorAll('.ls-act-chip').length,
      txt:(document.querySelector('#ls-memo-modal')||{innerText:''}).innerText.replace(/\n/g,' ')}));
    chk('#4 품목 자동 — 체크박스', I2.auto && I2.chips===0, 'auto='+I2.auto+' chips='+I2.chips);
    chk('#4 안내에 판별된 품목', new RegExp('품목 '+I1.hint).test(I2.txt), I2.txt.slice(0,90));
    await p.evaluate(()=>{const m=document.getElementById('ls-memo-modal'); if(m)m.remove();});
  }
  await p.evaluate(()=>{const m=document.getElementById('drill-modal'); if(m)m.style.display='none'; document.body.style.overflow='';});

  // ══ #3 검색 거래처 메모 — 칩 ══
  const S0=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const f=rows[10].firm, c=rows[10].cos;
    window.searchFirmMemo(f,c); return {firm:f,cos:c};
  });
  await p.waitForTimeout(700);
  const S1=await p.evaluate(()=>({open:!!document.getElementById('ls-memo-input'),
    chips:document.querySelectorAll('.ls-act-chip').length, auto:!!document.getElementById('ls-act-on'),
    txt:(document.querySelector('#ls-memo-modal')||{innerText:''}).innerText.replace(/\n/g,' ')}));
  chk('#3 searchFirmMemo — 칩 4개', S1.open && S1.chips===4 && !S1.auto, JSON.stringify(S1.chips));
  chk('#3 안내 문구 유지', /검색·지역별·메모 시트와 연동/.test(S1.txt), S1.txt.slice(0,90));
  await p.evaluate(()=>{const m=document.getElementById('ls-memo-modal'); if(m)m.remove();});

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
