/* 삼성자라다 — 초진 공용 모듈 (index.html · visit-notice.html 이 함께 씁니다)
 * 이 파일을 고치면 두 화면이 같이 바뀝니다. 고친 뒤에는 두 HTML의 ?v= 숫자도 올려 주세요(브라우저가 새 파일을 받게). */
/* =====================================================================
 * 초진 공용 모듈 (원무과용 visit-notice.html · 의사용 index.html 에서 똑같이 씁니다)
 *  - 영상추천_수정본.html 의 "초진 기록지 → 7편 중 3편 선별" 로직을 그대로 옮긴 것입니다.
 *  - 초진 기록지 한 줄(구글폼 응답)에서 이름·생년월일·성별·연락처·키/몸무게를 읽습니다.
 * ===================================================================== */
const FV_DEFAULT_PREP = [
  '이전에 재어둔 키·몸무게 기록(학교 건강검진 결과, 소아과 기록 등)이 있으면 사진으로 올려주세요.',
  '이전 검사 결과(혈액검사, 엑스레이 등)가 있으면 사진으로 올려주세요.',
  '복용 중인 약과 영양제가 있다면 이름을 메모해 오세요.',
  '진료 전 아래 영상을 시청하고 오시면 설명을 훨씬 쉽게 이해하실 수 있어요.'
].join('\n');
// 환아에게 나가는 초진 안내용 구글폼 (공개 응답 주소)
// 맞춤 영상 화면(자라다케어 사이트) — 이 주소 뒤에 ?v=145 처럼 영상 번호를 붙이면 코드 입력 없이 바로 열립니다.
const FV_VIDEO_SITE = 'https://jaradacare.com/';
const FV_INTAKE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScQHJ4Agz36KqkruYzihV_Cj-98uaHg-lLDQdAmL_v6kdgqeg/viewform';

