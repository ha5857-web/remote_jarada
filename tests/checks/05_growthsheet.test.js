// 성장기록지 사진 판독: AI 초안 → 원장이 체크한 줄만 기록에 들어감
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
const GS = require('../lib/gs');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const AI_ROWS = [
  { date: '2022-03-15', ageText: '', height: 108.2, weight: 18.1, sure: true, note: '' },
  { date: '2023-03-20', ageText: '', height: 114.9, weight: 20.4, sure: true, note: '' },
  { date: '2024-03-18', ageText: '', height: 112.0, weight: 23.0, sure: false, note: '키 숫자 1과 7이 헷갈림' },
  { date: '2025-03-17', ageText: '', height: 127.3, weight: 26.2, sure: true, note: '' },
  { date: '', ageText: '만 3세', height: 95.0, weight: 14.2, sure: true, note: '' },
  { date: '2031-01-01', ageText: '', height: 130, weight: 28, sure: true, note: '' }
];
const patient = () => ({ id: 'pt1', name: '김가람', sex: 'F', dob: '2016-05-10', chartNo: '7001', accessCode: 'abcdefghij0123456789', updatedAt: '2026-11-01T00:00:00.000Z',
  records: [{ id: 'r1', date: '2025-03-17', height: 127.0, callDone: false }] });

async function boot(caps, reply) {
  const posts = [];
  const o = await open(b, page('index.html'), {
    storage: { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_remote_gh_patients_v1: JSON.stringify([patient()]) },
    api: q => {
      if (q.method === 'GET') return /[?&]file=/.test(q.url) ? { status: 'ok', mime: 'image/png', data: PNG } : [];
      if (q.body.action === 'caps') return caps ? { status: 'ok', caps: { readgrowthsheet: 1 } } : { status: 'error', code: 'AUTH_REQUIRED' };
      if (q.body.action === 'readgrowthsheet') { posts.push(q.body); return reply; }
      return undefined;
    }
  });
  o.p.on('dialog', d => d.accept());
  await o.p.evaluate(async () => { currentPatientId = 'pt1'; await gsReadOpen('gsrow1', 'FILEID123'); });
  return { o, posts };
}

test('초안 표: 헷갈린 줄·미래 날짜·나이만 있는 줄을 표시하고, 체크 전에는 아무것도 넣지 않는다', async () => {
  const { o, posts } = await boot(true, { status: 'ok', kind: '학교 건강검사', memo: '', rows: AI_ROWS });
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].dob, '2016-05-10'); assert.ok(posts[0].image.length > 50);
  assert.ok(!JSON.stringify(posts[0]).includes('김가람') && !JSON.stringify(posts[0]).includes('7001'), '이름·등록번호는 보내지 않음');
  const st = await o.p.evaluate(() => ({ rows: GS.rows.map(r => r.date + '|' + r.height + '|' + r.on), btn: document.getElementById('gsApplyBtn').disabled, txt: document.getElementById('gsBox').innerText, recs: getPatient('pt1').records.length }));
  assert.strictEqual(st.rows.length, 6); assert.ok(st.rows.every(r => r.endsWith('|false')), '처음엔 모두 체크 안 됨');
  assert.strictEqual(st.btn, true); assert.strictEqual(st.recs, 1);
  assert.ok(st.rows.includes('2019-05-10|95|false'), '만 3세 → 생일+3년으로 어림: ' + st.rows.join(' '));
  assert.match(st.txt, /키 숫자 1과 7이 헷갈림/); assert.match(st.txt, /앞 날짜.*보다 키가 작아요/); assert.match(st.txt, /오늘보다 뒤 날짜/); assert.match(st.txt, /기록에 이미 있음: 127cm/); assert.match(st.txt, /나이\(만 3세\)로 어림/);

  // 「주의 표시 없는 줄 모두 체크」 → 깨끗한 2줄만. 미래 날짜 줄은 체크 자체가 안 됨
  await o.p.evaluate(() => gsTickClean());
  let on = await o.p.evaluate(() => GS.rows.filter(r => r.on).map(r => r.date));
  assert.deepStrictEqual(on, ['2022-03-15', '2023-03-20']);
  // 원장이 헷갈린 줄을 사진 보고 고침(112 → 121.0) + 이미 기록 있는 날짜 줄 체크
  await o.p.evaluate(() => { const i = GS.rows.findIndex(r => r.date === '2024-03-18'); gsSet(i, 'height', '121.0'); gsSet(i, 'on', true); gsSet(GS.rows.findIndex(r => r.date === '2025-03-17'), 'on', true); });
  await o.p.click('#gsApplyBtn');
  const after = await o.p.evaluate(() => { const p = getPatient('pt1'); return { recs: p.records.map(r => r.date + ':' + (r.height ?? '') + '/' + (r.weight ?? '')).sort(), left: (p.gsDraft.gsrow1.rows || []).map(r => r.date), applied: p.appliedInboxIds, open: document.getElementById('gsOv').classList.contains('open') }; });
  assert.deepStrictEqual(after.recs, ['2022-03-15:108.2/18.1', '2023-03-20:114.9/20.4', '2024-03-18:121/23', '2025-03-17:127/26.2']);   // 기존 키 127.0 은 그대로, 빈 몸무게만 채움
  assert.deepStrictEqual(after.left.sort(), ['2019-05-10', '2031-01-01']);          // 확인 안 한 줄은 초안으로 남음
  assert.deepStrictEqual(after.applied, ['gsrow1']); assert.strictEqual(after.open, false);
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});

