// 초진기록지 추천 영상 자동 채우기: 예약·도착으로 들어온 초진 아이의 대기 영상이 비어 있으면 서버 환자 찾기로 받아 넣고, 환자 폰에는 새 재구성판(파일)으로 보여 줌
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
const V = o => Object.assign({ sv: 2, card: '', appt: '', log: [{ s: 0, t: now - 5 * M }], createdAt: now - 30 * M, updatedAt: now - 20 * M, date: TODAY, rev: false, first: false, step: 0,
  intake: {}, measure: {}, xray: {}, lab: { items: [], results: {}, proto: 'single', draws: [], ext: {}, at: {} }, review: {}, exit: {}, report: {} }, o);
const DB = new Map();
[V({ id: 'a', name: '김새봄', age: 6, sex: '여', chartNo: '103555', card: 'C011' }),               // 등록번호로 찾음 → 172
 V({ id: 'b', name: '박하늘', age: 8, sex: '남', chartNo: '' }),                                     // 이름만 → 한 명 일치 → 35
 V({ id: 'c', name: '최다온', age: 7, sex: '여', chartNo: '104000', vids: '7' }),                    // 직원이 넣은 번호 → 그대로
 V({ id: 'd', name: '윤서아', age: 6, sex: '여', chartNo: '104100', vids: '123', vidsSrc: 'default' }), // 당일 기본값 → 기록지 추천 45로
 V({ id: 'e', name: '정이안', age: 9, sex: '남', chartNo: '104200', rev: true }),                    // 재진 → 찾지 않음
 V({ id: 'f', name: '한지호', age: 9, sex: '남', chartNo: '104300', step: -1 }),                     // 아직 도착 전 → 찾지 않음
 V({ id: 'g', name: '이로운', age: 9, sex: '남', chartNo: '' }),                                     // 이름 겹침(두 명) → 넣지 않음
].forEach(v => DB.set(v.id, v));
const setPath = (o, k, val) => { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; };
const LOOK = [];
function handle(b) {
  switch (b.action) {
    case 'flowlist': return { status: 'ok', visits: [...DB.values()] };
    case 'flowsave': { let v = DB.get(b.id); if (!v) { v = { id: b.id }; DB.set(b.id, v); } Object.entries(b.patch).forEach(([k, val]) => setPath(v, k, val)); return { status: 'ok' }; }
    case 'flowlookup': {
      LOOK.push(b.chartNo || ('name:' + b.name));
      const T = { '103555': [{ name: '김새봄', age: 6, sex: '여', chartNo: '103555', first: true, vids: '172', phoneTail: '1234' }],
                 '104100': [{ name: '윤서아', age: 6, sex: '여', chartNo: '104100', first: true, vids: '45', phoneTail: '2222' }],
                 '104000': [{ name: '최다온', age: 7, sex: '여', chartNo: '104000', first: true, vids: '26', phoneTail: '3333' }],
                 'name:박하늘': [{ name: '박하늘', age: 8, sex: '남', chartNo: '', first: true, vids: '35', phoneTail: '4444' }],
                 'name:이로운': [{ name: '이로운', age: 9, sex: '남', chartNo: '', first: true, vids: '14', phoneTail: '5555' }, { name: '이로운', age: 6, sex: '남', chartNo: '', first: true, vids: '27', phoneTail: '6666' }] };
      return { status: 'ok', matches: T[b.chartNo || ('name:' + b.name)] || [] };
    }
    default: return { status: 'ok' };
  }
}
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); localStorage.setItem('jrd_site_url', 'https://ha5857-web.github.io/remote_jarada'); window.print = () => {}; });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) {
      if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ROWS) });
      const b = JSON.parse(route.request().postData() || '{}'); 
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(handle(b)) });
    }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  await page.waitForTimeout(11000);   // 첫 자동 채우기(8초 뒤)
  const got = await page.evaluate(() => Object.fromEntries([...S.items.values()].map(v => [v.id, { vids: v.vids || '', src: v.vidsSrc || '', first: !!v.first }])));
  console.log('채운 결과:', JSON.stringify(got));
  console.log('찾은 순서:', JSON.stringify(LOOK));
  const want = { a: '172', b: '35', c: '7', d: '45', e: '', f: '', g: '' };
  const bad = Object.keys(want).filter(k => (got[k] || {}).vids !== want[k]);
  if (bad.length) console.log('FAIL 대기 영상 번호가 다름:', bad.join(','));
  if (LOOK.some(x => x === '104200' || x === '104300' || x === '104000')) console.log('FAIL 찾지 말아야 할 아이를 찾음');
  if (DB.get('a').vids !== '172' || DB.get('d').vids !== '45') console.log('FAIL 서버에 저장되지 않음');
  if (!got.a.first) console.log('FAIL 초진 표시가 켜지지 않음');
  const kv = await page.evaluate(() => kioskVideos({ vids: '172', xv: '', first: true, lab: { proto: 'single' } }));
  if (!/v\/ko\/G1\.mp4/.test(kv) || !/v\/ko\/G1\.jpg/.test(kv) || !/기다리는 동안 보세요/.test(kv)) console.log('FAIL 환자 폰 영상 목록에 새 영상(파일·표지)이 없음');
  await page.evaluate(() => { const k = document.getElementById('kiosk'); k.innerHTML = kioskVideos({ vids: '172', xv: '', first: true, lab: { proto: 'single' } }); k.hidden = false; });
  await page.click('#kiosk .kvrow');
  const vid = await page.evaluate(() => { const v = document.querySelector('#kiosk video.kv'); return v && { src: v.getAttribute('src'), poster: v.getAttribute('poster'), auto: v.autoplay }; });
  console.log('누르면 재생:', JSON.stringify(vid));
  if (!vid || !/G1\.mp4$/.test(vid.src) || !/G1\.jpg$/.test(vid.poster)) console.log('FAIL 눌렀을 때 새 영상 파일이 재생되지 않음');
  await page.screenshot({ path: OUT + '/iv_kiosk.png' });
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
