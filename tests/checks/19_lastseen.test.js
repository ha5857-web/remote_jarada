// 환아 목록: 마지막 진료로부터 3개월(주황)·6개월(빨강) 지나면 눈에 띄게
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' };
test('3·6개월 경과 표시', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  const r = await o.p.evaluate(() => {
    const ago = m => { const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(Math.min(d.getDate(), 28)); return d.toISOString().slice(0, 10); };
    const mk = (id, m) => ({ id, name: 'L' + id, sex: 'F', dob: '2016-01-01', location: 'domestic', records: [{ id: 'r' + id, date: ago(m) }] });
    return ['2', '3', '5', '6', '9'].map(m => { const x = lastSeenBadge(mk('a' + m, +m)); return m + ':' + (/6개월|🔴/.test(x.html) ? 'red' : x.html ? 'amber' : 'none'); }).join(',');
  });
  assert.strictEqual(r, '2:none,3:amber,5:amber,6:red,9:red');
});
