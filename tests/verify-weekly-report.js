// 제안 주간 요약 — 이번 주 성사·실패·신규·방치 건을 보고용 텍스트로
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

  // 이번 주/지난주에 걸친 제안들을 심는다
  const S=await p.evaluate(()=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const firms=Object.keys(info).slice(0,8);
    const now=new Date(), mon=new Date(now); mon.setHours(0,0,0,0);
    mon.setDate(mon.getDate()-((mon.getDay()+6)%7));            // 이번 주 월요일
    const inWeek=new Date(mon.getTime()+2*86400000).toISOString();   // 이번 주 수요일
    const lastWeek=new Date(mon.getTime()-4*86400000).toISOString(); // 지난주
    const D=d=>new Date(Date.now()-d*86400000).toISOString();
    function put(i,grp,st,stAt,date,note){
      const f=firms[i], it=info[f], k=f+'|||'+it.cos+'|||'+it.ind;
      window.LS_MGMT[k]={checked:false,memo:'메모'+i,memoDate:D(5),memoBy:'박정주',comments:[],
        actions:[{id:'a'+i,grp:grp,by:it.cos,date:date,st:st,stAt:stAt,note:note||'',
                  history:[{st:'open',at:date,by:it.cos}]}]};
      return f;
    }
    const r={};
    r.won1 = put(0,'조명','won', inWeek, D(20).slice(0,10), '');                 // 이번 주 성사
    r.won2 = put(1,'전선','won', inWeek, D(9).slice(0,10), '');                  // 이번 주 성사
    r.lost1= put(2,'MRO','lost', inWeek, D(15).slice(0,10), '타사 단가 우위');    // 이번 주 실패(사유 있음)
    r.lost2= put(3,'부자재','lost', inWeek, D(11).slice(0,10), '');               // 이번 주 실패(사유 없음)
    r.oldWon=put(4,'조명','won', lastWeek, D(40).slice(0,10), '');               // 지난주 성사 → 제외돼야
    r.stale= put(5,'전선','open', D(70), D(70).slice(0,10), '재연락 필요');       // 70일 방치
    r.stale2=put(6,'MRO','open', D(35), D(35).slice(0,10), '');                  // 35일 방치
    r.fresh= put(7,'부자재','open', D(1), new Date(mon.getTime()+86400000).toISOString().slice(0,10), ''); // 이번 주 신규
    lsSave();
    return r;
  });

  const T=await p.evaluate(()=>window.actWeeklyReport());
  const lines=T.split('\n');
  chk('제목·기간 표기', /📋 제안 주간 요약\s+\(\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2}\)/.test(lines[0]), lines[0]);
  chk('이번 주 성사 2건', /■ 이번 주 성사\s+2건/.test(T), (T.match(/■ 이번 주 성사.*/)||[''])[0]);
  chk('이번 주 실패 2건', /■ 이번 주 실패\s+2건/.test(T), (T.match(/■ 이번 주 실패.*/)||[''])[0]);
  chk('지난주 성사는 제외', T.indexOf(S.oldWon)<0, S.oldWon);
  chk('성사 건에 소요일 표기', /\(소요 \d+일\)/.test(T), (T.match(/.*소요 \d+일.*/)||[''])[0].trim());
  chk('실패 사유가 붙음', T.indexOf('타사 단가 우위')>=0);
  chk('사유 없는 실패는 표시됨', /사유 미기재/.test(T), (T.match(/.*사유 미기재.*/)||[''])[0].trim());
  chk('이번 주 신규 제안 집계', /■ 이번 주 신규 제안\s+1건/.test(T), (T.match(/■ 이번 주 신규.*/)||[''])[0]);
  chk('30일 이상 방치 2건', /■ 30일 이상 방치\s+2건/.test(T), (T.match(/■ 30일 이상 방치.*/)||[''])[0]);
  const si=T.indexOf('방치'), a=T.indexOf(S.stale,si), b2=T.indexOf(S.stale2,si);
  chk('방치는 오래된 순', a>=0 && b2>=0 && a<b2, 'stale70@'+a+' stale35@'+b2);
  chk('전체 집계 줄', /■ 전체\s+진행 중 \d+ · 성사 \d+ · 실패 \d+/.test(T), (T.match(/■ 전체.*/)||[''])[0]);

  // ── 코스 필터가 반영되는가 ──
  const FT=await p.evaluate(s=>{
    const rows=(window._allRows||GDATA.allRows||[]);
    const cos=rows.find(r=>r.firm===s.won1).cos;
    window._dashSelectedCos=new Set([cos]);
    const t=window.actWeeklyReport();
    window._dashSelectedCos=new Set();
    return {cos:cos, hasScope:/대상: 코스/.test(t), hasWon1:t.indexOf(s.won1)>=0,
            shorter:t.length < window.actWeeklyReport().length};
  }, S);
  chk('필터 시 대상 범위 표기', FT.hasScope, FT.cos);
  chk('필터가 실제로 좁힌다', FT.shorter || FT.hasWon1, 'shorter='+FT.shorter);

  // ── 버튼·모달·복사 ──
  await p.click('.tab[data-tab="memo"]'); await p.waitForTimeout(1600);
  const B0=await p.evaluate(()=>!!document.getElementById('act-week-btn'));
  chk('메모 뷰에는 주간 요약 버튼 없음', !B0);
  await p.evaluate(()=>document.querySelector('.memo-view-btn[data-view="act"]').click());
  await p.waitForTimeout(800);
  const B1=await p.evaluate(()=>{const x=document.getElementById('act-week-btn');
    return {exists:!!x, txt:x?x.textContent.trim():''};});
  chk('제안 뷰에 주간 요약 버튼', B1.exists && /주간 요약/.test(B1.txt), B1.txt);
  await p.evaluate(()=>document.getElementById('act-week-btn').click());
  await p.waitForTimeout(700);
  const M=await p.evaluate(()=>{
    const m=document.getElementById('act-week-modal');
    const ta=document.getElementById('act-week-txt');
    return {open:!!m, readonly:ta?ta.readOnly:false, len:ta?ta.value.length:0,
            copy:!!document.getElementById('act-week-copy'), close:!!document.getElementById('act-week-close')};
  });
  chk('모달 열림 + 텍스트 채워짐', M.open && M.len>200, 'len='+M.len);
  chk('읽기 전용 · 복사/닫기 버튼', M.readonly && M.copy && M.close);
  await p.evaluate(()=>document.getElementById('act-week-close').click());
  await p.waitForTimeout(400);
  chk('닫기 동작', await p.evaluate(()=>!document.getElementById('act-week-modal')));

  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  console.log('\nPAGE ERRORS:', errs);
  await b.close(); process.exit(bad.length?1:0);
})();
