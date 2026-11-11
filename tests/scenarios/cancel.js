// 예약 칸 카드 × : 숨김 저장 → 새로고침(오늘 예약 자동 불러오기)해도 다시 안 생김, 되돌리기, 다른 기기
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2], OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js' };
const d = new Date(), pad = n => (n < 10 ? '0' : '') + n, TODAY = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = Date.now(), M = 60000;
const base = () => ({ intake: {}, measure: {}, xray: { part: '왼손', done: false }, lab: { items: ['원내검사'], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} }, review: {}, exit: { paid: true, guide: true }, report: { sent: true } });
const V = o => Object.assign({ sv: 2, card: '', appt: '', log: [], createdAt: now - 90 * M, updatedAt: now - 60 * M, date: TODAY, rev: true }, base(), o);
const DB = new Map();
const R = (k, name, t) => V({ id: 'resv_' + TODAY + '_' + k, name, chartNo: k, age: 10, sex: '남', appt: t, step: -1, fromResv: true });
[R('101691', '유환빈', '09:00'), R('101360', '신민솔', '09:20'), R('100743', '조규빈', '09:30'),
 V({ id: 'p3', name: '이규현', age: 13, sex: '남', chartNo: '101707', step: 3, log: [{ s: 0, t: now - 20 * M }] }),
 V({ id: 'p9', name: '노시온', age: 10, sex: '남', chartNo: '101700', step: 10, log: [{ s: 0, t: now - 90 * M }, { s: 10, t: now - 30 * M }] })].forEach(v => DB.set(v.id, v));
const RESV = { v: 2, set: 's1', data: [['101691', '유환빈', '09:00'], ['100743', '조규빈', '09:30'], ['101360', '신민솔', '09:20']].slice(0,2).map(r => TODAY + '|' + r.join('|')).join('\n') };
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
const LOG = [];
(async () => {
  const browser = await chromium.launch();
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
    await ctx.addInitScript(r => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); localStorage.setItem('jrd_todayresv', r); }, JSON.stringify(RESV));
    await ctx.route('**/*', async route => {
      const u = route.request().url();
      if (u.startsWith('https://api.test/')) {
        if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: '[]' });
        const b = JSON.parse(route.request().postData() || '{}'); if (b.action !== 'flowlist') LOG.push(b.action + ':' + (b.id || '') + (b.patch ? JSON.stringify(b.patch) : ''));
        let res = { status: 'ok' };
        if (b.action === 'flowlist') res = { status: 'ok', visits: [...DB.values()] };
        if (b.action === 'flowdelete') DB.delete(b.id);
        if (b.action === 'flowsave') { let v = DB.get(b.id); if (!v) { v = { id: b.id }; DB.set(b.id, v); } Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(res) });
      }
      for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
      if (u.startsWith('file:')) return route.continue();
      return route.fulfill({ status: 204, body: '' });
    });
    return ctx;
  };
  const ctx = await mk();
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded); await page.waitForTimeout(400);
  const has = id => page.locator(`.card[data-sel="${id}"]`).count();
  const ids = { a: 'resv_' + TODAY + '_101691', b: 'resv_' + TODAY + '_101360', c: 'resv_' + TODAY + '_100743' };
  await page.waitForTimeout(3500);
  console.log('명단에서 빠진 신민솔(B):', 'shown', await has(ids.b), '· hidden on server', !!DB.get(ids.b).hide, '· 유환빈 shown', await has(ids.a), '· 조규빈 shown', await has(ids.c), '· 진행중 p3 shown', await has('p3'));
  console.log('calls:', LOG.map(x => x.slice(0, 90)).join('\n  '));
  console.log('errors:', errs);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
