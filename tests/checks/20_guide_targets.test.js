// 오늘 혈액·엑스레이 검사를 한 재진 아이도 「진료 후 안내」 일괄 발송 대상
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' };
test('검사한 재진은 안내 대상', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  const r = await o.p.evaluate(() => {
    const t = todayStr();
    const a = { id: 'g1', name: 'G1', chartNo: '9001', sex: 'F', dob: '2016-01-01', records: [], rvQ: { date: t, st: 'wait', blood: 1, xray: 0 } };
    const c = { id: 'g2', name: 'G2', chartNo: '9002', sex: 'F', dob: '2016-01-01', records: [] };
    return [fvGuideReason(a), fvGuideReason(c)];
  });
  assert.strictEqual(r[0], '검사 리포트');
  assert.strictEqual(r[1], '');
});
test('같은 날 차트가 바뀌면 chartChangedAt 기록', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  const r = await o.p.evaluate(() => {
    const t = todayStr(), p = { id: 'g9', name: 'G9', records: [] }, long1 = '가'.repeat(40), long2 = '나'.repeat(40);
    fvGuideCollect(p, { chartNoteRaw: long1 }, true, '', t, []);
    const a = p.chartChangedAt || 0;
    fvGuideCollect(p, { chartNoteRaw: long2 }, true, '', t, []);
    return [a, !!p.chartChangedAt];
  });
  assert.strictEqual(r[0], 0);
  assert.strictEqual(r[1], true);
});