const JRDV = (function(){
  /* ---------- 보호자 안내 영상 7편 (영상추천_수정본.html 과 동일) ---------- */
  const VIDEOS = [
    {no:1,title:"우리 아이, 잘 크고 있나요",sub:"성장속도 · 키 순위보다 1년에 몇 cm",src:"https://youtu.be/ccxsr-6cdn4"},
    {no:2,title:"키 크는 습관, 1순위는 잠입니다",sub:"생활습관 · 수면, 영양, 운동의 순서",src:"https://youtu.be/W80S1rwvM6Y"},
    {no:3,title:"왜 이렇게 검사가 많을까요",sub:"성조숙증 검사 · 불필요한 치료를 막는 이유",src:"https://youtu.be/Nkz4dDbGNeY"},
    {no:4,title:"이 주사, 어떻게 작용하나요",sub:"성조숙증 치료 · 층간소음으로 이해하는 억제",src:"https://youtu.be/ta7bS_O1rFs"},
    {no:5,title:"몇 cm나 클까요",sub:"성장호르몬 효과 · 솔직하게 말씀드립니다",src:"https://youtu.be/ijNvlNmLn1M"},
    {no:6,title:"우리 아이도 병행치료 해야 할까요",sub:"병행치료 · 가이드라인이 권하는 두 경우",src:"https://youtu.be/zC8_55pK0TQ"},
    {no:7,title:"물만 먹어도 살찌는 아이",sub:"인슐린저항성 · 과장이 아닙니다",src:"https://youtu.be/DxoqacQTMYQ"}
  ];
  const KIOSK_BASE = "https://ha5857-web.github.io/jarada-kiosk/";
  const V = no => VIDEOS.find(x=>x.no===no);
  let sexOverride = null;

  /* 날짜+시각이 붙은 칸(구글폼 제출 시각 "2026. 8. 22 오후 5:57:54")은 생년월일이 아닙니다. */
  function findDobStr(raw){
    const text = String(raw||'');
    const re = /((?:19|20)\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})(?!\d)/g;
    const cands = [];
    const scan = (txt)=>{
      let m; re.lastIndex = 0;
      while((m = re.exec(txt))){
        const after = txt.slice(m.index + m[0].length);
        if(/^\s*(?:오전|오후)?\s*\d{1,2}\s*:\s*\d{2}/.test(after)) continue;      // 제출 시각
        const y=+m[1], mo=+m[2], d=+m[3];
        if(mo<1||mo>12||d<1||d>31) continue;
        const age = (Date.now() - new Date(y,mo-1,d)) / 31557600000;
        if(age<0 || age>25) continue;                                              // 아이 나이가 아님
        cands.push(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      }
    };
    const cols = text.split('\t');
    for(const c of cols.slice(0,5)){ scan(c); if(cands.length) return cands[0]; }
    scan(text.replace(/\s+/g,' '));
    return cands[0] || '';
  }

/* 2017 한국 소아청소년 성장도표 근사값 (만 3~17세, P50 / SD) — 선별용 */
const HT={
 M:{p50:[96.5,103.1,109.6,115.9,122.1,127.9,133.4,138.8,144.7,151.4,158.6,165.0,169.2,171.4,172.6],
    sd :[4.2,4.5,4.7,5.0,5.3,5.6,5.9,6.3,6.8,7.3,7.5,7.0,6.3,5.9,5.8]},
 F:{p50:[95.4,101.9,108.4,114.7,120.8,126.7,132.6,139.1,145.8,151.7,155.9,158.3,159.5,160.0,160.2],
    sd :[4.2,4.4,4.6,4.9,5.2,5.5,6.0,6.4,6.6,6.3,5.8,5.6,5.5,5.4,5.4]}};
/* BMI 85th / 95th 근사 (만 5~17세) */
const BMI85={M:[17.0,17.3,17.9,18.6,19.4,20.2,21.0,21.8,22.5,23.2,23.8,24.3,24.8],
             F:[16.9,17.2,17.8,18.5,19.4,20.3,21.2,22.0,22.7,23.3,23.7,24.0,24.3]};
const BMI95={M:[18.3,18.9,19.8,20.8,21.9,22.9,23.9,24.8,25.6,26.3,26.9,27.4,27.9],
             F:[18.1,18.8,19.7,20.7,21.8,22.9,23.9,24.8,25.5,26.1,26.5,26.8,27.1]};
/* 연령별 정상 성장속도 하한 (cm/년) */
function gvFloor(a){ return a<2?9 : a<4?6 : a<10?4.5 : 4; }

function interp(arr,age,base){
  const i=Math.max(0,Math.min(arr.length-2,Math.floor(age)-base));
  const f=Math.max(0,Math.min(1,age-base-i));
  return arr[i]+(arr[i+1]-arr[i])*f;
}
function zToP(z){ // 정규분포 근사
  const t=1/(1+0.2316419*Math.abs(z));
  const d=0.3989423*Math.exp(-z*z/2);
  let p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  p=z>0?1-p:p; return Math.round(p*1000)/10;
}
function htZ(sex,age,cm){
  if(age<3||age>17||!cm) return null;
  const T=HT[sex]; return (cm-interp(T.p50,age,3))/interp(T.sd,age,3);
}
function bmiBand(sex,age,bmi){
  if(age<5||age>17||!bmi) return null;
  if(bmi>=interp(BMI95[sex],age,5)) return 95;
  if(bmi>=interp(BMI85[sex],age,5)) return 85;
  return 0;
}

/* ---------- 기록지 파싱 ---------- */

function num(re,t){ const m=t.match(re); return m?parseFloat(m[1]):null; }

// 취침시각 추출 — "10시~11시이전 취침 7시반 기상"처럼 범위·수식어가 섞이거나
// 취침·기상 시각이 한 문장에 같이 나오는 표현에서도 안정적으로 "취침" 쪽 숫자만 골라낸다.
function extractBedHour(t){
  const bedIdx = t.indexOf('취침');
  if (bedIdx < 0) return null;
  const wakeIdx = t.indexOf('기상');

  // 1) '취침' 앞쪽 근처에서 가장 마지막 'N시'를 찾는다.
  //    범위 표기("10시~11시이전 취침")면 뒤쪽(더 늦은) 숫자가 채택된다.
  const before = t.slice(Math.max(0, bedIdx - 20), bedIdx);
  const beforeNums = [...before.matchAll(/(\d{1,2})\s*시/g)];
  if (beforeNums.length) return +beforeNums[beforeNums.length - 1][1];

  // 2) 앞에 없으면 '취침' 뒤에서 찾되, 그 사이에 '기상'이 먼저 나오면
  //    그 숫자는 기상시각이므로 채택하지 않는다.
  let after = t.slice(bedIdx, Math.min(t.length, bedIdx + 15));
  if (wakeIdx > bedIdx) {
    const rel = wakeIdx - bedIdx;
    if (rel < after.length) after = after.slice(0, rel);
  }
  const m = after.match(/(\d{1,2})\s*시/);
  return m ? +m[1] : null;
}

function parseIntake(raw){
  const t=raw.replace(/\s+/g," ");
  const o={};

  // 생년월일 → 만나이 (제출 시각 같은 "날짜+시각" 칸은 생년월일로 읽지 않습니다)
  const dobStr=findDobStr(raw);
  if(dobStr){ const dp=dobStr.split('-').map(Number); const b=new Date(dp[0],dp[1]-1,dp[2]);
    o.dob=dobStr; o.age=Math.round(((Date.now()-b)/31557600000)*10)/10;
    if(o.age<0||o.age>25) o.age=null; }

  // 성별 추정 — 가중 투표 (기록지에 성별 칸이 없어 단서를 모아 판단)
  let m=0,f=0;
  if(/남아\s*[-–:]|고환|변성기|음경|포경|아들/.test(t)) m+=5;
  if(/여아\s*[-–:]|가슴\s*(멍울|몽우리|발달)|유방|분비물|외동딸|장녀|딸/.test(t)) f+=5;
  if(/(초경|생리)\s*(을|를)?\s*(시작|했)/.test(t)) f+=5;      // 아이 초경
  if(/\d\s*남\s*\d*\s*녀/.test(t)){ /* 남매 — 판단 보류 */ }
  else{ if(/\d\s*녀\s*중|\d녀중/.test(t)) f+=3;
        if(/\d\s*남\s*중|\d남중|장남/.test(t)) m+=3; }
  o.sex = m>f?"M" : f>m?"F" : null;
  if(sexOverride) o.sex=sexOverride;

  // 키 · 몸무게
  o.ht=num(/키\s*:?\s*(\d{2,3}(?:\.\d)?)/,t) || num(/(\d{2,3}(?:\.\d)?)\s*cm\s*\/\s*몸무게/,t);
  o.wt=num(/몸무게\s*:?\s*(\d{1,3}(?:\.\d)?)/,t) || num(/체중\s*:?\s*(\d{1,3}(?:\.\d)?)/,t);
  if(!o.ht||!o.wt){                      // "2026-04-20/169.4/63.5" 처럼 라벨 없는 표기
    const bare=t.match(/\/\s*(\d{2,3}(?:\.\d)?)\s*(?:cm)?\s*\/\s*(\d{1,3}(?:\.\d)?)\s*(?:kg)?/);
    if(bare){ o.ht=o.ht||+bare[1]; o.wt=o.wt||+bare[2]; }
  }
  if(o.ht&&(o.ht<45||o.ht>200)) o.ht=null;
  if(o.wt&&(o.wt<3||o.wt>150)) o.wt=null;
  if(o.ht&&o.wt) o.bmi=Math.round(o.wt/Math.pow(o.ht/100,2)*10)/10;

  // 부모 키
  o.fh=num(/(?:아버지|아빠|부)\s*:?\s*(1[5-9]\d(?:\.\d)?)/,t);
  o.mh=num(/(?:어머니|어머님|엄마|모)\s*:?\s*(1[4-8]\d(?:\.\d)?)/,t);
  if(!o.fh||!o.mh){ const pair=t.match(/(1[5-9]\d(?:\.\d)?)\s*\/\s*(1[4-8]\d(?:\.\d)?)/);
    if(pair){ o.fh=o.fh||+pair[1]; o.mh=o.mh||+pair[2]; } }
  if(o.fh&&o.mh&&o.sex) o.mph=Math.round(((o.fh+o.mh+(o.sex==="M"?13:-13))/2)*10)/10;

  // 성장속도
  o.gv=num(/1년\s*(?:간|동안)?\s*(?:약\s*|대략\s*)?([\d.]+)\s*(?:cm|센치|센티)/,t)
     || num(/([\d.]+)\s*(?:cm|센치|센티)\s*(?:정도\s*)?(?:성장|자람|큼)/,t);

  if(o.gv===null||o.gv===undefined){ // 한 칸에 "8cm"처럼 값만 적힌 1년 성장량 (1~15cm)
    const cols=String(raw).split('\t').map(c=>c.trim()); for(const c of cols){ const mm=c.match(/^(\d{1,2}(?:\.\d)?)\s*(?:cm|센치|센티)$/i); if(mm){ const v=parseFloat(mm[1]); if(v>=1&&v<=15){ o.gv=v; break; } } } }

  // 모 초경
  const men=t.match(/초경\s*:?\s*(초\s*\d|중\s*\d|고\s*\d|만?\s*\d{1,2}\s*세)/);
  if(men){ const v=men[1].replace(/\s/g,"");
    o.mMen = /초[1-5]/.test(v)||/1[01]세/.test(v) ? "early" : /초6|중1/.test(v) ? "avg" : "late"; }

  // 사춘기 징후
  o.pub = /가슴\s*(멍울|몽우리|발달|나옴|통증)|유방|분비물|초경\s*시작|생리\s*시작|고환\s*(크기)?\s*(변화|커)|변성기|음모|체모|겨드랑이\s*털|정수리\s*냄새|머리\s*냄새|여드름|피지/.test(t)
        && !/징후\s*(는)?\s*(없|아직|모름|관찰\s*안)|없음\s*$/.test(t.slice(-30));
  { const tv=num(/고환\s*:?\s*(\d+(?:\.\d+)?)\s*(?:cc|ml|mL|㎖)/i,t); if(tv!==null){ o.testis=tv; if(tv>=4) o.pub=true; } }
  o.onGH = /성장\s*호르몬\s*(?:투여|주사|치료)\s*중|GH\s*(?:투여|주사|치료)\s*중|투여\s*중인?\s*약물?\s*:?\s*성장\s*호르몬/i.test(t);  // 이미 성장호르몬 치료 중
  o.menarche = /초경\s*시작|생리\s*(를)?\s*시작|초경\s*했|생리\s*중/.test(t);

  // 생활
  // 취침시각: "10시~11시이전 취침 7시반 기상"처럼 범위·수식어(이전/경 등)가 섞이거나
  // 취침과 기상 시각이 한 문장에 같이 나오는 실제 기록 표현을 견고하게 처리한다.
  // (예전 방식은 이런 경우 기상시각을 취침시각으로 잘못 읽는 경우가 있었음)
  const bedHour = extractBedHour(t);
  if(bedHour!==null){
    let h=bedHour;
    // "몇 시 취침"이라는 문구는 대개 오후~자정 무렵을 가리킴 — 12(자정)=24, 8~11시=오후 8~11시(20~23),
    // 1~7시=다음날 새벽(25~31)로 환산해야 "늦게 잔다"는 판정이 실제 시각과 맞아떨어진다.
    if(h===12) h=24;
    else if(h>=1&&h<=7) h+=24;
    else if(h>=8&&h<=11) h+=12;
    o.bed=h;
  }
  o.lateBed = o.bed>=23 || /새벽\s*[1-5]\s*시|12시\s*(넘어|이후)|자정/.test(t);
  o.media = num(/(\d)\s*시간/,(t.match(/(?:스마트폰|태블릿|미디어|폰)[^가-힣]{0,20}\d\s*시간/)||[""])[0]) || 0;
  o.noExercise = /운동\s*(은)?\s*(없|안\s*함|거의\s*안|x|X|하지\s*않)/.test(t);
  o.picky = /편식|안\s*먹|잘\s*안\s*먹|입이\s*짧|식욕\s*(이)?\s*없|소식|식사량\s*(이)?\s*적|양이\s*적/.test(t);
  o.noMilk = /우유\s*(는)?\s*(거의\s*)?(안\s*(먹|마)|잘\s*안|싫어|안먹)|유제품\s*(거의\s*)?안/.test(t);
  o.snack = /간식\s*(을)?\s*(좋아|많이|자주|매일)|단\s*음료|군것질|과자\s*(를)?\s*(좋아|자주|매일)/.test(t);

  // 보호자 걱정 문구
  o.cShort = /작(은|음|아|다|고)|앞번호|또래보다\s*(작|덜)|저신장|덜\s*자라|성장이\s*(더디|느리)/.test(t);
  o.cTall  = /또래보다\s*(크|큼)|친구보다\s*키가\s*큼|많이\s*큼|커서\s*(걱정|나중)/.test(t);
  o.cPub   = /성조숙|조숙|초경(이)?\s*(빠|일찍)|사춘기(가)?\s*(빠|일찍)|2차\s*성징/.test(t);
  o.cObes  = /비만|과체중|살이\s*(찌|많)|체중이\s*(많이|늘)|통통|뚱뚱/.test(t);
  o.cBone  = /뼈\s*나이|골연령|성장판|예측키|최종\s*키|남은\s*성장|얼마나\s*더/.test(t);
  o.cDrop  = /백분위\s*(가)?\s*(감소|떨어|내려)|퍼센트\s*(가)?\s*(감소|떨어|내려)|점점\s*(작|차이|격차)|성장이\s*(멈|둔화|정체)|안\s*크/.test(t);
  return o;
}

/* ---------- 점수화 ---------- */
const PRIO1=[4,5,3,1,7,2];
function scoreIntake(o){
  const S={},W={};
  const add=(no,pt,why)=>{ S[no]=(S[no]||0)+pt; if(why){(W[no]=W[no]||[]); if(!W[no].includes(why))W[no].push(why);} };

  const z = (o.sex&&o.age&&o.ht)?htZ(o.sex,o.age,o.ht):null;
  const p = z!==null?zToP(z):null;
  const bb= (o.sex&&o.age&&o.bmi)?bmiBand(o.sex,o.age,o.bmi):null;
  o._z=z; o._p=p; o._bb=bb;

  const early = o.pub && o.age && (o.sex==="F" ? o.age<8.5 : o.age<9.5);

  /* ── 3번 사춘기 · 성조숙 ── */
  if(o.pub&&o.age){
    const border= o.sex==="F" ? o.age<9.5 : o.age<10.5;
    if(early)      add(4,12,`만 ${o.age}세에 사춘기 징후`);
    else if(border)add(4,8,`만 ${o.age}세 · 사춘기 징후 (경계)`);
    else           add(4,4,"사춘기 징후 확인됨");
  }
  if(o.menarche) add(4,7,"초경 시작");
  if(o.cPub) add(4,3,"보호자가 성조숙을 걱정");
  if(o.mMen==="early") add(4,2,"어머니 초경이 빠른 편");
  if(z!==null&&z>1.3&&o.age&&o.age<10) add(4,4,`또래보다 큼 (${p}백분위)`);
  if(o.cTall) add(4,2,"또래보다 크다는 걱정");

  /* ── 1번 성장도표 · 저신장 ── */
  if(p!==null){
    if(p<=3)       add(1,12,`신장 ${p}백분위`);
    else if(p<=10) add(1,8,`신장 ${p}백분위`);
    else if(p<=25) add(1,5,`신장 ${p}백분위`);
  }
  if(o.mph&&o.ht&&o.age>=8&&z!==null){
    const mz=htZ(o.sex,17,o.mph);
    if(mz!==null&&z-mz<=-1.2) add(1,5,"중간부모키 대비 낮음");
  }
  if(o.cShort) add(1,p===null?3:1,"또래보다 작다는 걱정");

  /* ── 2번 골연령 · 남은 성장 ── */
  if(o.gv!==null&&o.age){
    const f=gvFloor(o.age);
    if(o.gv<f-1.5) add(5,11,`성장속도 ${o.gv}cm/년`);
    else if(o.gv<f) add(5,7,`성장속도 ${o.gv}cm/년`);
    else if(o.gv>f+3.5&&o.age<11) add(5,5,`성장속도 ${o.gv}cm/년 (빠름)`);
  }
  if(o.cDrop) add(5,7,"백분위 하락 · 성장 둔화 호소");
  if(o.cBone) add(5,6,"뼈나이·예측키를 궁금해함");
  if(o.pub&&p!==null&&p<=25) add(5,6,"사춘기 징후 + 낮은 백분위");
  if(o.pub&&o.age>=10) add(5,3,"사춘기 진행 중");

  /* ── 7번 비만 · 대사 ── */
  if(bb===95) add(7,11,`BMI ${o.bmi} (95백분위 이상)`);
  else if(bb===85) add(7,7,`BMI ${o.bmi} (85백분위 이상)`);
  if(o.cObes) add(7,3,"체중 증가를 걱정");
  if(bb&&o.snack) add(7,2,"간식·단음료 잦음");

  /* ── 4번 검사 안내 ── 초진에서 검사로 이어질 가능성이 높은 소견 */
  if(o.onGH) add(5,6,"성장호르몬 치료 중 · 효과 궁금");   // 이미 치료 중이면 효과 설명(5번)을 우선, 검사 안내(3번)는 빼기
  const willTest = !o.onGH && ((p!==null&&p<=10) || (o.gv!==null&&o.age&&o.gv<gvFloor(o.age)) || early || bb===95);
  if(willTest) add(3,5,"검사로 이어질 가능성이 높음");
  if(o.cBone) add(3,3,"검사·예측키를 궁금해함");

  /* ── 5번 생활습관 ── */
  if(o.lateBed) add(2,4,"취침이 늦음");
  if(o.media>=3) add(2,3,`미디어 ${o.media}시간`);
  if(o.noExercise) add(2,1,"규칙적 운동 없음");
  if(o.picky) add(2,1,"편식·소식");

  if(!Object.keys(S).length) add(1,5,"특이 소견 없음 · 기본 안내");

  let out=Object.keys(S).map(Number)
    .map(no=>({no,score:S[no],why:(W[no]||[]).slice(0,2).join(" · ")}))
    .sort((a,b)=>b.score-a.score || PRIO1.indexOf(a.no)-PRIO1.indexOf(b.no));

  /* 기존 초진 890건을 돌려 보니 신장 중앙값이 25백분위, 48%가 25백분위 이하였습니다.
     1번(성장도표 읽는 법)은 사실상 전 환자 공통이라 개별 슬롯을 차지할 이유가 없어,
     1순위에 고정하고 나머지 두 칸을 개별화합니다.
     예외 — 신장이 50백분위 이상이면서 조기 사춘기나 고도비만이 뚜렷하면 1번을 뺍니다. */
  const drop1 = (p!==null && p>=50) && (early || bb===95);

  let final;
  if(drop1){ final=out.slice(0,3); }
  else{
    const common = out.find(r=>r.no===1) || {no:1,score:0,why:"전 환자 공통 · 성장 평가 기본"};
    final=[common].concat(out.filter(r=>r.no!==1).slice(0,2));
  }
  const fill=[[5,"예측키 기본 안내"],[3,"검사 절차 기본 안내"],[2,"생활습관 기본 안내"]];
  for(const [no,why] of fill){ if(final.length>=3) break;
    if(!final.some(r=>r.no===no)) final.push({no,score:0,why}); }
  return final.slice(0,3);
}


const IMPRESSIONS=[
  {k:"사춘기 발달 빠름", v:[4,5], v2:[3,4]},   // v2 = STEP 2(혈액검사 전)에서 쓰는 순서: 검사 먼저, 확진 뒤(STEP 3)에 치료
  {k:"저신장", v:[1,3]},
  {k:"성장 속도 감소", v:[1,5]},
  {k:"골연령 선행", v:[5,4]},
  {k:"골연령 지연", v:[5]},
  {k:"과체중·비만", v:[7,2]},
  {k:"수면·식습관 문제", v:[2]},
  {k:"검사 진행 예정", v:[3]},
  {k:"성장호르몬 치료 검토", v:[5,6]},
  {k:"억제 + 성장호르몬 병행 검토", v:[6,4]},
  {k:"특이 소견 없음 · 추적", v:[1]},
  {k:"키 성장 고민", v:[1]}
];
// IMPRESSIONS와 같은 순서 - 차트에 적은 소견/플랜 문구를 자동으로 인식하기 위한 규칙.
// STEP2(임상 임프레션)의 자동 인식과 STEP3(진료 후)의 파싱에서 공용으로 사용합니다.
const IMPRESS_RULES=[
  /사춘기.{0,12}(빠름|빠른|조기|앞섬|앞서)|조기\s*사춘기|성조숙증|precocious\s*puberty|\bCPP\b/i,
  /저신장|단신|또래보다\s*작음/,
  /성장\s*속도\s*(감소|둔화)|성장\s*둔화|백분위\s*(감소|하락)/,
  /골연령\s*(선행|앞섬|빠름)|뼈나이.{0,10}(빠름|앞섬)/,
  /골연령\s*지연|뼈나이.{0,10}지연/,
  /과체중|비만/,
  /수면\s*(부족|문제)|식습관\s*문제|편식/,
  /검사\s*(진행|예정|필요)|정밀\s*검사|추가\s*검사|GnRH\s*(stim|자극)|LHRH\s*(stim|자극)|(stimulation|자극)\s*(test|검사)|stim\.?\s*test/i,
  /성장\s*호르몬\s*(치료|주사)|성장\s*호르몬.{0,10}(wanted|희망|원함|원해|원하|관심|문의)|\bGH\b\s*[:：]?\s*(wanted|want|희망|원함)/i,
  /억제\s*(치료|주사).{0,20}(병행|\+|및).{0,10}성장\s*호르몬|GnRH.{0,20}병행|성조숙증.{0,15}치료.{0,15}병행/i,
  /특이\s*소견\s*없음|정상\s*범위|경과\s*관찰|추적\s*관찰/,
  /키\s*(성장)?\s*(고민|걱정|궁금)|성장\s*(고민|걱정)|잘\s*(클|자랄)\s*(까|지)|키가?\s*(작|안\s*(크|커|자))|더\s*컸으면/
];
/* ---------- 차트 읽기 엔진 ----------
   1) 부정 표현 처리: "성조숙증 아님", "비만 없음", "(-)" 는 소견으로 잡지 않습니다.
   2) 초진 기록지(STEP 1에 붙여넣은 내용)와 겹치는 줄은 빼고, 차트에서 새로 추가된 내용만 읽습니다.
      (보호자가 적은 걱정이 진찰 소견으로 잘못 읽히는 것을 막기 위해)
   3) GnRH 자극검사 peak LH 수치가 있으면 기준(LH_PEAK_CUT)과 비교해 성조숙증 소견을 넣거나 뺍니다.
   4) 영상은 임프레션 순서가 아니라 점수 → 단계별 우선순위로 정렬합니다. */
const LH_PEAK_CUT=5;   // GnRH 자극검사 peak LH 기준(IU/L). 원장님 기준에 맞게 이 숫자만 바꾸세요.
const NEGT=/(없(음|어|고|다|는|습|네|었|던|이)|않|아니(에|고|다|야|라|어|었|며)|아닙|아님|배제|음성|정상|\(\s*[-–]\s*\)|\bneg|\bno\b|\bnot\b|^[은는이가도]?\s*안\s)/i;
function hitNegEv(s,re){   // 뒤따르는 부정 표현이 없는 첫 일치의 앞뒤 문구를 돌려줌(없으면 null)
  const g=new RegExp(re.source,(re.flags||"").replace("g","")+"g"), ms=[]; let m;
  while((m=g.exec(s))){ ms.push({i:m.index,l:m[0].length}); if(!m[0].length) g.lastIndex++; }
  for(let k=0;k<ms.length;k++){
    const st=ms[k].i+ms[k].l, en=Math.min(st+14, k+1<ms.length?ms[k+1].i:s.length);
    const tail=s.slice(st,en).replace(/^\s*[:：\-]\s*/,"").split(/[,./·:：\n]/)[0];
    if(!NEGT.test(tail)){
      const ls=s.lastIndexOf("\n",ms[k].i)+1; let le=s.indexOf("\n",st); if(le<0) le=s.length;
      const a=Math.max(ls,ms[k].i-14), b=Math.min(le,st+26);
      return (a>ls?"…":"")+s.slice(a,b).replace(/\s+/g," ").trim()+(b<le?"…":"");
    }
  }
  return null;
}
function peakLH(t){
  const m=t.match(/peak\s*LH\s*[:=]?\s*(\d+(?:\.\d+)?)|LH\s*peak\s*[:=]?\s*(\d+(?:\.\d+)?)|(?:최고|최대)\s*LH\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]||m[2]||m[3]) : null;
}
function normKey(s){ return String(s).toLowerCase().replace(/[\s.,;:!?·•()\[\]{}"'“”‘’\-–—_\/\\]+/g,""); }
function addedOnly(chart,intake){
  const inK=normKey(intake||"");
  if(inK.length<20) return {text:chart, added:null, skipped:0};
  const G=new Set(); for(let i=0;i+5<=inK.length;i++) G.add(inK.slice(i,i+5));
  const segs=chart.split(/[\n\t]+|[.!?。]\s+/).map(x=>x.trim()).filter(Boolean);
  const keep=[]; let skipped=0;
  for(const sg of segs){
    const k=normKey(sg);
    if(!k) continue;
    if(k.length<5){ if(k && inK.includes(k)){ skipped++; continue; } keep.push(sg); continue; }
    let hit=0,tot=0; for(let i=0;i+5<=k.length;i++){ tot++; if(G.has(k.slice(i,i+5))) hit++; }
    if(hit/tot>=0.7) skipped++; else keep.push(sg);
  }
  return {text:keep.join("\n"), added:keep, skipped};
}
function chartFindings(text){
  const out=[];
  IMPRESS_RULES.forEach((re,i)=>{ const ev=hitNegEv(text,re); if(ev!==null) out.push({i,ev}); });
  detectTableImpressions(text).idx.forEach(i=>{ if(!out.some(o=>o.i===i)) out.push({i,ev:"검사표 수치"}); });
  return out;
}
function analyzeChart(raw,intake){
  const d=addedOnly(raw,intake||"");
  const usedDiff=d.added!==null;
  const text=usedDiff?d.text:raw;
  const ev=text.trim()?chartFindings(text):[];
  const notes=[];
  const lh=peakLH(text);
  if(lh!==null){
    const t7=ev.findIndex(f=>f.i===7 && /stim|자극/i.test(f.ev));   // 결과가 이미 나왔으면 "검사 예정"은 아님
    if(t7>=0){ ev.splice(t7,1); notes.push("GnRH 자극검사 결과(peak LH)가 있어 '검사 진행 예정'은 뺐습니다."); }
    const at=ev.findIndex(f=>f.i===0);
    if(lh>=LH_PEAK_CUT){
      if(at<0) ev.push({i:0,ev:"peak LH "+lh}); else ev[at].ev+=" · peak LH "+lh;
      notes.push("peak LH "+lh+" ≥ "+LH_PEAK_CUT+" → 성조숙증 소견으로 읽었습니다.");
    }else{
      if(at>=0) ev.splice(at,1);
      notes.push("peak LH "+lh+" < "+LH_PEAK_CUT+" → 성조숙증 소견은 제외했습니다. 다르면 STEP 2에서 직접 골라 주세요.");
    }
  }
  return {idx:[...new Set(ev.map(f=>f.i))], ev, notes, usedDiff, added:d.added, skipped:d.skipped};
}
function autoDetectImpressions(raw){ return analyzeChart(raw,"").idx; }
// 단계별 영상 우선순위: STEP 2(혈액검사 전)는 검사·치료 설명 위주, STEP 3(확정)은 치료 위주
const PRIO_STAGE={2:[3,4,5,6,7,1,2], 3:[4,6,5,7,3,1,2]};
function stageV(i,stage){ const im=IMPRESSIONS[i]; return (stage===2 && im.v2) ? im.v2 : im.v; }
function rankVideos(idxList,stage,limit){
  const sc={};
  idxList.forEach(i=>stageV(i,stage).forEach((no,pos)=>{ sc[no]=(sc[no]||0)+Math.max(1,3-pos); }));
  const pr=PRIO_STAGE[stage]||PRIO_STAGE[2];
  return Object.keys(sc).map(Number).sort((a,b)=>sc[b]-sc[a] || pr.indexOf(a)-pr.indexOf(b)).slice(0,limit||3);
}
const esc=x=>String(x).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// 차트 프로그램이 "AGE BA TS WT HT BMI" 같은 표 형태로 수치를 뽑아 줄 때는
// 문구가 아니라 숫자만 있어서 위의 문구 인식(IMPRESS_RULES)이 아무것도 못 찾는다.
// 이 표를 직접 읽어서 골연령 선행/지연, 저신장, 과체중, 사춘기 조기 징후를 함께 판단한다.
function detectTableImpressions(t){
  const re = /AGE\s+BA\s+TS\s+WT\s+HT\s+BMI(?:\s+BT)?\s*(?:\d{4}-\d{1,2}-\d{1,2}\s*)?([\d.]+)\s+([\d.]+)\s+T?(\d)\s+([\d.]+)(?:\(([\d.]+)\))?\s+([\d.]+)(?:\(([\d.]+)\))?\s+([\d.]+)(?:\(([\d.]+)\))?/;
  const m = t.match(re);
  if(!m) return { found:false, idx:[] };

  const age=+m[1], ba=+m[2], ts=+m[3];
  const htPct = m[7]!==undefined?+m[7]:null;
  const bmiPct = m[9]!==undefined?+m[9]:null;

  const idx = new Set();
  const baDiff = ba - age;
  if(baDiff >= 0.8) idx.add(3);        // 골연령 선행
  else if(baDiff <= -0.8) idx.add(4);  // 골연령 지연

  if(htPct !== null && htPct <= 10) idx.add(1);   // 저신장
  if(bmiPct !== null && bmiPct >= 85) idx.add(5); // 과체중·비만

  // 사춘기 징후 — 성별별 조기사춘기 나이 기준(여아 9.5세/남아 10.5세 미만)을 재사용.
  // 성별을 아직 못 골랐으면 더 넉넉한 여아 기준(9.5세)으로 판단.
  if(ts >= 2){
    const early = sexOverride==='M' ? age<10.5 : age<9.5;
    if(early) idx.add(0);
  }
  return { found:true, idx:[...idx], raw:{age,ba,ts,htPct,bmiPct} };
}


  /* ---------- 공개 함수 ---------- */
  // 구글폼 한 줄에는 시트 스크립트가 덧붙인 링크·문구가 같이 따라옵니다. 그 부분은 빼고 읽습니다.
  function sanitizeIntake(raw){
    let t = String(raw||'').replace(/\r/g,'');
    const cut = t.search(/\[삼성자라다\s*소아청소년과\]|진료\s*전에\s*아래\s*영상/);
    if(cut > 0) t = t.slice(0, cut);
    t = t.replace(/https?:\/\/\S+/g, ' ');
    return t;
  }
  function vid(no, why){ const v=V(no); return { no, title:v.title, question:v.sub, link:v.src, why:why||'' }; }
  function thumb(link){ const m=String(link||'').match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{6,})/); return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : ''; }
  // 초진 기록지 → 진료 전 영상 3편
  function preVideos(raw, sex){
    sexOverride = sex || null;
    const o = parseIntake(sanitizeIntake(raw));
    const list = scoreIntake(o);
    sexOverride = null;
    return { o, list, videos: list.map(r=>vid(r.no, r.why)) };
  }
  // 진료 후 소견/플랜 텍스트 → 영상 3편 (STEP 3 규칙)
  // exclude: 진료 전에 이미 보낸 영상 번호 — 진료 후에는 새로운 영상을 보여주기 위해 제외합니다.
  function postVideos(text, intake, sex, exclude){
    sexOverride = sex || null;
    const res = analyzeChart(String(text||''), intake ? sanitizeIntake(intake) : '');
    sexOverride = null;
    const ex = new Set(exclude || []);
    const ranked = rankVideos(res.idx, 3, 7);
    const nos = ranked.filter(n=>!ex.has(n)).slice(0,3);
    return { res, nos, videos: nos.map(n=>vid(n)), excluded: ranked.filter(n=>ex.has(n)) };
  }
  function link(nos){ return KIOSK_BASE + '#v=' + nos.join(''); }
  function watchLink(nos){ return FV_VIDEO_SITE + '?v=' + nos.join(''); }
  function preMessageBody(videos){
    const l = videos.map((v,i)=>`${i+1}순위) ${v.no}. ${v.title}`).join('\n');
    return `진료 전에 아래 영상을 순서대로 봐 주세요. 같은 설명을 진료실에서 반복하지 않고, 아이에게 필요한 이야기부터 시작할 수 있습니다.\n\n${l}\n\n${link(videos.map(v=>v.no))}`;
  }
  return { VIDEOS, V, vid, thumb, link, watchLink, sanitizeIntake, findDobStr, parseIntake, scoreIntake, analyzeChart, rankVideos, preVideos, postVideos, preMessageBody, IMPRESSIONS };
})();

