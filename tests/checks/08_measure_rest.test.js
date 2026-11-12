// 원장 앱: 45일 넘게 키 기록이 없는 해외 아이 목록 → 보호자 언어로 측정 안내 보내기
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const code = c => c.repeat(20);
const pt = (id, name, o) => Object.assign({ id, name, sex: 'F', dob: '2016-05-10', location: 'overseas', updatedAt: '2026-11-01T00:00:00.000Z', records: [] }, o);

test('측정 쉬는 아이: 45일 넘은 해외 아이만, 안내 보내면 기록이 남고 아래로 내려감', async () => {
  const pts = [
    pt('A', '가쉼', { accessCode: code('a'), lang: 'ko' }),
    pt('B', '나최근', { accessCode: code('b') }),
    pt('C', '다링크없음', {}),
    pt('D', '라국내', { accessCode: code('d'), location: 'domestic' }),
    pt('E', '마차트만', { accessCode: code('e'), lang: 'en', records: [{ id: 'r', date: '2026-09-20', height: 140 }] }),
    pt('F', '바종료', { accessCode: code('f'), careCategory: 'ended' })
  ];
  const rows = [
    { id: 'm1', pid: code('a'), type: 'measurement', date: '2026-09-01', height: '130' },
    { id: 'm2', pid: code('b'), type: 'measurement', date: '2026-11-02', height: '131' }
  ];
  const posts = [];
  const o = await open(b, page('index.html'), {
    storage: { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_site_url: 'https://jrd.example/', jrd_remote_gh_patients_v1: JSON.stringify(pts) },
    api: q => { if (q.method === 'GET') return rows; posts.push(q.body); return undefined; }
  });
  o.p.on('dialog', d => d.accept());
  await o.p.evaluate(() => { todayStr = () => '2026-11-12'; return renderPendingMeasurements(); }); await o.p.waitForTimeout(300);
  const names = () => o.p.evaluate(() => [...document.querySelectorAll('#mrestList .patient-card .name')].map(e => e.textContent));
  assert.deepStrictEqual(await names(), ['가쉼', '마차트만']);          // 72일 → 53일 순
  let txt = await o.p.evaluate(() => document.getElementById('mrestList').innerText);
  assert.match(txt, /마지막 키 기록 72일 전 \(2026\.09\.01\)/); assert.match(txt, /53일 전 \(2026\.09\.20\) · 집에서 입력한 기록 없음/);
  assert.strictEqual(await o.p.evaluate(() => document.getElementById('mrestCount').textContent), '2');

  await o.p.evaluate(() => mrestSend('A'));
  const ps = await o.p.evaluate(() => ({ msg: pendingSend.msg, alim: document.getElementById('sendChoiceAlimBtn').style.display, open: document.getElementById('sendChoiceOv').classList.contains('open') }));
  assert.ok(ps.open); assert.strictEqual(ps.alim, 'none');
  assert.match(ps.msg, /가쉼 보호자님, 이번 달 키·몸무게를 잴 때가 되었어요/); assert.match(ps.msg, /https:\/\/jrd\.example\/자라다케어_환아용\.html\?pid=a{20}/);
  await o.p.evaluate(() => sendViaCopy()); await o.p.waitForTimeout(300);
  const a = await o.p.evaluate(() => { const p = getPatient('A'); return { at: !!p.mremindAt, via: p.mremindVia }; });
  assert.ok(a.at); assert.match(a.via, /복사/);
  assert.ok(!posts.some(x => x && x.type === 'linkSent'), '측정 안내는 링크 발송 기록으로 남기지 않음');
  assert.strictEqual(await o.p.evaluate(() => document.getElementById('sendChoiceAlimBtn').style.display), '');
  assert.deepStrictEqual(await names(), ['마차트만', '가쉼']);           // 보낸 아이는 아래로
  txt = await o.p.evaluate(() => document.getElementById('mrestList').innerText);
  assert.match(txt, /🔔 안내 보냄 오늘 · 복사/); assert.strictEqual(await o.p.evaluate(() => document.getElementById('mrestCount').textContent), '1');

  await o.p.evaluate(() => { mrestSend('E'); });
  assert.match(await o.p.evaluate(() => pendingSend.msg), /^\[Jarada Care\] Dear guardian of 마차트만, it's time/);
  await o.p.evaluate(() => closeSendChoiceModal());
  assert.ok(!(await o.p.evaluate(() => getPatient('E').mremindAt)), '창만 닫으면 기록 안 남음');
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});
