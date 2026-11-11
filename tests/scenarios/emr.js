const { chromium, devices } = require('playwright');const fs=require('fs'),path=require('path');const {seed,TD}=require('./mob_seed');
const FLOW=process.argv[2],INDEX=process.argv[3],OUT=process.argv[4];const NM=path.join(__dirname,'..','node_modules');
const OLD=`#주소: 키 성장 상담\nS) 키가 작다고 걱정\nO) Ht 140.3 Wt 33.0\nA) 성장 경과 관찰\nP) 6개월 후 재방문`;
const NEW=`#주소: 키 성장 상담\nS) 키가 작다고 걱정\nS) 최근 6개월 5.7cm 자람, 밤 11시 넘어 잠\nO) Ht 146.0 Wt 38.1\nO) BA 11Y10M (CA 10Y11M)\nA) 성장 경과 관찰\nA) 뼈나이 약 11개월 앞섬 — 사춘기 시작 가능성\nP) 6개월 후 재방문 · LH/FSH 검토\nP) 수면 10시 전 권고`;
const docPatients=[{id:'dp1',name:'홍지우',chartNo:'101001',dob:'2015-01-02',records:[{date:'2025-11-05',chartNoteRaw:OLD},{date:TD,chartNoteRaw:NEW}]},{id:'dp2',name:'김서준',chartNo:'101002',records:[]}];
const KEY='sync-key-ABCDEFGHIJKLMNOP';
const json=JSON.stringify(docPatients),half=Math.ceil(json.length/2);
const ROWS=[{type:'doctordata',pid:KEY,timestamp:'2026-11-10T07:00:00Z',refId:'0',answer:'2',question:json.slice(0,half)},{type:'doctordata',pid:KEY,timestamp:'2026-11-10T07:00:00Z',refId:'1',answer:'2',question:json.slice(half)}];
(async()=>{const b=await chromium.launch();const errs=[];
 const ctx=await b.newContext(Object.assign({},devices['iPhone 13']));const DB=seed();
 await ctx.addInitScript(k=>{localStorage.setItem('jrd_api_url','https://api.test/exec');localStorage.setItem('jrd_auth_token','x.'+(Date.now()+864e5)+'.y');localStorage.setItem('jrd_sync_key',k)},KEY);
 let gets=0;
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://api.test/')){if(r.request().method()==='GET'){gets++;return r.fulfill({contentType:'application/json',body:u.includes('only=doctordata')?JSON.stringify(ROWS):'[]'})}
   const bb=JSON.parse(r.request().postData()||'{}');return r.fulfill({contentType:'application/json',body:JSON.stringify(bb.action==='flowlist'?{status:'ok',visits:[...DB.values()]}:{status:'ok'})})}
  if(u.includes('qrcode-generator'))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(NM+'/qrcode-generator/qrcode.js')});
  if(u.startsWith('file:'))return r.continue();return r.fulfill({status:204,body:''})});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push('flow:'+e));
 await p.goto('file://'+FLOW+'#report');await p.waitForFunction(()=>typeof S!=='undefined'&&S.loaded);await p.waitForTimeout(300);
 await p.tap('.mr-card >> nth=0');await p.waitForTimeout(900);
 console.log('flow 1:',(await p.locator('#mb-emr').innerText()).replace(/\s+/g,' '));
 await p.tap('#mb-emr [data-emr="tog"]');await p.waitForTimeout(200);
 console.log('flow 2 open:',(await p.locator('#mb-emr .emr-txt').innerText()).split('\n').join(' / '));
 await p.screenshot({path:OUT+'/emr_flow.png'});
 await p.tap('#mb-emr [data-emr="all"]');await p.waitForTimeout(200);console.log('flow 3 all lines:',await p.locator('#mb-emr .emr-l').count(),'· highlighted',await p.locator('#mb-emr .emr-l.nw').count());
 await p.tap('#fr-summary');await p.locator('#fr-summary').fill('최근 6개월 5.7cm 자랐어요. 뼈나이가 11개월 앞서 사춘기 시작 가능성이 있어요.');await p.waitForTimeout(300);
 console.log('flow 4 panel still open while typing:',await p.locator('#mb-emr .emr-body').isVisible());
 await p.tap('#mb-next');await p.waitForTimeout(700);console.log('flow 5 next kid (no chart):',(await p.locator('#mb-emr').innerText()).replace(/\s+/g,' '));
 console.log('  doctordata GETs:',gets);
 // index 진료 후 안내 편집
 const q=await ctx.newPage();q.on('pageerror',e=>errs.push('index:'+String(e).slice(0,120)));
 await q.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({status:204,body:''}));
 await q.goto('file://'+INDEX);await q.waitForTimeout(1000);
 await q.evaluate(([OLD,NEW,TD])=>{patients.push({id:'g0',name:'이수현',chartNo:'102530',sex:'F',records:[{date:'2025-11-05',chartNoteRaw:OLD},{date:TD,chartNoteRaw:NEW}],pendingGuideSend:true,firstFlag:{date:TD},guideBase:{date:TD,text:OLD},
   guideDraft:{ai:true,post:{summary:'오늘 키 5.7cm 자랐어요.',labs:'',xray:'뼈나이 11개월 앞섬',direction:'6개월 뒤',nextDate:'2027-05-10',exercise:'',nutrition:'',sleep:'10시 전'}}});guideEdit('g0')},[OLD,NEW,TD]);
 await q.waitForTimeout(300);console.log('index 1:',(await q.locator('#ge_emr').innerText()).replace(/\s+/g,' '));
 await q.evaluate(()=>{const g=document.getElementById('authGateOv');if(g)g.remove()});await q.locator('#ge_emr [data-emr="tog"]').tap();await q.waitForTimeout(200);console.log('index 2:',(await q.locator('#ge_emr .emr-txt').innerText()).split('\n').join(' / '));
 await q.screenshot({path:OUT+'/emr_index.png'});
 console.log('errors',errs);await b.close()})().catch(e=>{console.error('FAIL',e);process.exit(1)});
