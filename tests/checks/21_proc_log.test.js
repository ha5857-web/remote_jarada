// 날짜별 처리 기록
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' };
test('처리 기록이 남고 보인다', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  const r = await o.p.evaluate(() => { plog('엑셀 업로드', '신규 1명 · 안내 초안 대상 0명', ['초진:가나다']); document.getElementById('procLog').open = true; plogRender(); return document.getElementById('procLogBody').textContent; });
  assert.ok(/엑셀 업로드/.test(r) && /가나다/.test(r) && /안내 초안 대상 0명/.test(r));
});
