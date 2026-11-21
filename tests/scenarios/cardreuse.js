// 카드 재사용: 귀가·완료한 아이의 카드(C001)는 연결이 풀리고, 다음 아이에게 「C001 주기」로 다시 나감
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2], OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js',
  'html2canvas/1.4.1/html2canvas.min.js': NM + '/html2canvas/dist/html2canvas.min.js', 'jspdf/2.5.1/jspdf.umd.min.js': NM + '/jspdf/dist/jspdf.umd.min.js', 'jsqr@1.4.0/dist/jsQR.js': NM + '/jsqr/dist/jsQR.js' };
const d = new Date(), pad = n => (n < 10 ? '0' : '') + n, ymd = t => t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
const TODAY = ymd(d), now = Date.now(), M = 60000;
const V = o => Object.assign({ sv: 2, card: '', appt: '', log: [{ s: 0, t: now - 5 * M }], createdAt: now - 30 * M, updatedAt: now - 20 * M, date: TODAY, rev: false, first: false, step: 0,
  intake: {}, measure: {}, xray: {}, lab: { items: [], results: {}, proto: 'single', draws: [], ext: {}, at: {} }, review: {}, exit: {}, report: {} }, o);
const DB = new Map();
[V({ id: 'a', name: '조하연', age: 9, sex: '여', chartNo: '100129', step: 1, card: 'C001', cardAt: now - 25 * M, log: [{ s: 0, t: now - 25 * M }, { s: 1, t: now - 20 * M }] }),
 V({ id: 'b', name: '문다은', age: 10, sex: '남', chartNo: '100498', step: -1, appt: '09:00', log: [] }),
 V({ id: 'c', name: '백다은', age: 10, sex: '여', chartNo: '100555', step: -1, appt: '09:10', log: [] })].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
function handle(b) {
  switch (b.action) {
    case 'flowlist': return { status: 'ok', visits: [...DB.values()] };
    case 'flowsave': { let v = DB.get(b.id); if (!v) { v = { id: b.id }; DB.set(b.id, v); } Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); return { status: 'ok' }; }
    default: return { status: 'ok' };
  }
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); localStorage.setItem('jrd_site_url', 'https://ha5857-web.github.io/remote_jarada'); window.print = () => {}; });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) { let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(handle(b)) }); }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', dl => dl.accept());
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded); await page.waitForTimeout(500);
  const chips = () => page.evaluate(() => [...document.querySelectorAll('[data-act="card-next"]')].map(e => e.textContent.trim()));
  const n1 = await page.evaluate(() => nextCard());
  console.log('조하연 진행 중(C001) → 다음 카드:', n1, (await chips()).join(' | '));
  if (n1 !== 'C002') console.log('FAIL C001을 쓰는 동안에는 C002를 줘야 함');
  await page.evaluate(() => quickDone(S.items.get('a'))); await page.waitForTimeout(700);
  const a = DB.get('a'), n2 = await page.evaluate(() => nextCard());
  console.log('조하연 바로 완료 → 서버 카드:', JSON.stringify(a.card), 'was', a.cardWas, '· 다음 카드:', n2, (await chips()).join(' | '));
  if (a.card || a.cardWas !== 'C001') console.log('FAIL 완료하면 C001 연결이 풀려야 함');
  if (n2 !== 'C001') console.log('FAIL 돌려받은 C001을 다음 아이에게 줘야 함');
  if (!(await chips()).every(t => /C001/.test(t))) console.log('FAIL 예약 칸의 「카드 주기」가 C001로 바뀌지 않음');
  await page.click('[data-act="card-next"][data-id="b"]'); await page.waitForTimeout(700);
  const b = DB.get('b'), n3 = await page.evaluate(() => nextCard());
  console.log('문다은에게 주기 → 문다은 카드:', b.card, 'step', b.step, '· 다음 카드:', n3);
  if (b.card !== 'C001' || b.step !== 0) console.log('FAIL 문다은에게 C001이 연결되고 도착 처리돼야 함');
  if (n3 !== 'C002') console.log('FAIL C001을 다시 쓰는 동안에는 C002를 줘야 함');
  // 조하연 보호자 폰이 남긴 별점(카드를 다시 주기 전에 찍음)은 조하연 것으로
  const who = await page.evaluate(([t]) => { const v = fxVisit('C001', t); return v && v.name; }, [now - 24 * M]);
  const who2 = await page.evaluate(() => { const v = fxVisit('C001', Date.now()); return v && v.name; });
  console.log('C001 카드 조회 — 조하연 폰(먼저 찍음):', who, '· 지금 찍은 폰:', who2);
  if (who !== '조하연' || who2 !== '문다은') console.log('FAIL 같은 카드를 다시 줬을 때 보호자 폰 연결이 섞임');
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
