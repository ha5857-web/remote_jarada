const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2], OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js' };
const d = new Date(), pad = n => (n < 10 ? '0' : '') + n, TODAY = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = Date.now(), M = 60000;
const base = () => ({ intake: {}, measure: {}, xray: { part: '왼손', done: false }, lab: { items: ['원내검사'], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} }, review: {}, exit: { paid: true, guide: true }, report: { sent: true } });
const V = o => Object.assign({ sv: 2, card: '', appt: '', log: [{ s: 0, t: now - 90 * M }, { s: 10, t: now - 30 * M }], createdAt: now - 90 * M, updatedAt: now - 60 * M, date: TODAY, rev: true }, base(), o);
const DB = new Map();
[V({ id: 'p1', name: '홍길순', age: 10, sex: '여', chartNo: '101001', step: 10, sameDay: true }),
 V({ id: 'p2', name: '노시온', age: 10, sex: '남', chartNo: '101700', step: 10 }),
 V({ id: 'p3', name: '이규현', age: 13, sex: '남', chartNo: '101707', step: 3, log: [{ s: 0, t: now - 20 * M }] })].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
const LOG = [];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) {
      if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '[]' });
      const b = JSON.parse(route.request().postData() || '{}'); LOG.push(b.action + ':' + (b.id || ''));
      let res = { status: 'ok' };
      if (b.action === 'flowlist') res = { status: 'ok', visits: [...DB.values()] };
      if (b.action === 'flowdelete') { await new Promise(r => setTimeout(r, 1500)); DB.delete(b.id); }
      if (b.action === 'flowsave') { let v = DB.get(b.id); if (!v) { v = { id: b.id }; DB.set(b.id, v); } Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(res) });
    }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  await page.waitForTimeout(400);
  console.log('X buttons:', await page.locator('.card .cx').count(), '(exit column only; p3 at step 3 has none:', await page.locator('.card[data-sel="p3"] .cx').count() === 0, ')');
  await page.setViewportSize({width:1500,height:900}); const col=page.locator('.card[data-sel="p1"]').locator('xpath=..'); await col.screenshot({ path: OUT + '/x_card.png' });
  await page.click('.card[data-sel="p2"] .cx');
  await page.waitForTimeout(200);
  console.log('after X: p2 card gone:', await page.locator('.card[data-sel="p2"]').count() === 0, '· detail opened?', await page.evaluate(() => UI.sel), '· toast:', await page.locator('#undo').innerText());
  await page.evaluate(() => poll()); await page.waitForTimeout(300);
  console.log('poll during pending delete → still gone:', await page.locator('.card[data-sel="p2"]').count() === 0);
  await page.waitForTimeout(1600);
  console.log('server deleted p2:', !DB.has('p2'));
  // 되돌리기 (p1)
  await page.click('.card[data-sel="p1"] .cx'); await page.waitForTimeout(200);
  console.log('2nd: p1 gone', await page.locator('.card[data-sel="p1"]').count()===0, 'toast:', JSON.stringify(await page.locator('#undo').innerText()), 'hidden', await page.evaluate(()=>document.getElementById('undo').hidden), 'cards', await page.locator('.card .cx').count());
  await page.click('#undo .tu');
  for (let i=0;i<6;i++){ await page.waitForTimeout(400); console.log('  t'+i, JSON.stringify(await page.evaluate(()=>({has:S.items.has('p1'),synced:!!S.synced.p1,timer:!!S.timers.p1,busy:S.busy.p1,gone:!!(S.gone&&S.gone.p1)}))), LOG.slice(-2).join(',')); }
  console.log('undo → p1 card back:', await page.locator('.card[data-sel="p1"]').count() === 1, '· server has p1 again:', DB.has('p1'), (DB.get('p1') || {}).name, '· step', (DB.get('p1') || {}).step);
  await page.evaluate(() => poll()); await page.waitForTimeout(400);
  console.log('after poll p1 still there:', await page.locator('.card[data-sel="p1"]').count() === 1);
  console.log('calls:', LOG.filter(x => !/flowlist/.test(x)).join(', '));
  console.log('errors:', errs);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
