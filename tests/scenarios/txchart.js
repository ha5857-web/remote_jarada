const { chromium } = require('playwright');const fs=require('fs'),path=require('path');
const FLOW=process.argv[2],OUT=process.argv[3];const NM=path.join(__dirname,'..','node_modules');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:900,height:1200}});
await ctx.addInitScript(()=>{localStorage.setItem('jrd_api_url','https://api.test/exec');localStorage.setItem('jrd_auth_token','x.'+(Date.now()+864e5)+'.y')});
await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('https://api.test/'))return r.fulfill({contentType:'application/json',body:JSON.stringify({status:'ok',visits:[]})});if(u.includes('qrcode'))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(NM+'/qrcode-generator/qrcode.js')});if(u.startsWith('file:'))return r.continue();return r.fulfill({status:204,body:''})});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+FLOW);await p.waitForFunction(()=>typeof S!=='undefined'&&S.loaded);
const recs=`2023-11-02 키 118.1 몸무게 21.0\n2024-05-08 키 120.6 몸무게 22.5\n2024-11-06 키 123.0 몸무게 24.0 골연령 9세 2개월\n2025-03-04 키 125.0 몸무게 25.0\n2025-09-10 키 129.2 몸무게 27.0\n2026-03-15 키 133.1 몸무게 29.4 골연령 10세 1개월\n2026-11-10 키 137.9 몸무게 32.1 골연령 10세 9개월`;
const chart='GnRHa(2024-11-20~2026-01-15) 디페렐린 3.75mg\nGH(2025-03-04~) 그로트로핀 1.2 IU 6/wk';
const cases={full:{txp:null,chart,txh:{p:[],d:[{k:'GH',d:'2025-09-10',a:'1.2',b:'1.5',u:'IU'},{k:'GH',d:'2026-03-15',a:'1.5',b:'1.8',u:'IU'},{k:'GnRH',d:'2025-06-01',a:'3.75',b:'11.25',u:'mg'}]}},
  noDose:{chart:'GH(2026-11-10~)',txh:null},none:{chart:'',txh:null}};
for(const k of Object.keys(cases)){const c=cases[k];
 const r=await p.evaluate(([recs,c])=>{const g={name:'홍지우',sex:'M',dob:'2015-06-02',fh:'174',mh:'160',recsText:recs,date:'2026-11-10',txp:txPeriodsOf(c.chart),txh:c.txh,post:{summary:'요약',direction:'방향'}};
  const m=GR.compute(GR.build(g).st);let host=document.getElementById('tcmp');if(!host){host=document.createElement('div');host.id='tcmp';host.style.cssText='position:absolute;left:0;top:0;z-index:99999;background:#fff';document.body.appendChild(host)}
  host.innerHTML=GR.pagesHTML(m);GR.paint(host,m);const rp=host.querySelector('.rp');const cm=host.querySelector('.rp-cmp');
  return {over:rp.scrollHeight-rp.clientHeight,txp:g.txp,cmp:cm?cm.innerText.replace(/\n/g,' | '):'(없음)',tx:m.tx?{p:m.tx.p.length,d:m.tx.d.length}:null,err:m.error||''}},[recs,c]);
 console.log(k,JSON.stringify(r));await p.locator('#tcmp .rp').first().screenshot({path:OUT+'/txc_'+k+'.png'});}
console.log('errors',errs);await b.close()})();
