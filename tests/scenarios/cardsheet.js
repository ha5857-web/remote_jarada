// 카드 시트: 앞 번호 여분(같은 번호 여러 장) 확인
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2], OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js' };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', visits: [] }) });
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  await page.evaluate(() => { UI.view = 'cards'; renderAll(true); });
  await page.waitForSelector('[data-cc="cmax"]');
  const sum = async () => (await page.locator('#cards-preview p').first().innerText()).replace(/\s+/g, ' ');
  const counts = () => page.evaluate(() => { const m = {}; cardCodes().forEach(c => m[c] = (m[c] || 0) + 1); return m; });
  console.log('default:', await sum());
  let m = await counts(); console.log('   C001', m.C001, 'C010', m.C010, 'C011', m.C011, 'C021', m.C021, 'C031', m.C031, 'C040', m.C040, '| total', Object.values(m).reduce((a, b) => a + b, 0));
  console.log('   preview cells:', await page.locator('#cards-preview .qc').count(), '· buttons:', await page.locator('[data-act="save-sheet"]').allInnerTexts());
  await page.screenshot({ path: OUT + '/cs_1_default.png', fullPage: true });
  // 저장 시트 1, 마지막
  for (const pg of [0, 2]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`[data-act="save-sheet"][data-page="${pg}"]`)]);
    const f = OUT + '/' + dl.suggestedFilename(); await dl.saveAs(f);
    const svg = fs.readFileSync(f, 'utf8'); const labels = [...svg.matchAll(/>(C\d{3})</g)].map(x => x[1]);
    console.log('   saved', dl.suggestedFilename(), '· labels', labels.length, labels.slice(0, 6).join(','), '…', labels.slice(-3).join(','));
  }
  for (const v of ['1', '6', '2']) {
    await page.selectOption('[data-cc="cmax"]', v); await page.waitForTimeout(100);
    console.log('cmax=' + v + ':', await sum());
  }
  await page.fill('[data-cc="ccount"]', '100'); await page.dispatchEvent('[data-cc="ccount"]', 'input'); await page.waitForTimeout(100);
  await page.selectOption('[data-cc="cmax"]', '4'); await page.waitForTimeout(100);
  console.log('100 numbers, cmax=4:', await sum());
  await page.fill('[data-cc="ccount"]', '300'); await page.dispatchEvent('[data-cc="ccount"]', 'input'); await page.selectOption('[data-cc="cmax"]', '6'); await page.waitForTimeout(100);
  m = await counts(); console.log('300 numbers, cmax=6:', await sum(), '| total', Object.values(m).reduce((a, b) => a + b, 0), '· last number C300 present:', !!m.C300);
  await page.fill('[data-cc="ccount"]', '7'); await page.dispatchEvent('[data-cc="ccount"]', 'input'); await page.selectOption('[data-cc="cmax"]', '4'); await page.waitForTimeout(100);
  console.log('7 numbers, cmax=4:', await sum());
  console.log('errors:', errs); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
