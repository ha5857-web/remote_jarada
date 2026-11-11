const { chromium, devices } = require('playwright');const {seed,route,TD}=require('./mob_seed');
const FLOW=process.argv[2],OUT=process.argv[3];
const LX={t:'🩸 검사 결과\n· 비타민D(21.4) → 부족\n· 사춘기 호르몬(LH 0.9) → 억제 잘 됨\n\n📌 관리 계획\n비타민D 꾸준히 복용, 다음 달 3개월 제형 고려',at:Date.now()-60000,d:TD};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const mode of ['pc','phone']){
 const ctx=await b.newContext(mode==='phone'?Object.assign({},devices['iPhone 13']):{viewport:{width:1400,height:950}});const DB=seed(),LOG=[];
 // r1: 확인 전, 혈액 설명 비어 있음 / r2: 혈액 설명 이미 있음 / r4: 확인 끝 / r7: 결과 대기(채혈)
 const r1=DB.get('r1');r1.gr.post.labs='';r1.labx=LX;
 const r2=DB.get('r2');r2.gr.post.labs='원장 직접 쓴 설명';r2.labx=LX;
 const r4=DB.get('r4');r4.labx=LX;
 const r7=JSON.parse(JSON.stringify(r1));r7.id='r7';r7.name='윤채혈';r7.chartNo='101007';r7.lab={items:['원내검사'],drawn:true,results:{},proto:'single',draws:[],ext:{},at:{}};r7.gr.post.labs='';delete r7.labx;DB.set('r7',r7);
 await route(ctx,DB,LOG);
 let aiBody=null;await ctx.route('https://api.test/**',async r=>{const bb=JSON.parse(r.request().postData()||'{}');if(bb.action==='generatefirstvisitchart'){aiBody=bb;return r.fulfill({contentType:'application/json',body:JSON.stringify({status:'ok',via:'jarada-codegs',data:{summary:'AI 요약',labs:'',direction:'AI 방향'}})})}return r.fallback()});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(mode+':'+e));
 await p.goto('file://'+FLOW);await p.waitForFunction(()=>typeof S!=='undefined'&&S.loaded);await p.waitForTimeout(800);
 const labs=id=>((DB.get(id).gr||{}).post||{}).labs||'';
 console.log(mode,'1 r1 labs filled:',JSON.stringify(labs('r1').slice(0,20)),'· r2 kept:',labs('r2'),'· r4 reviewed untouched:',JSON.stringify(labs('r4').slice(0,12)));
 const st=await p.evaluate(()=>['r1','r7'].map(id=>{const v=S.items.get(id);return id+':'+(v.gr.blood===false?'blood off':'')}));
 // r7 결과 대기 → 문자 도착
 DB.get('r7').labx=LX;await p.evaluate(()=>poll());await p.waitForTimeout(800);
 console.log('  2 r7 after labx: blood',DB.get('r7').gr.blood,'· labs',JSON.stringify(labs('r7').slice(0,12)));
 await p.evaluate(()=>FR.open('r2'));await p.waitForTimeout(500);
 console.log('  3 editor panel:',(await p.locator('#fr-labx summary').innerText()).replace(/\s+/g,' '));
 if(mode==='phone'){await p.locator('#fr-labx summary').tap();await p.waitForTimeout(200);await p.screenshot({path:OUT+'/labx_phone.png'})}
 await p.evaluate(()=>{const s=document.querySelector('#fr-labx summary');if(s&&!s.parentElement.open)s.click()});
 await p.evaluate(()=>document.querySelector('[data-fr="labx-use"]').click());await p.waitForTimeout(1200);
 console.log('  4 use button → r2 labs:',JSON.stringify(labs('r2').slice(0,20)));
 await p.evaluate(()=>FR.close());
 // AI 입력에 들어가는지: 차트 없는 아이(r6)에 labx 두고 차트 붙여넣어 AI 정리
 DB.get('r6').labx=LX;await p.evaluate(()=>poll());await p.waitForTimeout(500);
 await p.evaluate(()=>FR.open('r6'));await p.waitForTimeout(400);
 await p.evaluate(()=>{const t=document.getElementById('fr-chart');t.value='#주소 키 상담\nHt 150.2 Wt 41.0\nA) 성장 경과\nP) 6개월 후';document.querySelector('[data-fr="ai"]').click()});await p.waitForTimeout(1500);
 console.log('  5 AI labs input has lab message:',!!(aiBody&&String(aiBody.labs).includes('보호자에게 이미 보낸 혈액검사')),'· report labs:',JSON.stringify(labs('r6').slice(0,20)));
 await ctx.close();}
 console.log('errors',errs);await b.close()})().catch(e=>{console.error('FAIL',e);process.exit(1)});
