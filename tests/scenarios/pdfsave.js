// 보호자 폰은 찍은 카드의 아이 한 명만: 같은 휴대폰으로 C001 → C003 을 찍어도 C003 화면에 C001 아이(이름·탭·채혈 알람)가 뜨지 않음
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2], OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js' };
const pad = n => (n < 10 ? '0' : '') + n, ymd = t => t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
const TODAY = ymd(new Date()), now = Date.now(), M = 60000;
const PDF64 = 'JVBERi0xLjQKJSB0ZXN0IHJlcG9ydAo=';
const KIDS = { C001: { name: '한가람', step: 8, date: TODAY, since: now - 5 * M, vids: '', first: false, draws: [] } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('jrd_my_kids', JSON.stringify({ P1: { t: Date.now() } })); } catch (e) {} });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://script.google.com/macros/s/')) {
      if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify([
        { id: 'fvr_P1_a_0', pid: 'P1', type: 'fvreport', timestamp: '2026-11-25T03:00:00Z', question: JSON.stringify({ v: 1, set: 'a', i: 0, n: 1, name: 'report_test.pdf', size: 24, data: PDF64 }) },
        { id: 'fvr_P2_a_0', pid: 'P2', type: 'fvreport', timestamp: '2026-11-25T03:00:00Z', question: JSON.stringify({ v: 1, set: 'z', i: 0, n: 1, name: '다른아이.pdf', size: 24, data: PDF64 }) }]) });
      const b = JSON.parse(route.request().postData() || '{}');
      if (b.action === 'flowme') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', now: Date.now(), visit: KIDS[b.card] || null }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const errs = [];
  const open = async c => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); await p.goto('file://' + FLOW + '?c=' + c); await p.waitForTimeout(3000); return p; };
  const pv = await open('C001');
  await pv.evaluate(() => pmPdfSync(true)); await pv.evaluate(() => pmRender(true, true)); await pv.waitForTimeout(300);
  const saved = await pv.evaluate(() => Object.keys(pmPdfAll()).join());
  if (saved !== 'P1') console.log('FAIL 이 휴대폰의 아이(P1)만 저장돼야 함', saved);
  if (!(await pv.locator('[data-pmpdf="P1"]').count())) console.log('FAIL 귀가 단계에 PDF 받기 단추가 없음');
  const [dl] = await Promise.all([pv.waitForEvent('download', { timeout: 5000 }).catch(() => null), pv.click('[data-pmpdf="P1"]')]);
  if (!dl) console.log('FAIL PDF가 내려받아지지 않음'); else if (!/\.pdf$/.test(dl.suggestedFilename())) console.log('FAIL 파일 이름', dl.suggestedFilename());
  // 다음 날: 같은 카드(C001)를 다른 아이가 받음 → 우리 아이 PDF는 그대로 열림
  KIDS.C001 = { name: '다른아이', step: 0, date: TODAY, since: now, vids: '', first: false, draws: [] };
  await pv.evaluate(() => { return pmLoad(); }); await pv.waitForTimeout(500); await pv.evaluate(() => pmRender(true, true));
  const still = await pv.evaluate(() => ({ cached: !!pmPdfAll().P1, btn: !!document.querySelector('[data-pmpdf="P1"]') }));
  if (!still.cached) console.log('FAIL 카드가 다른 아이에게 넘어가자 저장된 PDF가 사라짐');
  console.log('cachedname', await pv.evaluate(() => (pmPdfAll().P1||{}).name)); console.log('after-reassign', JSON.stringify(still), 'errors', JSON.stringify(errs));
  await browser.close();
})();
