// 원장 확인이 끝난 오늘 리포트는 카드 번호(card-C001)로 보호자 폰에 PDF가 자동으로 올라감(기능 추가 전에 확인한 리포트 포함)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2];
const NM = path.join(__dirname, '..', 'node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js',
  'html2canvas/1.4.1/html2canvas.min.js': NM + '/html2canvas/dist/html2canvas.min.js', 'jspdf/2.5.1/jspdf.umd.min.js': NM + '/jspdf/dist/jspdf.umd.min.js', 'jsqr@1.4.0/dist/jsQR.js': NM + '/jsqr/dist/jsQR.js' };
const pad = n => (n < 10 ? '0' : '') + n, d = new Date(), TODAY = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), now = Date.now(), M = 60000;
const base = () => ({ intake: { chief: '', purpose: '성장 평가', fatherH: '', motherH: '', history: '', signs: '', consent: false }, measure: { height: '', weight: '' }, xray: { part: '', done: false, note: '' },
  lab: { items: ['원내검사'], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} }, review: { boneAge: '', note: '', next: '' }, exit: { paid: false, guide: false }, report: { sent: false } });
const V = o => Object.assign({ sv: 2, card: '', appt: '', log: [{ s: 0, t: now - 50 * M }], createdAt: now - 90 * M, updatedAt: now - 60 * M, date: TODAY, rev: true }, base(), o);
const DB = new Map(); const rowsPosted = [];
DB.set('a', V({ id: 'a', name: '노시온', age: 10, sex: '남', chartNo: '101700', step: 8, card: 'C001', dob: '2016-05-11',
  gr: { ready: true, reviewed: true, reviewedAt: now - 5 * M, date: TODAY, dob: '2016-05-11', sex: 'M', fh: '175', mh: '162', recsText: '2026-05-10 키 128.5 체중 26\n' + TODAY + ' 키 131.2 체중 27.5', post: { summary: '잘 크고 있어요.', direction: '6개월 뒤 다시 봐요.' } } }));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
function handle(b) {
  if (b.type === 'fvreport') { rowsPosted.push(b); return { status: 'ok' }; }
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
    if (u.startsWith('https://api.test/')) { if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '[]' });
      let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(handle(b)) }); }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded); await page.waitForTimeout(500);
  await page.evaluate(() => { try { FR.cardBackfill(); } catch (e) {} });
  await page.waitForTimeout(9000);
  if (!rowsPosted.length) console.log('FAIL 이미 확인한 리포트가 카드로 올라가지 않음');
  else {
    const r = rowsPosted[0]; if (r.pid !== 'card-C001') console.log('FAIL pid가 카드 번호가 아님', r.pid);
    const q = JSON.parse(r.question); if (!/^[A-Za-z0-9+/=]+$/.test(q.data)) console.log('FAIL PDF 조각 형식');
    const had = await page.evaluate(() => !!S.items.get('a').gr.cardAt); if (!had) console.log('FAIL 올린 뒤 cardAt 표시가 없음');
    console.log('uploaded rows', rowsPosted.length);
  }
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
