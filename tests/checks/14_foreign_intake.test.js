// 🌏 외국어 초진 기록지(10개 언어): 원무과·원장 화면이 읽고, 카카오·한국 문자 대신 링크만 등록(manual)한 뒤
//    보호자가 고른 메신저·이메일 버튼으로 보냄. 자동·일괄 발송은 해외 기록지를 건드리지 않음. 원장 앱은 해외 환아로 등록.
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });

const MARK = '⟦해외 ZT | 이름: Chen Wei-Ting | 전화: +886 912 345 678 | 이메일: chen@example.com | 메신저: LINE, WhatsApp | ID: chenwt⟧';
const ROW = ['2026. 11. 20 오후 3:01:02', 'Chen Wei-Ting', '2016. 5. 12', '39+0週 / 3200g', '無', '無', '無', '175cm / 160cm', '1/2', '無', '2025-05-30 / 138.2cm / 34.2kg',
  '', '擔心長不高', '', '', '', '', '', '', '+886 912 345 678', 'chen@example.com', 'LINE, WhatsApp', 'chenwt'].join('\t') + '\t' + MARK;
const KO = '2026. 11. 20 오후 2:00:00\t김하늘\t2018. 3. 2\t\t없음\t없음\t없음\t\t\t\t\t\t\t\t\t\t\t\t\t010-2222-3333';
const ITEMS = [{ key: '2026. 11. 20 오후 3:01:02', raw: ROW, ts: 2, lang: 'zt', intl: true }, { key: '2026. 11. 20 오후 2:00:00', raw: KO, ts: 1 }];

test('공용: 외국어 기록지 표시(⟦해외…⟧)에서 이름·국제전화·이메일·메신저를 읽음, 한국어 기록지는 그대로', async () => {
  const o = await open(b, page('visit-notice.html'), { storage: { jrd_api_url: API } });
  const r = await o.p.evaluate(([a, k]) => [parseFirstIntake(a), parseFirstIntake(k)], [ROW, KO]);
  assert.strictEqual(r[0].intl, true); assert.strictEqual(r[0].lang, 'zt'); assert.strictEqual(r[0].name, 'Chen Wei-Ting');
  assert.strictEqual(r[0].dob, '2016-05-12'); assert.strictEqual(r[0].phone, '+886912345678'); assert.strictEqual(r[0].email, 'chen@example.com');
  assert.strictEqual(r[0].apps, 'LINE, WhatsApp'); assert.strictEqual(r[0].appId, 'chenwt');
  assert.ok(!r[1].intl); assert.strictEqual(r[1].name, '김하늘'); assert.strictEqual(r[1].phone, '010-2222-3333');
  await o.ctx.close();
});

