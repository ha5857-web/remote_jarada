// 지난 날 이 폰이 C001(다른 아이)을 찍은 기록이 있어도, 「오늘 받은 카드예요」를 누르면 오늘 아이 화면으로
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js' };
const pad = n => (n < 10 ? '0' : '') + n, ymd = t => t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
const TODAY = ymd(new Date()), now = Date.now(), M = 60000;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('jrd_pm_hist')) localStorage.setItem('jrd_pm_hist', JSON.stringify({ C001: { nm: '옛아이', date: '2020-01-01' } })); } catch (e) {} });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://script.google.com/macros/s/')) {
      const b = JSON.parse(route.request().postData() || '{}');
      if (b.action === 'flowme') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', now: Date.now(), visit: { name: '조하연', step: 1, date: TODAY, since: now - 5 * M, vids: '', draws: [] } }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + FLOW + '?c=C001'); await p.waitForTimeout(2500);
  const t1 = await p.evaluate(() => document.querySelector('#kiosk').innerText);
  console.log('처음:', /지난 진료 때 받으신/.test(t1) ? '지난 진료 화면' : t1.slice(0, 60));
  if (!/지난 진료 때 받으신/.test(t1) || !/오늘 받은 카드예요/.test(t1)) console.log('FAIL 안내와 단추가 보여야 함');
  await p.click('#pm-today'); await p.waitForTimeout(1500);
  const t2 = await p.evaluate(() => document.querySelector('#kiosk').innerText);
  console.log('누른 뒤:', /조하연/.test(t2) ? '조하연 화면' : t2.slice(0, 80));
  if (!/조하연/.test(t2) || /지난 진료 때 받으신/.test(t2)) console.log('FAIL 오늘 아이 화면으로 바뀌어야 함');
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
