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
  
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://script.google.com/macros/s/')) {
      if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify([
        { id: 'fvr_card-C001_x_0', pid: 'card-C001', type: 'fvreport', timestamp: '2026-11-25T03:00:00Z', question: JSON.stringify({ v: 1, set: Date.now().toString(36), i: 0, n: 1, name: 'report_test.pdf', size: 24, data: PDF64 }) },
        { id: 'fvr_card-C002_a_0', pid: 'card-C002', type: 'fvreport', timestamp: '2026-11-25T03:00:00Z', question: JSON.stringify({ v: 1, set: 'z', i: 0, n: 1, name: '다른아이.pdf', size: 24, data: PDF64 }) }]) });
      const b = JSON.parse(route.request().postData() || '{}');
      if (b.action === 'flowme') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', now: Date.now(), visit: KIDS[b.card] || null }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    }
    if (u.includes('pdf.js/3.11.174/pdf.min.js')) return route.fulfill({ contentType: 'application/javascript', body: "window.pdfjsLib={GlobalWorkerOptions:{},getDocument:function(){return{promise:Promise.resolve({numPages:2,getPage:function(){return Promise.resolve({getViewport:function(o){return{width:600*o.scale,height:800*o.scale}},render:function(){return{promise:Promise.resolve()}}})}})}}};" });
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const errs = [];
  const open = async c => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); await p.goto('file://' + FLOW + '?c=' + c); await p.waitForTimeout(3000); return p; };
  const pv = await open('C001');
  await pv.evaluate(() => { PM.pdfAt = 0; });   // 첫 자동 가져오기 전에 단추를 눌러 봄
  if (await pv.locator('[data-pmpdf-sync]').count()) { await pv.click('[data-pmpdf-sync]'); await pv.waitForTimeout(800); }
  const saved = await pv.evaluate(() => Object.keys(pmPdfAll()).join());
  if (!/^card-C001:/.test(saved) || saved.indexOf(',') >= 0) console.log('FAIL 이 카드(C001)로 올라온 리포트만 저장돼야 함', saved);
  const key = saved.split(',')[0];
  if (!(await pv.locator('[data-pmview]').count())) console.log('FAIL 지금 가져오기를 눌러도 리포트 열기 단추가 안 생김');
  const [dl] = await Promise.all([pv.waitForEvent('download', { timeout: 5000 }).catch(() => null), pv.click('[data-pmpdf]')]);
  if (!dl) console.log('FAIL PDF가 내려받아지지 않음'); else if (!/\.pdf$/.test(dl.suggestedFilename())) console.log('FAIL 파일 이름', dl.suggestedFilename());
  // 리포트 열람 → 닫으면 네이버 리뷰로 이어지는 창
  await pv.click('[data-pmview]'); await pv.waitForSelector('#pm-rv canvas', { timeout: 5000 }).catch(() => {});
  const nc = await pv.locator('#pm-rv canvas').count(); if (nc !== 2) console.log('FAIL 리포트가 화면에서 열리지 않음 (쪽 수)', nc);
  await pv.click('#pm-rvdone');
  const rv = await pv.evaluate(() => { const a = document.querySelector('#pm-rvsheet #pm-rvgo'); return a ? a.getAttribute('href') : ''; });
  if (!/review\.html|rv=/.test(rv)) console.log('FAIL 리포트를 닫아도 네이버 리뷰로 이어지지 않음', rv);
  if (await pv.locator('#pm-rv').count()) console.log('FAIL 닫았는데 리포트 화면이 남음');
  await pv.click('#pm-rvlater');
  // 다음 날: 같은 카드(C001)를 다른 아이가 받음 → 우리 아이 PDF는 그대로 열림
  KIDS.C001 = { name: '다른아이', step: 0, date: TODAY, since: now, vids: '', first: false, draws: [] };
  await pv.evaluate(() => { return pmLoad(); }); await pv.waitForTimeout(500); await pv.evaluate(() => pmRender(true, true));
  const still = await pv.evaluate(() => ({ cached: Object.keys(pmPdfAll()).length === 1, btn: !!document.querySelector('#kiosk [data-pmpdf]') }));
  if (!still.cached || !still.btn) console.log('FAIL 카드가 다른 아이에게 넘어가자 저장된 PDF가 사라짐', JSON.stringify(still));
  console.log('cachedname', await pv.evaluate(() => Object.keys(pmPdfAll()).join())); console.log('after-reassign', JSON.stringify(still), 'errors', JSON.stringify(errs));
  await browser.close();
})();