for (const [label, file, storage, by] of [
  ['원무과 앱', 'visit-notice.html', { jrd_api_url: API, jrd_auth_token: 'staff.' + (Date.now() + 1e9) + '.s', jrd_site_url: 'https://example.test/' }, '원무과'],
  ['원장 앱', 'index.html', { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_site_url: 'https://example.test/' }, '의사']
]) {
  test(label + ': 해외 기록지 → 🌏 표시 · 보호자 언어 안내문 · 카카오 없이 링크 등록 · LINE/WhatsApp/이메일 버튼', async () => {
    const posts = [];
    const o = await open(b, page(file), { storage, api: q => {
      if (q.method === 'GET') return [];
      const a = q.body && q.body.action;
      if (a === 'listintakes') return { status: 'ok', items: ITEMS, template: 'new' };
      if (a === 'registerfirstvisit') { posts.push(q.body); return { status: 'ok', sent: true, channel: q.body.method === 'manual' ? q.body.channel : 'kakao' }; }
      return undefined; } });
    const opened = []; await o.p.exposeFunction('__opened', u => opened.push(u));
    await o.p.evaluate(() => { window.open = (u) => { window.__opened(String(u)); return null; }; });
    await o.p.evaluate(() => fsLoadList()); await o.p.waitForTimeout(400);
    const list = await o.p.evaluate(() => document.getElementById('fs_list').textContent);
    assert.match(list, /Chen Wei-Ting\s*🌏 대만\(번체\)/); assert.match(list, /🌏 해외 · LINE, WhatsApp · chen@example\.com/); assert.match(list, /김하늘[\s\S]*연락처 있음/);
    await o.p.evaluate(() => fsPick(0));
    const st = await o.p.evaluate(() => ({ name: document.getElementById('fs_name').value, phone: document.getElementById('fs_phone').value, info: document.getElementById('fs_info').textContent,
      manualShown: getComputedStyle(document.getElementById('fs_manualLabel')).display !== 'none', method: fsMethod() }));
    assert.strictEqual(st.name, 'Chen Wei-Ting'); assert.strictEqual(st.phone, '+886912345678'); assert.match(st.info, /🌏 해외 보호자\(대만\(번체\) 기록지\)/);
    assert.ok(st.manualShown); assert.strictEqual(st.method, 'manual');
    await o.p.evaluate(() => { document.getElementById('fs_sex').value = 'M'; document.getElementById('fs_visit').value = '2026-12-01'; });
    await o.p.evaluate(() => fsPreview());
    const pv = await o.p.evaluate(() => ({ msg: document.getElementById('fs_msg').value, btn: document.getElementById('fs_sendBtn').textContent, link: fsCurLink }));
    assert.match(pv.msg, /Chen Wei-Ting的監護人您好/); assert.match(pv.msg, /初診室/); assert.match(pv.msg, /lang=zh/);   // 영상 사이트는 번체가 없어 간체로
    assert.match(pv.link, /lang=zt/); assert.match(pv.link, /loc=overseas/); assert.match(pv.btn, /해외 초진방 링크 등록/);
    // 자동 발송이면 해외는 보내지 않음
    let t = await o.p.evaluate(async () => { window.fsAuto = true; try { await fsSend(); } finally { window.fsAuto = false; } return document.getElementById('fs_status').textContent; });
    assert.match(t, /^⛔ 🌏 해외 보호자는 자동으로 보내지 않아요/); assert.strictEqual(posts.length, 0);
    // 직접 누르면 manual 로 등록
    t = await o.p.evaluate(async () => { await fsSend(); return document.getElementById('fs_status').textContent; });
    assert.match(t, /^✅ 해외 초진방 링크를 등록했어요/);
    assert.strictEqual(posts.length, 1); assert.strictEqual(posts[0].method, 'manual'); assert.strictEqual(posts[0].channel, 'LINE');
    assert.strictEqual(posts[0].pending.intl, true); assert.strictEqual(posts[0].pending.lang, 'zt'); assert.strictEqual(posts[0].pending.email, 'chen@example.com');
    assert.strictEqual(posts[0].pending.messenger, 'LINE, WhatsApp'); assert.strictEqual(posts[0].pending.by, by); assert.strictEqual(posts[0].pending.location, 'overseas');
    const share = await o.p.evaluate(() => [...document.querySelectorAll('#fs_intlShare button')].map(x => x.textContent.trim()));
    assert.deepStrictEqual(share.slice(0, 2), ['⭐ LINE (병원 공식계정)', '⭐ WhatsApp']); assert.ok(share.includes('✉️ 이메일')); assert.ok(share.includes('📋 문구 복사'));
    assert.match(pv.msg, /LINE @214wlixe: https:\/\/line\.me\/R\/ti\/p\/%40214wlixe/);                 // 병원 LINE 친구 추가 링크
    await o.p.evaluate(() => fvIntlGo(0)); await o.p.evaluate(() => fvIntlGo(1)); await o.p.waitForTimeout(200);
    assert.strictEqual(opened[0], 'https://manager.line.biz/');                                  // LINE: 문구 복사 + 공식계정 채팅
    assert.match(opened[1], /^https:\/\/wa\.me\/886912345678\?text=/); assert.match(decodeURIComponent(opened[1]), /初診室/);
    const em = await o.p.evaluate(() => window.fvIntlState.targets.find(x => x.key === 'email').url);
    assert.match(em, /^mailto:chen@example\.com\?subject=/);
    assert.deepStrictEqual(o.errors, []); await o.ctx.close();
  });
}

test('원무과 앱: 해외 번호를 카카오로 보내려 하면 막고 「해외: 직접 보내기」로 바꿈', async () => {
  const posts = [], o = await open(b, page('visit-notice.html'), { storage: { jrd_api_url: API, jrd_auth_token: 'staff.' + (Date.now() + 1e9) + '.s', jrd_site_url: 'https://example.test/' },
    api: q => q.method === 'GET' ? [] : (q.body && q.body.action === 'registerfirstvisit' ? (posts.push(1), { status: 'ok', channel: 'kakao' }) : undefined) });
  await o.p.evaluate(() => { const $ = id => document.getElementById(id); $('fs_name').value = 'Anna'; $('fs_dob').value = '2017-01-01'; $('fs_sex').value = 'F'; $('fs_phone').value = '+1 212 555 0100';
    fsVideos = [JRDV.vid(1)]; fsParsed = null; fsKey = ''; });
  await o.p.evaluate(() => fsPreview());
  await o.p.evaluate(() => { document.querySelector('input[name="fs_method"][value="kakao"]').checked = true; });
  const t = await o.p.evaluate(async () => { await fsSend(); return document.getElementById('fs_status').textContent; });
  assert.match(t, /해외 전화번호예요/); assert.strictEqual(posts.length, 0);
  assert.strictEqual(await o.p.evaluate(() => fsMethod()), 'manual');
  await o.ctx.close();
});

