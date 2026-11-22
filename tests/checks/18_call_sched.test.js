// 해외 환아 화상통화 칸: 환자가 요청하지 않아도 「다음 화상통화 예정일」이 가까우면 시간 미정으로 보임
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' };
test('예정일만 있는 해외 환아도 통화 칸에 보임', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  const txt = await o.p.evaluate(async () => {
    const d = new Date(Date.now() + 9 * 36e5 + 10 * 864e5).toISOString().slice(0, 10);
    patients.push({ id: 'sc1', name: '린메이', location: 'overseas', accessCode: 'scpid0123456789abcde', interval: 3, records: [{ id: 'r', date: '2026-08-01', callDone: true, nextCall: d }] },
      { id: 'sc2', name: '국내아이', location: 'domestic', records: [{ id: 'r2', date: '2026-08-01', nextCall: d }] });
    vcFetchRows = async () => []; vcSync = async () => false;
    await vcDash(); return document.getElementById('vcDashList').innerText + '|' + document.getElementById('vcDashCount').innerText;
  });
  assert.match(txt, /린메이[\s\S]*D-10/); assert.doesNotMatch(txt, /국내아이/); assert.match(txt, /\|1$/);
});