/* ---------- 초진 기록지 한 줄 → 접수 정보 ---------- */
function parseFirstIntake(raw){
  const clean = JRDV.sanitizeIntake(raw);
  const out = { name:'', dob:'', sex:'', phone:'', ht:null, wt:null, fh:null, mh:null, history:[] };
  const cols = clean.split('\t').map(c=>c.trim());
  const flat = clean.replace(/\s+/g,' ');
  out.dob = JRDV.findDobStr(clean);
  const STOP = /^(없음|있음|모름|정상|해당없음|아니오|예|남|여)$/;
  for(const c of cols.slice(0,5)){ if(/^[가-힣]{2,4}$/.test(c) && !STOP.test(c)){ out.name = c; break; } }
  if(!out.name){ const nm = flat.match(/(?:이름|성함|환아명?)\s*[:：]?\s*([가-힣]{2,4})/); if(nm) out.name = nm[1]; }
  // 정규식의 '뒤돌아보기(lookbehind)'는 iPadOS 16.3 이하 Safari에서 앱 전체가 안 열리게 해서 쓰지 않고 직접 확인합니다
  const ph = (function(){ const re = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}(?!\d)/g; let m; while((m = re.exec(flat))){ if(m.index === 0 || !/\d/.test(flat[m.index-1])) return m; } return null; })();
  if(ph){
    const dg = ph[0].replace(/\D/g,'');
    out.phone = dg.length===11 ? `${dg.slice(0,3)}-${dg.slice(3,7)}-${dg.slice(7)}` : `${dg.slice(0,3)}-${dg.slice(3,6)}-${dg.slice(6)}`;
  }
  const o = JRDV.parseIntake(clean);
  out.sex = o.sex || '';
  out.fh = o.fh; out.mh = o.mh; out.ht = o.ht; out.wt = o.wt;
  const hre = /((?:19|20)\d{2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\s*[\/,:\s]*키\s*:?\s*(\d{2,3}(?:\.\d)?)\s*(?:cm|센티)?\s*[\/,\s]*(?:몸무게|체중)\s*:?\s*(\d{1,3}(?:\.\d)?)/g;
  let hm; const seen = new Set();
  while((hm = hre.exec(flat))){
    const date = `${hm[1]}-${String(hm[2]).padStart(2,'0')}-${String(hm[3]).padStart(2,'0')}`, h = parseFloat(hm[4]), w = parseFloat(hm[5]);
    if(h<45||h>200||w<3||w>150||seen.has(date)) continue;
    seen.add(date); out.history.push({ date, height:h, weight:w });
  }
  out.history.sort((a,b)=> a.date<b.date ? -1 : 1);
  const tg = flat.match(/목표\s*키\s*[:：(]?\s*(\d{3}(?:\.\d)?)/); if(tg) out.target = parseFloat(tg[1]);
  else{ for(const c of cols){ const m = c.match(/^(1[5-9]\d)\s*cm$/i); if(m){ out.target = parseFloat(m[1]); break; } } }
  return out;
}
