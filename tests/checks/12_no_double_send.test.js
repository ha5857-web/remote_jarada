// 초진방 링크 중복 발송 막기: 원장 앱(index)·원무과 앱(visit-notice)·flow 중 어디서 먼저 보냈든, 보내기 바로 전에 서버 기록을 다시 보고 또 보내지 않음
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const SENT = [{ id: 'fv_abc123', pid: 'abc123abc123', type: 'firstvisit', timestamp: '2026-11-20T05:00:00Z', question: JSON.stringify({ name: '김하늘', stage: 'pre', updatedAt: '2026-11-20T05:00:00Z' }) },
  { id: 'p1', pid: 'def456def456', type: 'firstVisitPending', timestamp: '2026-11-20T05:00:00Z', question: JSON.stringify({ pid: 'def456def456', name: '박바다', dob: '2018-03-02', by: '원무과', sentAt: '2026-11-20T06:00:00Z' }) }];
const mk = (rows, posts) => q => { if (q.method === 'GET') return rows.slice(); const a = q.body && q.body.action; if (a === 'registerfirstvisit') { posts.push(q.body.name); return { status: 'ok', channel: 'kakao' }; } if (a === 'listintakes') return { status: 'ok', items: [] }; return undefined; };
async function fill(p, name, dob) {
  await p.evaluate(([name, dob]) => {
    const $ = id => document.getElementById(id);
    $('fs_name').value = name; $('fs_dob').value = dob; $('fs_sex').value = 'F'; $('fs_phone').value = '010-1234-5678'; $('fs_visit').value = '2026-11-21';
    fsVideos = [JRDV.vid(1), JRDV.vid(2)]; fsKey = ''; fsParsed = null;
  }, [name, dob]);
  await p.evaluate(() => fsPreview());
}
const send = (p, auto) => p.evaluate(async auto => { window.fsAuto = auto; try { await fsSend(); } finally { window.fsAuto = false; } return document.getElementById('fs_status').textContent; }, auto);

for (const [label, file, storage] of [
  ['원무과 앱', 'visit-notice.html', { jrd_api_url: API, jrd_auth_token: 'staff.' + (Date.now() + 1e9) + '.s', jrd_site_url: 'https://example.test/' }],
  ['원장 앱', 'index.html', { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_site_url: 'https://example.test/' }]
]) {
  test(label + ': 다른 화면에서 이미 보낸 아이는 보내기 직전에 걸러짐', async () => {
    const rows = [], posts = [], o = await open(b, page(file), { storage, api: mk(rows, posts) });
    const dialogs = []; let answer = false; o.p.on('dialog', d => { dialogs.push(d.message()); answer ? d.accept() : d.dismiss(); });
    await fill(o.p, '김하늘', '2019-01-05');
    rows.push(...SENT);                                                     // 화면을 연 뒤 원장/직원이 먼저 보냄
    let t = await send(o.p, true);                                          // 일괄·자동 발송: 묻지 않고 건너뜀
    assert.match(t, /^⛔ 이미 초진방 링크를 보낸 아이예요/); assert.deepStrictEqual(posts, []); assert.strictEqual(dialogs.filter(x => /그래도 다시/.test(x)).length, 0);
    t = await send(o.p, false);                                             // 직접 누름: 물어보고, 아니오면 안 보냄
    assert.match(t, /^⛔/); assert.deepStrictEqual(posts, []); assert.ok(dialogs.some(x => /김하늘: 이미 초진방 링크를 보낸 아이예요[\s\S]*그래도 다시 보낼까요/.test(x)), dialogs.join(' / '));
    answer = true; t = await send(o.p, false);                              // 「예」를 고르면 다시 보냄
    assert.match(t, /^✅/); assert.deepStrictEqual(posts, ['김하늘']);
    await fill(o.p, '이새봄', '2019-01-05'); posts.length = 0;             // 처음 보내는 아이는 그대로 보냄
    t = await send(o.p, true); assert.match(t, /^✅/); assert.deepStrictEqual(posts, ['이새봄']);
    assert.deepStrictEqual(o.errors, []); await o.ctx.close();
  });
}

