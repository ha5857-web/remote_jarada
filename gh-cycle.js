window.JRD_GH_BUILD='20261101a';
/* ════════════════════════════════════════════════════════════════
 * 자라다 성장 달력 — 성장호르몬 주사 스케줄 (동아 그로트로핀II 펜)
 *
 * 설치: calendar.html 맨 아래 </body> 바로 위에 한 줄만 넣으면 됩니다.
 *       <script src="gh-cycle.js"></script>      (calendar.html 과 같은 폴더에 두세요)
 *
 * - 세팅 용량 + 첫 투여일 + 다음 외래일만 넣으면 외래일까지 달력에 자동 배치
 * - 6일 맞고 1일 쉬기 (연속 일수는 바꿀 수 있음)
 * - 어떤 날 못 맞으면 그 회차가 다음날로 밀리고, 이후 전체가 자동으로 다시 계산됨
 * - 달력 칸에 "몇 번째/세트 총 몇 회" 와 그날 용량 표시 (카트리지 교체일 포함)
 * - 아이별로 따로 저장(브라우저 localStorage), 앱의 11개 언어 지원
 * ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ───── 동아 Growtropin-II PEN 용량환산표 (병원 비치 용량환산표 사진 기준) ─────
   * 'N x 용량' = 같은 용량 N회, 'a+b' = 한 번 맞을 때 카트리지가 바뀌어 a(남은 양)+b(새 카트리지)로 나눠 맞는 회차
   * 한 세트 = 카트리지 30단위 합계(30 또는 2개 분량 60) — 세트가 끝나면 1회차부터 다시 시작 */
  var SPEC = {
    '2.6': '6x2.4,6x2.6',
    '2.8': '4x2.6,7x2.8',
    '3':   '10x3',
    '3.4': '3x3.2,6x3.4',
    '3.8': '2x3.6,6x3.8',
    '4.2': '4x4.2,3x4.4',
    '4.6': '6x4.6,2.4+2.2,5x4.6,4.8',
    '5':   '6x5',
    '5.4': '5x5.4,3+2.4,2x5.4,3x5.6',
    '6':   '5x6',
    '6.6': '4x6.6,3.6+3,6.6,3x6.8',
    '7.4': '2x7.2,2x7.4'
  };
  /* 펜(제품) 목록 — cart: 카트리지 1개 분량(단위). 새 제품은 여기에 용량환산표(spec)만 추가하면 됩니다.
   *  예) gq: { name:'지노트로핀 고퀵 36단위', cart:36, keys:[...], spec:{ '설정용량':'6x5,...' } } */
  /* 펜(제품) 목록 — cart: 카트리지/펜 1개 분량(단위).
   * ① spec 방식: 병원 비치 용량환산표를 그대로 옮긴 제품(동아 그로트로핀II 펜)
   * ② gen 방식: mg 다이얼 펜 — 펜 1개를 남김없이 쓰도록 전체 클릭 수를 N회(=총단위÷설정용량 반올림)에 고르게 나눔(앞쪽이 1클릭 적게)
   *    gen = { mg: 1클릭당 mg, total: 총 mg, minMg/maxMg: 1회 최소·최대 mg, step: 설정용량 간격(단위) }, 1mg = 3단위 */
  /* ───── 제품 규격 덮어쓰기(gh-spec.json / 이 브라우저 테스트용 jrdGhSpec) ─────
   * override: { 제품id: { name, mg, total, minMg, maxMg, step, inuse, ... } }  add: [ { id, type:'gen'|'vial', name, company, p:{...} } ] */
  var OV = { o: {}, add: [], co: {} };
  (function () {
    function take(j) {
      if (!j) return;
      if (j.override) Object.keys(j.override).forEach(function (k) { OV.o[k] = j.override[k]; });
      if (j.add) j.add.forEach(function (a) { if (a && a.id && a.type && a.p) { OV.add.push(a); if (a.company) OV.co[a.id] = a.company; } });
      window.JRD_GH_SPEC_VER = j.version || 1;
    }
    try { if (/^https?:/.test(location.protocol)) { var x = new XMLHttpRequest(); x.open('GET', 'gh-spec.json?v=' + Math.floor(Date.now() / 600000), false); x.send(); if (x.status === 200) take(JSON.parse(x.responseText)); } } catch (e) {}
    try { var raw = localStorage.getItem('jrdGhSpec'); if (raw) take(JSON.parse(raw)); } catch (e) {}
  })();
  function applyOv(o, g) { if (!o) return; Object.keys(o).forEach(function (k) { if (k !== 'name' && k !== 'company') g[k] = o[k]; }); }
  var PENS = {
    g2: { name: '동아 그로트로핀투 카트리지 30IU (비급여) · 그로트로핀-II Pen', cart: 30, inuse: 28, keys: ['2.6', '2.8', '3', '3.4', '3.8', '4.2', '4.6', '5', '5.4', '6', '6.6', '7.4'], spec: SPEC }
  };
  function addGen(id, name, g) {
    if (OV.o[id] && OV.o[id].name) name = OV.o[id].name; applyOv(OV.o[id], g);
    g.unit = g.mg * 3; g.clicks = Math.round(g.total / g.mg); g.minC = Math.round(g.minMg / g.mg); g.maxC = Math.round(g.maxMg / g.mg);
    PENS[id] = { name: name, cart: g.total * 3, gen: g, keys: [] };
    var tot = g.clicks * g.unit, seenN = {};
    for (var T = g.step; T <= tot; T += g.step) {
      T = Math.round(T * 1000) / 1000;
      var N = Math.round(tot / T); if (N < 3 || N > 40) continue;
      var base = Math.floor(g.clicks / N), extra = g.clicks - base * N;
      if (base < g.minC || base + (extra ? 1 : 0) > g.maxC) continue;
      if (seenN[N]) continue;
      if (g.inuse && penCounts(g, genSeq(g, String(T)).list) > perPenMax(g.inuse)) continue;   // 펜 1개를 사용기한 안에 못 쓰는 묶음은 제외
      seenN[N] = 1;
      PENS[id].keys.push(String(T));
    }
    // 펜 2개 묶음: 한 번은 두 펜에 걸쳐 맞는 회차가 생기는 대신 선택지가 촘촘해짐 (홀수 회수만 — 짝수는 펜 1개 묶음을 두 번 쓰는 것과 같음)
    var C2 = g.clicks * 2;
    for (var N2 = 5; N2 <= 41; N2 += 2) {
      var b2 = Math.floor(C2 / N2), e2 = C2 - b2 * N2;
      if (b2 < g.minC || b2 + (e2 ? 1 : 0) > g.maxC) continue;
      if (g.inuse && penCounts(g, genSeq(g, 'M2N' + N2).list) > perPenMax(g.inuse)) continue;
      PENS[id].keys.push('M2N' + N2);
    }
    PENS[id].keys.sort(function (a, b) { return avgOf(g, a) - avgOf(g, b); });
  }
  // 첫 사용 후 사용기한(일) → 펜·카트리지·바이알 1개로 맞을 수 있는 최대 횟수 (6일 맞고 1일 쉬기 기준)
  function perPenMax(days) { return Math.max(1, Math.floor(days * 6 / 7)); }
  function penCounts(g, list) {   // 각 펜(카트리지)에 걸치는 주사 횟수 중 최댓값 (두 펜에 걸친 회차는 양쪽 모두 셈)
    var used = 0, cnt = {}, mx = 0;
    list.forEach(function (c) { var p0 = Math.floor(used / g.clicks), p1 = Math.floor((used + c - 1) / g.clicks); for (var q = p0; q <= p1; q++) { cnt[q] = (cnt[q] || 0) + 1; if (cnt[q] > mx) mx = cnt[q]; } used += c; });
    return mx;
  }
  function avgOf(g, k) { var m = /^M(\d)N(\d+)$/.exec(k); return m ? g.clicks * g.unit * (+m[1]) / (+m[2]) : parseFloat(k); }
  function genSeq(g, k) {   // → { N, M, list: [클릭수...] }
    var m = /^M(\d)N(\d+)$/.exec(k), M = m ? +m[1] : 1, N = m ? +m[2] : Math.round(g.clicks * g.unit / parseFloat(k)), C = g.clicks * M;
    var base = Math.floor(C / N), extra = C - base * N, list = [];
    for (var i = 0; i < N; i++) list.push(base + (i >= N - extra ? 1 : 0));
    return { N: N, M: M, list: list, base: base, extra: extra };
  }
  /* ════ 국내 시판 성장호르몬 (1일 1회 제제) ════
   * 근거: 약학정보원(health.kr) 허가정보, 심평원 급여정보, 제조사 제품페이지·사용설명서, 해외 허가문서(같은 펜)
   * inuse = 첫 사용 후 사용기한(일). 그 안에 다 못 쓰는 묶음은 선택지에서 뺌 */

  // ── LG화학 유트로핀 (현재 국내 제품: 유트로핀주 4IU · 에스펜 36IU · 카트리지 48IU) ──
  // 유트로핀에스펜주 36IU/3.0mL(급여): 최소 용량 조절 단위 0.5IU(LG화학), 첫 사용 후 냉장 42일(health.kr). 1회 최대 미공개 → 1회 12IU 이하
  addGen('es36', '유트로핀 에스펜주 36IU (급여)', { mg: 0.5 / 3, total: 12, minMg: 0.5 / 3, maxMg: 4, step: 0.5, iu: true, inuse: 42 });
  // 유트로핀카트리지주 48IU/2.88mL + 유트로핀에코펜48(비급여): 첫 사용 후 냉장 42일(허가정보). 다이얼 최소 단위는 공개 자료 없음 →
  // 0.1IU·0.5IU 어느 펜에서도 맞출 수 있는 0.5IU 기준으로 계산, 1회 12IU 이하. 잔량 맞춤 기능 → 카트리지 교체 회차는 남은 양 + 새 카트리지로 나눠 맞음
  addGen('ec48', '유트로핀 카트리지 48IU · 에코펜48 (비급여, 0.5단위 기준)', { mg: 0.5 / 3, total: 16, minMg: 0.5 / 3, maxMg: 4, step: 0.5, iu: true, inuse: 42 , cart: true});

  // ── 동아에스티 그로트로핀투 ──
  // 아이펜 30IU/2.7mL(급여·일체형): 최소 0.1IU, 1회 최대 8.9IU, 첫 사용 후 냉장 28일 / 아이펜 20IU/1.8mL: 0.1IU, 냉장 21일 (health.kr·ConnectDI)
  addGen('ip30', '동아 그로트로핀투 아이펜 30IU (급여·일체형)', { mg: 0.1 / 3, total: 10, minMg: 0.1 / 3, maxMg: 8.9 / 3, step: 0.5, iu: true, inuse: 28 });
  addGen('ip20', '동아 그로트로핀투 아이펜 20IU (일체형)', { mg: 0.1 / 3, total: 20 / 3, minMg: 0.1 / 3, maxMg: 7 / 3, step: 0.5, iu: true, inuse: 21 });
  // 카트리지 20IU/1.8mL(급여) · 30IU/2.7mL(비급여, 위 병원 환산표) + 그로트로핀-II Pen(전자식, 0.2IU 단위, 1회 최대 15IU). 20IU 냉장 21일
  addGen('dc20', '동아 그로트로핀투 카트리지 20IU (급여) · 그로트로핀-II Pen', { mg: 0.2 / 3, total: 20 / 3, minMg: 0.2 / 3, maxMg: 15 / 3, step: 0.5, iu: true, inuse: 21 , cart: true});

  // ── 한국화이자 지노트로핀 ── (0.15mg·0.05mg/클릭: 화이자 매뉴얼, 펜 0.1·0.2mg: 한국화이자 허가문서) 재조제 후 냉장 28일
  addGen('gq', '지노트로핀 고퀵 36단위(12mg)', { mg: 0.15, total: 12, minMg: 0.3, maxMg: 4.5, step: 0.5, inuse: 28 });
  addGen('gq53', '지노트로핀 고퀵 16단위(5.3mg)', { mg: 0.05, total: 5.3, minMg: 0.1, maxMg: 1.5, step: 0.25, inuse: 28 });
  addGen('gp53', '지노트로핀주 16IU(5.3mg) 카트리지 (급여) · 지노트로핀 펜', { mg: 0.1, total: 5.3, minMg: 0.1, maxMg: 2.0, step: 0.25, inuse: 28 , cart: true});
  addGen('gp12', '지노트로핀주 12mg 카트리지 (급여) · 지노트로핀 펜', { mg: 0.2, total: 12, minMg: 0.2, maxMg: 4.0, step: 0.5, inuse: 28 , cart: true});

  // ── 노보노디스크 노디트로핀 노디플렉스주 ── (국내 급여 확인: 10mg/1.5mL) 5mg 0.025mg·최대 1.5mg / 10mg 0.05mg·최대 3.0mg / 15mg 0.075mg·최대 4.5mg, 첫 사용 후 냉장 28일 (노디플렉스 허가문서)
  addGen('nd10', '노디트로핀 노디플렉스주 10mg/1.5mL (급여)', { mg: 0.05, total: 10, minMg: 0.05, maxMg: 3.0, step: 0.5, inuse: 28 });
  addGen('nd5', '노디트로핀 노디플렉스주 5mg/1.5mL', { mg: 0.025, total: 5, minMg: 0.025, maxMg: 1.5, step: 0.25, inuse: 28 });
  addGen('nd15', '노디트로핀 노디플렉스주 15mg/1.5mL', { mg: 0.075, total: 15, minMg: 0.075, maxMg: 4.5, step: 0.5, inuse: 28 });

  // ── 한국머크 싸이젠 리퀴드 카트리지 ── 6mg/1.03mL(5.83mg/mL, 급여) · 12mg/1.5mL(8mg/mL) · 20mg/2.5mL. 이지포드(전자식) 또는 알루에타 펜(0.1mg 단위).
  // 첫 주사 후 냉장 28일. 이지포드 1회 범위 6mg 0.15~4.66mg, 12·20mg 0.5~6.4mg → 두 기기 모두 맞출 수 있게 0.1mg 단위·그 범위 안으로 계산
  addGen('sz6', '싸이젠 리퀴드 6mg (급여) · 이지포드/알루에타', { mg: 0.1, total: 6, minMg: 0.2, maxMg: 4.6, step: 0.25, inuse: 28 , cart: true});
  addGen('sz12', '싸이젠 리퀴드 12mg · 이지포드/알루에타', { mg: 0.1, total: 12, minMg: 0.5, maxMg: 6.4, step: 0.5, inuse: 28 , cart: true});
  addGen('sz20', '싸이젠 리퀴드 20mg · 이지포드/알루에타', { mg: 0.1, total: 20, minMg: 0.5, maxMg: 6.4, step: 1, inuse: 28 , cart: true});

  // ── 싸이젠코리아 싸이트로핀에이 카트리지 (산도즈 옴니트로프 동일 제제) ── 5mg(급여)·10mg·15mg(급여)/1.5mL, 첫 주사 후 냉장 28일 (health.kr)
  // 옴니트로프 펜 5 = 0.05mg 단위, 펜 10 = 0.1mg 단위 (옴니트로프 사용설명서), 싸이트로핀 펜 15 = 0.1mg 단위·1회 최대 5.4mg(같은 계열 15mg 펜 자료)
  addGen('sc5', '싸이트로핀에이 카트리지 5mg (급여) · 옴니트로프 펜 5', { mg: 0.05, total: 5, minMg: 0.05, maxMg: 1.7, step: 0.25, inuse: 28 , cart: true});
  addGen('sc10', '싸이트로핀에이 카트리지 10mg · 옴니트로프 펜 10', { mg: 0.1, total: 10, minMg: 0.1, maxMg: 3.4, step: 0.5, inuse: 28 , cart: true});
  addGen('sc15', '싸이트로핀에이 카트리지 15mg (급여) · 싸이트로핀 펜 15', { mg: 0.1, total: 15, minMg: 0.1, maxMg: 5.4, step: 0.5, inuse: 28 , cart: true});

  // ── 바이알(주사기로 뽑는 제품) ── 매회 같은 용량, 한 바이알 = min(바이알 용량 ÷ 1회 용량, 사용기한 안의 주사 횟수)회, 남은 양은 폐기
  function addVial(id, name, v) {
    if (OV.o[id] && OV.o[id].name) name = OV.o[id].name; applyOv(OV.o[id], v);
    // v = { iu: 단위 기준 여부, total: 바이알 용량(단위 또는 mg), conc: 1mL당(단위 또는 mg, 모르면 null), days: 첫 사용 후 사용기한, step, min, max, liquid: 액상(재조제 불필요) }
    v.maxInj = perPenMax(v.days);
    PENS[id] = { name: name, cart: v.iu ? v.total : v.total * 3, vial: v, keys: [] };
    var st = v.stepMl && v.conc ? v.conc * v.stepMl : v.step;   // 주사기 눈금(mL)에 딱 맞는 용량만
    for (var i = Math.ceil(v.min / st - 1e-9); i * st <= Math.min(v.max, v.total) + 1e-9; i++) PENS[id].keys.push(String(Math.round(i * st * 1000) / 1000));
  }
  // 유트로핀주 4IU(급여): 동결건조 + 첨부용제 1mL(4IU/mL), "용해 후 가능한 한 빨리 사용" → 매회 새 바이알 1개 (health.kr·LG화학)
  addVial('eu4', '유트로핀주 4IU 바이알 (급여·매회 새 바이알)', { iu: true, total: 4, conc: 4, days: 1, stepMl: 0.05, min: 0.4, max: 4 });
  // (바이알 용량 선택지는 주사기 눈금 0.01mL(유트로핀주는 0.05mL)에 딱 맞는 값만 — 예: 8IU/mL이면 0.08단위 간격)
  // 그로트로핀투주사액 바이알(액상 8IU/mL): 4IU/0.5mL 개봉 후 냉장 2일 · 12IU/1.5mL(급여) 14일 · 16IU/2mL 20일 (health.kr)
  addVial('gv12', '그로트로핀투주사액 12IU/1.5mL 바이알 (급여)', { iu: true, liquid: true, total: 12, conc: 8, days: 14, stepMl: 0.01, min: 0.4, max: 6 });
  addVial('gv16', '그로트로핀투주사액 16IU/2mL 바이알', { iu: true, liquid: true, total: 16, conc: 8, days: 20, stepMl: 0.01, min: 0.4, max: 8 });
  addVial('gv4', '그로트로핀투주사액 4IU/0.5mL 바이알', { iu: true, liquid: true, total: 4, conc: 8, days: 2, stepMl: 0.01, min: 0.4, max: 4 });
  // 조맥톤주 10mg(바이알+용제 1mL → 10mg/mL), 재조제 후 냉장 28일 (health.kr)
  addVial('zm10', '조맥톤주 10mg (바이알·주사기)', { total: 10, conc: 10, days: 28, stepMl: 0.01, min: 0.2, max: 10 / 3 });
  // 조맥톤 12.96IU(급여, 바늘 없는 조맥젯 2 비전으로 투여), 재조제 후 냉장 14일. 국내 용제량 자료 없음 → mL 대신 단위로만 표시
  addVial('zm13', '조맥톤 12.96IU (급여·조맥젯)', { iu: true, total: 12.96, conc: null, days: 14, step: 0.1, min: 0.5, max: 6.4 });

  OV.add.forEach(function (a) { try { if (a.type === 'vial') addVial(a.id, a.name, Object.assign({}, a.p)); else addGen(a.id, a.name, Object.assign({}, a.p)); } catch (e) { console.error('[gh-spec]', e); } });
  function doseLabel(pen, k) {
    if (pen.vial) {
      var v = pen.vial, D = parseFloat(k), Nv = Math.min(Math.floor(v.total / D + 1e-9), v.maxInj), ml = v.conc ? Math.round(D / v.conc * 1000) / 1000 : null;
      return D + (v.iu ? t('unit') : 'mg') + (ml != null ? ' (' + ml + 'mL)' : '') + ' · ' + Nv + '×';
    }
    var g = pen.gen;
    if (!g) return k + ' ' + t('unit');
    var q = genSeq(g, k), N = q.N, base = q.base, extra = q.extra;
    var r = function (x) { return String(Math.round(x * 100) / 100); };
    var u = t('unit'), part = function (c, n) { return r(c * g.unit) + u + (g.iu ? '' : '(' + r(c * g.mg) + 'mg)') + ' ×' + n; };
    var txt = part(base, N - extra) + (extra ? ' + ' + part(base + 1, extra) : '');
    return (q.M > 1 ? '[' + gt('pens2') + '] ' : '') + N + '× · ' + gt('avg') + ' ' + r(g.clicks * g.unit * q.M / N) + u + ' = ' + txt;
  }
  function parseSpec(str) {
    var out = [];
    str.split(',').forEach(function (tok) {
      var m = /^(?:(\d+)x)?([\d.]+(?:\+[\d.]+)?)$/.exec(tok.trim());
      if (!m) return;
      var n = m[1] ? +m[1] : 1;
      var segs = m[2].split('+').map(parseFloat);
      for (var i = 0; i < n; i++) out.push(segs.slice());
    });
    return out;
  }
  var TABLES = {};
  var META = {};   // mg 다이얼 제품: META[pen][dose] = [{ c: 클릭수, mg: mg }, ...]
  Object.keys(PENS).forEach(function (id) {
    var p = PENS[id]; TABLES[id] = {};
    if (p.vial) {
      var v = p.vial; META[id] = {};
      p.keys.forEach(function (k) {
        var D = parseFloat(k), N = Math.min(Math.floor(v.total / D + 1e-9), v.maxInj), arr = [], meta = [], iu = v.iu ? D : Math.round(D * 3 * 1000) / 1000;
        for (var i = 0; i < N; i++) { arr.push([iu]); meta.push({ c: null, mg: v.iu ? Math.round(D / 3 * 1000) / 1000 : D, iu: iu, ml: v.conc ? Math.round(D / v.conc * 1000) / 1000 : null, vt: v.iu ? (v.conc ? 'iu' : 'iu0') : 'mg', liq: !!v.liquid }); }
        TABLES[id][k] = arr; META[id][k] = meta;
      });
      return;
    }
    if (!p.gen) { p.keys.forEach(function (k) { TABLES[id][k] = parseSpec(p.spec[k]); }); return; }
    var g = p.gen; META[id] = {};
    p.keys.forEach(function (k) {
      var q = genSeq(g, k), arr = [], meta = [], used = 0, rd = function (x) { return Math.round(x * 1000) / 1000; };
      q.list.forEach(function (c) {
        var room = g.clicks - (used % g.clicks), segs;
        if (c > room && room > 0 && used % g.clicks !== 0) segs = [rd(room * g.unit), rd((c - room) * g.unit)]; else segs = [rd(c * g.unit)];
        used += c; arr.push(segs);
        meta.push({ c: c, mg: rd(c * g.mg), iu: rd(c * g.unit), d: !!g.iu, ct: !!g.cart });
      });
      TABLES[id][k] = arr; META[id][k] = meta;
    });
  });
  function penOf(id) { return PENS[id] || PENS.g2; }
  function tableOf(pen, dose) { return (TABLES[PENS[pen] ? pen : 'g2'] || {})[dose]; }
  function r1(x) { return Math.round(x * 1000) / 1000; }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }

  /* ───── 다국어 ───── */
  var TX = {
    ko: { dial: '펜 다이얼: {mg}mg ({c}클릭)', newpen: '새 펜 시작', draw: '주사기로 {ml}mL 준비 ({mg}mg)', newvial: '새 바이알(재조제) 시작', title: '💉 성장호르몬 주사 스케줄', sub: '동아 그로트로핀II 펜 · 6일 맞고 1일 쉬기', f_pen: '주사 제품', f_dose: '세팅 용량', f_start: '첫 투여일', f_k: '첫 투여 회차', f_visit: '다음 외래일', f_run: '연속 투여 일수', make: '스케줄 만들기', del: '스케줄 삭제', delq: '이 아이의 주사 스케줄을 삭제할까요?', today_inj: '오늘 {k}/{n}번째 · {dose}단위', today_rest: '오늘은 쉬는 날이에요', today_out: '오늘은 스케줄 범위 밖이에요', skip_today: '오늘 못 맞았어요 → 내일로 미루기', skip: '이날 못 맞았어요 (다음날로 미루기)', undo: '되돌리기 (이날 맞은 걸로)', c_rest: '휴약', c_skip: '건너뜀', c_visit: '외래', day_inj: '{set}번째 세트 · {k}/{n}번째 · {dose}단위', split: '카트리지 교체: 남은 {a}단위를 맞고 새 카트리지에서 {b}단위 이어서', newcart: '새 카트리지 시작', upcoming: '앞으로 7일', unit: '단위', note: '동아 Growtropin-II PEN 용량환산표 기준입니다. 용량과 외래일은 담당 의사의 안내를 따라 주세요.', hint_set: '이 용량은 한 세트가 {n}회 ({t}단위)예요', moved: '내일 {k}/{n}번째 · {dose}단위로 미뤄졌어요', visit_day: '다음 외래일', rest_day: '쉬는 날 (6일 맞고 1일 쉬기)', skipped_day: '못 맞은 날 — 이 회차는 다음날로 밀렸어요', need: '세팅 용량과 첫 투여일을 입력해 주세요', edit: '설정 바꾸기', open: '열기' },
    en: { dial: 'Pen dial: {mg} mg ({c} clicks)', newpen: 'Start a new pen', draw: 'Draw {ml} mL ({mg} mg)', newvial: 'Start a new vial (reconstitute)', title: '💉 Growth hormone injection schedule', sub: 'Dong-A Growtropin-II PEN · 6 days on, 1 day off', f_pen: 'Product', f_dose: 'Dose setting', f_start: 'First injection date', f_k: 'First injection no.', f_visit: 'Next clinic visit', f_run: 'Days in a row', make: 'Create schedule', del: 'Delete schedule', delq: "Delete this child's injection schedule?", today_inj: 'Today: #{k} of {n} · {dose} units', today_rest: 'Today is a rest day', today_out: 'Today is outside the schedule', skip_today: "Missed today → move to tomorrow", skip: 'Missed this day (push to next day)', undo: 'Undo (mark as given)', c_rest: 'Rest', c_skip: 'Missed', c_visit: 'Visit', day_inj: 'Set {set} · #{k} of {n} · {dose} units', split: 'Cartridge change: inject the remaining {a} units, then {b} units from the new cartridge', newcart: 'Start a new cartridge', upcoming: 'Next 7 days', unit: 'units', note: "Based on the Dong-A Growtropin-II PEN dose conversion chart. Follow your doctor's instructions for dose and visit date.", hint_set: 'One set of this dose is {n} injections ({t} units)', moved: 'Moved to tomorrow: #{k} of {n} · {dose} units', visit_day: 'Next clinic visit', rest_day: 'Rest day (6 on, 1 off)', skipped_day: 'Missed — this injection moved to the next day', need: 'Enter the dose setting and first injection date', edit: 'Change settings', open: 'Open' },
    zh: { dial: '笔刻度：{mg}mg（{c}格）', newpen: '开始使用新笔', draw: '用注射器抽取{ml}mL（{mg}mg）', newvial: '开始使用新药瓶（重新配制）', title: '💉 生长激素注射日程', sub: '东亚 Growtropin-II 笔 · 打6天休1天', f_pen: '产品', f_dose: '设定剂量', f_start: '首次注射日', f_k: '首次注射序号', f_visit: '下次门诊日', f_run: '连续注射天数', make: '生成日程', del: '删除日程', delq: '要删除这个孩子的注射日程吗？', today_inj: '今天第{k}/{n}次 · {dose}单位', today_rest: '今天是休息日', today_out: '今天不在日程范围内', skip_today: '今天没打 → 顺延到明天', skip: '这天没打（顺延到次日）', undo: '撤销（视为已打）', c_rest: '休息', c_skip: '漏打', c_visit: '门诊', day_inj: '第{set}组 · 第{k}/{n}次 · {dose}单位', split: '更换笔芯：先打完剩余{a}单位，再从新笔芯接着打{b}单位', newcart: '开始使用新笔芯', upcoming: '未来7天', unit: '单位', note: '依据东亚 Growtropin-II PEN 剂量换算表。剂量和门诊日请遵医嘱。', hint_set: '此剂量一组为{n}次（{t}单位）', moved: '已顺延到明天：第{k}/{n}次 · {dose}单位', visit_day: '下次门诊日', rest_day: '休息日（打6天休1天）', skipped_day: '漏打 — 本次顺延到次日', need: '请输入设定剂量和首次注射日', edit: '修改设置', open: '展开' },
    'zh-TW': { dial: '筆刻度：{mg}mg（{c}格）', newpen: '開始使用新筆', draw: '用注射器抽取{ml}mL（{mg}mg）', newvial: '開始使用新藥瓶（重新調配）', title: '💉 生長激素注射行程', sub: '東亞 Growtropin-II 筆 · 打6天休1天', f_pen: '產品', f_dose: '設定劑量', f_start: '首次注射日', f_k: '首次注射序號', f_visit: '下次門診日', f_run: '連續注射天數', make: '建立行程', del: '刪除行程', delq: '要刪除這個孩子的注射行程嗎？', today_inj: '今天第{k}/{n}次 · {dose}單位', today_rest: '今天是休息日', today_out: '今天不在行程範圍內', skip_today: '今天沒打 → 順延到明天', skip: '這天沒打（順延到隔天）', undo: '復原（視為已打）', c_rest: '休息', c_skip: '漏打', c_visit: '門診', day_inj: '第{set}組 · 第{k}/{n}次 · {dose}單位', split: '更換藥匣：先打完剩餘{a}單位，再從新藥匣接著打{b}單位', newcart: '開始使用新藥匣', upcoming: '未來7天', unit: '單位', note: '依據東亞 Growtropin-II PEN 劑量換算表。劑量與門診日請依醫師指示。', hint_set: '此劑量一組為{n}次（{t}單位）', moved: '已順延到明天：第{k}/{n}次 · {dose}單位', visit_day: '下次門診日', rest_day: '休息日（打6天休1天）', skipped_day: '漏打 — 本次順延到隔天', need: '請輸入設定劑量與首次注射日', edit: '修改設定', open: '展開' },
    ja: { dial: 'ペンのダイヤル：{mg}mg（{c}クリック）', newpen: '新しいペンを開始', draw: 'シリンジで{ml}mLを準備（{mg}mg）', newvial: '新しいバイアル開始（再溶解）', title: '💉 成長ホルモン注射スケジュール', sub: '東亜 Growtropin-II ペン · 6日打って1日休み', f_pen: '製品', f_dose: '設定用量', f_start: '初回投与日', f_k: '初回の回数', f_visit: '次回の外来日', f_run: '連続投与日数', make: 'スケジュール作成', del: 'スケジュール削除', delq: 'このお子さんの注射スケジュールを削除しますか？', today_inj: '今日は{k}/{n}回目 · {dose}単位', today_rest: '今日は休みの日です', today_out: '今日はスケジュール範囲外です', skip_today: '今日は打てなかった → 明日へ延期', skip: 'この日は打てなかった（翌日へ延期）', undo: '元に戻す（打ったことにする）', c_rest: '休薬', c_skip: '未投与', c_visit: '外来', day_inj: '第{set}セット · {k}/{n}回目 · {dose}単位', split: 'カートリッジ交換：残り{a}単位を打ち、新しいカートリッジから{b}単位を続けて', newcart: '新しいカートリッジ開始', upcoming: '今後7日間', unit: '単位', note: '東亜 Growtropin-II PEN の用量換算表に基づきます。用量と外来日は主治医の指示に従ってください。', hint_set: 'この用量は1セット{n}回（{t}単位）です', moved: '明日に延期：{k}/{n}回目 · {dose}単位', visit_day: '次回の外来日', rest_day: '休みの日（6日打って1日休み）', skipped_day: '未投与 — この回は翌日に繰り越されました', need: '設定用量と初回投与日を入力してください', edit: '設定を変更', open: '開く' },
    vi: { dial: 'Vòng chỉnh liều: {mg} mg ({c} nấc)', newpen: 'Bắt đầu bút mới', draw: 'Rút {ml} mL bằng bơm tiêm ({mg} mg)', newvial: 'Bắt đầu lọ mới (pha lại)', title: '💉 Lịch tiêm hormone tăng trưởng', sub: 'Bút Dong-A Growtropin-II · tiêm 6 ngày nghỉ 1 ngày', f_pen: 'Sản phẩm', f_dose: 'Liều cài đặt', f_start: 'Ngày tiêm đầu tiên', f_k: 'Mũi tiêm đầu tiên số', f_visit: 'Ngày tái khám', f_run: 'Số ngày tiêm liên tiếp', make: 'Tạo lịch', del: 'Xóa lịch', delq: 'Xóa lịch tiêm của bé này?', today_inj: 'Hôm nay: mũi {k}/{n} · {dose} đơn vị', today_rest: 'Hôm nay là ngày nghỉ', today_out: 'Hôm nay nằm ngoài lịch', skip_today: 'Hôm nay chưa tiêm → dời sang ngày mai', skip: 'Ngày này chưa tiêm (dời sang ngày sau)', undo: 'Hoàn tác (coi như đã tiêm)', c_rest: 'Nghỉ', c_skip: 'Bỏ lỡ', c_visit: 'Khám', day_inj: 'Bộ {set} · mũi {k}/{n} · {dose} đơn vị', split: 'Đổi ống thuốc: tiêm nốt {a} đơn vị còn lại, rồi {b} đơn vị từ ống mới', newcart: 'Bắt đầu ống thuốc mới', upcoming: '7 ngày tới', unit: 'đơn vị', note: 'Theo bảng quy đổi liều bút Dong-A Growtropin-II. Hãy làm theo hướng dẫn của bác sĩ về liều và ngày tái khám.', hint_set: 'Một bộ với liều này gồm {n} mũi ({t} đơn vị)', moved: 'Đã dời sang ngày mai: mũi {k}/{n} · {dose} đơn vị', visit_day: 'Ngày tái khám', rest_day: 'Ngày nghỉ (tiêm 6 nghỉ 1)', skipped_day: 'Bỏ lỡ — mũi này dời sang ngày sau', need: 'Hãy nhập liều cài đặt và ngày tiêm đầu tiên', edit: 'Đổi cài đặt', open: 'Mở' },
    th: { dial: 'หมุนปากกา: {mg} มก. ({c} คลิก)', newpen: 'เริ่มปากกาด้ามใหม่', draw: 'ดูดยา {ml} มล. ด้วยกระบอกฉีด ({mg} มก.)', newvial: 'เริ่มขวดใหม่ (ผสมใหม่)', title: '💉 ตารางฉีดโกรทฮอร์โมน', sub: 'ปากกา Dong-A Growtropin-II · ฉีด 6 วัน พัก 1 วัน', f_pen: 'ผลิตภัณฑ์', f_dose: 'ขนาดที่ตั้ง', f_start: 'วันฉีดครั้งแรก', f_k: 'ครั้งที่เริ่มต้น', f_visit: 'วันนัดพบแพทย์ครั้งหน้า', f_run: 'จำนวนวันฉีดต่อเนื่อง', make: 'สร้างตาราง', del: 'ลบตาราง', delq: 'ลบตารางฉีดของเด็กคนนี้หรือไม่', today_inj: 'วันนี้ครั้งที่ {k}/{n} · {dose} หน่วย', today_rest: 'วันนี้เป็นวันพัก', today_out: 'วันนี้อยู่นอกช่วงตาราง', skip_today: 'วันนี้ไม่ได้ฉีด → เลื่อนเป็นพรุ่งนี้', skip: 'วันนี้ไม่ได้ฉีด (เลื่อนไปวันถัดไป)', undo: 'ยกเลิก (นับว่าฉีดแล้ว)', c_rest: 'พัก', c_skip: 'พลาด', c_visit: 'นัดพบ', day_inj: 'ชุดที่ {set} · ครั้งที่ {k}/{n} · {dose} หน่วย', split: 'เปลี่ยนคาร์ทริดจ์: ฉีดส่วนที่เหลือ {a} หน่วย แล้วต่อด้วย {b} หน่วยจากคาร์ทริดจ์ใหม่', newcart: 'เริ่มคาร์ทริดจ์ใหม่', upcoming: '7 วันข้างหน้า', unit: 'หน่วย', note: 'อ้างอิงตารางแปลงขนาดยาปากกา Dong-A Growtropin-II โปรดทำตามคำแนะนำของแพทย์เรื่องขนาดยาและวันนัด', hint_set: 'ขนาดนี้ 1 ชุดมี {n} ครั้ง ({t} หน่วย)', moved: 'เลื่อนเป็นพรุ่งนี้: ครั้งที่ {k}/{n} · {dose} หน่วย', visit_day: 'วันนัดพบแพทย์', rest_day: 'วันพัก (ฉีด 6 พัก 1)', skipped_day: 'พลาด — ครั้งนี้เลื่อนไปวันถัดไป', need: 'กรุณากรอกขนาดที่ตั้งและวันฉีดครั้งแรก', edit: 'แก้ไขการตั้งค่า', open: 'เปิด' },
    id: { dial: 'Putar pena: {mg} mg ({c} klik)', newpen: 'Mulai pena baru', draw: 'Ambil {ml} mL dengan spuit ({mg} mg)', newvial: 'Mulai vial baru (rekonstitusi)', title: '💉 Jadwal suntik hormon pertumbuhan', sub: 'Pena Dong-A Growtropin-II · suntik 6 hari, libur 1 hari', f_pen: 'Produk', f_dose: 'Dosis pengaturan', f_start: 'Tanggal suntik pertama', f_k: 'Suntikan pertama ke-', f_visit: 'Kunjungan berikutnya', f_run: 'Hari berturut-turut', make: 'Buat jadwal', del: 'Hapus jadwal', delq: 'Hapus jadwal suntik anak ini?', today_inj: 'Hari ini ke-{k}/{n} · {dose} unit', today_rest: 'Hari ini hari libur suntik', today_out: 'Hari ini di luar jadwal', skip_today: 'Hari ini terlewat → geser ke besok', skip: 'Hari ini terlewat (geser ke hari berikutnya)', undo: 'Batalkan (anggap sudah disuntik)', c_rest: 'Libur', c_skip: 'Terlewat', c_visit: 'Kontrol', day_inj: 'Set {set} · ke-{k}/{n} · {dose} unit', split: 'Ganti kartrid: suntikkan sisa {a} unit, lalu {b} unit dari kartrid baru', newcart: 'Mulai kartrid baru', upcoming: '7 hari ke depan', unit: 'unit', note: 'Berdasarkan tabel konversi dosis pena Dong-A Growtropin-II. Ikuti arahan dokter untuk dosis dan tanggal kontrol.', hint_set: 'Satu set dosis ini = {n} suntikan ({t} unit)', moved: 'Digeser ke besok: ke-{k}/{n} · {dose} unit', visit_day: 'Kunjungan berikutnya', rest_day: 'Hari libur (6 hari suntik, 1 libur)', skipped_day: 'Terlewat — suntikan ini digeser ke hari berikutnya', need: 'Isi dosis pengaturan dan tanggal suntik pertama', edit: 'Ubah pengaturan', open: 'Buka' },
    es: { dial: 'Dial de la pluma: {mg} mg ({c} clics)', newpen: 'Empezar pluma nueva', draw: 'Cargue {ml} mL con la jeringa ({mg} mg)', newvial: 'Empezar vial nuevo (reconstituir)', title: '💉 Calendario de inyecciones de hormona de crecimiento', sub: 'Pluma Dong-A Growtropin-II · 6 días sí, 1 día descanso', f_pen: 'Producto', f_dose: 'Dosis configurada', f_start: 'Fecha de la primera inyección', f_k: 'N.º de la primera inyección', f_visit: 'Próxima consulta', f_run: 'Días seguidos', make: 'Crear calendario', del: 'Eliminar calendario', delq: '¿Eliminar el calendario de inyecciones de este niño?', today_inj: 'Hoy: n.º {k} de {n} · {dose} unidades', today_rest: 'Hoy es día de descanso', today_out: 'Hoy está fuera del calendario', skip_today: 'Hoy no se puso → pasar a mañana', skip: 'Este día no se puso (pasar al día siguiente)', undo: 'Deshacer (marcar como puesta)', c_rest: 'Descanso', c_skip: 'Omitida', c_visit: 'Consulta', day_inj: 'Serie {set} · n.º {k} de {n} · {dose} unidades', split: 'Cambio de cartucho: ponga las {a} unidades restantes y luego {b} del cartucho nuevo', newcart: 'Empezar cartucho nuevo', upcoming: 'Próximos 7 días', unit: 'unidades', note: 'Según la tabla de conversión de dosis de la pluma Dong-A Growtropin-II. Siga las indicaciones del médico sobre dosis y fecha de consulta.', hint_set: 'Una serie de esta dosis son {n} inyecciones ({t} unidades)', moved: 'Pasada a mañana: n.º {k} de {n} · {dose} unidades', visit_day: 'Próxima consulta', rest_day: 'Día de descanso (6 sí, 1 no)', skipped_day: 'Omitida — esta inyección pasó al día siguiente', need: 'Indique la dosis y la fecha de la primera inyección', edit: 'Cambiar ajustes', open: 'Abrir' },
    ar: { dial: 'ضبط القلم: {mg} ملغ ({c} نقرة)', newpen: 'بدء قلم جديد', draw: 'اسحب {ml} مل بالمحقنة ({mg} ملغ)', newvial: 'بدء قارورة جديدة (إعادة التحضير)', title: '💉 جدول حقن هرمون النمو', sub: 'قلم Dong-A Growtropin-II · 6 أيام حقن ويوم راحة', f_pen: 'المنتج', f_dose: 'الجرعة المضبوطة', f_start: 'تاريخ أول حقنة', f_k: 'رقم أول حقنة', f_visit: 'موعد المراجعة القادمة', f_run: 'عدد الأيام المتتالية', make: 'إنشاء الجدول', del: 'حذف الجدول', delq: 'هل تريد حذف جدول حقن هذا الطفل؟', today_inj: 'اليوم: الحقنة {k}/{n} · {dose} وحدة', today_rest: 'اليوم يوم راحة', today_out: 'اليوم خارج نطاق الجدول', skip_today: 'لم تُعطَ اليوم ← تأجيل إلى الغد', skip: 'لم تُعطَ في هذا اليوم (تأجيل لليوم التالي)', undo: 'تراجع (اعتبارها أُعطيت)', c_rest: 'راحة', c_skip: 'فائتة', c_visit: 'مراجعة', day_inj: 'المجموعة {set} · الحقنة {k}/{n} · {dose} وحدة', split: 'تغيير الخرطوشة: أعطِ الـ{a} وحدة المتبقية ثم {b} وحدة من الخرطوشة الجديدة', newcart: 'بدء خرطوشة جديدة', upcoming: 'الأيام السبعة القادمة', unit: 'وحدة', note: 'بحسب جدول تحويل جرعات قلم Dong-A Growtropin-II. اتبع تعليمات الطبيب بشأن الجرعة وموعد المراجعة.', hint_set: 'المجموعة الواحدة بهذه الجرعة {n} حقنة ({t} وحدة)', moved: 'تم التأجيل إلى الغد: الحقنة {k}/{n} · {dose} وحدة', visit_day: 'موعد المراجعة القادمة', rest_day: 'يوم راحة (6 أيام حقن ويوم راحة)', skipped_day: 'فائتة — انتقلت هذه الحقنة لليوم التالي', need: 'أدخل الجرعة المضبوطة وتاريخ أول حقنة', edit: 'تغيير الإعدادات', open: 'فتح' },
    mn: { dial: 'Үзгийн тохиргоо: {mg} мг ({c} товшилт)', newpen: 'Шинэ үзэг эхлүүлэх', draw: 'Тариураар {ml} мл татах ({mg} мг)', newvial: 'Шинэ сав эхлүүлэх (дахин уусгах)', title: '💉 Өсөлтийн даавар тарих хуваарь', sub: 'Dong-A Growtropin-II үзэг · 6 өдөр тариад 1 өдөр амрах', f_pen: 'Бүтээгдэхүүн', f_dose: 'Тохируулсан тун', f_start: 'Эхний тарих өдөр', f_k: 'Эхний тарилгын дугаар', f_visit: 'Дараагийн үзлэгийн өдөр', f_run: 'Дараалан тарих өдөр', make: 'Хуваарь үүсгэх', del: 'Хуваарь устгах', delq: 'Энэ хүүхдийн тарилгын хуваарийг устгах уу?', today_inj: 'Өнөөдөр {k}/{n}-р тарилга · {dose} нэгж', today_rest: 'Өнөөдөр амрах өдөр', today_out: 'Өнөөдөр хуваарийн гадна байна', skip_today: 'Өнөөдөр тарьж чадсангүй → маргааш руу шилжүүлэх', skip: 'Энэ өдөр тарьж чадсангүй (дараагийн өдөр рүү шилжүүлэх)', undo: 'Буцаах (тарьсан гэж тооцох)', c_rest: 'Амрах', c_skip: 'Алгассан', c_visit: 'Үзлэг', day_inj: '{set}-р багц · {k}/{n}-р тарилга · {dose} нэгж', split: 'Картриж солих: үлдсэн {a} нэгжийг тариад, шинэ картрижаас {b} нэгжийг үргэлжлүүлнэ', newcart: 'Шинэ картриж эхлүүлэх', upcoming: 'Дараагийн 7 хоног', unit: 'нэгж', note: 'Dong-A Growtropin-II үзгийн тун хөрвүүлэх хүснэгтэд үндэслэв. Тун болон үзлэгийн өдрийг эмчийнхээ зааврын дагуу авна уу.', hint_set: 'Энэ туны нэг багц {n} тарилга ({t} нэгж)', moved: 'Маргааш руу шилжлээ: {k}/{n}-р тарилга · {dose} нэгж', visit_day: 'Дараагийн үзлэгийн өдөр', rest_day: 'Амрах өдөр (6 өдөр тариад 1 амрах)', skipped_day: 'Алгассан — энэ тарилга дараагийн өдөр рүү шилжлээ', need: 'Тохируулсан тун, эхний тарих өдрөө оруулна уу', edit: 'Тохиргоо өөрчлөх', open: 'Нээх' }
  };
  function lang() {
    var l = (window.JRD_LANG || document.documentElement.getAttribute('lang') || 'ko'); if (/^ko/i.test(String(l))) return 'ko';
    if (/^zh-?(tw|hant|hk)$/i.test(l) || l === 'zt') return 'zh-TW';
    l = String(l).split('-')[0].toLowerCase() === 'zh' ? 'zh' : String(l).toLowerCase();
    return TX[l] ? l : (l === 'ko' ? 'ko' : 'en');
  }
  // 회사(제조·판매사) → 제품 2단계 선택용
  var COMPANIES = [
    { id: 'dong', name: '동아에스티', re: /^(g2|ip\d+|dc\d+|gv\d+)$/ },
    { id: 'lg', name: 'LG화학', re: /^(es\d+|ec\d+|eu\d+)$/ },
    { id: 'pfizer', name: '한국화이자', re: /^(gq\d*|gp\d+)$/ },
    { id: 'novo', name: '노보노디스크', re: /^nd\d+$/ },
    { id: 'merck', name: '한국머크 (싸이젠)', re: /^sz\d+$/ },
    { id: 'scigen', name: '싸이젠코리아 (싸이트로핀)', re: /^sc\d+$/ },
    { id: 'ferring', name: '페링 (조맥톤)', re: /^zm\d+$/ }
  ];
  function coOf(pid) { for (var i = 0; i < COMPANIES.length; i++) if (COMPANIES[i].re.test(pid) || OV.co[pid] === COMPANIES[i].id) return COMPANIES[i]; return COMPANIES[0]; }
  // 한국어가 아닌 언어에서는 회사·제품명을 영문(브랜드명)으로 표시
  var EN_CO = { dong: 'Dong-A ST', lg: 'LG Chem', pfizer: 'Pfizer Korea', novo: 'Novo Nordisk', merck: 'Merck Korea (Saizen)', scigen: 'SciGen Korea (Scitropin)', ferring: 'Ferring (Zomacton)' };
  var EN_PEN = {
    g2: 'Dong-A Growtropin-II Cartridge 30IU · Growtropin-II Pen',
    ip30: 'Dong-A Growtropin-II iPen 30IU (integrated pen)', ip20: 'Dong-A Growtropin-II iPen 20IU (integrated pen)',
    dc20: 'Dong-A Growtropin-II Cartridge 20IU · Growtropin-II Pen',
    es36: 'Eutropin S-Pen 36IU', ec48: 'Eutropin Cartridge 48IU · EcoPen 48 (0.5-unit basis)', eu4: 'Eutropin 4IU vial (new vial each time)',
    gq: 'Genotropin GoQuick 36 units (12mg)', gq53: 'Genotropin GoQuick 16 units (5.3mg)',
    gp53: 'Genotropin 16IU (5.3mg) cartridge · Genotropin Pen', gp12: 'Genotropin 12mg cartridge · Genotropin Pen',
    nd10: 'Norditropin NordiFlex 10mg/1.5mL', nd5: 'Norditropin NordiFlex 5mg/1.5mL', nd15: 'Norditropin NordiFlex 15mg/1.5mL',
    sz6: 'Saizen Liquid 6mg · EasyPod / Aluetta', sz12: 'Saizen Liquid 12mg · EasyPod / Aluetta', sz20: 'Saizen Liquid 20mg · EasyPod / Aluetta',
    sc5: 'Scitropin A cartridge 5mg · Omnitrope Pen 5', sc10: 'Scitropin A cartridge 10mg · Omnitrope Pen 10', sc15: 'Scitropin A cartridge 15mg · Scitropin Pen 15',
    gv12: 'Growtropin-II solution 12IU/1.5mL vial', gv16: 'Growtropin-II solution 16IU/2mL vial', gv4: 'Growtropin-II solution 4IU/0.5mL vial',
    zm10: 'Zomacton 10mg (vial & syringe)', zm13: 'Zomacton 12.96IU (ZomaJet needle-free)'
  };
  function cname(c) { return lang() === 'ko' ? c.name : (EN_CO[c.id] || c.name); }
  function pname(id) { return lang() === 'ko' ? PENS[id].name : (EN_PEN[id] || PENS[id].name); }
  function pensOfCo(co) { return Object.keys(PENS).filter(function (id) { return coOf(id).id === co.id; }); }
  var GT = {
    company: { ko: '회사', en: 'Company', zh: '制药公司', 'zh-TW': '製藥公司', ja: 'メーカー', vi: 'Hãng sản xuất', th: 'บริษัท', id: 'Perusahaan', es: 'Fabricante', ar: 'الشركة', mn: 'Компани' },
    splitpen: { ko: '펜 교체: 남은 {a}단위를 맞고 새 펜에서 {b}단위 이어서', en: 'Pen change: inject the remaining {a} units, then {b} units from the new pen', zh: '更换笔：先打完剩余{a}单位，再用新笔接着打{b}单位', 'zh-TW': '更換筆：先打完剩餘{a}單位，再用新筆接著打{b}單位', ja: 'ペン交換：残り{a}単位を打ち、新しいペンで{b}単位を続けて', vi: 'Đổi bút: tiêm nốt {a} đơn vị còn lại, rồi {b} đơn vị bằng bút mới', th: 'เปลี่ยนปากกา: ฉีดส่วนที่เหลือ {a} หน่วย แล้วต่อด้วย {b} หน่วยจากปากกาใหม่', id: 'Ganti pena: suntikkan sisa {a} unit, lalu {b} unit dari pena baru', es: 'Cambio de pluma: ponga las {a} unidades restantes y luego {b} de la pluma nueva', ar: 'تغيير القلم: أعطِ الـ{a} وحدة المتبقية ثم {b} وحدة من القلم الجديد', mn: 'Үзэг солих: үлдсэн {a} нэгжийг тарьж, шинэ үзгээс {b} нэгжийг үргэлжлүүлнэ' },
    single: { ko: '매번 새 바이알을 쓰고 남은 양은 버려요', en: 'Use a new vial every time and discard what is left', zh: '每次使用新药瓶，剩余药液丢弃', 'zh-TW': '每次使用新藥瓶，剩餘藥液丟棄', ja: '毎回新しいバイアルを使い、残りは捨てます', vi: 'Mỗi lần dùng một lọ mới và bỏ phần còn lại', th: 'ใช้ขวดใหม่ทุกครั้งและทิ้งส่วนที่เหลือ', id: 'Gunakan vial baru setiap kali dan buang sisanya', es: 'Use un vial nuevo cada vez y deseche lo que sobre', ar: 'استخدم قارورة جديدة في كل مرة وتخلّص من الباقي', mn: 'Тарилга бүрт шинэ сав хэрэглэж, үлдэгдлийг хаяна' },
    drawiu: { ko: '주사기로 {ml}mL 뽑기 ({iu}단위)', en: 'Draw {ml} mL with a syringe ({iu} units)', zh: '用注射器抽取{ml}mL（{iu}单位）', 'zh-TW': '用注射器抽取{ml}mL（{iu}單位）', ja: 'シリンジで{ml}mLを吸う（{iu}単位）', vi: 'Rút {ml} mL bằng bơm tiêm ({iu} đơn vị)', th: 'ดูดยา {ml} มล. ด้วยกระบอกฉีด ({iu} หน่วย)', id: 'Ambil {ml} mL dengan spuit ({iu} unit)', es: 'Cargue {ml} mL con la jeringa ({iu} unidades)', ar: 'اسحب {ml} مل بالمحقنة ({iu} وحدة)', mn: 'Тариураар {ml} мл татах ({iu} нэгж)' },
    doseiu: { ko: '{iu}단위 투여', en: 'Give {iu} units', zh: '注射{iu}单位', 'zh-TW': '注射{iu}單位', ja: '{iu}単位を投与', vi: 'Tiêm {iu} đơn vị', th: 'ฉีด {iu} หน่วย', id: 'Suntik {iu} unit', es: 'Administrar {iu} unidades', ar: 'إعطاء {iu} وحدة', mn: '{iu} нэгж тарих' },
    newvial2: { ko: '새 바이알 시작', en: 'Start a new vial', zh: '开始使用新药瓶', 'zh-TW': '開始使用新藥瓶', ja: '新しいバイアルを開始', vi: 'Bắt đầu lọ mới', th: 'เริ่มขวดใหม่', id: 'Mulai vial baru', es: 'Empezar vial nuevo', ar: 'بدء قارورة جديدة', mn: 'Шинэ сав эхлүүлэх' },
    inuse: { ko: '펜·카트리지·바이알 1개를 첫 사용 후 {d}일 안에 다 쓰도록 맞췄어요', en: 'Planned so each pen/cartridge/vial is used up within {d} days of first use', zh: '已按每支笔/药芯/药瓶在首次使用后{d}天内用完来安排', 'zh-TW': '已依每支筆/藥匣/藥瓶在首次使用後{d}天內用完來安排', ja: 'ペン・カートリッジ・バイアル1本を初回使用から{d}日以内に使い切るよう計算しています', vi: 'Đã tính để mỗi bút/ống/lọ được dùng hết trong {d} ngày kể từ lần dùng đầu', th: 'คำนวณให้ใช้ปากกา/คาร์ทริดจ์/ขวด 1 อันหมดภายใน {d} วันหลังใช้ครั้งแรก', id: 'Direncanakan agar tiap pena/kartrid/vial habis dalam {d} hari sejak pertama dipakai', es: 'Calculado para que cada pluma/cartucho/vial se termine en {d} días desde el primer uso', ar: 'تم الحساب بحيث يُستهلك كل قلم/خرطوشة/قارورة خلال {d} يومًا من أول استخدام', mn: 'Үзэг/картридж/сав бүрийг анх хэрэглэснээс хойш {d} хоногт дуусахаар тооцсон' },
    pens2: { ko: '펜2개', en: '2 pens', zh: '2支笔', 'zh-TW': '2支筆', ja: 'ペン2本', vi: '2 bút', th: '2 ด้าม', id: '2 pena', es: '2 plumas', ar: 'قلمان', mn: '2 үзэг' },
    avg: { ko: '평균', en: 'avg', zh: '平均', 'zh-TW': '平均', ja: '平均', vi: 'TB', th: 'เฉลี่ย', id: 'rata-rata', es: 'media', ar: 'المتوسط', mn: 'дундаж' },
    makeup: { ko: '이번 주만 휴약일에 주사 (다음 주부터 원래 휴약일로)', en: 'This week only: injection on the usual rest day (back to normal next week)', zh: '仅本周：在原休药日注射（下周起恢复）', 'zh-TW': '僅本週：在原休藥日注射（下週起恢復）', ja: '今週だけ休薬日に注射（来週から元の休薬日に戻ります）', vi: 'Chỉ tuần này: tiêm vào ngày nghỉ thường lệ (tuần sau trở lại bình thường)', th: 'เฉพาะสัปดาห์นี้: ฉีดในวันพักตามปกติ (สัปดาห์หน้ากลับเป็นปกติ)', id: 'Hanya minggu ini: suntik di hari libur biasa (minggu depan kembali normal)', es: 'Solo esta semana: inyección en el día de descanso habitual (la próxima semana vuelve a lo normal)', ar: 'هذا الأسبوع فقط: حقنة في يوم الراحة المعتاد (يعود الجدول الأسبوع القادم)', mn: 'Зөвхөн энэ долоо хоногт: ердийн амрах өдөр тарина (дараа долоо хоногоос хэвийн)' },
    restday: { ko: '휴약일 (쉬는 요일)', en: 'Rest day of the week', zh: '休药日（星期）', 'zh-TW': '休藥日（星期）', ja: '休薬日（曜日）', vi: 'Ngày nghỉ trong tuần', th: 'วันหยุดฉีดยา (วันในสัปดาห์)', id: 'Hari libur suntik (hari dalam minggu)', es: 'Día de descanso de la semana', ar: 'يوم الراحة الأسبوعي', mn: 'Амрах гараг' },
    restauto: { ko: '연속 투여 일수 기준으로 자동', en: 'Automatic (after the days in a row)', zh: '按连续注射天数自动安排', 'zh-TW': '依連續注射天數自動安排', ja: '連続投与日数に従って自動', vi: 'Tự động theo số ngày liên tiếp', th: 'อัตโนมัติตามจำนวนวันฉีดต่อเนื่อง', id: 'Otomatis menurut hari berturut-turut', es: 'Automático según los días seguidos', ar: 'تلقائي حسب عدد الأيام المتتالية', mn: 'Дараалсан хоногоор автоматаар' },
    dialiu: { ko: '펜 설정: {iu}단위', en: 'Pen setting: {iu} units', zh: '笔设定：{iu}单位', 'zh-TW': '筆設定：{iu}單位', ja: 'ペン設定：{iu}単位', vi: 'Cài đặt bút: {iu} đơn vị', th: 'ตั้งปากกา: {iu} หน่วย', id: 'Atur pena: {iu} unit', es: 'Ajuste de la pluma: {iu} unidades', ar: 'ضبط القلم: {iu} وحدة', mn: 'Үзгийн тохиргоо: {iu} нэгж' },
    gnote: { ko: '제품 설명서의 다이얼 단위에 맞춰 펜(카트리지) 한 대를 남김없이 쓰도록 나눈 계산값입니다. 용량과 외래일은 담당 의사의 안내를 따라 주세요.', en: "Calculated from the product's dial increments so that one pen/cartridge is used up evenly. Follow your doctor's instructions for dose and visit date.", zh: '按产品说明书的刻度单位计算，使一支笔/药芯恰好用完。剂量和门诊日请遵医嘱。', 'zh-TW': '依產品說明書的刻度單位計算，使一支筆/藥匣剛好用完。劑量與門診日請依醫師指示。', ja: '製品説明書のダイヤル単位に基づき、ペン（カートリッジ）1本を使い切るように分けた計算値です。用量と外来日は主治医の指示に従ってください。', vi: 'Tính theo bước chỉnh liều của sản phẩm để dùng hết một bút/ống thuốc. Hãy làm theo hướng dẫn của bác sĩ về liều và ngày tái khám.', th: 'คำนวณตามหน่วยปรับของผลิตภัณฑ์ เพื่อใช้ปากกา/คาร์ทริดจ์ 1 อันให้หมดพอดี โปรดทำตามคำแนะนำของแพทย์เรื่องขนาดยาและวันนัด', id: 'Dihitung dari satuan pengaturan produk agar satu pena/kartrid habis terpakai. Ikuti arahan dokter untuk dosis dan tanggal kontrol.', es: 'Calculado según los incrementos del dial del producto para agotar una pluma/cartucho. Siga las indicaciones del médico sobre dosis y fecha de consulta.', ar: 'محسوب وفق وحدات ضبط المنتج بحيث يُستهلك قلم/خرطوشة واحدة بالكامل. اتبع تعليمات الطبيب بشأن الجرعة وموعد المراجعة.', mn: 'Бүтээгдэхүүний тохируулах нэгжид тулгуурлан нэг үзэг/картриджийг дуустал хуваасан тооцоо. Тун, үзлэгийн өдрийг эмчийнхээ зааврын дагуу авна уу.' }
  };
  function gt(k, v) { var d = GT[k] || {}, s = d[lang()] || d.en || d.ko || k; if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function t(key, v) {
    var s = (TX[lang()] || TX.ko)[key];
    if (s == null) s = TX.ko[key] || key;
    if (v) Object.keys(v).forEach(function (k) { s = s.split('{' + k + '}').join(v[k]); });
    return s;
  }

  /* ───── 날짜 도우미 ───── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function todayStr() { return fmt(new Date()); }

  /* ───── 저장 (아이별) ───── */
  function childId() { try { return (typeof activeChildId !== 'undefined') ? activeChildId : 1; } catch (e) { return 1; } }
  function key() { return 'jrdGhPlan_' + childId(); }
  function load() { try { var v = JSON.parse(localStorage.getItem(key()) || 'null'); return v && v.start && tableOf(v.pen, v.dose) ? v : null; } catch (e) { return null; } }
  function save(p) { try { if (p) localStorage.setItem(key(), JSON.stringify(p)); else localStorage.removeItem(key()); } catch (e) {} try { if (window.jrdGhExtra) window.jrdGhExtra.onSave(p); } catch (e2) {} }

  /* ───── 스케줄 계산: 못 맞은 날(skips)을 만나면 그날은 쉬고, 회차는 다음날로 그대로 이어짐 ───── */
  function build(plan) {
    var map = {}, seq = tableOf(plan.pen, plan.dose), cartSz = penOf(plan.pen).cart, N = seq.length, tot = r1(sum(seq.map(sum)));
    var k = Math.min(Math.max(+plan.k0 || 1, 1), N), setNo = 1, streak = 0, carry = 0, byDow = plan.restDow != null && plan.restDow !== '';
    var run = Math.max(1, +plan.run || 6);
    var end = plan.visit && plan.visit >= plan.start ? plan.visit : addDays(plan.start, 27);
    var d = plan.start, guard = 0;
    while (d <= end && guard++ < 800) {
      var isRest = byDow ? parse(d).getDay() === +plan.restDow : streak >= run;
      if (plan.skips && plan.skips[d]) { map[d] = { t: 'skip' }; streak = 0; if (byDow) carry = 1; }
      else if (isRest && !(byDow && carry)) { map[d] = { t: 'rest' }; streak = 0; carry = 0; }
      else {
        var segs = seq[k - 1], before = sum(seq.slice(0, k - 1).map(sum));
        var mt = (META[plan.pen] || {})[plan.dose]; map[d] = { t: 'inj', mg: mt ? mt[k - 1].mg : null, iu: mt ? mt[k - 1].iu : null, dd: mt ? !!mt[k - 1].d : false, vt: mt ? (mt[k - 1].vt || null) : null, ct: mt ? !!mt[k - 1].ct : (penOf(plan.pen).spec ? true : false), liq: mt ? !!mt[k - 1].liq : false, clicks: mt ? mt[k - 1].c : null, ml: mt ? (mt[k - 1].ml != null ? mt[k - 1].ml : null) : null, k: k, n: N, set: setNo, segs: segs, dose: r1(sum(segs)), split: segs.length > 1, cart: Math.floor(before / cartSz + 1e-9) + 1, newCart: k === 1 || (before > 0 && Math.abs(before / cartSz - Math.round(before / cartSz)) < 1e-6) };
        if (isRest) { map[d].mk = true; carry = 0; }
        streak++; k++;
        if (k > N) { k = 1; setNo++; }
      }
      d = addDays(d, 1);
    }
    if (plan.visit) { if (map[plan.visit]) map[plan.visit].visit = true; else map[plan.visit] = { t: 'visit', visit: true }; }
    return { map: map, N: N, tot: tot, end: end };
  }

  /* ───── 화면: 달력 칸 표시 ───── */
  function chipFor(info, date) {
    var past = date < todayStr();
    if (info.t === 'inj') {
      var d = info.split ? info.segs.join('+') : ((info.dd || info.vt === 'iu' || info.vt === 'iu0' || info.mg == null) ? info.dose : info.mg + 'mg');
      return '<div class="gh-chip gh-inj' + (past ? ' gh-past' : '') + (date === todayStr() ? ' gh-today' : '') + '" title="' + esc(dayText(info)) + '">' + (info.mk ? '↩' : '💉') + info.k + '/' + info.n + '<br><b>' + d + '</b></div>';
    }
    if (info.t === 'rest') return '<div class="gh-chip gh-rest">' + esc(t('c_rest')) + '</div>';
    if (info.t === 'skip') return '<div class="gh-chip gh-skip">' + esc(t('c_skip')) + '</div>';
    return '';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function splitText(info) { return (info.ct || info.mg == null) ? t('split', { a: info.segs[0], b: info.segs[1] }) : gt('splitpen', { a: info.segs[0], b: info.segs[1] }); }
  function dialText(info) {   // 그날 펜·주사기에 맞출 값
    if (info.vt === 'iu') return gt('drawiu', { ml: info.ml, iu: info.iu });
    if (info.vt === 'iu0') return gt('doseiu', { iu: info.iu });
    if (info.mg == null || info.split) return '';
    if (info.ml != null) return t('draw', { ml: info.ml, mg: info.mg });
    return info.dd ? gt('dialiu', { iu: info.iu }) : t('dial', { mg: info.mg, c: info.clicks });
  }
  function dayText(info) {
    if (info.t !== 'inj') return '';
    var s = t('day_inj', { set: info.set, k: info.k, n: info.n, dose: info.dose });
    if (info.mk) s += ' / ' + gt('makeup');
    if (info.split) s += ' / ' + splitText(info);
    else if (info.newCart) s += ' / ' + (info.vt ? (info.liq ? gt('newvial2') : t('newvial')) : t(info.ct || info.mg == null ? 'newcart' : 'newpen'));
    var dt = dialText(info); if (dt) s += ' / ' + dt;
    return s;
  }

  function decorate() {
    var plan = load(); var b = plan ? build(plan) : null;
    document.querySelectorAll('.day-cell').forEach(function (c) {
      c.querySelectorAll('.gh-chip').forEach(function (x) { x.remove(); });
      c.classList.remove('gh-has');
      var on = c.getAttribute('onclick') || ''; var m = /openRecord\('(\d{4}-\d{2}-\d{2})'/.exec(on);
      if (!m || !b) return;
      var info = b.map[m[1]]; if (!info) return;
      var html = chipFor(info, m[1]);
      if (info.visit) html += '<div class="gh-chip gh-visit">🏥' + esc(t('c_visit')) + '</div>';
      if (html) { c.insertAdjacentHTML('beforeend', html); c.classList.add('gh-has'); }
    });
  }

  /* ───── 화면: 상단 패널 ───── */
  function css() {
    if (document.getElementById('ghCss')) return;
    var s = document.createElement('style'); s.id = 'ghCss';
    s.textContent = [
      'body>.gh-panel,body>.sup-panel{grid-column:1/-1;width:100%;max-width:680px;box-sizing:border-box;justify-self:center}',
      '.gh-panel{max-width:680px;margin:10px auto;background:#fff;border:1.5px solid #C0902C;border-radius:12px;padding:12px 14px;color:#1B3A4B;font-size:13px;-webkit-user-select:text;user-select:text}',
      '.gh-panel input,.gh-panel select{-webkit-user-select:text;user-select:text}',
      '.gh-panel h3{font-size:15px;margin:0 0 2px}.gh-panel .gh-sub{font-size:11px;color:#43555F;margin-bottom:8px}',
      '.gh-today-box{background:#FBF8F1;border:1px solid #DED5C6;border-radius:10px;padding:9px 11px;margin:8px 0;font-weight:700;font-size:14px}',
      '.gh-row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}.gh-row label{flex:1;min-width:120px;font-size:11px;font-weight:700;color:#43555F;display:block}',
      '.gh-row select,.gh-row input{width:100%;margin-top:3px;padding:8px;border:1px solid #DED5C6;border-radius:8px;font-size:14px;background:#fff;color:#1B3A4B;font-family:inherit}',
      '.gh-btn{border:0;border-radius:8px;padding:9px 12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
      '.gh-btn.p{background:#1B3A4B;color:#fff}.gh-btn.o{background:#fff;color:#1B3A4B;border:1px solid #DED5C6}.gh-btn.w{background:#B24E36;color:#fff}',
      '.gh-up{display:flex;gap:5px;overflow-x:auto;padding:4px 0}',
      '.gh-up div{flex:0 0 auto;min-width:54px;text-align:center;border:1px solid #DED5C6;border-radius:8px;padding:4px 5px;font-size:11px;background:#fff}',
      '.gh-up div b{display:block;font-size:12px}.gh-up .r{background:#f3f3f3;color:#888}.gh-up .s{background:#fbe9e5;color:#B24E36}.gh-up .t{border-color:#2E8B57;background:#eaf6ef}',
      '.gh-hint{font-size:11px;color:#43555F;margin:4px 0}.gh-msg{font-size:12px;font-weight:700;color:#2E8B57;margin-top:6px}.gh-msg.bad{color:#B24E36}',
      '.gh-note{font-size:10.5px;color:#7a8a93;margin-top:8px;line-height:1.5}',
      '.day-cell .gh-chip{font-size:8px;line-height:1.15;font-weight:700;border-radius:6px;padding:1px 4px;max-width:98%;text-align:center;letter-spacing:-.02em;word-break:keep-all}',
      '.day-cell .gh-inj{background:rgba(192,144,44,.2);color:#8a5f0f}.day-cell .gh-inj b{font-size:9px}',
      '.day-cell .gh-inj.gh-past{opacity:.55}.day-cell .gh-inj.gh-today{background:#C0902C;color:#fff}',
      '.day-cell .gh-rest{background:#eee;color:#888}.day-cell .gh-skip{background:#fbe9e5;color:#B24E36}.day-cell .gh-visit{background:#eaf6ef;color:#2E8B57}',
      '.gh-daybox{margin:0 0 12px;padding:10px 12px;border:1px solid #C0902C;border-radius:10px;background:#FBF8F1;font-size:13px;color:#1B3A4B}',
      '.gh-daybox .gh-btn{margin-top:8px;width:100%}'
    ].join('');
    document.head.appendChild(s);
  }

  var msg = '', formPen = null;
  function panel() {
    var host = document.getElementById('ghPanel');
    if (!host) {
      host = document.createElement('div'); host.id = 'ghPanel'; host.className = 'gh-panel';
      var anchor = document.querySelector('.container');   // 달력 맨 뒤(월별 달력 아래)에 배치
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor.nextSibling); else document.body.appendChild(host);
    }
    var plan = load(), b = plan ? build(plan) : null, today = todayStr();
    var penId = formPen || (plan && plan.pen) || 'g2', pen = penOf(penId);
    var subTxt = penId === 'g2' ? t('sub') : pname(penId) + ' · ' + t('sub').split(' · ').slice(1).join(' · ');
    var h = '<h3>' + esc(t('title')) + '</h3><div class="gh-sub">' + esc(subTxt) + '</div>';
    if (plan) {
      var ti = b.map[today], line;
      if (ti && ti.t === 'inj') line = '💉 ' + t('today_inj', { k: ti.k, n: ti.n, dose: ti.split ? ti.segs.join('+') + '=' + ti.dose : ti.dose }) + (ti.split ? '<div style="font-size:11px;font-weight:600;color:#B24E36;margin-top:3px">' + esc(splitText(ti) || t('split', { a: ti.segs[0], b: ti.segs[1] })) + '</div>' : (ti.newCart ? '<div style="font-size:11px;font-weight:600;margin-top:3px">' + esc(ti.vt ? (ti.liq ? gt('newvial2') : t('newvial')) : t(ti.ct || ti.mg == null ? 'newcart' : 'newpen')) + '</div>' : '')) + (dialText(ti) ? '<div style="font-size:12px;font-weight:700;color:#1B3A4B;margin-top:3px">🔘 ' + esc(dialText(ti)) + '</div>' : '');
      else if (ti && (ti.t === 'rest' || ti.t === 'skip')) line = '😴 ' + t('today_rest');
      else line = t('today_out');
      h += '<div class="gh-today-box">' + line + '</div>';
      if (ti && ti.t === 'inj') h += '<button class="gh-btn w" style="width:100%" data-gh="skip" data-d="' + today + '">' + esc(t('skip_today')) + '</button>';
      else if (plan.skips && plan.skips[today]) h += '<button class="gh-btn o" style="width:100%" data-gh="undo" data-d="' + today + '">' + esc(t('undo')) + '</button>';
      // 앞으로 7일
      h += '<div class="gh-hint" style="margin-top:8px">' + esc(t('upcoming')) + '</div><div class="gh-up">';
      for (var i = 0; i < 7; i++) {
        var dd = addDays(today, i), inf = b.map[dd], dt = parse(dd);
        var lab = (dt.getMonth() + 1) + '/' + dt.getDate();
        if (!inf) h += '<div><span>' + lab + '</span><b>–</b></div>';
        else if (inf.t === 'inj') h += '<div class="' + (inf.visit ? 't' : '') + '"><span>' + lab + '</span><b>' + inf.k + '/' + inf.n + '</b>' + (inf.split ? inf.segs.join('+') : inf.dose) + '</div>';
        else if (inf.t === 'skip') h += '<div class="s"><span>' + lab + '</span><b>' + esc(t('c_skip')) + '</b></div>';
        else h += '<div class="' + (inf.visit ? 't' : 'r') + '"><span>' + lab + '</span><b>' + esc(inf.visit ? t('c_visit') : t('c_rest')) + '</b></div>';
      }
      h += '</div>';
    }
    if (msg) h += '<div class="gh-msg' + (msg.charAt(0) === '!' ? ' bad' : '') + '">' + esc(msg.replace(/^!/, '')) + '</div>';
    // 설정 폼
    var p = plan || { dose: pen.keys[0], start: today, k0: 1, visit: '', run: 6 };
    if (pen.keys.indexOf(p.dose) < 0 || (plan && plan.pen !== penId && plan.pen !== undefined && penId !== (plan.pen || 'g2'))) p = Object.assign({}, p, { dose: pen.keys[0], k0: 1 });
    var N = tableOf(penId, p.dose).length;
    h += '<details id="ghForm"' + (plan ? '' : ' open') + ' style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;font-size:12px;color:#43555F">⚙️ ' + esc(plan ? t('edit') : t('make')) + '</summary>';
    var curCo = coOf(penId);
    h += '<div class="gh-row"><label>' + esc(gt('company')) + '<select id="ghCo">' + COMPANIES.filter(function (c) { return pensOfCo(c).length; }).map(function (c) { return '<option value="' + c.id + '"' + (c.id === curCo.id ? ' selected' : '') + '>' + esc(cname(c)) + '</option>'; }).join('') + '</select></label></div>';
    if (Object.keys(PENS).length > 1) h += '<div class="gh-row"><label>' + esc(t('f_pen')) + '<select id="ghPen">' + pensOfCo(curCo).map(function (id) { return '<option value="' + id + '"' + (id === penId ? ' selected' : '') + '>' + esc(pname(id)) + '</option>'; }).join('') + '</select></label></div>';
    h += '<div class="gh-row"><label>' + esc(t('f_dose')) + '<select id="ghDose">' + pen.keys.map(function (k) { return '<option value="' + k + '"' + (k === p.dose ? ' selected' : '') + '>' + esc(doseLabel(pen, k)) + '</option>'; }).join('') + '</select></label>';
    h += '<label>' + esc(t('f_start')) + '<input type="date" id="ghStart" value="' + p.start + '"></label></div>';
    h += '<div class="gh-row"><label>' + esc(t('f_k')) + '<select id="ghK">' + Array.apply(null, Array(N)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + ((+p.k0 || 1) === i + 1 ? ' selected' : '') + '>' + (i + 1) + '/' + N + '</option>'; }).join('') + '</select></label>';
    h += '<label>' + esc(t('f_visit')) + '<input type="date" id="ghVisit" value="' + (p.visit || '') + '"></label></div>';
    var wk = [], hasDow = p.restDow != null && p.restDow !== '';
    for (var wi = 0; wi < 7; wi++) { var wl = lang() === 'mn' ? ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'][wi] : new Date(2023, 0, 1 + wi).toLocaleDateString(lang() === 'zh' ? 'zh-CN' : lang(), { weekday: 'long' }); wk.push('<option value="' + wi + '"' + (hasDow && +p.restDow === wi ? ' selected' : '') + '>' + esc(wl) + '</option>'); }
    h += '<div class="gh-row"><label>' + esc(gt('restday')) + '<select id="ghRestDow"><option value=""' + (hasDow ? '' : ' selected') + '>' + esc(gt('restauto')) + '</option>' + wk.join('') + '</select></label></div>';
    h += '<div class="gh-row"><label>' + esc(t('f_run')) + '<select id="ghRun">' + [3, 4, 5, 6, 7].map(function (n) { return '<option value="' + n + '"' + ((+p.run || 6) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>';
    h += '<div class="gh-hint" id="ghHint"></div>';
    h += '<div style="display:flex;gap:8px;margin-top:6px"><button class="gh-btn p" style="flex:1" data-gh="make">' + esc(t('make')) + '</button>' + (plan ? '<button class="gh-btn o" data-gh="del">' + esc(t('del')) + '</button>' : '') + '</div></details>';
    h += '<div class="gh-note">' + esc(penId === 'g2' ? t('note') : gt('gnote')) + '</div>';
    host.innerHTML = h;
    try { if (window.jrdGhExtra) { var hx = window.jrdGhExtra.html(); if (hx) host.insertAdjacentHTML('beforeend', hx); } } catch (e3) {}
    hint();
  }
  function hint() {
    var el = document.getElementById('ghHint'), sel = document.getElementById('ghDose'); if (!el || !sel) return;
    var pe = document.getElementById('ghPen'), pid = pe ? pe.value : 'g2', seq = tableOf(pid, sel.value), pp = penOf(pid), dd = pp.gen ? pp.gen.inuse : (pp.vial ? pp.vial.days : pp.inuse);
    el.textContent = (pp.vial && pp.vial.maxInj === 1) ? gt('single') : t('hint_set', { n: seq.length, t: r1(sum(seq.map(sum))) }) + (dd ? ' · ' + gt('inuse', { d: dd }) : '');
  }

  function all() { panel(); decorate(); }

  /* ───── 하루 단위: 건너뛰기 / 되돌리기 ───── */
  function setSkip(date, on) {
    var plan = load(); if (!plan) return;
    plan.skips = plan.skips || {};
    if (on) plan.skips[date] = 1; else delete plan.skips[date];
    save(plan);
    msg = '';
    if (on) {
      var b = build(plan), nx = addDays(date, 1), inf = b.map[nx];
      var n2 = nx; var g = 0; while (b.map[n2] && b.map[n2].t !== 'inj' && g++ < 3) n2 = addDays(n2, 1);
      var ii = b.map[n2];
      if (ii && ii.t === 'inj') msg = t('moved', { k: ii.k, n: ii.n, dose: ii.split ? ii.segs.join('+') + '=' + ii.dose : ii.dose });
    }
    all(); dayBox(date);
  }

  /* ───── 날짜 눌렀을 때 뜨는 창 위쪽에 안내 ───── */
  function dayBox(date) {
    var mc = document.querySelector('#recordModal .modal-content'); if (!mc) return;
    var old = document.getElementById('ghDayBox'); if (old) old.remove();
    var plan = load(); if (!plan || !date) return;
    var b = build(plan), inf = b.map[date]; if (!inf) return;
    var h = '';
    if (inf.t === 'inj') {
      h = '💉 <b>' + esc(dayText(inf)) + '</b>' + (inf.visit ? '<br>🏥 ' + esc(t('visit_day')) : '') + '<button class="gh-btn w" data-gh="skip" data-d="' + date + '">' + esc(t('skip')) + '</button>';
    } else if (inf.t === 'skip') {
      h = '⏭ <b>' + esc(t('skipped_day')) + '</b><button class="gh-btn o" data-gh="undo" data-d="' + date + '">' + esc(t('undo')) + '</button>';
    } else if (inf.t === 'rest') h = '😴 <b>' + esc(t('rest_day')) + '</b>' + (inf.visit ? '<br>🏥 ' + esc(t('visit_day')) : '');
    else if (inf.visit) h = '🏥 <b>' + esc(t('visit_day')) + '</b>';
    if (!h) return;
    var box = document.createElement('div'); box.id = 'ghDayBox'; box.className = 'gh-daybox'; box.innerHTML = h;
    var hd = mc.querySelector('.modal-header');
    if (hd && hd.nextSibling) mc.insertBefore(box, hd.nextSibling); else mc.appendChild(box);
  }

  /* ───── 이벤트 ───── */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-gh]'); if (!b) return;
    var a = b.getAttribute('data-gh');
    if (a === 'skip') setSkip(b.getAttribute('data-d'), true);
    else if (a === 'undo') setSkip(b.getAttribute('data-d'), false);
    else if (a === 'del') { if (confirm(t('delq'))) { save(null); msg = ''; formPen = null; all(); } }
    else if (a === 'make') {
      var dose = document.getElementById('ghDose').value, start = document.getElementById('ghStart').value;
      if (!dose || !parse(start)) { msg = '!' + t('need'); panel(); return; }
      var old = load();
      var penEl = document.getElementById('ghPen'); formPen = null;
      save({ pen: penEl ? penEl.value : 'g2', dose: dose, start: start, k0: +document.getElementById('ghK').value || 1, visit: document.getElementById('ghVisit').value || '', run: +document.getElementById('ghRun').value || 6, restDow: document.getElementById('ghRestDow').value === '' ? null : +document.getElementById('ghRestDow').value,
             skips: (old && old.dose === dose && old.start === start && (old.pen || 'g2') === (penEl ? penEl.value : 'g2')) ? (old.skips || {}) : {} });
      msg = ''; all();
      var f = document.getElementById('ghForm'); if (f) f.open = false;
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'ghCo') {
      var cc = COMPANIES.filter(function (c) { return c.id === e.target.value; })[0], lst = cc ? pensOfCo(cc) : [];
      if (lst.length) { formPen = lst[0]; panel(); var fo2 = document.getElementById('ghForm'); if (fo2) fo2.open = true; }
      return;
    }
    if (e.target && e.target.id === 'ghPen') { formPen = e.target.value; var fo = document.getElementById('ghForm'); panel(); fo = document.getElementById('ghForm'); if (fo) fo.open = true; return; }
    if (e.target && e.target.id === 'ghDose') {
      hint();
      var pe0 = document.getElementById('ghPen'), N = tableOf(pe0 ? pe0.value : 'g2', e.target.value).length, ks = document.getElementById('ghK');
      if (ks) ks.innerHTML = Array.apply(null, Array(N)).map(function (_, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + '/' + N + '</option>'; }).join('');
    }
  });

  /* ───── 달력 함수에 끼워 넣기 (기존 코드는 그대로) ───── */
  function wrap(name, after) {
    var orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = function () { var r = orig.apply(this, arguments); try { after.apply(this, arguments); } catch (e) { console.error('[gh-cycle]', e); } return r; };
  }
  function init() {
    css();
    wrap('renderMonths', function () { all(); });
    wrap('openRecord', function (d) { dayBox(d); });
    wrap('jrdApplyLang', function () { msg = ''; all(); });
    all();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.jrdGh = { build: build, TABLES: TABLES, PENS: PENS, load: load, save: save, lang: lang, parse: parse, fmt: fmt, pad: pad, addDays: addDays, todayStr: todayStr, esc: esc, refresh: all };
})();

/* ════════════════════════════════════════════════════════════════
 * 억제주사(성조숙증) 스케줄 — 주사한 날을 등록하면 다음 주사 권장일 주변을 달력에 색으로 표시
 *   · 권장일 = 맞은 날 + 제품 간격(1개월형 28일, 3개월형 84일, 6개월형 168일 / 직접 입력 가능)
 *   · 권장일 3일 전부터 연한 초록이 점점 진해지고, 권장일에 가장 진하며, 지난 뒤 2일은 연보라가 서서히 사라짐
 * ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PRODUCTS = [
    { id: 'lor1', ko: '로렐린 1개월 (피하)', en: 'Lorelin 1-month (SC)', days: 28 },
    { id: 'leu1', ko: '루프린 1개월 (피하)', en: 'Leuprin 1-month (SC)', days: 28 },
    { id: 'lph1', ko: '루피어 1개월 (피하)', en: 'Luphere 1-month (SC)', days: 28 },
    { id: 'lpo1', ko: '루프원 1개월 (피하)', en: 'Loop One 1-month (SC)', days: 28 },
    { id: 'dip1', ko: '디페렐린 1개월 (근육)', en: 'Diphereline 1-month (IM)', days: 28 },
    { id: 'leu3', ko: '루프린 3개월 (피하)', en: 'Leuprin 3-month (SC)', days: 84 },
    { id: 'dip3', ko: '디페렐린 3개월 (근육)', en: 'Diphereline 3-month (IM)', days: 84 },
    { id: 'eli6', ko: '엘리가드 6개월 (피하)', en: 'Eligard 6-month (SC)', days: 168 },
    { id: 'dip6', ko: '디페렐린 6개월 (근육)', en: 'Diphereline 6-month (IM)', days: 168 },
    { id: 'etc', ko: '직접 입력', en: 'Custom', days: 28 }
  ];
  var BEFORE = 3, AFTER = 2;
  var SX = {
    ko: { ics_btn: '📅 폰 캘린더에 알림 추가', ics_time: '알림 시각', ics_hint: '다음 주사 권장일 알림 파일을 받아 폰 캘린더에 열어 저장하면, 3일 전·하루 전·당일에 알림이 울려요', ics_title: '억제주사 권장일', ics_desc: '3일 전·하루 전·당일에 알림이 울립니다. 담당 의사에게 예약 일정을 확인하세요.', title: '💜 억제주사 스케줄 (성조숙증)', sub: '주사 맞은 날을 등록하면 다음 주사 권장일이 달력에 색으로 표시돼요', prod: '주사 종류', date: '주사 맞은 날', days: '간격(일)', add: '주사 등록', hist: '등록한 주사', next: '다음 주사 권장일 {d} ({dd})', dd0: '오늘', ddf: 'D-{n}', ddp: '{n}일 지남', none: '주사를 등록하면 다음 권장일이 표시돼요', del: '삭제', delq: '이 주사 기록을 삭제할까요?', need: '주사 맞은 날을 입력해 주세요', lg: '초록 = 권장일 전후(진할수록 권장일), 보라 = 권장일이 지난 뒤', c_due: '권장일', c_inj: '주사', note: '권장일은 간격(1개월형 28일, 3개월형 84일, 6개월형 168일) 기준 참고용입니다. 실제 주사일은 담당 의사 안내를 따라 주세요.' },
    en: { ics_btn: '📅 Add reminder to phone calendar', ics_time: 'Reminder time', ics_hint: 'Download the file and open it in your phone calendar to get alerts 3 days before, 1 day before and on the day', ics_title: 'GnRH injection due', ics_desc: 'Alerts 3 days before, 1 day before and on the day. Please confirm your appointment with the doctor.', title: '💜 GnRH suppression injection schedule', sub: 'Register the date of each injection to see the next due date on the calendar', prod: 'Injection', date: 'Date given', days: 'Interval (days)', add: 'Register', hist: 'Registered injections', next: 'Next injection due {d} ({dd})', dd0: 'today', ddf: 'in {n} days', ddp: '{n} days overdue', none: 'Register an injection to see the next due date', del: 'Delete', delq: 'Delete this injection record?', need: 'Enter the date the injection was given', lg: 'Green = around the due date (darkest on the day), purple = after the due date', c_due: 'Due', c_inj: 'Given', note: "The due date is a guide based on the interval (28 days for monthly, 84 for 3-month, 168 for 6-month). Follow your doctor's instructions." },
    zh: { ics_btn: '📅 添加到手机日历提醒', ics_time: '提醒时间', ics_hint: '下载文件并用手机日历打开保存，将在3天前、1天前和当天提醒', ics_title: '抑制针建议日', ics_desc: '将在3天前、1天前和当天提醒。请向医生确认预约。', title: '💜 抑制针日程（性早熟）', sub: '登记每次注射日期，日历上会标出下次注射建议日', prod: '针剂', date: '注射日期', days: '间隔（天）', add: '登记', hist: '已登记的注射', next: '下次注射建议日 {d}（{dd}）', dd0: '今天', ddf: '还有{n}天', ddp: '已过{n}天', none: '登记注射后会显示下次建议日', del: '删除', delq: '要删除这条注射记录吗？', need: '请输入注射日期', lg: '绿色 = 建议日前后（建议日当天最深），紫色 = 建议日之后', c_due: '建议日', c_inj: '已注射', note: '建议日按间隔（月制28天、3个月84天、6个月168天）推算，仅供参考，请遵医嘱。' },
    'zh-TW': { ics_btn: '📅 加入手機行事曆提醒', ics_time: '提醒時間', ics_hint: '下載檔案並用手機行事曆開啟儲存，將在3天前、1天前和當天提醒', ics_title: '抑制針建議日', ics_desc: '將在3天前、1天前和當天提醒。請向醫師確認預約。', title: '💜 抑制針行程（性早熟）', sub: '登記每次注射日期，日曆上會標出下次注射建議日', prod: '針劑', date: '注射日期', days: '間隔（天）', add: '登記', hist: '已登記的注射', next: '下次注射建議日 {d}（{dd}）', dd0: '今天', ddf: '還有{n}天', ddp: '已過{n}天', none: '登記注射後會顯示下次建議日', del: '刪除', delq: '要刪除這筆注射記錄嗎？', need: '請輸入注射日期', lg: '綠色 = 建議日前後（建議日當天最深），紫色 = 建議日之後', c_due: '建議日', c_inj: '已注射', note: '建議日依間隔（月劑28天、3個月84天、6個月168天）推算，僅供參考，請依醫師指示。' },
    ja: { ics_btn: '📅 スマホのカレンダーに通知を追加', ics_time: '通知時刻', ics_hint: 'ファイルをダウンロードしてスマホのカレンダーで開くと、3日前・前日・当日に通知されます', ics_title: '抑制注射の推奨日', ics_desc: '3日前・前日・当日に通知します。予約日は主治医に確認してください。', title: '💜 抑制注射スケジュール（思春期早発症）', sub: '注射した日を登録すると、次回の推奨日がカレンダーに色で表示されます', prod: '注射の種類', date: '注射した日', days: '間隔（日）', add: '登録', hist: '登録した注射', next: '次回注射の推奨日 {d}（{dd}）', dd0: '今日', ddf: 'あと{n}日', ddp: '{n}日超過', none: '注射を登録すると次回の推奨日が表示されます', del: '削除', delq: 'この注射の記録を削除しますか？', need: '注射した日を入力してください', lg: '緑＝推奨日の前後（当日が最も濃い）、紫＝推奨日を過ぎた後', c_due: '推奨日', c_inj: '注射', note: '推奨日は間隔（1か月製剤28日、3か月84日、6か月168日）に基づく目安です。実際の注射日は主治医の指示に従ってください。' },
    vi: { ics_btn: '📅 Thêm nhắc nhở vào lịch điện thoại', ics_time: 'Giờ nhắc', ics_hint: 'Tải tệp và mở bằng lịch điện thoại để nhận nhắc trước 3 ngày, 1 ngày và đúng ngày', ics_title: 'Ngày tiêm ức chế', ics_desc: 'Nhắc trước 3 ngày, 1 ngày và đúng ngày. Hãy xác nhận lịch hẹn với bác sĩ.', title: '💜 Lịch tiêm thuốc ức chế (dậy thì sớm)', sub: 'Đăng ký ngày đã tiêm để lịch hiển thị ngày tiêm tiếp theo bằng màu', prod: 'Loại thuốc tiêm', date: 'Ngày đã tiêm', days: 'Khoảng cách (ngày)', add: 'Đăng ký', hist: 'Các mũi đã đăng ký', next: 'Ngày tiêm tiếp theo {d} ({dd})', dd0: 'hôm nay', ddf: 'còn {n} ngày', ddp: 'quá {n} ngày', none: 'Đăng ký mũi tiêm để xem ngày tiếp theo', del: 'Xóa', delq: 'Xóa bản ghi mũi tiêm này?', need: 'Hãy nhập ngày đã tiêm', lg: 'Xanh = quanh ngày khuyến nghị (đậm nhất đúng ngày), tím = sau ngày khuyến nghị', c_due: 'Dự kiến', c_inj: 'Đã tiêm', note: 'Ngày khuyến nghị tính theo khoảng cách (1 tháng 28 ngày, 3 tháng 84 ngày, 6 tháng 168 ngày), chỉ để tham khảo. Hãy làm theo hướng dẫn của bác sĩ.' },
    th: { ics_btn: '📅 เพิ่มการแจ้งเตือนในปฏิทินมือถือ', ics_time: 'เวลาแจ้งเตือน', ics_hint: 'ดาวน์โหลดไฟล์แล้วเปิดในปฏิทินมือถือ จะแจ้งเตือนก่อน 3 วัน 1 วัน และในวันนั้น', ics_title: 'วันแนะนำฉีดยากดฮอร์โมน', ics_desc: 'แจ้งเตือนก่อน 3 วัน 1 วัน และในวันนั้น โปรดยืนยันนัดกับแพทย์', title: '💜 ตารางฉีดยากดฮอร์โมน (เข้าสู่วัยหนุ่มสาวเร็ว)', sub: 'บันทึกวันที่ฉีด แล้วปฏิทินจะแสดงวันแนะนำฉีดครั้งถัดไปเป็นสี', prod: 'ชนิดยาฉีด', date: 'วันที่ฉีด', days: 'ระยะห่าง (วัน)', add: 'บันทึก', hist: 'การฉีดที่บันทึกไว้', next: 'วันแนะนำฉีดครั้งถัดไป {d} ({dd})', dd0: 'วันนี้', ddf: 'อีก {n} วัน', ddp: 'เลย {n} วัน', none: 'บันทึกการฉีดเพื่อดูวันแนะนำครั้งถัดไป', del: 'ลบ', delq: 'ลบบันทึกการฉีดนี้หรือไม่', need: 'กรุณากรอกวันที่ฉีด', lg: 'เขียว = ช่วงรอบวันแนะนำ (เข้มสุดในวันนั้น), ม่วง = หลังวันแนะนำ', c_due: 'วันแนะนำ', c_inj: 'ฉีดแล้ว', note: 'วันแนะนำคำนวณจากระยะห่าง (รายเดือน 28 วัน, 3 เดือน 84 วัน, 6 เดือน 168 วัน) ใช้เป็นแนวทางเท่านั้น โปรดทำตามคำแนะนำของแพทย์' },
    id: { ics_btn: '📅 Tambahkan pengingat ke kalender ponsel', ics_time: 'Jam pengingat', ics_hint: 'Unduh berkas dan buka di kalender ponsel untuk pengingat 3 hari, 1 hari sebelum, dan pada harinya', ics_title: 'Jadwal suntik penekan', ics_desc: 'Pengingat 3 hari, 1 hari sebelum, dan pada harinya. Konfirmasi janji dengan dokter.', title: '💜 Jadwal suntik penekan (pubertas dini)', sub: 'Catat tanggal suntik agar kalender menandai tanggal suntik berikutnya dengan warna', prod: 'Jenis suntikan', date: 'Tanggal disuntik', days: 'Interval (hari)', add: 'Catat', hist: 'Suntikan tercatat', next: 'Suntikan berikutnya {d} ({dd})', dd0: 'hari ini', ddf: '{n} hari lagi', ddp: 'lewat {n} hari', none: 'Catat suntikan untuk melihat tanggal berikutnya', del: 'Hapus', delq: 'Hapus catatan suntikan ini?', need: 'Isi tanggal suntikan', lg: 'Hijau = sekitar tanggal anjuran (paling pekat di hari itu), ungu = setelah tanggal anjuran', c_due: 'Jadwal', c_inj: 'Disuntik', note: 'Tanggal anjuran berdasarkan interval (bulanan 28 hari, 3 bulan 84 hari, 6 bulan 168 hari) hanya sebagai panduan. Ikuti arahan dokter.' },
    es: { ics_btn: '📅 Añadir recordatorio al calendario del móvil', ics_time: 'Hora del aviso', ics_hint: 'Descargue el archivo y ábralo en el calendario del móvil para recibir avisos 3 días antes, 1 día antes y el mismo día', ics_title: 'Inyección supresora recomendada', ics_desc: 'Avisos 3 días antes, 1 día antes y el mismo día. Confirme la cita con el médico.', title: '💜 Calendario de inyecciones supresoras (pubertad precoz)', sub: 'Registre la fecha de cada inyección y el calendario marcará con color la próxima', prod: 'Inyección', date: 'Fecha de aplicación', days: 'Intervalo (días)', add: 'Registrar', hist: 'Inyecciones registradas', next: 'Próxima inyección {d} ({dd})', dd0: 'hoy', ddf: 'en {n} días', ddp: '{n} días de retraso', none: 'Registre una inyección para ver la próxima fecha', del: 'Eliminar', delq: '¿Eliminar este registro de inyección?', need: 'Indique la fecha de la inyección', lg: 'Verde = alrededor de la fecha recomendada (más intenso ese día), morado = después de la fecha', c_due: 'Toca', c_inj: 'Puesta', note: 'La fecha es una guía según el intervalo (mensual 28 días, trimestral 84, semestral 168). Siga las indicaciones del médico.' },
    ar: { ics_btn: '📅 إضافة تذكير إلى تقويم الهاتف', ics_time: 'وقت التذكير', ics_hint: 'نزّل الملف وافتحه في تقويم الهاتف لتصلك تنبيهات قبل 3 أيام ويوم واحد وفي اليوم نفسه', ics_title: 'موعد حقنة الكبح', ics_desc: 'تنبيهات قبل 3 أيام ويوم واحد وفي اليوم نفسه. أكّد الموعد مع الطبيب.', title: '💜 جدول حقن الكبح (البلوغ المبكر)', sub: 'سجّل تاريخ كل حقنة ليُظهر التقويم موعد الحقنة التالية بالألوان', prod: 'نوع الحقنة', date: 'تاريخ الحقنة', days: 'الفاصل (أيام)', add: 'تسجيل', hist: 'الحقن المسجّلة', next: 'موعد الحقنة التالية {d} ({dd})', dd0: 'اليوم', ddf: 'بعد {n} يوم', ddp: 'تأخرت {n} يوم', none: 'سجّل حقنة لإظهار الموعد التالي', del: 'حذف', delq: 'هل تريد حذف سجل هذه الحقنة؟', need: 'أدخل تاريخ الحقنة', lg: 'الأخضر = حول الموعد المقترح (الأغمق في يومه)، البنفسجي = بعد الموعد', c_due: 'الموعد', c_inj: 'مُعطاة', note: 'الموعد المقترح تقدير حسب الفاصل (شهري 28 يوماً، 3 أشهر 84، 6 أشهر 168). اتبع تعليمات الطبيب.' },
    mn: { ics_btn: '📅 Утасны календарьт сануулга нэмэх', ics_time: 'Сануулах цаг', ics_hint: 'Файлыг татаж утасны календарьт нээвэл 3 хоногийн, 1 хоногийн өмнө болон тухайн өдөр сануулна', ics_title: 'Дарангуйлах тарилгын өдөр', ics_desc: '3 хоногийн, 1 хоногийн өмнө болон тухайн өдөр сануулна. Эмчтэйгээ цагаа баталгаажуулна уу.', title: '💜 Дарангуйлах тариа (эрт бэлгийн бойжилт)', sub: 'Тарьсан өдрөө бүртгэвэл дараагийн тарилгын өдөр календарьт өнгөөр харагдана', prod: 'Тарилгын төрөл', date: 'Тарьсан өдөр', days: 'Давтамж (хоног)', add: 'Бүртгэх', hist: 'Бүртгэсэн тарилгууд', next: 'Дараагийн тарилга {d} ({dd})', dd0: 'өнөөдөр', ddf: '{n} хоногийн дараа', ddp: '{n} хоног хэтэрсэн', none: 'Тарилга бүртгэвэл дараагийн өдөр харагдана', del: 'Устгах', delq: 'Энэ тарилгын бүртгэлийг устгах уу?', need: 'Тарьсан өдрөө оруулна уу', lg: 'Ногоон = зөвлөмж өдрийн орчим (тэр өдөр хамгийн бараан), нил ягаан = зөвлөмж өдрөөс хойш', c_due: 'Өдөр', c_inj: 'Тарьсан', note: 'Зөвлөмж өдөр нь давтамжид (1 сарын 28, 3 сарын 84, 6 сарын 168 хоног) үндэслэсэн лавлагаа юм. Эмчийнхээ зааврыг дага.' }
  };
  function lang() {
    var l = (window.JRD_LANG || document.documentElement.getAttribute('lang') || 'ko'); if (/^ko/i.test(String(l))) return 'ko';
    if (/^zh-?(tw|hant|hk)$/i.test(l) || l === 'zt') return 'zh-TW';
    l = String(l).split('-')[0].toLowerCase() === 'zh' ? 'zh' : String(l).toLowerCase();
    return SX[l] ? l : (l === 'ko' ? 'ko' : 'en');
  }
  function t(k, v) { var s = (SX[lang()] || SX.ko)[k]; if (s == null) s = SX.ko[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function diff(a, b) { return Math.round((parse(a) - parse(b)) / 86400000); }   // a - b (일)
  function today() { return fmt(new Date()); }
  function pname(p) { return lang() === 'ko' ? p.ko : p.en; }
  function prodOf(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return PRODUCTS[0]; }
  function child() { try { return (typeof activeChildId !== 'undefined') ? activeChildId : 1; } catch (e) { return 1; } }
  function key() { return 'jrdSupPlan_' + child(); }
  function load() { try { var v = JSON.parse(localStorage.getItem(key()) || 'null'); return v && v.inj ? v : { inj: [] }; } catch (e) { return { inj: [] }; } }
  function save(v) { try { localStorage.setItem(key(), JSON.stringify(v)); } catch (e) {} }
  function nextDue(plan) {
    if (!plan.inj.length) return null;
    var last = plan.inj.slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; }).pop();
    var p = prodOf(last.p), days = +last.n || p.days;
    return { due: addDays(last.d, days), last: last, days: days };
  }

  function css() {
    if (document.getElementById('supCss')) return;
    var s = document.createElement('style'); s.id = 'supCss';
    s.textContent = [
      '.sup-panel{max-width:680px;margin:10px auto;background:#fff;border:1.5px solid #8e6bb0;border-radius:12px;padding:12px 14px;color:#1B3A4B;font-size:13px}',
      '.sup-panel h3{font-size:15px;margin:0 0 2px}.sup-panel .s{font-size:11px;color:#43555F;margin-bottom:8px}',
      '.sup-panel input,.sup-panel select{-webkit-user-select:text;user-select:text;width:100%;margin-top:3px;padding:8px;border:1px solid #DED5C6;border-radius:8px;font-size:14px;background:#fff;color:#1B3A4B;font-family:inherit}',
      '.sup-row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}.sup-row label{flex:1;min-width:120px;font-size:11px;font-weight:700;color:#43555F;display:block}',
      '.sup-btn{border:0;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;background:#6f4f94;color:#fff;font-family:inherit;width:100%;margin-top:4px}',
      '.sup-next{background:#f1faf4;border:1px solid #bfe3cc;border-radius:10px;padding:9px 11px;margin:8px 0;font-weight:700;font-size:14px}',
      '.sup-hist{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.sup-hist span{background:#f4eefa;border:1px solid #d9c8ea;border-radius:16px;padding:3px 9px;font-size:11.5px}',
      '.sup-hist button{border:0;background:none;color:#B24E36;font-weight:700;cursor:pointer;margin-left:4px}',
      '.sup-lg{font-size:10.5px;color:#43555F;margin-top:6px;line-height:1.5}.sup-note{font-size:10.5px;color:#7a8a93;margin-top:6px;line-height:1.5}',
      '.day-cell.sup-g1{background:#f3fbf6!important}.day-cell.sup-g2{background:#e1f5e9!important}.day-cell.sup-g3{background:#c9edd8!important}',
      '.day-cell.sup-t{background:#a8e0bf!important;border-color:#4caf7a!important}',
      '.day-cell.sup-p1{background:#e6d8f3!important}.day-cell.sup-p2{background:#f5effb!important}',
      '.day-cell .sup-chip{font-size:8px;line-height:1.15;font-weight:700;border-radius:6px;padding:1px 4px;max-width:98%;text-align:center}',
      '.day-cell .sup-due{background:#2e8b57;color:#fff}.day-cell .sup-inj{background:#6f4f94;color:#fff}'
    ].join('');
    document.head.appendChild(s);
  }

  function decorate() {
    var plan = load(), nd = nextDue(plan), injMap = {};
    plan.inj.forEach(function (x) { injMap[x.d] = x; });
    document.querySelectorAll('.day-cell').forEach(function (c) {
      c.className = c.className.replace(/\bsup-(g1|g2|g3|t|p1|p2)\b/g, '').replace(/\s+/g, ' ').trim();
      c.querySelectorAll('.sup-chip').forEach(function (x) { x.remove(); });
      var m = /openRecord\('(\d{4}-\d{2}-\d{2})'/.exec(c.getAttribute('onclick') || ''); if (!m) return;
      var d = m[1], html = '';
      if (nd) {
        // 마지막 주사일 기준으로 간격(days)마다 무기한 반복: last + days*m (m>=1)
        var o = diff(d, nd.last.d), mm = Math.round(o / nd.days), k = o - mm * nd.days;   // k: 가장 가까운 권장일 대비 일수
        if (mm >= 1 && k >= -BEFORE && k <= AFTER) {
          var cls = k === 0 ? 'sup-t' : (k === -1 ? 'sup-g3' : (k === -2 ? 'sup-g2' : (k === -BEFORE ? 'sup-g1' : (k === 1 ? 'sup-p1' : 'sup-p2'))));
          c.classList.add(cls);
          if (k === 0) html += '<div class="sup-chip sup-due">' + esc(t('c_due')) + '</div>';
        }
      }
      if (injMap[d]) html += '<div class="sup-chip sup-inj">💉' + esc(t('c_inj')) + '</div>';
      if (html) c.insertAdjacentHTML('beforeend', html);
    });
  }

  var formProd = null;
  function panel() {
    var host = document.getElementById('supPanel');
    if (!host) {
      host = document.createElement('div'); host.id = 'supPanel'; host.className = 'sup-panel';
      var gh = document.getElementById('ghPanel'), anchor = gh || document.querySelector('.container');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor.nextSibling); else document.body.appendChild(host);
    }
    var plan = load(), nd = nextDue(plan), prodId = formProd || (plan.inj.length ? plan.inj[plan.inj.length - 1].p : 'lor1'), p = prodOf(prodId);
    var h = '<h3>' + esc(t('title')) + '</h3><div class="s">' + esc(t('sub')) + '</div>';
    if (nd) {
      var dn = diff(nd.due, today()), dd = dn === 0 ? t('dd0') : (dn > 0 ? t('ddf', { n: dn }) : t('ddp', { n: -dn }));
      var dt = parse(nd.due);
      var more = []; for (var q = 2; q <= 5; q++) { var qd = parse(addDays(nd.last.d, nd.days * q)); more.push((qd.getMonth() + 1) + '/' + qd.getDate()); }
      h += '<div class="sup-next">🗓 ' + esc(t('next', { d: (dt.getMonth() + 1) + '/' + dt.getDate(), dd: dd })) + '<div style="font-weight:500;font-size:12px;margin-top:3px">➜ ' + more.join(' · ') + ' …</div></div>';
    } else h += '<div class="sup-next" style="background:#f7f4ef;border-color:#DED5C6;color:#7a8a93;font-weight:600">' + esc(t('none')) + '</div>';
    h += '<div class="sup-row"><label>' + esc(t('prod')) + '<select id="supProd">' + PRODUCTS.map(function (x) { return '<option value="' + x.id + '"' + (x.id === prodId ? ' selected' : '') + '>' + esc(pname(x)) + '</option>'; }).join('') + '</select></label>';
    h += '<label>' + esc(t('date')) + '<input type="date" id="supDate" value="' + today() + '"></label></div>';
    h += '<div class="sup-row" id="supDaysRow"><label>' + esc(t('days')) + '<input type="number" id="supDays" min="7" max="400" value="' + p.days + '"></label></div>';
    h += '<button class="sup-btn" data-sup="add">' + esc(t('add')) + '</button>';
    if (nd) {
      h += '<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #DED5C6"><div class="sup-row"><label>' + esc(t('ics_time')) + '<input type="time" id="supTime" value="' + (localStorage.getItem('jrdSupTime') || '09:00') + '"></label></div>';
      h += '<button class="sup-btn" style="background:#2e8b57" data-sup="ics">' + esc(t('ics_btn')) + '</button><div class="sup-lg">' + esc(t('ics_hint')) + '</div></div>';
    }
    if (plan.inj.length) {
      h += '<div class="sup-lg" style="margin-top:10px;font-weight:700">' + esc(t('hist')) + '</div><div class="sup-hist">';
      plan.inj.slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; }).forEach(function (x) {
        var dd = parse(x.d); h += '<span>' + (dd.getMonth() + 1) + '/' + dd.getDate() + ' · ' + esc(pname(prodOf(x.p))) + ' · ' + (+x.n || prodOf(x.p).days) + '<button data-sup="del" data-d="' + x.d + '" title="' + esc(t('del')) + '">✕</button></span>';
      });
      h += '</div>';
    }
    h += '<div class="sup-lg">' + esc(t('lg')) + '</div><div class="sup-note">' + esc(t('note')) + '</div>';
    host.innerHTML = h;
  }
  function all() { panel(); decorate(); }

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'supProd') { formProd = e.target.value; var dv = document.getElementById('supDate').value; panel(); var el = document.getElementById('supDate'); if (el && dv) el.value = dv; }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sup]'); if (!b) return;
    var a = b.getAttribute('data-sup'), plan = load();
    if (a === 'add') {
      var d = document.getElementById('supDate').value, pr = document.getElementById('supProd').value, n = +document.getElementById('supDays').value || prodOf(pr).days;
      if (!parse(d)) { alert(t('need')); return; }
      plan.inj = plan.inj.filter(function (x) { return x.d !== d; }); plan.inj.push({ d: d, p: pr, n: n });
      save(plan); formProd = null; all();
    } else if (a === 'ics') {
      var nd2 = nextDue(plan); if (!nd2) return;
      var tm = (document.getElementById('supTime') || {}).value || '09:00'; try { localStorage.setItem('jrdSupTime', tm); } catch (e2) {}
      var hh = tm.split(':'), ymd = nd2.due.replace(/-/g, ''), st = ymd + 'T' + pad(+hh[0]) + pad(+hh[1] || 0) + '00';
      var endD = new Date(parse(nd2.due)); endD.setHours(+hh[0], (+hh[1] || 0) + 30, 0, 0);
      var en = fmt(endD).replace(/-/g, '') + 'T' + pad(endD.getHours()) + pad(endD.getMinutes()) + '00';
      var nm = pname(prodOf(nd2.last.p)), sm = t('ics_title') + ' - ' + nm;
      var ev = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jarada//Suppression//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        'UID:jrd-sup-' + nd2.due + '-' + child() + '@jarada', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
        'DTSTART:' + st, 'DTEND:' + en, 'RRULE:FREQ=DAILY;INTERVAL=' + nd2.days + ';COUNT=12', 'SUMMARY:' + sm.replace(/[,;]/g, ' '), 'DESCRIPTION:' + t('ics_desc').replace(/[,;]/g, ' '),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + sm.replace(/[,;]/g, ' '), 'TRIGGER:-P3D', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + sm.replace(/[,;]/g, ' '), 'TRIGGER:-P1D', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + sm.replace(/[,;]/g, ' '), 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var a2 = document.createElement('a'); a2.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ev); a2.download = 'jarada-suppression-' + nd2.due + '.ics';
      document.body.appendChild(a2); a2.click(); a2.remove();
    } else if (a === 'del') {
      if (confirm(t('delq'))) { plan.inj = plan.inj.filter(function (x) { return x.d !== b.getAttribute('data-d'); }); save(plan); all(); }
    }
  });
  function wrap(name, after) {
    var orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = function () { var r = orig.apply(this, arguments); try { after.apply(this, arguments); } catch (e) { console.error('[sup]', e); } return r; };
  }
  function init() { css(); wrap('renderMonths', all); wrap('jrdApplyLang', all); all(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ════════════════════════════════════════════════════════════════
 * 성장호르몬 부가 기능 — ① 약 소진 예정일 안내(처방·내원 필요) ② 펜 교체·소진 폰 알람(.ics)
 *                      ③ 일정·못 맞음 기록을 서버에 저장(환아 앱) → 의사 앱에서 확인
 * ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var G = window.jrdGh; if (!G || !G.build) return;
  var D = {
    ko: { sup_l: '받은 약 개수 (펜·카트리지·바이알)', sup_h: '입력하면 소진 예정일을 정확히 계산해요. 모르면 비워 두세요(현재 펜 기준).', sup_b: '저장', cur: '현재 사용 중인 펜(세트)은 {d}까지 쓸 수 있어요 (약 {n}일 남음).', all: '받은 약 {c}개는 {d}에 모두 소진돼요 ({n}일 남음).', over: '소진 예정일({d})이 지났어요. 새 약이 있는지 확인하세요.', warn: '⚠️ 약이 {n}일 뒤({d})에 떨어져요 — 처방·내원이 필요해요.', warn0: '⚠️ 약이 오늘({d}) 떨어져요 — 처방·내원이 필요해요.', early: '⚠️ 다음 외래({v})보다 {n}일 먼저 약이 떨어져요 — 외래를 앞당기거나 처방을 받으세요.', ics_b: '📅 펜 교체·소진 알람을 폰 캘린더에 추가', ics_t: '알람 시각', ics_h: '펜/카트리지 교체일과 약 소진 3일 전·1일 전·당일에 알려줘요.', pen: '💉 펜/카트리지 교체일', out: '💊 약 소진 예정 — 처방·내원 필요', none: '추가할 알람이 없어요.' },
    en: { sup_l: 'Pens / cartridges / vials received', sup_h: 'Enter this to calculate the run-out date exactly. Leave blank to use the current pen only.', sup_b: 'Save', cur: 'Your current pen (set) lasts until {d} (about {n} days left).', all: 'All {c} supplies run out on {d} ({n} days left).', over: 'The run-out date ({d}) has passed. Check that you have new medicine.', warn: '⚠️ Medicine runs out in {n} days ({d}) — a prescription / visit is needed.', warn0: '⚠️ Medicine runs out today ({d}) — a prescription / visit is needed.', early: '⚠️ Medicine runs out {n} days before your next visit ({v}) — move the visit earlier or get a prescription.', ics_b: '📅 Add pen-change & run-out alarms to phone calendar', ics_t: 'Alarm time', ics_h: 'Alerts on pen/cartridge change days and 3 days, 1 day before and on the run-out day.', pen: '💉 Pen/cartridge change day', out: '💊 Medicine runs out — prescription / visit needed', none: 'No alarms to add.' },
    ja: { sup_l: '受け取った薬の数（ペン・カートリッジ・バイアル）', sup_h: '入力すると消費終了日を正確に計算します。不明なら空欄（現在のペン基準）。', sup_b: '保存', cur: '現在のペン（セット）は{d}まで使えます（残り約{n}日）。', all: '受け取った薬{c}個は{d}に使い終わります（残り{n}日）。', over: '終了予定日（{d}）を過ぎました。新しい薬があるか確認してください。', warn: '⚠️ 薬があと{n}日（{d}）でなくなります — 処方・来院が必要です。', warn0: '⚠️ 薬が本日（{d}）なくなります — 処方・来院が必要です。', early: '⚠️ 次回の来院（{v}）より{n}日早く薬がなくなります。', ics_b: '📅 ペン交換・終了アラームをカレンダーに追加', ics_t: '通知時刻', ics_h: 'ペン/カートリッジ交換日と、終了の3日前・1日前・当日にお知らせします。', pen: '💉 ペン/カートリッジ交換日', out: '💊 薬の終了予定 — 処方・来院が必要', none: '追加するアラームがありません。' },
    zh: { sup_l: '已领取的药品数量（笔·药筒·药瓶）', sup_h: '填写后可精确计算用完日期；不清楚可留空（按当前笔计算）。', sup_b: '保存', cur: '当前使用的笔（组）可用到{d}（约剩{n}天）。', all: '领取的{c}个药品将于{d}用完（剩{n}天）。', over: '预计用完日期（{d}）已过，请确认是否还有新药。', warn: '⚠️ 药品将在{n}天后（{d}）用完 — 需要处方·就诊。', warn0: '⚠️ 药品今天（{d}）用完 — 需要处方·就诊。', early: '⚠️ 药品将比下次就诊（{v}）早{n}天用完。', ics_b: '📅 将换笔·用完提醒添加到手机日历', ics_t: '提醒时间', ics_h: '在换笔/药筒日以及用完前3天、1天和当天提醒。', pen: '💉 换笔/药筒日', out: '💊 药品即将用完 — 需要处方·就诊', none: '没有可添加的提醒。' },
    'zh-TW': { sup_l: '已領取的藥品數量（筆·藥筒·藥瓶）', sup_h: '填寫後可精確計算用完日期；不清楚可留空（按當前筆計算）。', sup_b: '儲存', cur: '當前使用的筆（組）可用到{d}（約剩{n}天）。', all: '領取的{c}個藥品將於{d}用完（剩{n}天）。', over: '預計用完日期（{d}）已過，請確認是否還有新藥。', warn: '⚠️ 藥品將在{n}天後（{d}）用完 — 需要處方·就診。', warn0: '⚠️ 藥品今天（{d}）用完 — 需要處方·就診。', early: '⚠️ 藥品將比下次就診（{v}）早{n}天用完。', ics_b: '📅 將換筆·用完提醒新增到手機日曆', ics_t: '提醒時間', ics_h: '在換筆/藥筒日以及用完前3天、1天和當天提醒。', pen: '💉 換筆/藥筒日', out: '💊 藥品即將用完 — 需要處方·就診', none: '沒有可新增的提醒。' },
    vi: { sup_l: 'Số thuốc đã nhận (bút · ống thuốc · lọ)', sup_h: 'Nhập để tính chính xác ngày hết thuốc. Nếu không rõ, hãy để trống (tính theo bút hiện tại).', sup_b: 'Lưu', cur: 'Bút (bộ) đang dùng có thể dùng đến {d} (còn khoảng {n} ngày).', all: '{c} thuốc đã nhận sẽ hết vào {d} (còn {n} ngày).', over: 'Đã qua ngày dự kiến hết thuốc ({d}). Hãy kiểm tra xem còn thuốc mới không.', warn: '⚠️ Thuốc sẽ hết sau {n} ngày ({d}) — cần kê đơn / tái khám.', warn0: '⚠️ Thuốc hết hôm nay ({d}) — cần kê đơn / tái khám.', early: '⚠️ Thuốc sẽ hết sớm hơn lần khám tới ({v}) {n} ngày — hãy dời lịch khám sớm hơn hoặc nhận đơn thuốc.', ics_b: '📅 Thêm nhắc thay bút & hết thuốc vào lịch điện thoại', ics_t: 'Giờ nhắc', ics_h: 'Nhắc vào ngày thay bút/ống thuốc, 3 ngày và 1 ngày trước, và đúng ngày hết thuốc.', pen: '💉 Ngày thay bút/ống thuốc', out: '💊 Sắp hết thuốc — cần kê đơn / tái khám', none: 'Không có nhắc nhở nào để thêm.' },
    id: { sup_l: 'Jumlah obat yang diterima (pen · cartridge · vial)', sup_h: 'Isi untuk menghitung tanggal obat habis dengan tepat. Jika tidak tahu, biarkan kosong (dihitung dari pen saat ini).', sup_b: 'Simpan', cur: 'Pen (set) yang sedang dipakai cukup sampai {d} (sisa sekitar {n} hari).', all: '{c} obat yang diterima akan habis pada {d} (sisa {n} hari).', over: 'Tanggal perkiraan obat habis ({d}) sudah lewat. Periksa apakah masih ada obat baru.', warn: '⚠️ Obat akan habis dalam {n} hari ({d}) — perlu resep / kunjungan.', warn0: '⚠️ Obat habis hari ini ({d}) — perlu resep / kunjungan.', early: '⚠️ Obat habis {n} hari sebelum kunjungan berikutnya ({v}) — majukan kunjungan atau minta resep.', ics_b: '📅 Tambahkan pengingat ganti pen & obat habis ke kalender ponsel', ics_t: 'Jam pengingat', ics_h: 'Mengingatkan pada hari ganti pen/cartridge, 3 hari dan 1 hari sebelumnya, serta pada hari obat habis.', pen: '💉 Hari ganti pen/cartridge', out: '💊 Obat akan habis — perlu resep / kunjungan', none: 'Tidak ada pengingat untuk ditambahkan.' },
    es: { sup_l: 'Medicamento recibido (plumas · cartuchos · viales)', sup_h: 'Introdúzcalo para calcular con exactitud cuándo se acaba. Si no lo sabe, déjelo en blanco (se calcula con la pluma actual).', sup_b: 'Guardar', cur: 'La pluma (set) actual alcanza hasta el {d} (quedan unos {n} días).', all: 'Los {c} envases recibidos se acaban el {d} (quedan {n} días).', over: 'La fecha prevista de fin ({d}) ya pasó. Compruebe si tiene medicamento nuevo.', warn: '⚠️ El medicamento se acaba en {n} días ({d}) — necesita receta / consulta.', warn0: '⚠️ El medicamento se acaba hoy ({d}) — necesita receta / consulta.', early: '⚠️ El medicamento se acaba {n} días antes de su próxima consulta ({v}) — adelante la consulta o pida receta.', ics_b: '📅 Añadir avisos de cambio de pluma y fin del medicamento al calendario', ics_t: 'Hora del aviso', ics_h: 'Avisa los días de cambio de pluma/cartucho, 3 días y 1 día antes, y el día en que se acaba.', pen: '💉 Día de cambio de pluma/cartucho', out: '💊 Se acaba el medicamento — necesita receta / consulta', none: 'No hay avisos que añadir.' },
    mn: { sup_l: 'Авсан эмийн тоо (үзэг · картридж · флакон)', sup_h: 'Оруулбал эм дуусах өдрийг яг тооцоолно. Мэдэхгүй бол хоосон үлдээгээрэй (одоогийн үзгээр тооцно).', sup_b: 'Хадгалах', cur: 'Одоо хэрэглэж буй үзэг (багц) {d} хүртэл хүрнэ (ойролцоогоор {n} хоног үлдсэн).', all: 'Авсан {c} эм {d}-нд бүгд дуусна ({n} хоног үлдсэн).', over: 'Дуусах төлөвтэй өдөр ({d}) өнгөрсөн. Шинэ эм байгаа эсэхийг шалгаарай.', warn: '⚠️ Эм {n} хоногийн дараа ({d}) дуусна — жор / үзлэг хэрэгтэй.', warn0: '⚠️ Эм өнөөдөр ({d}) дуусна — жор / үзлэг хэрэгтэй.', early: '⚠️ Дараагийн үзлэгээс ({v}) {n} хоногийн өмнө эм дуусна — үзлэгээ урагшлуулах эсвэл жор аваарай.', ics_b: '📅 Үзэг солих, эм дуусах сануулгыг утасны хуанлид нэмэх', ics_t: 'Сануулах цаг', ics_h: 'Үзэг/картридж солих өдөр, эм дуусахаас 3 хоног, 1 хоногийн өмнө болон дуусах өдөр сануулна.', pen: '💉 Үзэг/картридж солих өдөр', out: '💊 Эм дуусах гэж байна — жор / үзлэг хэрэгтэй', none: 'Нэмэх сануулга алга.' },
    ar: { sup_l: 'عدد الأدوية المستلمة (قلم · خرطوشة · قارورة)', sup_h: 'أدخله لحساب موعد نفاد الدواء بدقة. إن لم تكن متأكدًا فاتركه فارغًا (يُحسب على القلم الحالي).', sup_b: 'حفظ', cur: 'القلم (الطقم) الحالي يكفي حتى {d} (يتبقى نحو {n} يومًا).', all: 'تنفد الأدوية المستلمة ({c}) في {d} (يتبقى {n} يومًا).', over: 'مرّ موعد النفاد المتوقع ({d}). تأكد من وجود دواء جديد.', warn: '⚠️ ينفد الدواء بعد {n} يومًا ({d}) — يلزم وصفة / زيارة.', warn0: '⚠️ ينفد الدواء اليوم ({d}) — يلزم وصفة / زيارة.', early: '⚠️ ينفد الدواء قبل الزيارة القادمة ({v}) بـ {n} يومًا — قدّم موعد الزيارة أو احصل على وصفة.', ics_b: '📅 أضف تنبيهات تغيير القلم ونفاد الدواء إلى تقويم الهاتف', ics_t: 'وقت التنبيه', ics_h: 'تنبيه في أيام تغيير القلم/الخرطوشة، وقبل النفاد بثلاثة أيام وبيوم واحد، وفي يوم النفاد.', pen: '💉 يوم تغيير القلم/الخرطوشة', out: '💊 الدواء على وشك النفاد — يلزم وصفة / زيارة', none: 'لا توجد تنبيهات لإضافتها.' },
    th: { sup_l: 'จำนวนยาที่ได้รับ (ปากกา · หลอดยา · ขวดยา)', sup_h: 'กรอกเพื่อคำนวณวันที่ยาหมดได้แม่นยำ ถ้าไม่ทราบให้เว้นว่างไว้ (คำนวณจากปากกาที่ใช้อยู่)', sup_b: 'บันทึก', cur: 'ปากกา (ชุด) ที่ใช้อยู่ใช้ได้ถึง {d} (เหลือประมาณ {n} วัน)', all: 'ยาที่ได้รับ {c} ชิ้นจะหมดในวันที่ {d} (เหลือ {n} วัน)', over: 'เลยวันที่คาดว่ายาจะหมด ({d}) แล้ว โปรดตรวจสอบว่ามียาใหม่หรือไม่', warn: '⚠️ ยาจะหมดในอีก {n} วัน ({d}) — ต้องรับใบสั่งยา / มาพบแพทย์', warn0: '⚠️ ยาหมดวันนี้ ({d}) — ต้องรับใบสั่งยา / มาพบแพทย์', early: '⚠️ ยาจะหมดก่อนนัดครั้งถัดไป ({v}) {n} วัน — เลื่อนนัดให้เร็วขึ้นหรือรับใบสั่งยา', ics_b: '📅 เพิ่มการแจ้งเตือนเปลี่ยนปากกาและยาหมดลงปฏิทินโทรศัพท์', ics_t: 'เวลาแจ้งเตือน', ics_h: 'แจ้งเตือนในวันเปลี่ยนปากกา/หลอดยา และก่อนยาหมด 3 วัน 1 วัน และวันที่ยาหมด', pen: '💉 วันเปลี่ยนปากกา/หลอดยา', out: '💊 ยาใกล้หมด — ต้องรับใบสั่งยา / มาพบแพทย์', none: 'ไม่มีการแจ้งเตือนที่จะเพิ่ม' },
  };
  function lg() { try { return G.lang(); } catch (e) { return 'ko'; } }
  function L(k, v) { var d = D[lg()] || D.en, s = d[k] != null ? d[k] : (D.en[k] != null ? D.en[k] : D.ko[k]); if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function diff(a, b) { var A = G.parse(a), B = G.parse(b); return Math.round((A - B) / 86400000); }
  function md(s) { var d = G.parse(s); return d ? (d.getMonth() + 1) + '/' + d.getDate() : s; }

  // 계획 전체(오늘 + 400일)를 펼쳐서 세트(펜) 단위로 소진일을 구합니다
  function runOut(plan) {
    var today = G.todayStr(), far = G.addDays(today > plan.start ? today : plan.start, 400);
    var b = G.build(Object.assign({}, plan, { visit: far })), m = b.map, d, firstSet = null, curSet = null, lastBy = {}, changes = [];
    for (var i = 0; i < 900; i++) {
      d = G.addDays(plan.start, i); if (d > far) break;
      var inf = m[d]; if (!inf || inf.t !== 'inj') continue;
      if (firstSet == null) firstSet = inf.set;
      if (curSet == null && d >= today) curSet = inf.set;
      lastBy[inf.set] = d;
      if (d >= today && (inf.newCart || inf.split) && changes.length < 40 && d <= G.addDays(today, 120)) changes.push(d);
    }
    if (firstSet == null) return null;
    var supply = +plan.supply > 0 ? +plan.supply : 0, target = supply ? firstSet + supply - 1 : (curSet != null ? curSet : firstSet);
    var date = lastBy[target]; if (!date) return null;
    return { date: date, days: diff(date, today), supply: supply, set: target, changes: changes, map: m };
  }
  function notice(plan, ro) {
    if (!ro) return { text: '', bad: false };
    var o = { d: md(ro.date), n: ro.days, c: ro.supply };
    if (ro.days < 0) return { text: L('over', o), bad: true };
    if (!ro.supply) return { text: L('cur', o), bad: false };   // 받은 약 개수를 모르면 경고하지 않고 현재 펜 기준 안내만
    if (plan.visit && plan.visit >= G.todayStr() && ro.date < plan.visit) return { text: L('early', { n: diff(plan.visit, ro.date), v: md(plan.visit) }), bad: true };
    if (ro.days === 0) return { text: L('warn0', o), bad: true };
    if (ro.days <= 7) return { text: L('warn', o), bad: true };
    return { text: ro.supply ? L('all', o) : L('cur', o), bad: false };
  }
  function html() {
    var plan = G.load(); if (!plan) return '';
    var ro = null; try { ro = runOut(plan); } catch (e) {}
    var nt = notice(plan, ro), esc = G.esc, tm = ''; try { tm = localStorage.getItem('jrdGhTime') || ''; } catch (e) {}
    var h = '<div id="ghxBox" style="margin-top:10px;padding-top:8px;border-top:1px dashed #DED5C6">';
    if (nt.text) h += '<div style="padding:8px 10px;border-radius:8px;font-size:12.5px;font-weight:700;line-height:1.5;background:' + (nt.bad ? '#FBE9E5' : '#EAF6EF') + ';color:' + (nt.bad ? '#B24E36' : '#2E7D4F') + ';">' + esc(nt.text) + '</div>';
    h += '<div class="gh-row"><label>' + esc(L('sup_l')) + '<input type="number" id="ghxSupply" min="1" max="30" inputmode="numeric" value="' + (+plan.supply > 0 ? +plan.supply : '') + '"></label></div>';
    h += '<div class="gh-hint">' + esc(L('sup_h')) + '</div><button class="gh-btn o" data-ghx="supply" style="margin-top:2px">' + esc(L('sup_b')) + '</button>';
    h += '<div class="gh-row" style="margin-top:10px"><label>' + esc(L('ics_t')) + '<input type="time" id="ghxTime" value="' + esc(tm || '08:00') + '"></label></div>';
    h += '<button class="gh-btn p" data-ghx="ics" style="width:100%;background:#2e8b57">' + esc(L('ics_b')) + '</button><div class="gh-hint">' + esc(L('ics_h')) + '</div></div>';
    return h;
  }
  function icsEsc(s) { return String(s).replace(/[\;,]/g, ' ').replace(/[\r\n]+/g, ' '); }
  function makeIcs() {
    var plan = G.load(); if (!plan) return;
    var ro = runOut(plan); if (!ro) { alert(L('none')); return; }
    var tm = (document.getElementById('ghxTime') || {}).value || '08:00'; try { localStorage.setItem('jrdGhTime', tm); } catch (e) {}
    var hh = tm.split(':'), H = +hh[0] || 0, M = +hh[1] || 0, today = G.todayStr();
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), cid = String(plan.pen) + '-' + plan.start;
    function ev(date, summary, alarms) {
      var ymd = date.replace(/-/g, ''), st = ymd + 'T' + G.pad(H) + G.pad(M) + '00', e = new Date(G.parse(date)); e.setHours(H, M + 30, 0, 0);
      var en = G.fmt(e).replace(/-/g, '') + 'T' + G.pad(e.getHours()) + G.pad(e.getMinutes()) + '00', a = ['BEGIN:VEVENT', 'UID:jrd-gh-' + cid + '-' + date + '-' + icsEsc(summary).length + '@jarada', 'DTSTAMP:' + stamp, 'DTSTART:' + st, 'DTEND:' + en, 'SUMMARY:' + icsEsc(summary)];
      alarms.forEach(function (tr) { a.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(summary), 'TRIGGER:' + tr, 'END:VALARM'); });
      a.push('END:VEVENT'); return a;
    }
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jarada//GH//KO', 'CALSCALE:GREGORIAN'], n = 0;
    ro.changes.forEach(function (d) { if (d !== ro.date) { lines = lines.concat(ev(d, L('pen'), ['PT0M'])); n++; } });
    if (ro.date >= today) { lines = lines.concat(ev(ro.date, L('out'), ['-P3D', '-P1D', 'PT0M'])); n++; }
    lines.push('END:VCALENDAR');
    if (!n) { alert(L('none')); return; }
    var a2 = document.createElement('a'); a2.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n')); a2.download = 'jarada-gh-' + today + '.ics';
    document.body.appendChild(a2); a2.click(); a2.remove();
  }

  /* ── 서버 저장(환아 앱에서만: API·PID가 있을 때) ── 환자는 본인 행(ghPlan)만 만들고 고칠 수 있어요 */
  function summary(plan) {
    var today = G.todayStr(), b = G.build(Object.assign({}, plan, { visit: (plan.visit && plan.visit >= today) ? plan.visit : today })), planned = 0, skipped = 0, recent = [], d, ro = null;
    for (var i = 0; i < 900; i++) { d = G.addDays(plan.start, i); if (d > today) break; var inf = b.map[d]; if (!inf) continue; if (inf.t === 'inj') planned++; else if (inf.t === 'skip') { skipped++; if (diff(today, d) <= 14) recent.push(d); } }
    try { ro = runOut(plan); } catch (e) {}
    var pen = G.PENS[plan.pen] || {};
    return { v: 1, pen: plan.pen, penName: pen.name || plan.pen, dose: plan.dose, n: (G.TABLES[plan.pen] && G.TABLES[plan.pen][plan.dose]) ? G.TABLES[plan.pen][plan.dose].length : null, start: plan.start, visit: plan.visit || '', run: plan.run || 6, supply: +plan.supply || 0,
      injDays: planned, skipDays: skipped, pct: (planned + skipped) ? Math.round(planned * 100 / (planned + skipped)) : null, recentSkips: recent.sort(),
      runOut: ro ? { date: ro.date, days: ro.days } : null, updatedAt: new Date().toISOString() };
  }
  var timer = null;
  function ctx() { try { var api = (typeof API !== 'undefined') ? API : '', pid = (typeof PID !== 'undefined') ? PID : ''; return (api && pid) ? { api: api, pid: pid } : null; } catch (e) { return null; } }
  function push(plan) {
    var c = ctx(); if (!c) return;
    var payload = plan ? summary(plan) : { v: 1, deleted: true, updatedAt: new Date().toISOString() }, id = 'gp_' + c.pid, today = G.todayStr();
    var post = function (body) { return fetch(c.api, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); }).catch(function () { return null; }); };
    post({ action: 'update', id: id, date: today, question: JSON.stringify(payload) }).then(function (res) {
      if (res && res.status === 'ok' && res.updated) return res;
      return post({ id: id, pid: c.pid, type: 'ghPlan', date: today, question: JSON.stringify(payload) });
    }).then(function (res) { if (res && res.status === 'ok') { try { localStorage.setItem('ghxSync_' + c.pid, String(Date.now())); } catch (e) {} } });
  }
  function onSave(plan) { if (!ctx()) return; clearTimeout(timer); timer = setTimeout(function () { push(plan); }, 1500); }
  window.jrdGhExtra = { html: html, onSave: onSave, runOut: runOut, summary: summary };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ghx]'); if (!b) return;
    var a = b.getAttribute('data-ghx');
    if (a === 'supply') {
      var plan = G.load(); if (!plan) return;
      var v = parseInt((document.getElementById('ghxSupply') || {}).value, 10);
      if (v > 0) plan.supply = Math.min(v, 30); else delete plan.supply;
      G.save(plan); if (G.refresh) G.refresh();
    } else if (a === 'ics') makeIcs();
  });
  // 환아 앱: 열 때 하루 한 번(또는 12시간 이상 지났을 때) 현재 일정을 서버에 올려 의사 앱에서 볼 수 있게
  setTimeout(function () {
    var c = ctx(), plan = G.load(); if (!c || !plan) return;
    var last = 0; try { last = +localStorage.getItem('ghxSync_' + c.pid) || 0; } catch (e) {}
    if (Date.now() - last > 12 * 3600 * 1000) push(plan);
  }, 5000);
})();
