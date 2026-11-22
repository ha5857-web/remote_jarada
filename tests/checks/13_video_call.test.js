// 해외 환아 화상통화 일정: 원장 앱에서 후보 보내기 → 보호자 앱(현지 시각)에서 고르기 → 원장 앱 자동 확정 → 보호자 화면 확정 카드
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const PID = 'vcpid0123456789abcd';
const patient = (o) => Object.assign({ id: 'pt1', name: '이하나', sex: 'F', dob: '2016-05-10', accessCode: PID, location: 'overseas', lang: 'en', zoomLink: 'https://zoom.us/j/1234567890', phone: '+1 212 555 0100', email: 'mom@example.com',
  updatedAt: '2026-11-01T00:00:00.000Z', records: [{ id: 'r1', date: '2026-08-01', height: 127.0, callDone: true }] }, o || {});
function server() {
  const rows = [];
  const api = q => {
    if (q.method === 'GET') return rows.slice();
    const bd = q.body || {};
    if (bd.action === 'update') { const r = rows.find(x => x.id === bd.id); if (!r) return { status: 'ok', updated: false }; r.question = bd.question; r.timestamp = new Date().toISOString(); return { status: 'ok', updated: true }; }
    if (bd.action) return undefined;
    rows.push(Object.assign({ timestamp: new Date().toISOString() }, bd)); return { status: 'ok' };
  };
  return { rows, api };
}
const tomorrowKst = () => { const d = new Date(Date.now() + 9 * 3600e3 + 2 * 864e5); return d.toISOString().slice(0, 10); };

