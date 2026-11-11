// 진료 전 가안 일괄 / 진료 후 비교 / 검사 영상 / 당일 초진 등록 / 카메라 카드 연결 / 기존 카드 QR / 환자 폰
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2], OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js',
  'html2canvas/1.4.1/html2canvas.min.js': NM + '/html2canvas/dist/html2canvas.min.js', 'jspdf/2.5.1/jspdf.umd.min.js': NM + '/jspdf/dist/jspdf.umd.min.js', 'jsqr@1.4.0/dist/jsQR.js': NM + '/jsqr/dist/jsQR.js' };
const DEF_ID = 'AKfycbzTNYUR8rlsZSmQl1AQrIkB-HGARhUQDwP4nrDFti3R7-ip4ipRGOqk4lVfVZpIFSwONg';
const d = new Date(), pad = n => (n < 10 ? '0' : '') + n, ymd = t => t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
const TODAY = ymd(d), YEST = ymd(new Date(Date.now() - 864e5));
const now = Date.now(), M = 60000;
const base = () => ({ intake: { chief: '', purpose: '성장 평가', fatherH: '', motherH: '', history: '', signs: '', consent: false }, measure: { height: '', weight: '' },
  xray: { part: '왼손', done: false, note: '' }, lab: { items: ['원내검사'], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} },
  review: { boneAge: '', note: '', next: '' }, exit: { paid: false, guide: false }, report: { sent: false } });
const V = o => Object.assign({ sv: 2, card: '', appt: '', log: [], createdAt: now - 90 * M, updatedAt: now - 60 * M, date: TODAY, rev: true }, base(), o);
const DB = new Map();
[V({ id: 'p1', name: '홍지우', age: 7, sex: '여', chartNo: '101834', appt: '10:00', step: -1, dob: '2019-03-02', rev: false, first: true }),
 V({ id: 'p2', name: '노시온', age: 10, sex: '남', chartNo: '101700', appt: '10:10', step: -1, dob: '2016-05-11' }),
 V({ id: 'p3', name: '안유주', age: 9, sex: '여', chartNo: '102304', appt: '10:20', step: 0, dob: '2017-01-20', log: [{ s: 0, t: now - 10 * M }] }),
 V({ id: 'p4', name: '이규현', age: 13, sex: '남', chartNo: '101707', appt: '10:30', step: -1, dob: '2013-02-14' }),
 V({ id: 'old1', name: '어제아이', age: 8, sex: '남', chartNo: '100001', step: 3, date: YEST, createdAt: now - 864e5, card: 'C009' }),
].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
function handle(b) {
  switch (b.action) {
    case 'flowlist': return { status: 'ok', visits: [...DB.values()] };
    case 'flowsave': { let v = DB.get(b.id); if (!v) { v = { id: b.id }; DB.set(b.id, v); } Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); return { status: 'ok' }; }
    case 'flowlookup': return { status: 'ok', matches: b.chartNo === '103555' ? [{ name: '김새봄', age: 6, sex: '여', chartNo: '103555', first: true, vids: '172', phoneTail: '1234' }] : [] };
    case 'flowprepare': return b.chartNo === '103555' ? { status: 'ok', source: 'intake', identity: { dob: '2020-04-01', sex: 'F' }, vids: '172' } : { status: 'ok', source: 'patient', identity: {} };
    case 'generatefirstvisitchart': { const post = /오늘 새로 추가된/.test(b.added || ''); return { via: 'jarada-codegs', status: 'ok', data: {
      summary: (post ? '오늘 진료: ' : '지난 진료 기준 가안: ') + b.name, labs: post ? 'LHRH 자극검사를 했어요. 결과는 나오면 알려 드릴게요.' : '', xray: '뼈나이는 실제 나이와 비슷해요.',
      direction: post ? '3개월 뒤 다시 봐요.' : '6개월 뒤 다시 봐요.', exercise: '줄넘기', nutrition: '우유', sleep: '10시' } }; }
    default: return { status: 'ok' };
  }
}
const oldChart = (no, extra) => `등록번호 ${no}\n#SMR(): (Tanner 1)\n#CA/BA: (9.06)/(9.03)\n#Plan: 6개월 후 f/u ${extra || ''}\n등록일자\tAGE\tBA\tWT\tHT\tBMI\n2025-11-05\t9.06\t9.03\t30.1(45.2)\t134.0(48.1)\t16.8(44.0)\n`;
const postChart = (no) => oldChart(no) + `${TODAY}\t10.05\t10.03\t33.4(47.0)\t139.6(50.2)\t17.1(46.3)\n#Lab: LHRH 자극검사 시행 (오늘)\n#Plan2: 3개월 후 f/u, 결과 설명 예정\n`;
const intake = (nameLine, no) => `${no ? '등록번호 ' + no + '\n' : ''}${nameLine}\n(38+2) week 출생\n부: 175cm  모: 160cm\n최근 성장 기록: 2026-10-15 키 (112.0)cm 몸무게 (19.0)kg\n희망 키: 165cm\n걱정거리: 키가 작아요\n#SMR(): ( )\n#Plan:`;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); });
  await ctx.route('**/*', async route => { const u = route.request().url();
    if (u.startsWith('https://api.test/')) { const b = JSON.parse(route.request().postData() || '{}'); if (b.action === 'generatefirstvisitchart') await new Promise(r => setTimeout(r, 1200)); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(handle(b)) }); }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue(); return route.fulfill({ status: 204, body: '' }); });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + FLOW); await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  const paste = txt => page.evaluate(t => { const dt = new DataTransfer(); dt.setData('text/plain', t); (document.activeElement || document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, txt);
  // ① 현황판에서 지난 차트 붙여넣기 → 창이 바로 열림
  await paste(oldChart('101700'));
  await page.waitForSelector('#grov', { timeout: 3000 });
  console.log('① 창 열림:', await page.locator('.grbar b').first().innerText());
  // 정리 중에 다음 아이 차트 → 그 아이 창으로 넘어감
  await page.waitForTimeout(300);
  await paste(oldChart('101707'));
  await page.waitForTimeout(300);
  console.log('   넘어간 창:', await page.locator('.grbar b').first().innerText());
  await page.waitForFunction(() => { const b = document.getElementById('fr-okbtn'); return b && !b.disabled; }, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('   각자 저장:', await page.evaluate(() => ['p2', 'p4'].map(i => S.items.get(i).name + '=' + (S.items.get(i).gr || {}).post?.summary).join(' | ')));
  await page.click('[data-fr="close"]');
  await page.screenshot({ path: OUT + '/o1_board.png' });
  // ② 현황판 카드의 「📝 가안」 눌러서 열기
  await page.click('[data-act="gr-open"][data-id="p2"]');
  await page.waitForSelector('#grov'); console.log('② 카드 표시로 열림:', await page.locator('.grbar b').first().innerText());
  await page.click('[data-fr="close"]');
  // ③ 예약 아이 상세 화면 맨 위 버튼
  await page.click('[data-sel="p1"]');
  console.log('③ 상세 버튼:', await page.locator('#detail [data-act="gr-open"]').first().innerText());
  await page.click('#detail [data-act="gr-open"]');
  await page.waitForSelector('#grov'); console.log('   열림:', await page.locator('.grbar b').first().innerText());
  await page.click('[data-fr="close"]');
  await page.click('[data-sel="p2"]');
  await page.screenshot({ path: OUT + '/o2_detail.png' });
  console.log('errors:', errs); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
