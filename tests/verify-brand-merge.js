// 공구 6대 브랜드 시트: 엑셀이 '마끼다 충전(PM)', '보쉬AC' 처럼 쪼개 보내도
// 화면에는 6대 브랜드 한 줄씩만 나오고, 금액은 쪼개진 것들의 합과 같아야 한다.
const {launch,URL}=require('./_harness');
const XLSX=require('xlsx');
const path=require('path');
const ok=[], bad=[];
function chk(n,c,d){ (c?ok:bad).push(n+(d?' — '+d:'')); }

const SRC=path.resolve(__dirname,'.fixture','sample.xlsx');
const OUT=path.resolve(__dirname,'.fixture','brand.xlsx');

// 가상 데이터의 브랜드 값을 실제 파일처럼 세부 표기로 바꾼다
const 세부 = ['계양','디월트','마끼다 유선(PM)','마끼다 충전','마끼다 충전(PM)','마끼다AC','밀워키','보쉬','보쉬 가든툴','보쉬AC','아임삭'];
(async()=>{
  const wb=XLSX.readFile(SRC);
  const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null});
  const bi=raw[1].indexOf('브랜드');
  let n=0;
  for(let i=2;i<raw.length;i++){ if(raw[i]&&raw[i][bi]!=null){ raw[i][bi]=세부[n%세부.length]; n++; } }
  const wb2=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(raw), 'pivot');
  XLSX.writeFile(wb2, OUT);

  const b=await launch();
  const p=await b.newPage({viewport:{width:1600,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(800);
  await p.evaluate(()=>{const g=document.getElementById('auth-gate'); if(g)g.remove();});
  await p.setInputFiles('#file-input', OUT); await p.waitForTimeout(4500);
  await p.click('.tab[data-tab="brand"]'); await p.waitForTimeout(1500);

  const R=await p.evaluate(()=>{
    const tr=[...document.querySelectorAll('#brand-tbody tr')];
    const names=tr.map(t=>t.querySelector('td')?t.querySelector('td').textContent.trim():'');
    return { names, rows:tr.length };
  });
  const 브랜드행 = R.names.filter(x=>x.indexOf('합계')<0);
  chk('6대 브랜드만 표시', 브랜드행.length===6, JSON.stringify(브랜드행));
  chk('이름이 계양·디월트·마끼다·밀워키·보쉬·아임삭',
      JSON.stringify(브랜드행)===JSON.stringify(['계양','디월트','마끼다','밀워키','보쉬','아임삭']), JSON.stringify(브랜드행));
  chk('세부 표기(마끼다 충전(PM) 등)는 더 이상 줄로 나오지 않음',
      !R.names.some(x=>/\(PM\)|AC$|가든툴|충전|유선/.test(x)), JSON.stringify(R.names));

  // 금액: 화면의 '마끼다' 줄 = 마끼다로 시작하는 원본 행들의 합
  const M=await p.evaluate(()=>{
    const sum=(pre)=>(window._allRows||[]).filter(r=>String(r.brand||'').indexOf(pre)===0)
      .reduce((t,r)=>t+(r.tc||0),0);
    const cell=(name)=>{
      const tr=[...document.querySelectorAll('#brand-tbody tr')]
        .find(t=>t.querySelector('td')&&t.querySelector('td').textContent.trim()===name);
      if(!tr) return null;
      const tds=[...tr.querySelectorAll('td')];
      return Number((tds[3].textContent||'').replace(/[^0-9-]/g,''));   // 매출액 열
    };
    return { 마끼다화면:cell('마끼다'), 마끼다합:Math.round(sum('마끼다')),
             보쉬화면:cell('보쉬'),   보쉬합:Math.round(sum('보쉬')) };
  });
  chk('마끼다 금액 = 쪼개진 4종의 합', M.마끼다화면===M.마끼다합, M.마끼다화면+' vs '+M.마끼다합);
  chk('보쉬 금액 = 쪼개진 3종의 합', M.보쉬화면===M.보쉬합, M.보쉬화면+' vs '+M.보쉬합);

  // 브랜드 행을 클릭하면 코스별 팝업이 열리고, 합계가 시트와 같아야 한다
  await p.evaluate(()=>{
    const tr=[...document.querySelectorAll('#brand-tbody tr.brand-row')]
      .find(t=>t.querySelector('td').textContent.trim()==='마끼다');
    tr.click();
  });
  await p.waitForTimeout(1200);
  const D=await p.evaluate(()=>{
    const m=document.getElementById('drill-modal');
    return { 열림:m?getComputedStyle(m).display!=='none':false,
             제목:(document.getElementById('drill-title')||{}).textContent||'',
             kpi:(document.getElementById('drill-kpi')||{}).innerText||'' };
  });
  chk('마끼다 행 클릭 → 코스별 팝업 열림', D.열림 && D.제목==='마끼다', D.제목);
  const kpiNum=Number((D.kpi.split('원')[0]||'').replace(/[^0-9-]/g,''));
  chk('팝업 매출액도 통합 금액', kpiNum===M.마끼다합, kpiNum+' vs '+M.마끼다합);

  chk('JS 오류 없음', errs.length===0, errs.join(' | '));
  ok.forEach(t=>console.log('  ✓ '+t));
  bad.forEach(t=>console.log('  ✗ '+t));
  console.log(`통과 ${ok.length} / 실패 ${bad.length}`);
  await b.close();
  process.exit(bad.length?1:0);
})();
