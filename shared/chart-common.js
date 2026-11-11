/* 삼성자라다 — 차트 글 공용 함수 (index.html · flow.html 이 함께 씁니다)
 * 이 파일을 고치면 두 화면이 같이 바뀝니다. 고친 뒤에는 두 HTML의 ?v= 숫자도 올려 주세요. */
function splitChartForAI(rawText){
  let text = String(rawText||'').replace(/\r/g,'');
  const marker = '— 원본 메모 —';
  const mi = text.indexOf(marker);
  if(mi >= 0) text = text.slice(mi + marker.length);
  const lines = text.split('\n');
  const isTableHeader = l => /^\s*등록일자(\s|$)/.test(l);  // 한글 뒤엔 \b(단어경계)가 안 먹어서 공백/줄끝으로 판단
  const isTableRow = l => /^\s*\d{4}-\d{2}-\d{2}\t/.test(l);
  const FORM = /^\s*[#＃]?\s*[＊*]?\s*(\(\s*\d+\s*(\+\s*\d+\s*)?\)\s*week|출생|과거\s*병력|투여\s*중인\s*약물|부\s*[:：(]|모\s*[:：(]|형제|2촌|최근\s*성장\s*기록|고민|희망\s*키|백분율|체질량지수|식이|운동|수면|미디어|생활\s*습관|걱정거리|사춘기\s*징후)/;
  const STRUCT = /^\s*[#＃]\s*(SMR|CA\s*\/\s*BA|Image|Scoliosis|PAH)/i;
  const planIdx = lines.findIndex(l => /^\s*[#＃]\s*Plan/i.test(l));
  const labIdx = lines.findIndex(l => /^\s*[#＃]\s*Lab/i.test(l));
  let tableStart = lines.findIndex(isTableHeader);
  if(tableStart < 0) tableStart = lines.findIndex(isTableRow);
  const end = tableStart >= 0 ? tableStart : lines.length;
  const plan = [], labs = [], extra = [];
  let labEnd = -1;
  if(labIdx >= 0){
    labEnd = lines.length;
    for(let i = labIdx + 1; i < lines.length; i++){
      if(/^\s*[#＃]\s*(CA\s*\/\s*BA|Image|Scoliosis|PAH|Plan)/i.test(lines[i])){ labEnd = i; break; }
    }
  }
  lines.forEach((l, i) => {
    if(!l.trim() || isTableHeader(l) || isTableRow(l)) return;
    if(planIdx >= 0 && i >= planIdx && i < end){ plan.push(l.trim()); return; }
    if(labIdx >= 0 && i >= labIdx && i < labEnd){ labs.push(l.trim()); return; }
    if(FORM.test(l) || STRUCT.test(l)) return;
    extra.push(l.trim());
  });
  // 표 뒤에 따로 적은 메모(예: "최근에 아파서 집에 있었다")는 plan 범위 밖이므로 extra로 들어갑니다.
  return {
    plan: plan.join('\n').slice(0, 1800),
    labs: labs.join('\n').slice(-2200),     // 날짜순으로 쌓이는 블록이라 최근 것이 뒤쪽 → 뒤에서부터 자름
    extra: extra.join('\n').slice(0, 1200),
    chart: text.slice(0, 5000)
  };
}
function fvLifestyleDraft(kind, p){
  const text = [p.diagnosis||'', (p.firstVisit&&p.firstVisit.post&&p.firstVisit.post.summary)||'', p.notes||''].join(' ');
  const obese = /비만|과체중/.test(text);
  const early = /성조숙|조발|사춘기/.test(text);
  if(kind==='exercise'){
    let s = '하루 30~60분, 주 3~5회 정도 몸을 움직이는 시간을 만들어 주세요. 줄넘기·농구·수영·자전거처럼 뛰고 점프하는 운동이 좋아요. 운동 직후와 잠들기 직전의 과격한 운동은 피하는 편이 좋아요.';
    if(obese) s += ' 체중 관리를 위해 걷기·자전거 같은 유산소 운동을 매일 꾸준히 하고, 화면 보는 시간은 줄여 주세요.';
    return s;
  }
  if(kind==='nutrition'){
    let s = '매 끼니 단백질 반찬(살코기·생선·달걀·두부·콩)을 한 가지씩 꼭 넣어 주세요. 아침 식사를 거르지 않고, 우유·요거트 같은 칼슘 식품을 하루 1~2회 챙겨 주세요. 채소와 과일은 매일, 탄산·단 음료·야식은 줄여 주세요. 성장 보조식품이나 영양제는 먹이기 전에 상의해 주세요.';
    if(obese) s += ' 빨리 먹기, 과식, 야식을 줄이고 간식은 정해진 시간·양으로 먹도록 해주세요. 무리한 식사 제한은 하지 마세요.';
    if(early) s += ' 성호르몬이 들어 있다고 알려진 보양식·건강식품은 피해 주세요.';
    return s;
  }
  // sleep
  return '밤 10시 이전에 잠자리에 들어 하루 9~10시간(초등 기준)을 푹 자도록 해주세요. 자기 1시간 전에는 스마트폰·TV를 끄고, 방은 어둡고 조용하게 해주세요. 성장호르몬은 깊이 잠든 뒤 가장 많이 나오기 때문에, 수면 시간만큼 "깊은 잠"이 중요해요. 주말에도 기상 시간을 크게 바꾸지 않는 것이 좋아요.';
}
