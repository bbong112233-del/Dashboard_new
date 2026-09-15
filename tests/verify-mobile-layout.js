// 좁은 화면에서 헤더가 무너지지 않는지. (390px 에서 부제가 한 글자씩 세로로
// 쪼개져 헤더가 화면 대부분을 먹던 적이 있다)
const {launch,URL,FIXTURE}=require('./_harness');
const ok=[],bad=[];
function chk(n,c,d){ (c?ok:bad).push(n+(d?' — '+d:'')); }
(async()=>{
  const b=await launch();
  for(const [w,h,label,maxH] of [[390,844,'휴대폰 390px',260],[768,1024,'태블릿 768px',220],[1440,900,'데스크톱 1440px',160]]){
    const p=await b.newPage({viewport:{width:w,height:h}});
    await p.goto(URL); await p.waitForTimeout(800);
    await p.evaluate(()=>{const g=document.getElementById('auth-gate');if(g)g.remove();});
    await p.setInputFiles('#file-input',FIXTURE); await p.waitForTimeout(4000);
    const m=await p.evaluate(()=>{
      const hd=document.querySelector('.hdr');
      const sub=document.querySelector('.hdr-left > div:last-child');
      return { hdrH:Math.round(hd.getBoundingClientRect().height),
               subW:sub?Math.round(sub.getBoundingClientRect().width):0,
               scrollW:document.documentElement.scrollWidth, winW:window.innerWidth,
               tabs:document.querySelectorAll('.tab').length };
    });
    chk(label+' 헤더 높이가 과하지 않음', m.hdrH>0 && m.hdrH<=maxH, m.hdrH+'px (한도 '+maxH+')');
    chk(label+' 가로 스크롤 없음', m.scrollW<=m.winW+1, m.scrollW+' vs '+m.winW);
    // 820px 이하에서는 제목·요약이 한 줄을 온전히 쓴다. 그보다 넓으면 원래 레이아웃.
    if(w<=820) chk(label+' 부제가 한 줄을 온전히 씀', m.subW > w*0.8, m.subW+'px / 화면 '+w);
    else       chk(label+' 부제가 충분한 폭 확보', m.subW > 400, m.subW+'px / 화면 '+w);
    chk(label+' 탭이 모두 렌더', m.tabs>=16, 'tabs='+m.tabs);
    await p.close();
  }
  console.log('\n=== PASS ==='); ok.forEach(x=>console.log('  ✓',x));
  console.log('\n=== FAIL ==='); bad.length?bad.forEach(x=>console.log('  ✗',x)):console.log('  (없음)');
  await b.close(); process.exit(bad.length?1:0);
})();
