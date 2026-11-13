// 방학 귀국 진료 신청: 해외 보호자 앱에서 신청 → 원장 앱에 도착일 순으로 모임 → 답하면 보호자 카드에 보임
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const PID = 'abcdefghij0123456789';
const url = loc => page('자라다케어_환아용.html?pid=' + PID + '&api=' + encodeURIComponent(API) + '&dob=2016-05-10&sex=F&loc=' + loc);

test('보호자: 방학 철에만 카드, 신청 글은 한국어로 서버에, 답하면 카드에', async () => {
  const rows = [], posts = [];
  const o = await open(b, url('overseas'), {
    phone: true, storage: { jrd_lang: 'en', ['jrd_consent_' + PID]: '2026-11-01' },
    api: q => { if (q.method === 'GET') return rows; if (q.body && q.body.type === 'question') { posts.push(q.body); rows.push(Object.assign({ timestamp: '2026-11-13T01:00:00Z' }, q.body)); return { status: 'ok' }; } return undefined; }
  });
  const card = () => o.p.evaluate(() => { const c = document.getElementById('vrCard'); return c.style.display === 'none' ? '' : c.innerText; });
  await o.p.evaluate(() => { todayStr = () => '2026-11-13'; return loadPastMeasurements(); }); await o.p.waitForTimeout(300);
  assert.match(await card(), /Visiting Korea during the school break/);
  await o.p.evaluate(() => vrOpen());
  await o.p.evaluate(() => { vrSubmit(); }); await o.p.waitForTimeout(200);
  assert.match(await o.p.evaluate(() => document.getElementById('vr_msg').textContent), /check the arrival/);
  await o.p.evaluate(() => {
    document.getElementById('vr_from').value = '2026-12-20'; document.getElementById('vr_to').value = '2027-01-10';
    document.querySelector('input[name=vr_t][value=am]').checked = true; document.querySelector('input[name=vr_t][value=sat]').checked = true;
    document.querySelector('input[name=vr_w][value=blood]').checked = true; document.getElementById('vr_memo').value = '  first week   is best ';
  });
  await o.p.evaluate(() => vrSubmit()); await o.p.waitForTimeout(400);
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].question, '✈️ 귀국 진료 신청\n한국 체류: 2026-12-20 ~ 2027-01-10\n편한 시간: 평일 오전, 토요일\n원하는 것: 혈액검사\n메모: first week is best\n(보호자 언어: en)');
  let c = await card();
  assert.match(c, /Visit requested \(2026\.12\.20 ~ 2027\.01\.10\)/); assert.match(c, /We'll choose a date/);
  rows.push({ id: 'ans', pid: PID, type: 'answer', refId: posts[0].id, answer: '12월 22일(화) 오전 10시로 잡았습니다.' });
  await o.p.evaluate(() => loadPastMeasurements()); await o.p.waitForTimeout(300);
  c = await card(); assert.match(c, /Reply from the clinic/); assert.match(c, /12월 22일/);
  await o.p.evaluate(() => loadQA()); await o.p.waitForTimeout(300);
  assert.match(await o.p.evaluate(() => document.getElementById('qaList').innerText), /Q\. ✈️ Visit request · 2026\.12\.20 ~ 2027\.01\.10/);
  // 출국일이 지나고 방학 철도 아니면 카드 없음
  await o.p.evaluate(() => { todayStr = () => '2027-03-10'; vrRender(); });
  assert.strictEqual(await card(), '');
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
  const o2 = await open(b, url('domestic'), { phone: true, storage: { jrd_lang: 'ko', ['jrd_consent_' + PID]: '2026-11-01' }, api: q => (q.method === 'GET' ? [] : undefined) });
  await o2.p.evaluate(() => { todayStr = () => '2026-11-13'; return loadPastMeasurements(); }); await o2.p.waitForTimeout(300);
  assert.strictEqual(await o2.p.evaluate(() => document.getElementById('vrCard').style.display), 'none');
  await o2.ctx.close();
});

test('원장: 도착일 순, 아이마다 최근 신청 하나, 답변 여부', async () => {
  const code = c => c.repeat(20);
  const pts = [['A', '가', 'a'], ['B', '나', 'b'], ['C', '다', 'c']].map(([id, name, c]) => ({ id, name, dob: '2016-05-10', sex: 'F', location: 'overseas', accessCode: code(c), updatedAt: '2026-11-01T00:00:00.000Z', records: [] }));
  const q = (id, c, from, to, ts, extra) => ({ id, pid: code(c), type: 'question', timestamp: ts, question: `✈️ 귀국 진료 신청\n한국 체류: ${from} ~ ${to}\n편한 시간: 토요일\n원하는 것: 진료 상담${extra || ''}` });
  const rows = [
    q('a1', 'a', '2027-01-05', '2027-01-20', '2026-11-01T00:00:00Z'), q('a2', 'a', '2027-01-08', '2027-01-25', '2026-11-05T00:00:00Z', '\n메모: 날짜 바뀜'),
    q('b1', 'b', '2026-11-10', '2026-11-30', '2026-11-02T00:00:00Z'),
    q('c1', 'c', '2026-10-01', '2026-10-20', '2026-09-20T00:00:00Z'),
    { id: 'x', pid: code('b'), type: 'answer', refId: 'b1', answer: '11/14(토) 10시 예약' }
  ];
  const o = await open(b, page('index.html'), {
    storage: { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_remote_gh_patients_v1: JSON.stringify(pts) },
    api: r => (r.method === 'GET' ? rows : undefined)
  });
  await o.p.evaluate(() => { todayStr = () => '2026-11-13'; return renderPendingMeasurements(); }); await o.p.waitForTimeout(300);
  const t = await o.p.evaluate(() => document.getElementById('vreqList').innerText);
  assert.deepStrictEqual(await o.p.evaluate(() => [...document.querySelectorAll('#vreqList .name')].map(e => e.textContent)), ['나', '가']);
  assert.match(t, /2026\.11\.10 ~ 2026\.11\.30 · 지금 한국에 있음 · 출국 D-17/); assert.match(t, /✓ 답변함 · 11\/14\(토\) 10시 예약/);
  assert.match(t, /2027\.01\.08 ~ 2027\.01\.25 · 도착 D-56/); assert.match(t, /메모: 날짜 바뀜/); assert.match(t, /답변 대기/);
  assert.strictEqual(await o.p.evaluate(() => document.getElementById('vreqCount').textContent), '1');
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});
