// 의사 앱 동기화 「바뀐 아이만 받기」 — 실제 서버 코드(Security.gs)와 실제 의사 앱을 맞물려 확인
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
const GS = require('../lib/gs');
const skip = !GS.find() && 'Security.gs 가 없어서 건너뜀 (SECURITY_GS=경로 로 알려 주면 실행)';
const KEY = 'sync-key-000000000001';
const P = (id, name, u, extra) => Object.assign({ id, name, chartNo: String(1000 + Number(id.slice(1))), updatedAt: u, records: [{ date: '2026-11-01', chartNoteRaw: name + ' 차트 ' + 'x'.repeat(3000) }] }, extra || {});
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });

async function device(S, token, local, opt) {
  const log = [];
  const o = await open(b, page('index.html'), {
    storage: { jrd_api_url: API, jrd_auth_token: token, jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_sync_key: KEY, jrd_remote_gh_patients_v1: JSON.stringify(local) },
    wait: 4500,
    api: q => {
      if (q.method === 'GET') { const u = new URL(q.url); if (u.searchParams.get('only') !== 'doctordata') return []; log.push('GET'); return opt && opt.oldServer ? S.store.chunks.filter(r => r.pid === KEY) : S.get(Object.fromEntries(u.searchParams)); }
      if (!/^(caps|docpull|docone|savedoctordata)$/.test(q.body.action || '')) return undefined;
      log.push(q.body.action + (q.body.action === 'docpull' ? (q.body.have != null ? ':have' : ':stamp') : ''));
      if (opt && opt.oldServer && (q.body.action === 'caps' || q.body.action === 'docpull')) return { status: 'error', code: 'AUTH_REQUIRED' };
      const r = S.post(q.body); log.push('  ↳' + (r.same ? 'same' : Array.isArray(r.patients) ? 'n=' + r.patients.length : r.status));
      return r;
    }
  });
  const pull = () => o.p.evaluate(async () => { lastQuietPullAt = 0; await pullFromCloudQuiet(true); return patients.map(p => p.id + '@' + p.updatedAt).sort(); });
  return { o, log, pull, clear: () => { log.length = 0; } };
}

test('바뀐 아이만 받고, 그대로면 "그대로"만 확인한다', { skip }, async () => {
  const S = GS.load(), tok = S.login('doc-pw-1').token; assert.ok(tok);
  const many = []; for (let i = 1; i <= 60; i++) many.push(P('p' + i, '아이' + i, '2026-11-01T00:00:00.000Z'));
  S.setCloud(KEY, many.concat([P('p61', '새아이', '2026-11-10T00:00:00.000Z')]));
  const d = await device(S, tok, many);                       // 이 기기에는 60명, 클라우드에는 61명
  assert.ok(d.log.includes('caps')); assert.ok(!d.log.includes('GET'), '전체 받기를 하지 않아야 함: ' + d.log.join(','));
  assert.ok(d.log.includes('  ↳n=1'), '처음엔 없는 아이 1명만: ' + d.log.join(','));
  let ids = await d.pull(); assert.strictEqual(ids.length, 61);
  d.clear(); ids = await d.pull();
  assert.deepStrictEqual(d.log, ['docpull:stamp', '  ↳same']);   // 두 번째부터는 몇 글자짜리 확인만

  // 다른 기기가 p7 을 고쳐 저장 → 그 아이만 내려온다
  const cl = S.cloud(KEY); cl.find(p => p.id === 'p7').updatedAt = '2026-11-11T05:00:00.000Z'; cl.find(p => p.id === 'p7').name = '고친이름'; S.setCloud(KEY, cl);
  d.clear(); ids = await d.pull();
  assert.deepStrictEqual(d.log, ['docpull:stamp', '  ↳ok', 'docpull:have', '  ↳n=1']);
  assert.strictEqual(await d.o.p.evaluate(() => patients.find(p => p.id === 'p7').name), '고친이름');

  // 이 기기에서 고치고 저장 → 클라우드에 전체가 온전히 올라가고, 그 뒤엔 다시 "그대로"
  await d.o.p.evaluate(async () => { const p = patients.find(x => x.id === 'p3'); p.name = '여기서고침'; p.updatedAt = new Date().toISOString(); await syncPatientsNow(); });
  const after = S.cloud(KEY).filter(p => !p._deleted);
  assert.strictEqual(after.length, 61); assert.strictEqual(after.find(p => p.id === 'p3').name, '여기서고침'); assert.strictEqual(after.find(p => p.id === 'p7').name, '고친이름');
  d.clear(); await d.pull(); await d.pull();
  assert.deepStrictEqual(d.log.slice(-2), ['docpull:stamp', '  ↳same']);
  assert.deepStrictEqual(d.o.errors, []);
  await d.o.ctx.close();
});

