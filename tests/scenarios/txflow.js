const { chromium } = require('playwright');const fs=require('fs'),path=require('path');
const FLOW=process.argv[2],OUT=process.argv[3];const NM=path.join(__dirname,'..','node_modules');
const pad=n=>(n<10?'0':'')+n,d=new Date(),TD=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());const now=Date.now(),M=60000;
const base=()=>({intake:{},measure:{},xray:{part:'왼손',done:false},lab:{items:[],drawn:false,results:{},proto:'single',t0:null,draws:[],ext:{},at:{}},review:{},exit:{},report:{}});
const V=o=>Object.assign({sv:2,card:'',appt:'',log:[{s:0,t:now-30*M}],createdAt:now-40*M,updatedAt:now-30*M,date:TD,rev:true},base(),o);
const ago=days=>{const t=new Date(Date.now()-days*864e5);return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate())};
const DB=[V({id:'a',name:'김성장',step:3,card:'C001',tx:[{k:'GH',s:'2025-03-04'}]}),V({id:'b',name:'이억제',step:2,card:'C002',tx:[{k:'GnRH',s:ago(40)},{k:'GH',s:'2026-02'}]}),
 V({id:'c',name:'박첫날',step:1,card:'C003',tx:[{k:'GH',s:TD}]}),V({id:'e',name:'최열흘',step:4,card:'C004',tx:[{k:'GnRH',s:ago(9)}]}),V({id:'f',name:'정없음',step:3,card:'C005'})];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1500,height:900}});
await ctx.addInitScript(()=>{localStorage.setItem('jrd_api_url','https://api.test/exec');localStorage.setItem('jrd_auth_token','x.'+(Date.now()+864e5)+'.y')});
await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith('https://api.test/')){if(r.request().method()==='GET')return r.fulfill({contentType:'application/json',body:'[]'});const bb=JSON.parse(r.request().postData()||'{}');return r.fulfill({contentType:'application/json',body:JSON.stringify(bb.action==='flowlist'?{status:'ok',visits:DB}:{status:'ok'})})}
 if(u.includes('qrcode'))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(NM+'/qrcode-generator/qrcode.js')});if(u.startsWith('file:'))return r.continue();return r.fulfill({status:204,body:''})});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+FLOW);await p.waitForFunction(()=>typeof S!=='undefined'&&S.loaded);await p.waitForTimeout(800);
for(const id of ['a','b','c','e','f'])console.log(id,JSON.stringify(await p.locator(`.card[data-sel="${id}"] .pill.tx`).allInnerTexts()),await p.locator(`.card[data-sel="${id}"] .pill.tx`).first().getAttribute('title').catch(()=>''));
await p.click('.card[data-sel="b"]');await p.waitForTimeout(300);console.log('detail b:',(await p.locator('.txline').innerText()).replace(/\s+/g,' '));
await p.screenshot({path:OUT+'/tx_board.png'});
await p.click('.card[data-sel="c"]');await p.waitForTimeout(300);console.log('detail c:',(await p.locator('.txline').innerText()).replace(/\s+/g,' '));
console.log('errors',errs);await b.close()})();
