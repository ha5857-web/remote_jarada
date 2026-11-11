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
const ROWS=[{id:'fv_abc123',pid:'abc123',type:'firstvisit',question:JSON.stringify({v:1,stage:'pre',name:'홍지우',dob:'2019-03-02',preVideos:[{no:1,title:'x'}],prep:'준비물'})}];
const CALLS=[];
function handle(b) {
  CALLS.push(b.action||('row:'+b.type));
  if(!b.action&&b.id&&b.type){ROWS.push({id:b.id,pid:b.pid,type:b.type,question:b.question});return {status:'ok'}}
  if(b.action==='update'){const r=ROWS.find(x=>x.id===b.id);if(!r)return {status:'ok',updated:false};r.question=b.question;return {status:'ok',updated:true}}
  if(b.action==='delete'){const k=ROWS.findIndex(x=>x.id===b.id);if(k>=0)ROWS.splice(k,1);return {status:'ok'}}
  if(b.action==='registerfirstvisit'){global.REG=b;return {status:'ok',channel:'kakao'}}
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
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  await ctx.addInitScript(() => { localStorage.setItem('jrd_api_url', 'https://api.test/exec'); localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y'); localStorage.setItem('jrd_site_url', 'https://ha5857-web.github.io/remote_jarada'); window.print = () => {}; });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) {
      if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ROWS) });
      const b = JSON.parse(route.request().postData() || '{}'); if (b.action === 'generatefirstvisitchart') await new Promise(r => setTimeout(r, 600));
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
  // ① 당일 접수 등록
  await page.click('#btn-add');
  await page.waitForSelector('#quick-form');
  await page.fill('#qf-name', '김새봄'); await page.fill('#qf-dob', '20200401'); await page.fill('#qf-chart', '103555'); await page.fill('#qf-phone', '010-1234-5678'); await page.selectOption('#qf-sex', '여');
  await page.screenshot({ path: OUT + '/s1_form.png' });
  await page.click('#qf-go');
  await page.waitForTimeout(1500);
  const nv = await page.evaluate(() => { const v = [...S.items.values()].find(x => x.chartNo === '103555'); return v && { id: v.id, name: v.name, step: v.step, temp: v.temp, dob: v.dob, sex: v.sex, card: v.card, vids: v.vids, pid: v.pid, invite: v.invite }; });
  console.log('① 등록:', JSON.stringify(nv));
  const R = global.REG || {};
  console.log('   초진방 등록 요청:', JSON.stringify({ name: R.name, phone: R.phone, method: R.method, link: (R.link || '').slice(0, 110), pending: R.pending && { chartNo: R.pending.chartNo, dob: R.pending.dob, sex: R.pending.sex, by: R.pending.by, pre: R.pending.preVideos.map(x => x.no).join('') } }));
  await page.click('.tabs button[data-view="board"]');
  await page.screenshot({ path: OUT + '/s2_board.png' });
  console.log('   board pill:', await page.locator(`[data-sel="${nv.id}"] .nm`).innerText());
  // ② 진료 후 EMR → 확인 → 초진방
  const paste = txt => page.evaluate(t => { const dt = new DataTransfer(); dt.setData('text/plain', t); (document.activeElement || document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, txt);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await paste(`등록번호 103555\n#SMR(): (Tanner 1)\n#Plan: 6개월 후 f/u\n등록일자\tAGE\tBA\tWT\tHT\tBMI\n${TODAY}\t6.07\t6.05\t19.2(40.0)\t112.4(35.0)\t15.2(45.0)\n`);
  await page.waitForSelector('#grov');
  await page.waitForFunction(() => { const b = document.getElementById('fr-okbtn'); return b && !b.disabled; }, null, { timeout: 15000 });
  const dl = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#fr-okbtn'); await dl;
  await page.waitForFunction(id => { const v = S.items.get(id); return v && v.gr && (v.gr.roomAt || v.gr.roomErr); }, nv.id, { timeout: 30000 });
  const room = ROWS.find(r => r.id === 'fv_' + nv.pid), rq = room ? JSON.parse(room.question) : null;
  console.log('② 초진방 행:', rq ? JSON.stringify({ stage: rq.stage, fromFlow: rq.fromFlow, summary: rq.post.summary, report: rq.report && { n: rq.report.n, kb: Math.round(rq.report.size / 1024) }, preKept: (rq.preVideos || []).length }) : 'NONE', '| PDF 조각:', ROWS.filter(r => r.type === 'fvreport' && r.pid === nv.pid).length);
  console.log('   roomAt:', await page.evaluate(id => !!S.items.get(id).gr.roomAt, nv.id));
  // ③ 기존 초진 아이(초진방은 의사 앱이 만든 것) → 이름·생년월일로 찾아 올림
  await paste(`등록번호 101834\n#SMR(): (Tanner 1)\n#Plan: 3개월 후 f/u\n등록일자\tAGE\tBA\tWT\tHT\tBMI\n${TODAY}\t7.08\t7.06\t25.0(50.0)\t125.0(50.0)\t16.0(50.0)\n`);
  await page.waitForSelector('#grov');
  await page.waitForFunction(() => { const b = document.getElementById('fr-okbtn'); return b && !b.disabled; }, null, { timeout: 15000 });
  const dl2 = page.waitForEvent('download', { timeout: 20000 }); await page.click('#fr-okbtn'); await dl2;
  await page.waitForFunction(() => { const v = S.items.get('p1'); return v.gr && (v.gr.roomAt || v.gr.roomErr); }, null, { timeout: 30000 });
  const r1 = JSON.parse(ROWS.find(r => r.id === 'fv_abc123').question);
  console.log('③ 홍지우 초진방(abc123):', JSON.stringify({ stage: r1.stage, summary: r1.post && r1.post.summary, prep: r1.prep, pre: (r1.preVideos || []).length, report: !!r1.report }), '| pid saved:', await page.evaluate(() => S.items.get('p1').pid));
  await page.click('.tabs button[data-view="report"]');
  await page.screenshot({ path: OUT + '/s3_report.png' });
  console.log('   report tab room tags:', (await page.locator('#main-view').innerText()).match(/초진방 ✓ \d+:\d+|초진방에 올리기/g));
  console.log('calls:', CALLS.filter(c => !/flowlist|flowsave/.test(c)).join(','));
  console.log('errors:', errs);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
