// 보안 점검에서 고친 것들이 다시 풀리지 않는지
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const ROOM = '자라다케어_환아용.html?pid=aaaaaaaaaaaaaaaaaaaa';

test('초진방: zoom=javascript: 주소는 버린다', async () => {
  const o = await open(b, page(ROOM + '&api=' + encodeURIComponent(API) + '&zoom=' + encodeURIComponent('javascript:window.__pwn=1') + '&bot=' + encodeURIComponent('javascript:window.__pwn=2')), { phone: true });
  const r = await o.p.evaluate(() => ({ z: document.getElementById('zoomBtn').getAttribute('href'), c: document.getElementById('chatbotBtn').getAttribute('href') }));
  assert.ok(!/javascript:/i.test(r.z), 'zoom href: ' + r.z);
  assert.ok(!/javascript:/i.test(r.c), 'bot href: ' + r.c);
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});

test('초진방: zoom=https 주소는 그대로 쓴다', async () => {
  const o = await open(b, page(ROOM + '&api=' + encodeURIComponent(API) + '&zoom=' + encodeURIComponent('https://zoom.us/j/123?pwd=a')), { phone: true });
  assert.strictEqual(await o.p.evaluate(() => document.getElementById('zoomBtn').getAttribute('href')), 'https://zoom.us/j/123?pwd=a');
  await o.ctx.close();
});

test('초진방: api= 는 구글 Apps Script 주소만 받는다', async () => {
  const o = await open(b, page(ROOM), { phone: true });
  const r = await o.p.evaluate(() => {
    const wasFile = location.protocol === 'file:';
    const pub = u => { try { const x = new URL(u); return x.protocol === 'https:' && x.hostname === 'script.google.com'; } catch (e) { return false; } };
    return { wasFile, good: safeApi('https://script.google.com/macros/s/ABC/exec'), evilIsPublicOk: pub('https://evil.example/x'), fake: pub('https://script.google.com.evil.example/x'), http: pub('http://script.google.com/x') };
  });
  assert.strictEqual(r.good, 'https://script.google.com/macros/s/ABC/exec');
  assert.strictEqual(r.evilIsPublicOk, false); assert.strictEqual(r.fake, false); assert.strictEqual(r.http, false);
  // file:// 로 열면 시험용으로 다른 주소를 허용하므로, 공개 주소(https)일 때의 규칙을 코드에서 직접 확인
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', '자라다케어_환아용.html'), 'utf8');
  assert.match(src, /const API = safeApi\(qs\.get\('api'\)\);/);
  assert.match(src, /x\.hostname === 'script\.google\.com'/);
  await o.ctx.close();
});

test('카드 QR 화면: a= 로 다른 서버를 가리킬 수 없다(규칙이 코드에 있음)', async () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'flow.html'), 'utf8');
  const m = src.match(/function pmApi\(\)\{[^\n]*/);
  assert.ok(m && /x\.hostname==='script\.google\.com'/.test(m[0]) && /\^\[A-Za-z0-9_-\]\+\$/.test(m[0]));
  const o = await open(b, page('flow.html?c=C003&a=' + encodeURIComponent('bad id/../x')), { phone: true });
  assert.match(await o.p.evaluate(() => pmApi()), /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
  await o.ctx.close();
});

test('의사 앱: 서버 행의 id·pid 에서 따옴표·꺾쇠를 지운다 + 영상 링크 검증', async () => {
  const rows = [{ id: "x');window.__pwn=1;//", pid: 'p"<1>', type: 'que`stion', fileId: 'ab c', date: "2026-11-10');x('", question: '<b>그대로</b>' }, { id: 'ok_1-2.3:4', pid: 'abcDEF', type: 'measurement' }];
  const o = await open(b, page('index.html'), { storage: { jrd_api_url: API, jrd_auth_token: doctorToken() }, api: q => q.method === 'GET' ? rows : undefined });
  const r = await o.p.evaluate(async api => {
    const got = await (await fetch(api + '?x=1')).json();
    return { got, pwn: window.__pwn || 0, urls: [jsUrl('https://youtu.be/a?b=1&c=2'), jsUrl('javascript:alert(1)'), jsUrl("https://a/');x('"), jsUrl('')] };
  }, API);
  assert.strictEqual(r.got[0].id, 'x);window.__pwn=1;//');
  assert.strictEqual(r.got[0].pid, 'p1'); assert.strictEqual(r.got[0].type, 'question'); assert.strictEqual(r.got[0].fileId, 'abc');
  assert.strictEqual(r.got[0].date, '2026-11-10);x(');
  assert.strictEqual(r.got[0].question, '<b>그대로</b>');          // 본문은 건드리지 않음(화면에 낼 때 이스케이프)
  assert.deepStrictEqual(r.got[1], rows[1]);
  assert.strictEqual(r.pwn, 0);
  assert.deepStrictEqual(r.urls, ['https://youtu.be/a?b=1&amp;c=2', '', '', '']);
  await o.ctx.close();
});

test('저장소에 비밀번호·코드 파일이 올라가 있지 않다', () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..', '..');
  const bad = fs.readdirSync(root).filter(f => /code|코드|password|secret/i.test(f) && /\.(csv|xlsx?|txt|json)$/i.test(f));
  assert.deepStrictEqual(bad, []);
  for (const f of ['index.html', 'flow.html', 'visit-notice.html', '자라다케어_환아용.html']) {
    const s = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(!/DOCTOR_APP_PASSWORD\s*[:=]\s*['"][^'"]+['"]/.test(s), f);
    assert.ok(!/(sk-ant-|AIza[0-9A-Za-z_-]{30,}|pat[A-Za-z0-9]{14}\.[a-f0-9]{40,})/.test(s), f + ' 에 API 키처럼 보이는 글자가 있어요');
  }
});
