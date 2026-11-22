// 3D 동선 지도: 환자를 끌어 진료실에 놓으면 진료 단계(7)로 이동
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
[V({ id: 'a', name: '조하연', age: 9, sex: '여', chartNo: '100129', step: 0, log: [{ s: 0, t: now - 25 * M }] })].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
function handle(b) {
  if (b.action === 'flowlist') return { status: 'ok', visits: [...DB.values()] };
  if (b.action === 'flowsave') { const v = DB.get(b.id); if (v) Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); }
  return { status: 'ok' };
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) { let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(handle(b)) }); }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded); await page.waitForTimeout(500);
  await page.click('.tabs button[data-view="map"]'); await page.waitForTimeout(2500);
  const ok = await page.evaluate(() => !!(M3 && M3.inited && M3.avs.size));
  console.log('3D 지도 준비:', ok);
  if (!ok) { console.log('SKIP WebGL 없음'); await browser.close(); return; }
  const pos = await page.evaluate(([x, y]) => {
    const av = M3.avs.get('a'), b = M3.canvas.getBoundingClientRect();
    const sp = pt => { const v = pt.clone().project(M3.cam); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height } };
    const from = sp(new THREE.Vector3(av.g.position.x, 2, av.g.position.z)), to = sp(new THREE.Vector3((x - 380) / 10, 0, (y - 245) / 10));
    return { from, to };
  }, [640, 300]);
  await page.mouse.move(pos.from.x, pos.from.y); await page.mouse.down();
  await page.mouse.move((pos.from.x + pos.to.x) / 2, (pos.from.y + pos.to.y) / 2, { steps: 6 }); await page.mouse.move(pos.to.x, pos.to.y, { steps: 6 });
  await page.mouse.up(); await page.waitForTimeout(800);
  console.log('드래그 후 단계:', DB.get('a').step, '(진료=7)');
  if (DB.get('a').step !== 7) console.log('FAIL 진료실에 놓으면 7단계여야 함');
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