test('이 기기 목록이 옛것으로 바뀌면(백업 복원 등) 지름길을 쓰지 않고 다시 받아 온다', { skip }, async () => {
  const S = GS.load(), tok = S.login('doc-pw-1').token;
  const base = [P('p1', '가', '2026-11-05T00:00:00.000Z'), P('p2', '나', '2026-11-05T00:00:00.000Z'), P('p3', '다', '2026-11-05T00:00:00.000Z')];
  S.setCloud(KEY, base);
  const d = await device(S, tok, base); await d.pull(); d.clear(); await d.pull();
  assert.deepStrictEqual(d.log, ['docpull:stamp', '  ↳same']);
  await d.o.p.evaluate(() => { patients = patients.filter(p => p.id !== 'p3'); patients.find(p => p.id === 'p2').updatedAt = '2026-10-01T00:00:00.000Z'; });   // 옛 백업으로 되돌린 상황
  d.clear(); const ids = await d.pull();
  assert.strictEqual(d.log[0], 'docpull:have');
  assert.deepStrictEqual(ids, ['p1@2026-11-05T00:00:00.000Z', 'p2@2026-11-05T00:00:00.000Z', 'p3@2026-11-05T00:00:00.000Z']);
  await d.o.ctx.close();
});

test('다른 기기에서 지운 아이는 이 기기에서도 사라진다', { skip }, async () => {
  const S = GS.load(), tok = S.login('doc-pw-1').token;
  const base = [P('p1', '가', '2026-11-05T00:00:00.000Z'), P('p2', '나', '2026-11-05T00:00:00.000Z')];
  S.setCloud(KEY, [base[0], { id: 'p2', _deleted: true, deletedAt: Date.now(), updatedAt: '' }]);
  const d = await device(S, tok, base);
  assert.deepStrictEqual(await d.pull(), ['p1@2026-11-05T00:00:00.000Z']);
  await d.o.ctx.close();
});

test('예전 서버(새 기능 없음)에서는 예전 방식 그대로 동작한다', { skip }, async () => {
  const S = GS.load(), tok = S.login('doc-pw-1').token;
  const base = [P('p1', '가', '2026-11-05T00:00:00.000Z')];
  S.setCloud(KEY, base.concat([P('p2', '나', '2026-11-06T00:00:00.000Z')]));
  const d = await device(S, tok, base, { oldServer: true });
  assert.strictEqual((await d.pull()).length, 2);
  assert.ok(d.log.includes('GET')); assert.ok(!d.log.some(x => x.startsWith('docpull')));
  await d.o.ctx.close();
});