test('원장 앱: 해외 접수는 해외 환아(언어·이메일·메신저)로 등록되고 프로필에 메신저가 보임', async () => {
  const pend = { pid: 'aaaabbbbccccddddeeee', name: 'Chen Wei-Ting', dob: '2016-05-12', sex: 'M', phone: '+886912345678', visitDate: '2026-12-01', intake: 'x', by: '원무과',
    sentAt: '2026-11-20T07:00:00Z', intl: true, lang: 'zt', email: 'chen@example.com', messenger: 'LINE, WhatsApp', messengerId: 'chenwt', location: 'overseas' };
  const o = await open(b, page('index.html'), { storage: { jrd_api_url: API, jrd_sync_key: 'k', jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' },
    api: q => (q.method === 'GET' && /only=firstVisitPending/.test(q.url)) ? [{ id: 'r1', type: 'firstVisitPending', question: JSON.stringify(pend) }] : undefined });
  await o.p.evaluate(() => fvImportPending(true)); await o.p.waitForTimeout(500);
  const p = await o.p.evaluate(() => { const x = patients.find(q => q.name === 'Chen Wei-Ting'); return x && { loc: x.location, lang: x.lang, email: x.email, m: x.messenger, id: x.messengerId, ac: x.accessCode }; });
  assert.deepStrictEqual(p, { loc: 'overseas', lang: 'zt', email: 'chen@example.com', m: 'LINE, WhatsApp', id: 'chenwt', ac: 'aaaabbbbccccddddeeee' });
  await o.ctx.close();
});

test('병원 LINE 공식계정(@214wlixe)이 기본값: 원장 앱 해외 환아 링크·보호자 화면 LINE 친구 추가', async () => {
  const o = await open(b, page('index.html'), { storage: { jrd_api_url: API, jrd_site_url: 'https://example.test/', jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' } });
  const r = await o.p.evaluate(() => [vcLineId(), buildPatientLinkAndMsg({ name: 'Lin', accessCode: 'abcabcabcabcabcabc12', lang: 'zt', location: 'overseas', records: [] }).link,
    buildPatientLinkAndMsg({ name: '김하늘', accessCode: 'abcabcabcabcabcabc34', lang: 'ko', location: 'domestic', records: [] }).link]);
  assert.strictEqual(r[0], '@214wlixe'); assert.match(r[1], /line=%40214wlixe/); assert.doesNotMatch(r[2], /line=/);
  await o.ctx.close();
  const g = await open(b, page('자라다케어_환아용.html') + '?pid=abcabcabcabcabcabc12&lang=zt&loc=overseas', { phone: true });
  assert.strictEqual(await g.p.evaluate(() => cpLineId()), '@214wlixe');
  await g.ctx.close();
  const d = await open(b, page('자라다케어_환아용.html') + '?pid=abcabcabcabcabcabc34&lang=ko&loc=domestic', { phone: true });
  assert.strictEqual(await d.p.evaluate(() => cpLineId()), '');
  await d.ctx.close();
});

test('병원 Zalo(+82 10-6418-0430): 베트남 안내문·화상통화 문구·보호자 화면은 Zalo, 대만은 LINE', async () => {
  const o = await open(b, page('index.html'), { storage: { jrd_api_url: API, jrd_site_url: 'https://example.test/', jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' } });
  const r = await o.p.evaluate(() => [fvIntlInvite('vi', 'Bé An', 'L', 'V', 'Zalo'), fvIntlInvite('zt', 'Lin', 'L', 'V', 'LINE'), fvIntlInvite('en', 'Tom', 'L', 'V', 'WhatsApp, Zalo'),
    vcMessage({ name: 'Bé An', accessCode: 'abcabcabcabcabcabc56', lang: 'vi', location: 'overseas', records: [] }, 'propose', { slots: ['2026-12-01T05:00:00Z'] })]);
  assert.match(r[0], /Zalo \+82 10-6418-0430: https:\/\/zalo\.me\/821064180430/); assert.doesNotMatch(r[0], /LINE @214wlixe/);
  assert.match(r[1], /LINE @214wlixe/); assert.doesNotMatch(r[1], /Zalo/);
  assert.match(r[2], /LINE @214wlixe/); assert.match(r[2], /Zalo \+82/);
  assert.match(r[3], /Zalo: \+82 10-6418-0430 https:\/\/zalo\.me\/821064180430/); assert.doesNotMatch(r[3], /line\.me\/R\/ti/);
  await o.ctx.close();
  const g = await open(b, page('자라다케어_환아용.html') + '?pid=abcabcabcabcabcabc56&lang=vi&loc=overseas', { phone: true });
  const h = await g.p.evaluate(() => cpLineHtml());
  assert.match(h, /zalo\.me\/821064180430/); assert.match(h, /Nhắn Zalo cho phòng khám/);
  await g.ctx.close();
});
