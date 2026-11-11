// 휴대폰 리포트 시험용 공통 데이터·서버
const fs=require('fs'),path=require('path');const NM=path.join(__dirname,'..','node_modules');
const pad=n=>(n<10?'0':'')+n,d=new Date(),TD=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());const now=Date.now(),M=60000;
const base=()=>({intake:{},measure:{},xray:{part:'왼손',done:true},lab:{items:[],drawn:false,results:{},proto:'single',t0:null,draws:[],ext:{},at:{}},review:{},exit:{},report:{}});
const V=o=>Object.assign({sv:2,card:'',appt:'',log:[{s:0,t:now-90*M}],createdAt:now-100*M,updatedAt:now-30*M,date:TD,rev:true},base(),o);
const recs=`2025-05-10 키 137.0 몸무게 31.0\n2025-11-05 키 140.3 몸무게 33.0 골연령 10세 8개월\n${TD} 키 146.0 몸무게 38.1 골연령 11세 10개월`;
const post=(n)=>({summary:n+'는 지난 6개월 동안 5.7cm 자랐어요. 또래 중간보다 조금 큰 편으로 잘 자라고 있습니다.',xray:'뼈나이는 실제 나이보다 약 1년 빨라요. 사춘기가 시작된 신호일 수 있어 경과를 보겠습니다.',direction:'6개월 뒤 키와 뼈나이를 다시 확인해요. 필요하면 혈액검사를 함께 해요.',exercise:'줄넘기 하루 10분, 주 5회',nutrition:'우유 하루 2잔, 단 음료 줄이기',sleep:'밤 10시 전에 잠들기',nextDate:'2027-05-10'});
const G=(n,o)=>Object.assign({date:TD,dob:'2015-01-02',sex:'F',fh:'176',mh:'161',recsText:recs,post:post(n),ready:true,src:'today',srcAt:now-20*M,at:now-20*M,from:'flow'},o||{});
function seed(){
  const DB=new Map();
  [V({id:'r1',name:'홍지우',age:11,sex:'여',chartNo:'101001',step:9,gr:G('지우')}),
   V({id:'r2',name:'김서준',age:9,sex:'남',chartNo:'101002',step:8,gr:G('서준',{sex:'M',dob:'2017-03-04'})}),
   V({id:'r3',name:'이하린',age:8,sex:'여',chartNo:'101003',step:7,gr:G('하린',{src:'intake'})}),
   V({id:'r4',name:'박도윤',age:10,sex:'남',chartNo:'101004',step:9,gr:G('도윤',{sex:'M',dob:'2016-02-01',reviewed:true,reviewedAt:now-10*M})}),
   V({id:'r5',name:'최아린',age:7,sex:'여',chartNo:'101005',step:6,lab:{items:['원내검사'],drawn:true,results:{},proto:'single',draws:[],ext:{},at:{}}}),
   V({id:'r6',name:'정민준',age:12,sex:'남',chartNo:'101006',step:3})].forEach(v=>DB.set(v.id,v));
  return DB;
}
const setPath=(o,k,val)=>{const p=k.split('.');let x=o;for(let i=0;i<p.length-1;i++){if(!x[p[i]]||typeof x[p[i]]!=='object')x[p[i]]={};x=x[p[i]]}if(val===null)delete x[p[p.length-1]];else x[p[p.length-1]]=val};
async function route(ctx,DB,LOG){
  await ctx.addInitScript(()=>{localStorage.setItem('jrd_api_url','https://api.test/exec');localStorage.setItem('jrd_auth_token','x.'+(Date.now()+864e5)+'.y');localStorage.setItem('jrd_role','doctor')});
  await ctx.route('**/*',async r=>{const u=r.request().url();
    if(u.startsWith('https://api.test/')){if(r.request().method()==='GET')return r.fulfill({contentType:'application/json',body:'[]'});const b=JSON.parse(r.request().postData()||'{}');if(LOG&&b.action!=='flowlist')LOG.push(b.action+':'+(b.id||''));let res={status:'ok'};
      if(b.action==='flowlist')res={status:'ok',visits:[...DB.values()]};
      if(b.action==='flowsave'){let v=DB.get(b.id);if(!v){v={id:b.id};DB.set(b.id,v)}Object.entries(b.patch).forEach(([k,val])=>setPath(v,k,val))}
      if(b.action==='generatefirstvisitchart')res={status:'ok',via:'jarada-codegs',data:{summary:'AI 요약',direction:'AI 방향'}};
      return r.fulfill({contentType:'application/json',body:JSON.stringify(res)})}
    if(u.includes('qrcode-generator'))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(NM+'/qrcode-generator/qrcode.js')});
    if(u.includes('three.min.js'))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(NM+'/three/build/three.min.js')});
    if(u.startsWith('file:'))return r.continue();return r.fulfill({status:204,body:''})});
}
module.exports={seed,route,TD};
