// 내원 없이 원장 앱에서 보낸 리포트(printOnly)가 flow 성장 리포트 「인쇄 대기」에 뜨고 현황판엔 안 뜸
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
[V({ id: 'a', name: '조하연', age: 9, sex: '여', chartNo: '100129', step: 1, card: 'C001', cardAt: now - 25 * M, log: [{ s: 0, t: now - 25 * M }] }),
 { id: 'pr_x', sv: 2, name: '인쇄전용', chartNo: '100777', sex: '여', age: '', card: '', appt: '', step: 10, log: [], createdAt: now, date: '2020-01-01', printOnly: true,
   gr: { ready: true, reviewed: true, reviewedAt: now, name: '인쇄전용', date: TODAY, post: { summary: '요약' } } }].forEach(v => DB.set(v.id, v));
function handle(b) {
  if (b.action === 'flowlist') return { status: 'ok', visits: [...DB.values()] };
  return { status: 'ok' };
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); window.print = () => {}; });
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
  const board = await page.evaluate(() => document.querySelector('#main-view').innerText);
  console.log('현황판에 인쇄전용 표시:', /인쇄전용/.test(board));
  if (/인쇄전용/.test(board)) console.log('FAIL 현황판에 보이면 안 됨');
  const cnt = await page.evaluate(() => FR.queueCount());
  const html = await page.evaluate(() => FR.listHtml());
  console.log('인쇄 대기 수:', cnt, '· 리포트 탭에 표시:', /인쇄전용/.test(html), /내원 없이 인쇄/.test(html));
  if (cnt !== 1 || !/인쇄전용/.test(html)) console.log('FAIL 인쇄 대기에 떠야 함');
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
