// 진료 순서: 대기 → 계측 → 진료(검사 전) → X-ray·채혈 → 결과 대기 → 진료(결과 확인) → 귀가. 검사 전 진료는 다음 검사 단계에 「진료실」로 표시
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
[V({ id: 'a', name: '조하연', age: 9, sex: '여', chartNo: '100129', step: 3, log: [{ s: 0, t: now - 25 * M }, { s: 3, t: now - 10 * M }] }),
 V({ id: 'b', name: '문다은', age: 10, sex: '남', chartNo: '100498', step: 0, log: [{ s: 0, t: now - 5 * M }] })].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
function handle(b) {
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
    if (u.startsWith('https://api.test/')) { let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(handle(b)) }); }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded); await page.waitForTimeout(500);
  const st = id => page.evaluate(i => { const v = S.items.get(i); return { step: v.step, room: roomOf(v), label: stepLabel(v), c1: !!v.c1Done }; }, id);
  const chk = (name, got, step, room, label) => { if (got.step !== step || got.room !== room || got.label !== label) console.log('FAIL', name, JSON.stringify(got), '기대', step, room, label); };
  // 계측이 끝나면 → 진료(검사 전)
  await page.evaluate(() => advance(S.items.get('a'), true)); chk('계측 후 검사 전 진료', await st('a'), 4, 'doctor', '진료 (검사 전)');
  // 진료가 끝나면 → X-ray
  await page.evaluate(() => advance(S.items.get('a'), true)); chk('진료 후 X-ray', await st('a'), 4, 'xray', 'X-ray');
  await page.evaluate(() => { advance(S.items.get('a'), true); advance(S.items.get('a'), true); advance(S.items.get('a'), true); }); chk('검사 후 결과 확인(진료)', await st('a'), 7, 'doctor', '결과 확인');
  // 대기 중인 아이를 진료실에 놓으면 검사 전 진료, 진료실에서 검사실로 옮기면 진료 끝
  await page.evaluate(() => moveToRoom(S.items.get('b'), 'doctor')); chk('대기→진료실', await st('b'), 4, 'doctor', '진료 (검사 전)');
  await page.evaluate(() => moveToRoom(S.items.get('b'), 'lab')); const b2 = await st('b'); chk('진료실→채혈실', b2, 5, 'lab', '채혈'); if (!b2.c1) console.log('FAIL 검사 전 진료 완료 표시 없음');
  await page.evaluate(() => moveToRoom(S.items.get('b'), 'doctor')); chk('검사 후 진료실', await st('b'), 7, 'doctor', '결과 확인');
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