test('서버 규칙: 원장만, 조각이 섞이면 FALLBACK, flow EMR 칸은 그 아이 한 명만', { skip }, async () => {
  const S = GS.load(), doc = S.login('doc-pw-1').token, staff = S.login('staff-pw-1').token;
  S.setCloud(KEY, [P('p1', '가', 'u1'), P('p2', '나', 'u2'), P('p3', '나', 'u3'), { id: 'p9', _deleted: true, deletedAt: 1, updatedAt: '' }]);
  assert.strictEqual(S.post({ action: 'caps' }).caps.docpull, 1);
  assert.strictEqual(S.post({ action: 'docpull', key: KEY, auth: staff, have: '' }).code, 'AUTH_REQUIRED');
  assert.strictEqual(S.post({ action: 'docpull', key: KEY, have: '' }).code, 'AUTH_REQUIRED');
  assert.strictEqual(S.post({ action: 'docone', key: KEY, auth: staff, charts: ['1001'] }).code, 'AUTH_REQUIRED');
  const all = S.post({ action: 'docpull', key: KEY, auth: doc, have: '' });
  assert.strictEqual(all.patients.length, 4);
  const part = S.post({ action: 'docpull', key: KEY, auth: doc, have: 'p1|u1\np2|OLD\n' });
  assert.deepStrictEqual(part.patients.map(p => p.id).sort(), ['p2', 'p3', 'p9']);
  assert.strictEqual(S.post({ action: 'docpull', key: KEY, auth: doc, stamp: all.stamp }).same, true);
  assert.strictEqual(S.post({ action: 'docpull', key: 'no-such-key-00000000', auth: doc, have: '' }).none, true);
  const one = S.post({ action: 'docone', key: KEY, auth: doc, charts: ['001001'], names: ['나'] });   // 이름 '나'는 두 명이라 이름으로는 안 줌
  assert.deepStrictEqual(one.patients.map(p => p.id), ['p1']);
  S.store.chunks.push({ id: 'x', pid: KEY, type: 'doctordata', refId: '0', answer: '3', timestamp: '2099-01-01T00:00:00.000Z', question: '[' });   // 저장 도중 끊긴 조각
  assert.strictEqual(S.post({ action: 'docpull', key: KEY, auth: doc, stamp: all.stamp }).same, true);   // 온전한 예전 저장을 계속 씀
  S.store.chunks = S.store.chunks.filter(r => r.id === 'x');
  assert.strictEqual(S.post({ action: 'docpull', key: KEY, auth: doc, have: '' }).code, 'FALLBACK');
});

test('서버 규칙: 로그인 잠금 · 환아 id 겹침 거절 · 속도 제한', { skip }, async () => {
  const S = GS.load();
  for (let i = 0; i < 21; i++) S.login('wrong' + i);
  assert.strictEqual(S.login('doc-pw-1').code, 'LOCKED');
  const T = GS.load(), pid = 'abcdefghij0123456789';
  assert.strictEqual(T.post({ pid, type: 'question', question: 'x', id: "a');x//" }).code, 'AUTH_REQUIRED');
  assert.strictEqual(T.post({ pid, type: 'question', question: 'y'.repeat(70000) }).code, 'AUTH_REQUIRED');
  assert.strictEqual(T.post({ pid, type: 'question', question: '정상 질문' }).status, 'ok');
  let last; for (let i = 0; i < 205; i++) last = T.post({ pid, type: 'question', question: 'q' + i });
  assert.strictEqual(last.code, 'TOO_MANY');
});

test('현황판 휴대폰 EMR 칸: 새 서버면 그 아이 한 명만 받고, 예전 서버면 전체 받기로 돌아간다', { skip }, async () => {
  const S = GS.load(), tok = S.login('doc-pw-1').token;
  S.setCloud(KEY, [P('p1', '가', 'u1'), P('p2', '나', 'u2'), P('p3', '다', 'u3')]);
  for (const oldServer of [false, true]) {
    const log = [];
    const o = await open(b, page('flow.html'), {
      storage: { jrd_api_url: API, jrd_auth_token: tok, jrd_sync_key: KEY },
      api: q => {
        if (q.method === 'GET') { const u = new URL(q.url); if (u.searchParams.get('only') !== 'doctordata') return []; log.push('GET'); return S.get(Object.fromEntries(u.searchParams)); }
        if (!/^(caps|docone)$/.test(q.body.action || '')) return undefined;
        log.push(q.body.action); return oldServer ? { status: 'error', code: 'AUTH_REQUIRED' } : S.post(q.body);
      }
    });
    const r = await o.p.evaluate(async () => { const v = { id: 'v1', chartNo: '001002', name: '나' }; const list = await docFor(v); const p = docFind(list, v); return { n: list.length, hit: p && p.id }; });
    assert.strictEqual(r.hit, 'p2');
    if (oldServer) { assert.strictEqual(r.n, 3); assert.deepStrictEqual(log, ['caps', 'GET']); }
    else { assert.strictEqual(r.n, 1); assert.deepStrictEqual(log, ['caps', 'docone']); }
    assert.deepStrictEqual(o.errors, []);
    await o.ctx.close();
  }
});
