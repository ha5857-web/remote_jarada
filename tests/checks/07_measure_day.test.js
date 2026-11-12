// 측정의 날(매달 정한 날 안내·캘린더 알림) + 연속 기록 개월 수
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const PID = 'abcdefghij0123456789';
const m = (id, date, h) => ({ id, pid: PID, type: 'measurement', date, height: h, timestamp: date + 'T01:00:00Z' });

test('측정의 날: 지난 날이면 맨 위 안내, 입력하면 연속 개월 +1, 날짜 바꾸기·캘린더 파일', async () => {
  const rows = [m('a', '2026-08-03', '128.0'), m('b', '2026-09-06', '128.6'), m('c', '2026-10-04', '129.1')];
  const o = await open(b, page('자라다케어_환아용.html?pid=' + PID + '&api=' + encodeURIComponent(API) + '&dob=2016-05-10&sex=F'), {
    phone: true, storage: { jrd_lang: 'ko', ['jrd_consent_' + PID]: '2026-11-01' }, api: q => (q.method === 'GET' ? rows : undefined)
  });
  const view = () => o.p.evaluate(() => ({ card: document.getElementById('mdayCard').innerText, ban: document.getElementById('mdayBanner').style.display === 'none' ? '' : document.getElementById('mdayBanner').innerText }));
  await o.p.evaluate(() => { todayStr = () => '2026-11-12'; return loadPastMeasurements(); }); await o.p.waitForTimeout(300);
  let v = await view();
  assert.match(v.card, /🌱 3개월 연속 기록 중/); assert.match(v.card, /이번 달에 기록하면 4개월 연속/);
  assert.match(v.card, /측정의 날\(2026\.11\.07\)이 지났어요/);
  assert.match(v.ban, /이번 달 측정을 아직 안 했어요/);
  assert.deepStrictEqual(await o.p.evaluate(() => [...document.querySelectorAll('.mday-dot')].map(d => d.innerText + (d.classList.contains('on') ? '●' : '○'))), ['6○', '7○', '8●', '9●', '10●', '11○']);

  rows.push(m('d', '2026-11-12', '129.5'));
  await o.p.evaluate(() => loadPastMeasurements()); await o.p.waitForTimeout(300);
  v = await view();
  assert.match(v.card, /4개월 연속/); assert.match(v.card, /이번 달 기록 완료 ✓ · 다음 측정의 날: 2026\.12\.05 \(D-23\)/); assert.strictEqual(v.ban, '');

  rows.pop();
  await o.p.evaluate(() => { mdaySet('d15'); return loadPastMeasurements(); }); await o.p.waitForTimeout(300);
  v = await view();
  assert.match(v.card, /다음 측정의 날: 2026\.11\.15 \(D-3\)/); assert.strictEqual(v.ban, '');
  const ics = await o.p.evaluate(() => mdayIcsText());
  assert.match(ics, /DTSTART:20261115T080000/); assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=15;COUNT=24/); assert.match(ics, /TRIGGER:PT0M/);
  assert.ok(!ics.includes(PID) && !ics.includes('script.google'), '캘린더에 접속 코드·주소를 넣지 않음');
  await o.p.evaluate(() => { localStorage.setItem('jrd_lang', 'en'); mdaySet('sat1'); });
  v = await view();
  assert.match(v.card, /3 months in a row/); assert.match(v.ban, /measurement isn't done yet/);
  await o.p.evaluate(() => { localStorage.setItem('jrd_lang', 'ko'); todayStr = () => '2026-11-07'; mdayRender(); });
  v = await view();
  assert.match(v.card, /오늘이 측정의 날이에요/); assert.match(v.ban, /오늘은 측정의 날이에요/);
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});
