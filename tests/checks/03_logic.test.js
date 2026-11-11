// 화면 뒤의 계산·판독 규칙 (진료에 직접 영향 주는 것들)
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page } = require('../lib/h');
let b, ix, vn, fl;
test.before(async () => {
  b = await chromium.launch();
  ix = await open(b, page('index.html')); vn = await open(b, page('visit-notice.html')); fl = await open(b, page('flow.html'));
});
test.after(async () => { await b.close(); });

const INTAKE = ['2026. 11. 10 오전 9:12:00', '김하늘', '2016-03-02', '여', '010-1234-5678', '138.5', '34.2', '가슴 멍울이 잡혀요. 키가 작아서 걱정', '엄마 158 아빠 172', '밤 11시 취침'].join('\t');

test('공용 파일(shared/fv-common.js)이 의사 앱·원무과 앱에 똑같이 들어 있다', async () => {
  const f = async o => o.p.evaluate(raw => {
    const miss = typeof parseFirstIntake === 'function' && typeof JRDV === 'object' && JRDV ? [] : ['parseFirstIntake/JRDV'];
    const jr = typeof JRDV === 'object' && JRDV ? Object.keys(JRDV).sort() : [];
    let pf = null, err = ''; try { pf = parseFirstIntake(raw); } catch (e) { err = String(e); }
    return { miss, jr, pf, err, prep: typeof FV_DEFAULT_PREP !== 'undefined' ? JSON.stringify(FV_DEFAULT_PREP) : null };
  }, INTAKE);
  const a = await f(ix), c = await f(vn);
  assert.deepStrictEqual(a.miss, []); assert.deepStrictEqual(c.miss, []);
  assert.strictEqual(a.err, ''); assert.ok(a.pf && typeof a.pf === 'object'); assert.ok(a.jr.length > 3);
  assert.deepStrictEqual(a, c);
});

test('공용 파일(shared/chart-common.js)이 의사 앱·현황판에서 같은 결과를 낸다', async () => {
  const note = 'S) 최근 6개월 5.7cm 자람\n측정일\t키\t몸무게\n2026-05-01\t140.3\t35.0\n2026-11-10\t146.0\t38.1\nA) 뼈나이 11개월 앞섬\nP) 6개월 후 재방문';
  const f = o => o.p.evaluate(n => ({ s: splitChartForAI(n), sleep: fvLifestyleDraft('sleep', {}), t: typeof fvLifestyleDraft }), note);
  const a = await f(ix), c = await f(fl);
  assert.strictEqual(a.t, 'function');
  assert.ok(a.s && typeof a.s.chart === 'string' && a.s.chart.includes('뼈나이'));
  assert.deepStrictEqual(a, c);
});

test('예약 명단: 취소·삭제 예약은 올리지 않는다 (의사 앱·원무과 앱 동일)', async () => {
  const f = o => o.p.evaluate(() => {
    const td = todayStr();
    const grid = [['예약일자', '예약시간', '수진자명', '챠트번호', '예약상태'],
      [td, '09:30', '김하늘', '001234', '예약'], [td, '10:00', '이바다', '2222', '취소'], [td, '10:30', '박구름', '3333', '삭제'],
      [td, '11:00', '김하늘', '001234', '예약'], ['2020-01-01', '09:00', '옛날이', '4444', '예약'], [td, '14:00', '이바다', '2222', '예약']];
    const r = trParse(grid); return { names: r.list.map(x => x[2] + '@' + x[3]), past: r.past, canceled: r.canceled };
  });
  const a = await f(ix), c = await f(vn);
  assert.deepStrictEqual(a, { names: ['김하늘@09:30', '이바다@14:00'], past: 1, canceled: 2 });
  assert.deepStrictEqual(c, a);
});

test('초진 탭: 기준일에서 7일이 지나면 자동으로 빠진다', async () => {
  const r = await ix.p.evaluate(() => {
    const d = n => { const t = new Date(Date.now() - n * 86400000); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
    const mk = n => ({ firstVisit: { status: 'sent', visitDate: d(n) } });
    return [isFirstPatient(mk(0)), isFirstPatient(mk(6)), isFirstPatient(mk(9)), isFirstPatient(mk(-5))];
  });
  assert.deepStrictEqual(r, [true, true, false, true]);
});

test('치료 이력: 시작일·종료일·용량 변화를 차트에서 읽는다', async () => {
  const h = await ix.p.evaluate(() => txHistory({ name: '가', chartNo: '1', notes: '', records: [
    { date: '2024-11-20', chartNoteRaw: 'GnRHa(2024-11-20~) 디페렐린 3.75mg', suppDose: '3.75mg' },
    { date: '2025-03-04', chartNoteRaw: 'GH(2025-03-04~) 그로트로핀 1.2 IU', ghDose: 1.2, suppDose: '3.75mg' },
    { date: '2025-06-01', chartNoteRaw: '', ghDose: 1.2, suppDose: '11.25mg' },
    { date: '2025-09-10', chartNoteRaw: '', ghDose: 1.5 },
    { date: '2026-01-15', chartNoteRaw: 'GnRHa 종료 2026-01-15', ghDose: 1.5 },
    { date: '2026-03-15', chartNoteRaw: '', ghDose: '1.8' }] }));
  const gh = h.p.find(x => x.k === 'GH'), gn = h.p.find(x => x.k === 'GnRH');
  assert.strictEqual(gh.s, '2025-03-04'); assert.ok(!gh.e);
  assert.strictEqual(gn.s, '2024-11-20'); assert.strictEqual(gn.e, '2026-01-15');
  const ghUp = h.d.filter(x => x.k === 'GH').map(x => x.d + ':' + x.a + '>' + x.b);
  assert.deepStrictEqual(ghUp, ['2025-09-10:1.2>1.5', '2026-03-15:1.5>1.8']);
  assert.ok(h.d.some(x => x.k === 'GnRH' && x.d === '2025-06-01'));
});

test('혈액검사 문자: 인사말·영상·챗봇 줄을 빼고 결과와 계획만 남긴다', async () => {
  const core = await ix.p.evaluate(() => labCore('[삼성자라다소아청소년과] 김가람(만 10세 남) 혈액검사 결과 안내드립니다.\n\n🩸 검사 결과\n· 비타민D(25-OH Vit D 21.4) → 부족\n· 혈색소(Hb 12.9) → 빈혈 없음\n\n📌 관리 계획\n비타민D를 꾸준히 복용해 주세요.\n\n📺 도움이 되는 영상\n▶ 비타민D 부족: https://youtube.com/shorts/x\n\n💬 궁금한 점은 자라다 챗봇에 물어보세요: https://x.y'));
  assert.ok(core.includes('비타민D(25-OH Vit D 21.4) → 부족')); assert.ok(core.includes('관리 계획'));
  assert.ok(!/https?:|챗봇|안내드립니다/.test(core), core);
});

test('카드 QR: 귀가했거나 전날 방문이면 카드를 풀어 준다', async () => {
  const r = await fl.p.evaluate(() => {
    const td = ymdOf(Date.now()), yd = ymdOf(Date.now() - 86400000);
    return [cardStale({ card: 'C003', step: 3, date: td }), cardStale({ card: 'C003', step: 9, date: td }), cardStale({ card: 'C003', step: 3, date: yd }), cardStale({ card: '', step: 9, date: yd })];
  });
  assert.deepStrictEqual(r, [false, true, true, false]);
});

test('세 화면 모두 시험 도중 오류가 없었다', () => {
  assert.deepStrictEqual(ix.errors, []); assert.deepStrictEqual(vn.errors, []); assert.deepStrictEqual(fl.errors, []);
});
