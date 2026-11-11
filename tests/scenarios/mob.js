const { chromium, devices } = require('playwright');const {seed,route}=require('./mob_seed');
const FLOW=process.argv[2],OUT=process.argv[3];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext(Object.assign({},devices['iPhone 13']));const DB=seed(),LOG=[];await route(ctx,DB,LOG);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+FLOW+'#report');await p.waitForFunction(()=>typeof S!=='undefined'&&S.loaded);await p.waitForTimeout(500);
console.log('1 view:',await p.evaluate(()=>UI.view),'· body.mrep',await p.evaluate(()=>document.body.classList.contains('mrep')));
console.log('  segs:',(await p.locator('.mr-seg button').allInnerTexts()).map(x=>x.replace(/\n/g,' ')).join(' | '));
console.log('  cards:',(await p.locator('.mr-card b').allInnerTexts()).join(', '));
await p.screenshot({path:OUT+'/n1_list.png'});
await p.tap('.mr-card >> nth=0');await p.waitForTimeout(700);
console.log('2 open:',await p.locator('.mb-who b').innerText(),'· pos',await p.locator('#mb-pos').innerText(),'· ok btn:',await p.locator('#fr-okbtn').innerText(),'· prev disabled',await p.locator('#mb-prev').isDisabled());
await p.screenshot({path:OUT+'/n2_edit.png'});
// 고치기
await p.tap('#fr-summary');await p.locator('#fr-summary').fill('지난 6개월 동안 5.7cm 자랐어요. (지하철에서 고침)');await p.waitForTimeout(900);
const curName=await p.locator('.mb-who b').innerText();const curId=[...DB.values()].find(v=>v.name===curName).id;
console.log('3 edit saved to server:',JSON.stringify(((DB.get(curId)||{}).gr||{}).post&&DB.get(curId).gr.post.summary));
await p.tap('[data-fr="tab"][data-t="view"]');await p.waitForTimeout(700);
console.log('4 preview: pages',await p.locator('#gr-inner .rp').count(),'· scale',await p.evaluate(()=>document.getElementById('gr-inner').style.transform),'· text has edit',await p.evaluate(()=>document.getElementById('gr-inner').innerText.includes('지하철에서 고침')));
await p.screenshot({path:OUT+'/n3_view.png'});
await p.tap('[data-fr="tab"][data-t="edit"]');await p.waitForTimeout(200);
// 확인 → 다음 아이
const first=curId;
await p.tap('#fr-okbtn');await p.waitForTimeout(1500);
console.log('5 after confirm: reviewed',await p.evaluate(id=>!!S.items.get(id).gr.reviewed,first),'· now open:',await p.locator('.mb-who b').innerText().catch(()=>'(닫힘)'),'· toast:',await p.locator('.toast').first().innerText().catch(()=>''),'· pdf downloads?',await p.evaluate(()=>FR&&true));
await p.tap('#fr-okbtn');await p.waitForTimeout(1500);
console.log('6 after 2nd confirm: overlay',await p.locator('#grov').count(),'· toast:',await p.locator('.toast').first().innerText().catch(()=>''));
await p.screenshot({path:OUT+'/n4_after.png'});
console.log('  segs now:',(await p.locator('.mr-seg button').allInnerTexts()).map(x=>x.replace(/\n/g,' ')).join(' | '));
// 확인 끝 → 확인 취소
await p.tap('[data-act="mr-seg"][data-k="done"]');await p.waitForTimeout(300);
console.log('7 done list:',(await p.locator('.mr-card b').allInnerTexts()).join(', '));
await p.tap('.mr-card >> nth=0');await p.waitForTimeout(600);
console.log('  reviewed open: ok hidden',await p.locator('#fr-okbtn').isHidden(),'· unrev visible',await p.locator('#fr-unrevbtn').isVisible(),'· msg',await p.locator('#grmsg').innerText());
await p.tap('.mb-back');await p.waitForTimeout(300);
// 가안 탭 / prev-next
await p.tap('[data-act="mr-seg"][data-k="draft"]');await p.waitForTimeout(300);console.log('8 draft list:',(await p.locator('.mr-card b').allInnerTexts()).join(', '));
// 넓은 화면(컴퓨터)은 그대로
const pc=await b.newContext({viewport:{width:1400,height:900}});await route(pc,seed());const q=await pc.newPage();q.on('pageerror',e=>errs.push('pc:'+e));
await q.goto('file://'+FLOW);await q.waitForFunction(()=>typeof S!=='undefined'&&S.loaded);await q.evaluate(()=>{UI.view='report';renderAll(true)});await q.waitForTimeout(300);
console.log('9 desktop: mobile list?',await q.locator('.mr-card').count(),'· desktop panel',await q.locator('.grq').count());await q.evaluate(()=>FR.open('r1'));await q.waitForTimeout(500);console.log('  desktop overlay mob?',await q.evaluate(()=>document.getElementById('grov').classList.contains('mob')),'· okbtn',await q.locator('#fr-okbtn').innerText());
console.log('server calls:',LOG.filter(x=>!x.startsWith('flowlist')).slice(0,12).join(' '));
console.log('errors',errs);await b.close()})().catch(e=>{console.error('FAIL',e);process.exit(1)});
