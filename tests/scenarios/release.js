const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js' };
const pad = n => (n < 10 ? '0' : '') + n, ymd = t => t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
const TODAY = ymd(new Date()), YEST = ymd(new Date(Date.now() - 864e5)); const now = Date.now(), M = 60000;
const base = () => ({ intake: {}, measure: {}, xray: { part: '왼손', done: false }, lab: { items: ['원내검사'], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} }, review: {}, exit: {}, report: {} });
const V = o => Object.assign({ sv: 2, card: '', appt: '', log: [{ s: 0, t: now - 50 * M }], createdAt: now - 90 * M, updatedAt: now - 60 * M, date: TODAY, rev: true }, base(), o);
const DB = new Map();
[V({ id: 'a', name: '어제아이', step: 4, date: YEST, card: 'C001', cardAt: now - 864e5 }), V({ id: 'b', name: '오늘진행', step: 3, card: 'C002', cardAt: now - 40 * M }),
 V({ id: 'c', name: '오늘귀가', step: 9, card: 'C003', cardAt: now - 80 * M })].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { if (val === null) delete o[k]; else o[k] = val; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) {
      if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '[]' });
      const b = JSON.parse(route.request().postData() || '{}'); let res = { status: 'ok' };
      if (b.action === 'flowlist') res = { status: 'ok', visits: [...DB.values()] };
      if (b.action === 'flowsave') { let v = DB.get(b.id); if (!v) { v = { id: b.id }; DB.set(b.id, v); } Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(res) });
    }
    if (u.startsWith('https://script.google.com/macros/s/')) { const b = JSON.parse(route.request().postData() || '{}'); const v = [...DB.values()].find(x => x.card === b.card);   // 날짜를 안 거르는 서버라고 가정
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', now: Date.now(), visit: v ? { name: v.name, step: v.step, date: v.date, draws: [] } : null }) }); }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW); await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded); await page.waitForTimeout(1800);
  console.log('server after sweep:', ['a', 'b', 'c'].map(i => i + ':' + JSON.stringify(DB.get(i).card) + '/was ' + (DB.get(i).cardWas || '-')).join('  '));
  console.log('next card:', await page.evaluate(() => nextCard()), '(C002 진행 중 → 이어서 C003 기대)');
  // 진행 중 아이를 귀가 처리
  await page.evaluate(() => { const v = S.items.get('b'); v.step = 9; put(v, true); }); await page.waitForTimeout(600);
  console.log('귀가 처리 후 b:', JSON.stringify(DB.get('b').card), 'was', DB.get('b').cardWas);
  for (const c of ['C001', 'C002', 'C003']) { const pp = await ctx.newPage(); await pp.goto('file://' + FLOW + '?c=' + c); await pp.waitForTimeout(1500); console.log('폰', c, '→', (await pp.locator('#kiosk').innerText()).split('\n')[0] + ' / ' + (await pp.locator('#kiosk').innerText()).split('\n')[1]); await pp.close(); }
  // 서버가 카드를 남겨 둔 채 귀가/전날 데이터를 돌려주는 경우도 폰에서 막힘
  DB.get('a').card = 'C009'; DB.get('c').card = 'C008'; DB.get('b').card = 'C007'; DB.get('b').step = 3; DB.get('b').date = TODAY;
  for (const c of ['C009', 'C008', 'C007']) { const pp = await ctx.newPage(); await pp.goto('file://' + FLOW + '?c=' + c); await pp.waitForTimeout(1500); console.log('폰(서버 안 거름)', c, '→', (await pp.locator('#kiosk').innerText()).replace(/\s+/g,' ').slice(0,150)); await pp.close(); }
  console.log('errors:', errs); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
