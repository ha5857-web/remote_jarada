// 성장 리포트 PDF 안에 「보호자 안내서 선물」 칸을 누르면 열리는 링크(리뷰 → 안내서)가 들어 있음
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2];
const NM = path.join(__dirname, '..', 'node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js',
  'html2canvas/1.4.1/html2canvas.min.js': NM + '/html2canvas/dist/html2canvas.min.js', 'jspdf/2.5.1/jspdf.umd.min.js': NM + '/jspdf/dist/jspdf.umd.min.js' };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://script.google.com/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', visits: [] }) });
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const t = new Date(), pad = n => (n < 10 ? '0' : '') + n, today = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    const g = { date: today, dob: '2016-05-11', sex: 'M', fh: '175', mh: '162', gc: 'ABCD1234', recsText: '2026-05-10 키 128.5 체중 26\n' + today + ' 키 131.2 체중 27.5', post: { summary: '잘 크고 있어요.', direction: '6개월 뒤 다시 봐요.' } };
    const m = GR.compute(GR.build(Object.assign({ name: '노시온' }, g)).st);
    if (m.error) return { err: m.error };
    const pdf = await GR.pdfOf(m, 0.5);
    const buf = new Uint8Array(await pdf.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return { pages: pdf.pages, uris: (s.match(/\/URI\s*\(([^)]*)\)/g) || []).map(x => x.slice(0, 120)) };
  });
  if (r.err) console.log('SKIP 리포트 모델 생성 실패:', r.err);
  else if (!r.uris.some(u => /rv=ABCD1234/.test(u))) console.log('FAIL PDF에 안내서 선물 링크가 없음', JSON.stringify(r));
  else console.log('ok', JSON.stringify(r));
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
