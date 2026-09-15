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
  await p.click('.tab[data-tab="lowsales"]'); await p.waitForTimeout(1200);

  // ── 제안 없는 상태: 토글이 안 떠야 한다 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1500);
  const Z=await p.evaluate(()=>({tabs:getComputedStyle(document.getElementById('memo-view-tabs')).display,
                                 stats:getComputedStyle(document.getElementById('memo-act-stats')).display}));
  chk('제안 0건이면 토글·카드 숨김', Z.tabs==='none' && Z.stats==='none', JSON.stringify(Z));

  // ── 제안 12건 + 코스 메모 1건 심기 ──
  const SEED=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const firms=Object.keys(info).slice(0,12);
    const G=['전선','조명','부자재','MRO'];
    const ST=['open','open','open','open','open','won','won','lost','open','won','lost','open'];
    const AGE=[3,9,15,22,31,40,55,12,68,7,25,90];
    const D=d=>new Date(Date.now()-d*86400000).toISOString();
    firms.forEach((f,i)=>{
      const it=info[f], k=f+'|||'+it.cos+'|||'+it.ind;
      window.LS_MGMT[k]={checked:false,memo:'제안 메모 '+(i+1),memoDate:D(AGE[i]),memoBy:'박정주',comments:[],
        actions:[{id:'a'+i,grp:G[i%4],by:it.cos,date:D(AGE[i]).slice(0,10),st:ST[i],stAt:D(Math.max(0,AGE[i]-2))}]};
    });
    // 코스 메모에 제안이 붙어 있어도 목록엔 안 나와야 한다
    const cos=[...new Set(rows.map(r=>r.cos))][0];
    window.LS_MGMT['region_'+cos]={checked:false,memo:'코스 메모',memoDate:D(5),memoBy:'박정주',
      actions:[{id:'ax',grp:'조명',by:'',date:D(5).slice(0,10),st:'open',stAt:D(5)}]};
    lsSave();
    return {n:firms.length, cos:cos, open:ST.filter(x=>x==='open').length,
            won:ST.filter(x=>x==='won').length, lost:ST.filter(x=>x==='lost').length};
  });
  await p.evaluate(()=>window.renderMemoSheet()); await p.waitForTimeout(800);

  const T=await p.evaluate(()=>({tabs:getComputedStyle(document.getElementById('memo-view-tabs')).display,
    txt:document.getElementById('memo-view-tabs').innerText.replace(/\n/g,' '),
    view:window._memoView, cards:document.querySelectorAll('.act-stat-card').length}));
  chk('토글 노출 + 제안 건수 표기', T.tabs!=='none' && /제안 13/.test(T.txt), T.txt);
  chk('기본은 메모 뷰', T.view==='memo');
  chk('카드 3장이 클릭 가능', T.cards===3, 'cards='+T.cards);

  // ── 제안 뷰 전환 ──
  await p.evaluate(()=>document.querySelector('.memo-view-btn[data-view="act"]').click());
  await p.waitForTimeout(700);
  const A=await p.evaluate(()=>{
    const tb=document.getElementById('memo-sheet-tbody');
    const rows=[...tb.querySelectorAll('tr')];
    return { view:window._memoView,
      head:[...document.querySelectorAll('#memo-sheet-thead-row th')].map(t=>t.textContent),
      n:rows.length,
      first:rows[0]?rows[0].innerText.replace(/\t/g,' | '):'',
      all:rows.map(r=>r.innerText.replace(/\t/g,'|')),
      count:document.getElementById('memo-sheet-count').textContent,
      sub:document.getElementById('memo-sheet-sub').textContent };
  });
  chk('제안 뷰 헤더 8칸', A.head.length===8 && A.head[0]==='거래처명' && A.head[5]==='경과', JSON.stringify(A.head));
  chk('코스 메모 제외 — 12건만', A.n===12, 'n='+A.n+' count='+A.count);
  chk('부제가 제안 현황으로 바뀜', /제안 현황/.test(A.sub), A.sub.slice(0,30));
  const HB=await p.evaluate(()=>['memo-expand-btn','memo-past-btn'].map(i=>getComputedStyle(document.getElementById(i)).display));
  chk('날짜 그룹 전용 버튼 숨김', HB.every(d=>d==='none'), JSON.stringify(HB));
  chk('가장 오래 방치된 진행 건이 맨 위', /90일/.test(A.first), A.first.slice(0,80));

  const ORD=await p.evaluate(()=>{
    return [...document.querySelectorAll('#memo-sheet-tbody tr')].map(tr=>{
      const td=tr.querySelectorAll('td');
      return {st:td[6].innerText.replace(/\s+/g,''), days:parseInt(td[5].innerText)||0};
    });
  });
  const opens=ORD.filter(r=>/진행 중|진행중/.test(r.st));
  const firstClosed=ORD.findIndex(r=>!/진행 중|진행중/.test(r.st));
  chk('진행 중이 먼저', firstClosed===opens.length, 'open='+opens.length+' firstClosed@'+firstClosed);
  chk('진행 중은 경과일 내림차순', JSON.stringify(opens.map(r=>r.days))===JSON.stringify([...opens.map(r=>r.days)].sort((a,b)=>b-a)), JSON.stringify(opens.map(r=>r.days)));

  const COL=await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('#memo-sheet-tbody tr').forEach(tr=>{
      const td=tr.querySelectorAll('td');
      out.push({st:td[6].innerText.replace(/\s+/g,''), days:parseInt(td[5].innerText)||0, color:td[5].querySelector('b').style.color});
    });
    return out;
  });
  const isO=r=>/진행 중|진행중/.test(r.st);
  const c60=COL.find(r=>isO(r)&&r.days>=60), c30=COL.find(r=>isO(r)&&r.days>=30&&r.days<60), cok=COL.find(r=>isO(r)&&r.days<30);
  chk('60일 이상 진행 = 빨강', c60 && /217, 48, 37|d93025/.test(c60.color), JSON.stringify(c60));
  chk('30~59일 진행 = 주황', c30 && /230, 126, 34|e67e22/.test(c30.color), JSON.stringify(c30));
  chk('30일 미만 = 회색', cok && /95, 99, 104|5f6368/.test(cok.color), JSON.stringify(cok));

  // ── 카드 클릭 필터 ──
  await p.evaluate(()=>document.querySelector('.act-stat-card[data-st="won"]').click());
  await p.waitForTimeout(700);
  const F=await p.evaluate(()=>({filter:window._memoActFilter,
    sts:[...document.querySelectorAll('#memo-sheet-tbody tr')].map(tr=>tr.querySelectorAll('td')[6].innerText.replace(/\s+/g,'')),
    count:document.getElementById('memo-sheet-count').textContent}));
  chk('성사 카드 클릭 → 성사만', F.filter==='won' && F.sts.length===3 && F.sts.every(x=>/성사/.test(x)), JSON.stringify(F));
  await p.evaluate(()=>document.querySelector('.act-stat-card[data-st="won"]').click());
  await p.waitForTimeout(600);
  const F2=await p.evaluate(()=>({filter:window._memoActFilter, n:document.querySelectorAll('#memo-sheet-tbody tr').length}));
  chk('한 번 더 누르면 해제', F2.filter==='' && F2.n===12, JSON.stringify(F2));

  // ── 검색·코스 필터 연동 ──
  await p.evaluate(()=>{ document.getElementById('memo-search').value='조명'; window.renderMemoSheet(); });
  await p.waitForTimeout(600);
  const S=await p.evaluate(()=>[...document.querySelectorAll('#memo-sheet-tbody tr')].map(tr=>{
    const td=tr.querySelectorAll('td'); return {firm:td[0].innerText, grp:td[1].innerText, memo:td[7].innerText}; }));
  chk('검색어가 거래처·품목·메모 중 하나엔 걸림', S.length>0 && S.every(r=>/조명/.test(r.firm+r.grp+r.memo)), JSON.stringify(S.map(r=>r.grp)));
  const anyGrp=S.some(r=>/조명/.test(r.grp));
  chk('품목으로도 검색됨', anyGrp, JSON.stringify(S.map(r=>r.grp)));
  await p.evaluate(()=>{ document.getElementById('memo-search').value=''; window.renderMemoSheet(); });
  await p.waitForTimeout(500);

  // ── 상태 배지 클릭 → 순환 + 즉시 반영 ──
  // 같은 줄을 이어 눌러 진행 중 → 성사 → 실패까지 갈 수 있어야 한다
  const KEY=await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').getAttribute('data-actkey'));
  const seq=[];
  seq.push(await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').innerText.replace(/\s+/g,'')));
  for(let i=0;i<2;i++){
    await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').click());
    await p.waitForTimeout(600);
    seq.push(await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .act-badge').innerText.replace(/\s+/g,'')));
  }
  const rowStays=await p.evaluate(k=>document.querySelector('#memo-sheet-tbody .act-badge').getAttribute('data-actkey')===k, KEY);
  chk('같은 줄에서 진행 중 → 성사 → 실패로 이어 눌림', seq.length===3 && /진행 중|진행중/.test(seq[0]) && /성사/.test(seq[1]) && /실패/.test(seq[2]), JSON.stringify(seq));
  chk('상태를 바꿔도 줄이 제자리', rowStays);
  const B5=await p.evaluate(()=>({view:window._memoView, stats:document.getElementById('memo-act-stats').innerText.replace(/\n/g,' ')}));
  chk('제안 뷰 유지 + 카드 갱신', B5.view==='act' && /진행 중/.test(B5.stats), B5.stats.slice(0,50));

  // ── 메모 뷰 복귀 ──
  await p.evaluate(()=>document.querySelector('.memo-view-btn[data-view="memo"]').click());
  await p.waitForTimeout(800);
  const M=await p.evaluate(()=>({view:window._memoView,
    head:[...document.querySelectorAll('#memo-sheet-thead-row th')].map(t=>t.textContent),
    sub:document.getElementById('memo-sheet-sub').textContent,
    hasDateGroup:document.body.innerText.indexOf('▼')>=0||document.body.innerText.indexOf('▶')>=0,
    filter:window._memoActFilter}));
  chk('메모 뷰 헤더 9칸 복원', M.head.length===9 && M.head[0]==='날짜', JSON.stringify(M.head));
  chk('메모 뷰 부제 복원', /날짜별 그룹/.test(M.sub), M.sub.slice(0,30));
  chk('날짜 그룹 복귀', M.hasDateGroup);
  const HB2=await p.evaluate(()=>['memo-expand-btn','memo-past-btn'].map(i=>getComputedStyle(document.getElementById(i)).display));
  chk('메모 뷰로 오면 버튼 복원', HB2.every(d=>d!=='none'), JSON.stringify(HB2));
  chk('메모 뷰로 오면 상태 필터 해제', M.filter==='');

  // ── 거래처명 클릭 → 기존 이력 모달 ──
  await p.evaluate(()=>document.querySelector('.memo-view-btn[data-view="act"]').click());
  await p.waitForTimeout(700);
  await p.evaluate(()=>document.querySelector('#memo-sheet-tbody .firm-hist-link').click());
  await p.waitForTimeout(700);
  const H=await p.evaluate(()=>!!document.getElementById('drill-memo-preview'));
  chk('거래처명 클릭 → 이력 모달', H);
  await p.evaluate(()=>{const m=document.getElementById('drill-memo-preview'); if(m)m.remove();});

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
