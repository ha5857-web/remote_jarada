// 환자 상세 머리줄의 남/여 단추: 눌러서 성별을 고치면 서버에 저장되고, 당일 기본 영상·성장 리포트 성별도 함께 바뀜
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
[V({ id: 'a', name: '김로건', age: 6, sex: '여', chartNo: '105001', appt: '12:20', vids: '123', vidsSrc: 'default', gr: { sex: 'F', date: TODAY } }),
 V({ id: 'b', name: '이새벽', age: '', sex: '', chartNo: '105002' })].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
function handle(b) {
  switch (b.action) {
    case 'flowlist': return { status: 'ok', visits: [...DB.values()] };
    case 'flowsave': { let v = DB.get(b.id); if (!v) { v = { id: b.id }; DB.set(b.id, v); } Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); return { status: 'ok' }; }
    case 'flowlookup': return { status: 'ok', matches: [] };
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
  page.on('dialog', dl => { errs.push('dialog: ' + dl.message()); dl.dismiss(); });
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  await page.evaluate(() => { UI.sel = 'a'; renderAll(true); });
  const sw = '#detail .sexsw';
  await page.waitForSelector(sw);
  const before = await page.$eval(sw, e => [...e.querySelectorAll('button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join(','));
  console.log('처음:', before);
  if (before !== '남,여*') console.log('FAIL 처음 성별(여)이 단추에 표시되지 않음');
  await page.click(sw + ' button[data-s="남"]');
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => { const v = S.items.get('a'); return { sex: v.sex, vids: v.vids, gr: v.gr && v.gr.sex, on: [...document.querySelectorAll('#detail .sexsw button.on')].map(b => b.textContent).join('') }; });
  console.log('누른 뒤:', JSON.stringify(after), '서버:', JSON.stringify({ sex: DB.get('a').sex, vids: DB.get('a').vids, gr: DB.get('a').gr && DB.get('a').gr.sex }));
  if (after.sex !== '남' || after.on !== '남') console.log('FAIL 성별이 남으로 바뀌지 않음');
  if (DB.get('a').sex !== '남') console.log('FAIL 서버에 바뀐 성별이 저장되지 않음');
  if (after.vids !== '12') console.log('FAIL 당일 기본 영상이 남아 6세 기준(12)으로 바뀌지 않음');
  if (after.gr !== 'M') console.log('FAIL 성장 리포트 성별이 함께 바뀌지 않음');
  const card = await page.evaluate(() => document.querySelector('[data-sel="a"]') ? document.querySelector('[data-sel="a"]').textContent : '');
  if (!/남/.test(card)) console.log('FAIL 현황판 카드에 바뀐 성별이 보이지 않음');
  await page.evaluate(() => { UI.sel = 'b'; renderAll(true); });
  await page.click(sw + ' button[data-s="여"]'); await page.waitForTimeout(800);
  if (DB.get('b').sex !== '여') console.log('FAIL 성별이 비어 있던 아이에게 성별을 넣지 못함');
  await page.evaluate(() => { UI.sel = 'a'; renderAll(true); });
  await page.screenshot({ path: OUT + '/sexswitch.png', clip: { x: 0, y: 0, width: 1500, height: 500 } });
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