test('원장 제안 → 보호자(뉴욕) 고름 → 원장 앱이 확정 → 보호자 확정 카드·캘린더', async () => {
  const S = server(), other = patient({ id: 'pt2', name: '박둘', accessCode: 'otherpid0123456789x', lang: 'zh' });
  const doc = await open(b, page('index.html'), { storage: { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_call_link: '', jrd_remote_gh_patients_v1: JSON.stringify([patient(), other]) }, api: S.api, wait: 2000 });
  doc.p.on('dialog', d => d.accept());
  const day = tomorrowKst();
  // 원장: 환아 화면 → 시간대(뉴욕) → 날짜 → 한국 21:00·22:00 고르기 → 보내기
  await doc.p.evaluate(() => openDetail('pt1')); await doc.p.waitForTimeout(800);
  await doc.p.evaluate(() => vcSetTz('pt1', 'America/New_York')); await doc.p.waitForTimeout(500);
  await doc.p.evaluate(d => vcSetDate('pt1', d), day); await doc.p.waitForTimeout(500);
  const chips = await doc.p.evaluate(() => [...document.querySelectorAll('#vcBox .vc-chip')].filter(c => !c.closest('.vc-legend')).map(c => c.className.replace('vc-chip ', '') + '|' + c.innerText.replace(/\s+/g, ' ')));
  const c21 = chips.find(c => /^\w+\|21:00/.test(c)), c22 = chips.find(c => /^\w+\|22:00/.test(c)), c03 = chips.find(c => /^\w+\|03:00/.test(c));
  assert.ok(c21 && c21.startsWith('okay'), '한국 21:00 = 뉴욕 아침 7시 → 노랑: ' + c21);
  assert.ok(c22 && c22.startsWith('good') && /08:00/.test(c22), '한국 22:00 = 뉴욕 아침 8시 → 초록: ' + c22);
  assert.ok(!c03, '한국 03:00 은 목록 밖(07~23시)');
  const c13 = chips.find(c => /^\w+\|13:00/.test(c)); assert.ok(c13 && c13.startsWith('night'), '한국 13:00 = 뉴욕 한밤 → 회색: ' + c13);
  const iso21 = await doc.p.evaluate(d => vcKstIso(d, '21:00'), day), iso22 = await doc.p.evaluate(d => vcKstIso(d, '22:00'), day);
  await doc.p.evaluate(([a, c]) => { vcToggle('pt1', a); vcToggle('pt1', c); }, [iso21, iso22]); await doc.p.waitForTimeout(400);
  await doc.p.evaluate(() => vcPropose('pt1')); await doc.p.waitForTimeout(1200);
  const plan0 = JSON.parse(S.rows.find(r => r.type === 'callplan').question);
  assert.deepStrictEqual(plan0.slots, [iso21, iso22].sort()); assert.strictEqual(plan0.status, 'proposed'); assert.strictEqual(plan0.tz, 'America/New_York'); assert.strictEqual(plan0.link, 'https://zoom.us/j/1234567890');
  const msg = await doc.p.evaluate(() => document.getElementById('vcShareText').value);
  assert.match(msg, /Dear guardian of 이하나/); assert.match(msg, /1\) .*KST\)/); assert.match(msg, /자라다케어_환아용\.html\?pid=vcpid/);
  assert.ok(await doc.p.evaluate(() => !!document.querySelector('#vcShareOv button[onclick*="mail"]')), '이메일 버튼');
  assert.ok(await doc.p.evaluate(() => !!document.querySelector('#vcShareOv button[onclick*="line"]')), 'LINE 버튼');

  // 보호자: 뉴욕 시간대 휴대폰으로 열기 → 후보 2개가 현지 시각으로 → 첫 번째 고르기
  const ctxOpt = { timezoneId: 'America/New_York' };
  const pat = await open(b, page('자라다케어_환아용.html?pid=' + PID + '&api=' + encodeURIComponent(API) + '&dob=2016-05-10&sex=F&loc=overseas&lang=en&zoom=' + encodeURIComponent('https://zoom.us/j/1234567890')), { phone: true, storage: { ['jrd_consent_' + PID]: '2026-11-01', jrd_lang: 'en' }, api: S.api, wait: 2500 });
  await pat.ctx.close();
  const ctx = await b.newContext(Object.assign({ viewport: { width: 400, height: 860 } }, ctxOpt));
  await ctx.addInitScript(pid => { localStorage.setItem('jrd_consent_' + pid, '2026-11-01'); localStorage.setItem('jrd_lang', 'en'); }, PID);
  await ctx.route('**/*', async r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (u.startsWith('https://script.google.com/')) { let bd = null; try { bd = JSON.parse(r.request().postData() || 'null'); } catch (e) {} return r.fulfill({ contentType: 'application/json', body: JSON.stringify(S.api({ method: r.request().method(), url: u, body: bd }) || { status: 'ok' }) }); } return r.fulfill({ status: 204, body: '' }); });
  const pp = await ctx.newPage(); const perr = []; pp.on('pageerror', e => perr.push(String(e))); pp.on('dialog', d => d.accept());
  await pp.goto(page('자라다케어_환아용.html?pid=' + PID + '&api=' + encodeURIComponent(API) + '&dob=2016-05-10&sex=F&loc=overseas&lang=en')); await pp.waitForTimeout(2500);
  let card = await pp.evaluate(() => document.getElementById('cpCard').innerText);
  assert.match(card, /Please choose a video call time/); assert.match(card, /Eastern/);
  const slotsTxt = await pp.evaluate(() => [...document.querySelectorAll('#cpCard .cp-slot')].map(x => x.innerText.replace(/\s+/g, ' ')));
  assert.strictEqual(slotsTxt.length, 2); assert.match(slotsTxt[0], /(07|7):00 AM/); assert.match(slotsTxt[0], /Korea .*9:00 PM/);
  await pp.click('#cpCard .cp-slot'); await pp.waitForTimeout(800);
  card = await pp.evaluate(() => document.getElementById('cpCard').innerText);
  assert.match(card, /Your video call is booked/); assert.match(card, /Join video call/); assert.match(card, /Add to my calendar/); assert.match(card, /How to install the app/);
  const pick = S.rows.find(r => r.type === 'question' && /\[cp:v1\|pick\|/.test(r.question));
  assert.ok(pick, '서버에 선택이 남음'); assert.match(pick.question, /America\/New_York/); assert.match(pick.question, new RegExp(plan0.ver));
  const dl = pp.waitForEvent('download'); await pp.click('#cpCard button.cp-lite'); const f = await dl; const ics = require('fs').readFileSync(await f.path(), 'utf8');
  assert.match(ics, /BEGIN:VEVENT/); assert.match(ics, new RegExp('DTSTART:' + iso21.replace(/[-:]/g, '').replace(/\.\d{3}/, ''))); assert.match(ics, /TRIGGER:-PT10M/); assert.match(ics, /zoom\.us\/j\/1234567890/);
  // 질문함에는 꼬리표 대신 영어 문장
  assert.match(await pp.evaluate(q => vrQaText(q), pick.question), /^📅 Video call time chosen: .*7:00/);

  // 원장: 다시 열면 자동 확정, 질문은 답변 처리, 대시보드 목록
  await doc.p.evaluate(() => { VC.at = 0; openDetail('pt1'); }); await doc.p.waitForTimeout(1500);
  const plan1 = JSON.parse(S.rows.find(r => r.type === 'callplan').question);
  assert.strictEqual(plan1.status, 'confirmed'); assert.strictEqual(plan1.slot, iso21); assert.strictEqual(plan1.pickTz, 'America/New_York');
  assert.ok(S.rows.some(r => r.type === 'answer' && r.refId === pick.id), '질문함에서 답변 처리');
  assert.match(await doc.p.evaluate(() => document.getElementById('vcBox').innerText), /확정: .*서울 · 현지/);
  await doc.p.evaluate(() => { VC.at = 0; return vcDash(); }); await doc.p.waitForTimeout(800);
  assert.match(await doc.p.evaluate(() => document.getElementById('vcDashList').innerText), /이하나[\s\S]*미국 동부[\s\S]*📹/);
  await doc.p.evaluate(() => vcShare('pt1', 'confirm')); await doc.p.waitForTimeout(500);
  assert.match(await doc.p.evaluate(() => document.getElementById('vcShareText').value), /is booked for .*7:00/);
  // 통화 전 한눈에 보기: 보호자가 올린 것
  S.rows.push({ id: 'm1', pid: PID, type: 'measurement', date: '2026-11-10', height: 131.2, weight: 27, timestamp: '2026-11-10T01:00:00Z' }, { id: 'q1', pid: PID, type: 'question', date: '2026-11-12', question: 'Headache this week?', timestamp: '2026-11-12T01:00:00Z' }, { id: 'i1', pid: PID, type: 'injection', date: '2026-11-11', question: 'abdomenL', timestamp: '2026-11-11T01:00:00Z' });
  await doc.p.evaluate(() => vcSummary('pt1')); await doc.p.waitForTimeout(800);
  const sum = await doc.p.evaluate(() => document.getElementById('vcSumOv').innerText);
  assert.match(sum, /키 131\.2cm/); assert.match(sum, /Headache this week\?/); assert.match(sum, /주사 기록/); assert.doesNotMatch(sum, /\[cp:v1/);

  // 보호자 화면도 확정 상태 유지(서버 확정 반영) + 중국어로 바꿔도 카드 번역
  await pp.reload(); await pp.waitForTimeout(2500);
  assert.match(await pp.evaluate(() => document.getElementById('cpCard').innerText), /Your video call is booked/);
  await pp.evaluate(() => setLang('zh')); await pp.waitForTimeout(300);
  assert.match(await pp.evaluate(() => document.getElementById('cpCard').innerText), /视频通话已预约/);
  assert.deepStrictEqual(perr, []); assert.deepStrictEqual(doc.errors, []);
  await ctx.close(); await doc.ctx.close();
});

