const { chromium } = require('playwright');const fs=require('fs'),path=require('path');
const FLOW=process.argv[2],OUT=process.argv[3];const NM=path.join(__dirname,'..','node_modules');
const LIBS={'qrcode-generator@1.4.4/qrcode.js':NM+'/qrcode-generator/qrcode.js'};
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:900,height:1200}});
  await ctx.addInitScript(()=>{localStorage.setItem('jrd_api_url','https://api.test/exec');localStorage.setItem('jrd_auth_token','x.'+(Date.now()+864e5)+'.y')});
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('https://api.test/'))return r.fulfill({contentType:'application/json',body:JSON.stringify({status:'ok',visits:[]})});for(const k in LIBS)if(u.includes(k))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(LIBS[k])});if(u.startsWith('file:'))return r.continue();return r.fulfill({status:204,body:''})});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+FLOW);await p.waitForFunction(()=>typeof S!=='undefined'&&S.loaded);
  const post={summary:'오늘은 1년 동안의 키 성장을 확인했어요. 또래 중간 정도로 잘 자라고 있습니다. 앞으로도 꾸준히 관찰하면 좋겠습니다.',xray:'뼈나이는 실제 나이보다 조금 빨라요.',direction:'6개월 뒤 다시 키와 뼈나이를 확인해요.',exercise:'줄넘기 하루 10분',nutrition:'우유 하루 2잔',sleep:'밤 10시 전에 잠들기',nextDate:'2027-05-10'};
  const sets={
    A:`2023-11-02 키 128.1 몸무게 26.0\n2024-05-08 키 131.0 몸무게 27.5\n2024-11-06 키 134.2 몸무게 29.4\n2025-05-10 키 137.0 몸무게 31.0\n2025-11-05 키 140.3 몸무게 33.0 골연령 10세 8개월\n2026-11-10 키 146.0 몸무게 38.1 골연령 11세 10개월`,
    B:`2026-11-10 키 146.0 몸무게 38.1`,
    C:`2026-05-10 키 142.0 몸무게 35.0\n2026-11-10 키 146.0 몸무게 38.1 골연령 12세 5개월`,
    D:`2025-11-05 키 140.3 골연령 10세 2개월\n2026-05-10 키 143.0 몸무게 35.1\n2026-11-10 키 146.0 몸무게 38.1 골연령 11세 4개월`};
  for(const k of Object.keys(sets)){
    const r=await p.evaluate(([txt,post])=>{
      const g={name:'홍지우',sex:'F',dob:'2016-03-02',fh:'176',mh:'161',recsText:txt,post:post,gc:'AAAAAAAB',date:'2026-11-10'};
      const m=GR.compute(GR.build(g).st);let host=document.getElementById('tcmp');if(!host){host=document.createElement('div');host.id='tcmp';host.style.cssText='position:absolute;left:0;top:0;z-index:99999;background:#fff';document.body.appendChild(host)}
      host.innerHTML=GR.pagesHTML(m);GR.paint(host,m);
      const pages=[...host.querySelectorAll('.rp')].map(rp=>{const f=rp.querySelector('.rp-foot');const rb=rp.getBoundingClientRect();return {over:rp.scrollHeight-rp.clientHeight,footGap:f?Math.round(rb.bottom-f.getBoundingClientRect().bottom):null}});
      const c=host.querySelector('.rp-cmp');return {pages,cmp:c?c.innerText.replace(/\n/g,' | '):'(없음)',err:m.error||''};
    },[sets[k],post]);
    console.log(k,JSON.stringify(r));
    if(k==='A'||k==='D'||k==='B'){await p.locator('#tcmp .rp').first().screenshot({path:OUT+'/cmp_'+k+'.png'})}
  }
  console.log('errors',errs);await b.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
