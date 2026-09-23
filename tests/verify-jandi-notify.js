// 잔디 알림: 제안을 등록하면 팀 대화방으로 한 번만 나가는지, 설정이 없으면 조용한지,
// 실패했을 때 사용자가 알 수 있는지를 확인한다.
// 실제 잔디로는 보내지 않는다 — wh.jandi.com 요청을 가로채 내용만 들여다본다.
const {launch,URL,FIXTURE}=require('./_harness');
const ok=[], bad=[];
function chk(n,c,d){ (c?ok:bad).push(n+(d?' — '+d:'')); }

(async()=>{
  const b=await launch();
  const p=await b.newPage({viewport:{width:1560,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));

  let sent=[], failNext=false;
  await p.route('https://wh.jandi.com/**', async route=>{
    const req=route.request();
    sent.push({ method:req.method(), headers:req.headers(), body:req.postData() });
    if(failNext) return route.fulfill({status:500, headers:{'Access-Control-Allow-Origin':'*'}, body:'nope'});
    route.fulfill({status:200, headers:{'Access-Control-Allow-Origin':'*'}, contentType:'application/json', body:'{}'});
  });

  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(()=>{const g=document.getElementById('auth-gate'); if(g)g.remove();
    try{ localStorage.setItem('memo_author_name','박정주'); localStorage.setItem('sync_team_name','영업5팀'); }catch(e){}});
  await p.setInputFiles('#file-input',FIXTURE); await p.waitForTimeout(4500);

  // 테스트용 메모 3건 (거래처마다 따로 — 앞 단계가 뒤 단계를 오염시키지 않게)
  await p.evaluate(()=>{
    const rows=(window._allRows||[]);
    const info={}; rows.forEach(r=>{ if(!info[r.firm]) info[r.firm]={cos:r.cos,ind:r.ind}; });
    const F=Object.keys(info);
    window.__mk=(n,memo)=>{ const f=F[n], i=info[f], k=f+'|||'+i.cos+'|||'+i.ind;
      window.LS_MGMT[k]={checked:false,memo:memo,memoDate:new Date().toISOString(),memoBy:'박정주'};
      return {k:k, firm:f, cos:i.cos, ind:i.ind}; };
    window.__A=window.__mk(3,'조명 견적 요청 있었음');
    window.__B=window.__mk(6,'부자재 단가 문의');
    window.__C=window.__mk(9,'전선 재고 문의');
    lsSave();
  });

  // ── 1. 설정이 없으면 아무것도 보내지 않는다 ──
  await p.evaluate(()=>{ try{localStorage.removeItem('jandi_cfg');}catch(e){} actAdd(window.__A.k,'조명','박정주'); lsSave(); });
  await p.waitForTimeout(700);
  chk('설정 없는 팀: 잔디로 아무것도 보내지 않음', sent.length===0, sent.length+'건');
  chk('설정 없어도 제안은 정상 등록', await p.evaluate(()=>actList(window.__A.k).length===1));

  // ── 2. 설정하면 보낸다 ──
  sent=[];
  await p.evaluate(()=>{
    localStorage.setItem('jandi_cfg', JSON.stringify({'영업5팀':{url:'https://wh.jandi.com/connect-api/webhook/TEST',on:true,withMemo:false}}));
    actAdd(window.__B.k,'부자재','장주운'); lsSave();
  });
  await p.waitForTimeout(900);
  chk('제안 등록 시 1건 전송', sent.length===1, sent.length+'건');
  const s1=sent[0]||{headers:{},body:''};
  const j1=(()=>{ try{ return JSON.parse(s1.body||'{}'); }catch(e){ return {}; } })();
  const meta=await p.evaluate(()=>window.__B);
  chk('POST 로 보낸다', s1.method==='POST', s1.method);
  chk('잔디 헤더(Accept) 지정', String(s1.headers['accept']||'').indexOf('tosslab.jandi-v2')>=0, s1.headers['accept']);
  chk('본문에 거래처명 포함', String(j1.body||'').indexOf(meta.firm)>=0, j1.body);
  const t1=String((j1.connectInfo||[{}])[0].title||''), d1=String((j1.connectInfo||[{}])[0].description||'');
  chk('머리줄에 품목·코스·업종군', t1.indexOf('부자재')>=0 && t1.indexOf(meta.cos)>=0 && t1.indexOf(meta.ind)>=0, t1);
  chk('코스가 한 번만 나온다(중복 없음)', t1.split(meta.cos).length-1===1 && d1.indexOf(meta.cos)<0, t1+' | '+d1);
  chk('등록한 사람 이름 표시', d1.indexOf('등록: 박정주')>=0, d1);
  chk('등록일 표시', /등록: .+ · \d{4}-\d{2}-\d{2}/.test(d1), d1);
  chk('메모 본문 끔: 메모가 안 나감', JSON.stringify(j1).indexOf('부자재 단가 문의')<0);

  // ── 3. 같은 품목 재등록은 추가 발송 없음 ──
  sent=[];
  await p.evaluate(()=>{ actAdd(window.__B.k,'부자재','장주운'); lsSave(); });
  await p.waitForTimeout(700);
  chk('같은 품목 재등록: 중복 발송 없음', sent.length===0, sent.length+'건');

  // ── 3-2. 메모 본문은 설정을 따로 안 해도 기본으로 함께 간다 ──
  sent=[];
  await p.evaluate(()=>{
    localStorage.setItem('jandi_cfg', JSON.stringify({'영업5팀':{url:'https://wh.jandi.com/connect-api/webhook/TEST',on:true}}));
    const t=window.__mk(18,'기본값 확인용 메모'); window.__F=t; lsSave();
    actAdd(t.k,'조명','박정주'); lsSave();
  });
  await p.waitForTimeout(900);
  chk('메모 본문 기본 켜짐(설정 안 해도 함께 감)',
      sent.length===1 && String(sent[0].body||'').indexOf('기본값 확인용 메모')>=0, sent.length+'건');

  // ── 4. 메모 본문 포함 설정 ──
  sent=[];
  await p.evaluate(()=>{
    localStorage.setItem('jandi_cfg', JSON.stringify({'영업5팀':{url:'https://wh.jandi.com/connect-api/webhook/TEST',on:true,withMemo:true}}));
    actAdd(window.__C.k,'전선','박정주'); lsSave();
  });
  await p.waitForTimeout(900);
  chk('메모 본문 켬: 메모가 함께 나감', sent.length===1 && String(sent[0].body||'').indexOf('전선 재고 문의')>=0, sent.length+'건');

  // ── 5. 꺼 두면 안 보낸다 ──
  sent=[];
  await p.evaluate(()=>{
    localStorage.setItem('jandi_cfg', JSON.stringify({'영업5팀':{url:'https://wh.jandi.com/connect-api/webhook/TEST',on:false,withMemo:false}}));
    const t=window.__mk(12,'MRO 문의'); window.__D=t; lsSave();
    actAdd(t.k,'MRO','박정주'); lsSave();
  });
  await p.waitForTimeout(800);
  chk('알림 끔: 보내지 않음', sent.length===0, sent.length+'건');
  chk('알림 꺼도 제안은 등록됨', await p.evaluate(()=>actList(window.__D.k).length===1));

  // ── 6. 전송이 실패해도 제안은 남고, 사용자는 실패를 안다 ──
  sent=[]; failNext=true;
  await p.evaluate(()=>{
    localStorage.setItem('jandi_cfg', JSON.stringify({'영업5팀':{url:'https://wh.jandi.com/connect-api/webhook/TEST',on:true,withMemo:false}}));
    const t=window.__mk(15,'실패 확인용'); window.__E=t; lsSave();
    actAdd(t.k,'조명','박정주'); lsSave();
  });
  await p.waitForTimeout(1200);
  const F=await p.evaluate(()=>({
    banner: !!document.getElementById('jandi-warn-banner'),
    text: (document.getElementById('jandi-warn-banner')||{}).innerText||'',
    act: actList(window.__E.k).length }));
  chk('전송 실패: 화면에 알림(조용히 넘기지 않음)', F.banner);
  chk('전송 실패: 제안은 정상 등록되었다고 안내', F.text.indexOf('제안은 정상')>=0, F.text.slice(0,60));
  chk('전송 실패해도 제안 보존', F.act===1);
  failNext=false;

  // ── 7. 설정 창 ──
  await p.evaluate(()=>{ const bn=document.getElementById('jandi-warn-banner'); if(bn) bn.remove(); jandiOpenSettings(); });
  await p.waitForTimeout(600);
  const G=await p.evaluate(()=>{
    const m=document.getElementById('jandi-cfg-modal');
    return { open:!!m, url:(document.getElementById('jandi-url')||{}).value||'',
             team: m? m.innerText.indexOf('영업5팀')>=0 : false,
             test: !!document.getElementById('jandi-test') };
  });
  chk('설정 창 열림', G.open);
  chk('설정 창에 현재 팀 표시', G.team);
  chk('저장된 주소가 채워짐', G.url.indexOf('/webhook/TEST')>=0, G.url);
  chk('테스트 전송 버튼 있음', G.test);

  sent=[];
  await p.click('#jandi-test'); await p.waitForTimeout(900);
  const H=await p.evaluate(()=>(document.getElementById('jandi-test-res')||{}).textContent||'');
  chk('테스트 전송이 실제로 나감', sent.length===1, sent.length+'건');
  chk('테스트 결과를 화면에 알려줌', H.indexOf('보냈습니다')>=0, H);

  // 저장 → 다른 팀으로 바꾸면 그 팀에는 설정이 없다
  await p.evaluate(()=>{ document.getElementById('jandi-url').value='https://wh.jandi.com/connect-api/webhook/SAVED';
                         document.getElementById('jandi-save').click(); });
  await p.waitForTimeout(500);
  const I=await p.evaluate(()=>{
    const all=JSON.parse(localStorage.getItem('jandi_cfg')||'{}');
    localStorage.setItem('sync_team_name','영업3팀');
    const other=jandiCfg();
    localStorage.setItem('sync_team_name','영업5팀');
    return { saved:((all['영업5팀']||{}).url||''), otherEmpty: !other.url, mine:(jandiCfg().url||'') };
  });
  chk('저장이 팀 이름 아래로 들어감', I.saved.indexOf('/webhook/SAVED')>=0, I.saved);
  chk('다른 팀에는 설정이 없다(우리 팀만 설정해도 됨)', I.otherEmpty);
  chk('우리 팀 설정은 그대로', I.mine.indexOf('/webhook/SAVED')>=0, I.mine);

  chk('JS 오류 없음', errs.length===0, errs.join(' | '));

  ok.forEach(t=>console.log('  ✓ '+t));
  bad.forEach(t=>console.log('  ✗ '+t));
  console.log(`통과 ${ok.length} / 실패 ${bad.length}`);
  await b.close();
  process.exit(bad.length?1:0);
})();