test('겹치면 확정하지 않음 · 다른 시간 요청은 원장 화면에 보임', async () => {
  const S = server(), A = 'apid0123456789abcdef', B = 'bpid0123456789abcdef';
  const doc = await open(b, page('index.html'), { storage: { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_remote_gh_patients_v1: JSON.stringify([patient({ id: 'a', name: '가', accessCode: A }), patient({ id: 'b', name: '나', accessCode: B })]) }, api: S.api, wait: 1500 });
  const t = new Date(Date.now() + 3 * 864e5); t.setUTCMinutes(0, 0, 0); const iso = t.toISOString();
  S.rows.push({ id: 'cp_' + A, pid: A, type: 'callplan', timestamp: '2026-11-19T00:00:00Z', question: JSON.stringify({ v: 1, ver: 'va', status: 'confirmed', slots: [iso], slot: iso, dur: 20, tz: 'America/New_York' }) },
    { id: 'cp_' + B, pid: B, type: 'callplan', timestamp: '2026-11-19T00:00:00Z', question: JSON.stringify({ v: 1, ver: 'vb', status: 'proposed', slots: [iso], slot: null, dur: 20, tz: 'Asia/Shanghai' }) },
    { id: 'qb', pid: B, type: 'question', timestamp: '2026-11-19T01:00:00Z', question: '📅 화상통화 시간 선택\n[cp:v1|pick|' + iso + '|Asia/Shanghai|vb]' },
    { id: 'qb2', pid: B, type: 'question', timestamp: '2026-11-19T02:00:00Z', question: '📅 화상통화 다른 시간 요청 (Asia/Shanghai)\nweekend mornings\n[cp:v1|ask||Asia/Shanghai|vb]' });
  await doc.p.evaluate(() => { VC.at = 0; openDetail('b'); }); await doc.p.waitForTimeout(1500);
  const planB = JSON.parse(S.rows.find(r => r.id === 'cp_' + B).question);
  assert.strictEqual(planB.status, 'proposed'); assert.strictEqual(planB.clash, '가');
  const txt = await doc.p.evaluate(() => document.getElementById('vcBox').innerText);
  assert.match(txt, /겹쳐요/); assert.match(txt, /다른 시간 요청 \(중국\): weekend mornings/);
  assert.ok(!S.rows.some(r => r.type === 'answer' && r.refId === 'qb'), '겹친 선택은 답변 처리하지 않음');
  assert.deepStrictEqual(doc.errors, []); await doc.ctx.close();
});