test('원무과 앱: 서버 기록을 확인하지 못하면 일괄 발송은 보내지 않음', async () => {
  const posts = [], o = await open(b, page('visit-notice.html'), { storage: { jrd_api_url: API, jrd_auth_token: 'staff.' + (Date.now() + 1e9) + '.s', jrd_site_url: 'https://example.test/' },
    api: q => q.method === 'GET' ? { status: 'error', message: 'x' } : (q.body && q.body.action === 'registerfirstvisit' ? (posts.push(1), { status: 'ok' }) : undefined) });
  await fill(o.p, '최다온', '2019-01-05');
  const t = await send(o.p, true);
  assert.match(t, /^⛔ 발송 기록을 확인하지 못했어요/); assert.strictEqual(posts.length, 0); await o.ctx.close();
});

test('flow: 보내기 전 확인 — 이름이 같으면 「이미 보냄」, 연결 코드는 생년월일까지 같을 때만 이어 씀', async () => {
  const o = await open(b, page('flow.html'), { storage: { jrd_api_url: API, jrd_auth_token: 'staff.' + (Date.now() + 1e9) + '.s' }, api: q => q.method === 'GET' ? SENT : undefined, wait: 2000 });
  const r = await o.p.evaluate(async () => [await fvSentBefore('박바다', '2018-03-02'), await fvSentBefore('박바다', '2017-01-01'), await fvSentBefore('김하늘', '2019-01-05'), await fvSentBefore('새아이', '2019-01-05')]);
  assert.strictEqual(r[0].pid, 'def456def456'); assert.strictEqual(r[0].by, '원무과');
  assert.strictEqual(r[1], null);                                           // 같은 이름, 다른 생년월일 → 다른 아이
  assert.ok(r[2] && r[2].pid === '');                                       // 생년월일 없는 기록 → 「이미 보냄」은 알리되 연결 코드는 안 가져옴
  assert.strictEqual(r[3], null);
  assert.match(await o.p.evaluate(h => fvSentText(h), r[0]), /이미 초진방 링크를 받은 아이예요 \(11\/20 \d\d:00 · 원무과\)/);
  await o.ctx.close();
});

test('flow 당일 초진 빠른 등록: 이미 받은 아이는 묻고, 「아니오」면 보내지 않고 같은 초진방에 이어 둠', async () => {
  const posts = [], o = await open(b, page('flow.html'), { storage: { jrd_api_url: API, jrd_auth_token: 'staff.' + (Date.now() + 1e9) + '.s', jrd_site_url: 'https://example.test/' },
    api: q => { if (q.method === 'GET') return SENT; const a = q.body && q.body.action; if (a === 'registerfirstvisit') { posts.push(q.body.name); return { status: 'ok', pid: q.body.pid, channel: 'kakao' }; } if (a === 'flowlist') return { status: 'ok', visits: [] }; return undefined; }, wait: 2500 });
  const dialogs = []; o.p.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
  const run = (name, dob) => o.p.evaluate(async ([name, dob]) => {
    document.querySelectorAll('[id^=qf-]').forEach(e => e.remove());
    const box = document.createElement('div'); box.innerHTML = `<input id="qf-name" value="${name}"><input id="qf-dob" value="${dob}"><input id="qf-chart" value=""><input id="qf-phone" value="01012345678"><input id="qf-sex" value="여"><input type="checkbox" id="qf-send" checked><input type="checkbox" id="qf-card"><span id="qf-msg"></span><button id="qf-go"></button>`; document.body.appendChild(box);
    await sameDaySubmit(); await new Promise(r => setTimeout(r, 300));
    const v = [...S.items.values()].find(x => x.name === name); return v && { pid: v.pid || '', invite: !!(v.invite && v.invite.sentAt) };
  }, [name, dob]);
  const a = await run('박바다', '20180302');
  assert.ok(dialogs.some(x => /박바다: 이미 초진방 링크를 받은 아이예요[\s\S]*다시 보낼까요/.test(x)), dialogs.join(' / '));
  assert.deepStrictEqual(posts, []); assert.deepStrictEqual(a, { pid: 'def456def456', invite: true });
  const c = await run('새아이', '20190105');                                // 처음인 아이는 묻지 않고 보냄
  assert.deepStrictEqual(posts, ['새아이']); assert.strictEqual(c.invite, true); assert.strictEqual(dialogs.length, 1);
  assert.deepStrictEqual(o.errors, []); await o.ctx.close();
});
