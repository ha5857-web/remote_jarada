// 보호자 공유용 성장 카드: 기간별 자란 키, 기록 부족하면 안내, 이미지 만들기
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const PID = 'abcdefghij0123456789';
const m = (id, date, h) => ({ id, pid: PID, type: 'measurement', date, height: h, timestamp: date + 'T01:00:00Z' });

test('성장 카드: 6개월·1년 자란 만큼, 기록이 적으면 안내만', async () => {
  const rows = [m('a', '2026-09-01', '130.0')];
  const o = await open(b, page('자라다케어_환아용.html?pid=' + PID + '&api=' + encodeURIComponent(API) + '&dob=2016-05-10&sex=F'), {
    phone: true, storage: { jrd_lang: 'ko', ['jrd_consent_' + PID]: '2026-11-01' }, api: q => (q.method === 'GET' ? rows : undefined)
  });
  const card = () => o.p.evaluate(() => document.getElementById('gcCard').innerText);
  await o.p.evaluate(() => { todayStr = () => '2026-11-13'; return loadPastMeasurements(); }); await o.p.waitForTimeout(300);
  assert.match(await card(), /두 달 넘는 간격으로 2번 이상/);
  rows.push(m('b', '2026-10-05', '130.6'));                       // 34일 — 아직 부족
  await o.p.evaluate(() => loadPastMeasurements()); await o.p.waitForTimeout(300);
  assert.match(await card(), /두 달 넘는 간격/);
  rows.unshift(m('z', '2025-11-02', '125.1'), m('y', '2026-04-20', '127.9'));
  rows.push(m('c', '2026-11-10', '131.5'));
  await o.p.evaluate(() => loadPastMeasurements()); await o.p.waitForTimeout(300);
  assert.match(await card(), /최근 6개월 카드/); assert.match(await card(), /최근 1년 카드/);
  const w = await o.p.evaluate(() => [gcWindow(6), gcWindow(12)].map(x => ({ from: x.first.date, gain: x.gain, m: x.m, n: x.pts.length })));
  assert.deepStrictEqual(w, [{ from: '2026-04-20', gain: 3.6, m: 7, n: 4 }, { from: '2025-11-02', gain: 6.4, m: 12, n: 5 }]);
  await o.p.evaluate(() => gcMake(6)); await o.p.waitForTimeout(400);
  const img = await o.p.evaluate(() => { const i = document.getElementById('gcImg'); return { src: i.src.slice(0, 22), w: i.naturalWidth, h: i.naturalHeight, data: i.src }; });
  assert.strictEqual(img.src, 'data:image/png;base64,'); assert.deepStrictEqual([img.w, img.h], [1080, 1350]);
  if (process.env.GC_OUT) fs.writeFileSync(process.env.GC_OUT, Buffer.from(img.data.split(',')[1], 'base64'));
  await o.p.evaluate(() => { localStorage.setItem('jrd_lang', 'ar'); document.getElementById('gcOv').remove(); gcMake(12); }); await o.p.waitForTimeout(300);
  if (process.env.GC_OUT) fs.writeFileSync(process.env.GC_OUT.replace('.png', '_ar.png'), Buffer.from((await o.p.evaluate(() => document.getElementById('gcImg').src)).split(',')[1], 'base64'));
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});