test('대만: 기본 Google Meet 링크·병원 LINE 공식계정 → 후보·안내 문구·보호자 화면(번체)에 반영', async () => {
  const S = server(), TPID = 'twpid0123456789abcde';
  const doc = await open(b, page('index.html'), { storage: { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_call_link: '', jrd_remote_gh_patients_v1: JSON.stringify([patient({ id: 'tw', name: '陳小美', lang: 'zt', accessCode: TPID, phone: '' })]) }, api: S.api, wait: 1500 });
  const dialogs = []; doc.p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await doc.p.evaluate(() => openDetail('tw')); await doc.p.waitForTimeout(1000);
  assert.match(await doc.p.evaluate(() => document.getElementById('vcBox').innerText), /화상통화 설정 \(처음 한 번\)/);
  await doc.p.evaluate(() => { document.getElementById('vcSetLink').value = 'https://meet.google.com/abc-defg-hij'; document.getElementById('vcSetLine').value = '123abcde'; vcSaveSettings('tw'); }); await doc.p.waitForTimeout(800);
  const box = await doc.p.evaluate(() => document.getElementById('vcBox').innerText);
  assert.match(box, /통화 링크\(Google Meet\): https:\/\/meet\.google\.com\/abc-defg-hij/); assert.match(box, /LINE @123abcde/);
  assert.match(await doc.p.evaluate(() => document.querySelector('#vcBox select').value), /Asia\/Taipei/);   // 번체 → 대만 시간대
  const day = tomorrowKst(), iso = await doc.p.evaluate(d => vcKstIso(d, '15:00'), day);
  await doc.p.evaluate(i => vcToggle('tw', i), iso); await doc.p.evaluate(() => vcPropose('tw')); await doc.p.waitForTimeout(1200);
  const plan = JSON.parse(S.rows.find(r => r.type === 'callplan').question);
  assert.strictEqual(plan.link, 'https://meet.google.com/abc-defg-hij'); assert.strictEqual(plan.line, '@123abcde');
  const msg = await doc.p.evaluate(() => document.getElementById('vcShareText').value);
  assert.match(msg, /監護人您好/); assert.match(msg, /14:00/); assert.match(msg, /LINE: https:\/\/line\.me\/R\/ti\/p\/%40123abcde/); assert.match(msg, /line=%40123abcde/);
  assert.match(await doc.p.evaluate(() => document.querySelector('#vcShareOv button[onclick*="line"]').innerText), /LINE 공식계정/);
  // 보호자(대만 시간대, 번체)
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, timezoneId: 'Asia/Taipei' });
  await ctx.addInitScript(pid => { localStorage.setItem('jrd_consent_' + pid, 'x'); localStorage.setItem('jrd_lang', 'zt'); }, TPID);
  await ctx.route('**/*', async r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (u.startsWith('https://script.google.com/')) { let bd = null; try { bd = JSON.parse(r.request().postData() || 'null'); } catch (e) {} return r.fulfill({ contentType: 'application/json', body: JSON.stringify(S.api({ method: r.request().method(), url: u, body: bd }) || { status: 'ok' }) }); } return r.fulfill({ status: 204, body: '' }); });
  const pp = await ctx.newPage(); const perr = []; pp.on('pageerror', e => perr.push(String(e)));
  await pp.goto(page('자라다케어_환아용.html?pid=' + TPID + '&api=' + encodeURIComponent(API) + '&loc=overseas&lang=zt')); await pp.waitForTimeout(2500);
  const card = await pp.evaluate(() => document.getElementById('cpCard').innerText);
  assert.match(card, /請選擇視訊通話時間/); assert.match(card, /下午0?2:00/); assert.match(card, /台北/); assert.match(card, /加醫院LINE好友/);
  assert.strictEqual(await pp.evaluate(() => document.querySelector('#cpCard a.cp-line').href), 'https://line.me/R/ti/p/%40123abcde');
  assert.strictEqual(await pp.evaluate(() => document.querySelector('#cpLineBox a.cp-line').href), 'https://line.me/R/ti/p/%40123abcde');
  assert.deepStrictEqual(perr, []); assert.deepStrictEqual(doc.errors, []);
  await ctx.close(); await doc.ctx.close();
});
