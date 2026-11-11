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
const Y = new Date(Date.now()-864e5), YD = Y.getFullYear()+'-'+pad(Y.getMonth()+1)+'-'+pad(Y.getDate());
const noLab = { lab: { items: [], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} } };
[V({ id: 'p1', name: '오늘완료', step: 10, chartNo: '1' }),
 V({ id: 'p2', name: '어제완료결과대기', step: 10, date: YD, createdAt: now - 864e5, chartNo: '2' }),
 V(Object.assign({ id: 'p3', name: '어제완료', step: 10, date: YD, createdAt: now - 864e5, chartNo: '3' }, noLab)),
 V({ id: 'p4', name: '어제진행중', step: 3, date: YD, createdAt: now - 864e5, chartNo: '4' }),
 V({ id: 'p5', name: '오늘진행중', step: 3, chartNo: '5' })].forEach(v => DB.set(v.id, v));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) {
      if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '[]' });
      const b = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(b.action === 'flowlist' ? { status: 'ok', visits: [...DB.values()] } : { status: 'ok' }) });
    }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded); await page.waitForTimeout(400);
  const cards = await page.$$eval('.board .card .nm', els => els.map(e => e.textContent.trim().split(/\s/)[0]));
  console.log('board cards:', cards.join(', '));
  console.log('notify box:', (await page.locator('.nbox').innerText().catch(() => '(none)')).replace(/\n+/g, ' / '));
  console.log('summary:', (await page.locator('#summary').innerText()).replace(/\n+/g, ' '));
  await page.evaluate(() => { const v = S.items.get('p2'); v.log = [{ s: 0, t: Date.now() - 864e5 }, { s: 8, t: Date.now() - 864e5 + 3600e3 }, { s: 10, t: Date.now() - 864e5 + 4000e3 }]; v.lab.results = { '원내검사': '정상' }; v.lab.at = { '원내검사': Date.now() }; put(v, true); renderAll(true); });
  await page.waitForTimeout(300);
  console.log('old kid with results in → notify box:', (await page.locator('.nbox').innerText().catch(() => '(none)')).replace(/\n+/g, ' / '));
  console.log('errors:', errs);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