test('AI 키가 없거나 서버가 예전 것이면: 안내만 하고 직접 입력은 된다', async () => {
  for (const [caps, reply] of [[true, { status: 'error', code: 'nokey', message: 'AI 키가 없어요.' }], [false, null]]) {
    const { o, posts } = await boot(caps, reply);
    assert.strictEqual(posts.length, caps ? 1 : 0);                 // 예전 서버에는 요청 자체를 보내지 않음
    const txt = await o.p.evaluate(() => document.getElementById('gsBox').innerText);
    assert.match(txt, /직접 적어 넣을 수 있/);
    await o.p.evaluate(() => { gsAdd(); gsSet(0, 'date', '2024-05-01'); gsSet(0, 'height', '120.5'); gsSet(0, 'on', true); });
    await o.p.click('#gsApplyBtn');
    assert.ok(await o.p.evaluate(() => getPatient('pt1').records.some(r => r.date === '2024-05-01' && r.height === 120.5 && r.fromSheet)));
    assert.deepStrictEqual(o.errors, []);
    await o.ctx.close();
  }
});

const skip = !GS.find() && 'Security.gs 가 없어서 건너뜀';
test('서버: 원장만 · AI 답 검증(범위 밖 값은 확인 표시, 꺾쇠 제거) · 키 없으면 nokey', { skip }, async () => {
  const S = GS.load(), doc = S.login('doc-pw-1').token, staff = S.login('staff-pw-1').token;
  const req = { action: 'readgrowthsheet', image: PNG, mediaType: 'image/png', dob: '2016-05-10' };
  assert.strictEqual(S.post(req).code, 'AUTH_REQUIRED');
  assert.strictEqual(S.post(Object.assign({ auth: staff }, req)).code, 'AUTH_REQUIRED');
  assert.strictEqual(S.post(Object.assign({ auth: doc }, req)).code, 'nokey');
  S.props.SOME_OTHER_NAME = 'sk-ant-test-key';
  let sent = null;
  S.hooks.ai = (url, opt) => { sent = { url, opt }; return { code: 200, body: JSON.stringify({ content: [{ type: 'text', text: '```json\n' + JSON.stringify({ kind: '육아수첩', memo: '', rows: [
    { date: '2023-03-20', height: '114.9cm', weight: 20.4, sure: true, note: '' }, { date: '2024-13-45', height: 1215, weight: null, sure: true, note: '<b>x</b>' }, { date: null, ageText: '초2', height: null, weight: null } ] }) + '\n```' }] }) }; };
  const r = S.post(Object.assign({ auth: doc }, req));
  assert.strictEqual(r.status, 'ok'); assert.strictEqual(r.rows.length, 2);
  assert.deepStrictEqual(r.rows[0], { date: '2023-03-20', ageText: '', height: 114.9, weight: 20.4, sure: true, note: '' });
  assert.strictEqual(r.rows[1].date, ''); assert.strictEqual(r.rows[1].sure, false); assert.ok(!/[<>]/.test(r.rows[1].note)); assert.match(r.rows[1].note, /키 범위 확인/);
  assert.strictEqual(sent.url, 'https://api.anthropic.com/v1/messages'); assert.strictEqual(sent.opt.headers['x-api-key'], 'sk-ant-test-key');
  const payload = JSON.parse(sent.opt.payload); assert.strictEqual(payload.messages[0].content[0].type, 'image'); assert.ok(payload.messages[0].content[1].text.includes('2016-05-10'));
  S.hooks.ai = (u, o2) => JSON.parse(o2.payload).model === 'claude-sonnet-5-5' ? { code: 404, body: '{"error":{"message":"model not found"}}' } : { code: 200, body: JSON.stringify({ content: [{ type: 'text', text: '{"rows":[],"memo":"기록 없음"}' }] }) };
  const r2 = S.post(Object.assign({ auth: doc }, req)); assert.strictEqual(r2.status, 'ok'); assert.notStrictEqual(r2.model, 'claude-sonnet-5-5');   // 없는 모델이면 다음 모델로
  assert.strictEqual(S.post(Object.assign({ auth: doc }, req, { mediaType: 'application/pdf' })).code, 'BAD');
  const T = GS.load();
  assert.strictEqual(T.post({ pid: 'abcdefghij0123456789', type: 'question', question: 'x', date: "');alert(1)//" }).code, 'AUTH_REQUIRED');   // 날짜 칸 주입 거절
});
