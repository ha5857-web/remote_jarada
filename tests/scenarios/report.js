// flow.html 성장 리포트 최소 클릭 흐름 — 모의 서버로 실제 브라우저에서 확인
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2];
const OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = {
  'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js',
  'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js',
  'html2canvas/1.4.1/html2canvas.min.js': NM + '/html2canvas/dist/html2canvas.min.js',
  'jspdf/2.5.1/jspdf.umd.min.js': NM + '/jspdf/dist/jspdf.umd.min.js',
};
const d = new Date(), pad = n => (n < 10 ? '0' : '') + n;
const TODAY = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = Date.now(), M = 60000;
const base = () => ({ intake: { chief: '', purpose: '성장 평가', fatherH: '', motherH: '', history: '', signs: '', consent: false },
  measure: { height: '', weight: '' }, xray: { part: '왼손 정면 (골연령)', done: false, note: '' },
  lab: { items: ['원내검사'], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} },
  review: { boneAge: '', note: '', next: '' }, exit: { paid: false, guide: false }, report: { sent: false } });
const V = (o) => Object.assign({ sv: 2, card: '', appt: '', log: [], createdAt: now - 90 * M, updatedAt: now - 60 * M, date: TODAY, rev: true }, base(), o);
const DB = new Map();
[
  V({ id: 'p1', name: '홍지우', age: 7, sex: '여', chartNo: '101834', appt: '10:00', step: -1, dob: '2019-03-02' }),
  V({ id: 'p2', name: '노시온', age: 10, sex: '남', chartNo: '101700', appt: '10:10', step: 7, dob: '2016-05-11', log: [{ s: 0, t: now - 50 * M }, { s: 7, t: now - 5 * M }] }),
  V({ id: 'p3', name: '안유주', age: 9, sex: '여', chartNo: '102304', appt: '10:20', step: 6, dob: '2017-01-20', lab: Object.assign(base().lab, { drawn: true }), log: [{ s: 0, t: now - 40 * M }, { s: 5, t: now - 20 * M }, { s: 6, t: now - 10 * M }] }),
  V({ id: 'p4', name: '이규현', age: 13, sex: '남', chartNo: '101707', appt: '10:30', step: 7, dob: '2013-02-14', gr: { q: { blood: false, xray: true } }, xray: { part: '왼손', done: true, note: '' }, log: [{ s: 0, t: now - 30 * M }, { s: 4, t: now - 20 * M }, { s: 7, t: now - 2 * M }] }),
].forEach(v => DB.set(v.id, v));
function setPath(o, k, val) { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; }
const calls = [];
function handle(body) {
  calls.push(body.action);
  switch (body.action) {
    case 'flowlist': return { status: 'ok', visits: [...DB.values()] };
    case 'flowsave': { let v = DB.get(body.id); if (!v) { v = { id: body.id }; DB.set(body.id, v); } Object.entries(body.patch).forEach(([k, val]) => setPath(v, k, val)); return { status: 'ok' }; }
    case 'flowprepare': return { status: 'ok', source: 'patient', identity: {} };
    case 'generatefirstvisitchart': return { via: 'jarada-codegs', status: 'ok', data: {
      summary: '오늘은 1년 동안의 키 성장을 확인했어요. 또래 중간 정도로 잘 자라고 있습니다.', labs: '', xray: '뼈나이는 실제 나이와 비슷해요.',
      direction: '지금처럼 생활하면서 6개월 뒤 다시 키를 재 보아요.', exercise: '줄넘기 하루 10분', nutrition: '우유 하루 2잔', sleep: '밤 10시 전에 잠들기' } };
    default: return { status: 'ok' };
  }
}
const chart = (no, name, extra) => `${no ? '등록번호 ' + no + '  ' : ''}${name ? name + ' ' : ''}
# CA/BA: (10.5)/(10.3)
# Image finding: 특이 소견 없음
# Plan: ${extra || '6개월 후 f/u, 생활습관 교정'}
등록일자\tAGE\tBA\tWT\tHT\tBMI
2025-11-05\t9.06\t\t30.1(45.2)\t134.0(48.1)\t16.8(44.0)
${TODAY}\t10.05\t10.03\t33.4(47.0)\t139.6(50.2)\t17.1(46.3)
`;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('jrd_api_url', 'https://api.test/exec');
    localStorage.setItem('jrd_auth_token', 'x.' + (Date.now() + 864e5) + '.y');
    window.__prints = 0; window.print = () => { window.__prints++; setTimeout(() => window.dispatchEvent(new Event('afterprint')), 50); };
  });
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith('https://api.test/')) { const b = JSON.parse(route.request().postData() || '{}'); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(handle(b)) }); }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + FLOW);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.loaded);
  // 진료실 단말처럼: 스캔 칸 보이게
  await page.selectOption('#station', 'doctor').catch(() => {});
  await page.click('.tabs button[data-view="report"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/1_tab.png' });
  const grp = await page.evaluate(() => [...S.items.values()].map(v => v.name + ':' + (v.gr && v.gr.blood) ));
  console.log('groups text:', (await page.locator('#main-view').innerText()).split('\n').filter(l => /\(\d+\)/.test(l)).join(' | '));

  // ① 스캔 칸에 커서가 있는 상태에서 노시온 차트 Ctrl+V → 자동 매칭 → AI → 확인 한 번
  await page.evaluate(() => { const s = document.getElementById('scan'); if (s) { s.hidden = false; s.focus(); } });
  const paste = (txt) => page.evaluate((t) => { const dt = new DataTransfer(); dt.setData('text/plain', t); const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); (document.activeElement || document.body).dispatchEvent(ev); return ev.defaultPrevented; }, txt);
  console.log('paste prevented (scan box):', await paste(chart('101700', '', '')));
  await page.waitForSelector('#grov');
  await page.waitForFunction(() => { const b = document.getElementById('fr-okbtn'); return b && !b.disabled; }, null, { timeout: 15000 });
  console.log('modal header:', await page.locator('.grbar b').first().innerText());
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/2_modal.png' });
  const dl = page.waitForEvent('download', { timeout: 20000 });
  await page.click('#fr-okbtn');
  const file = await dl; console.log('PDF download:', file.suggestedFilename());
  await page.waitForSelector('#grov', { state: 'detached', timeout: 15000 });
  console.log('after confirm p2:', JSON.stringify(await page.evaluate(() => { const g = S.items.get('p2').gr; return { ready: g.ready, reviewed: g.reviewed, printedAt: g.printedAt || null }; })));

  // ② 이름·번호 없는 차트 → 환자 고르기 1번 → Ctrl+Enter
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await paste(chart('', '', ''));
  await page.waitForSelector('#grpick');
  await page.screenshot({ path: OUT + '/3_pick.png' });
  await page.click('#grpick [data-pick="p4"]');
  await page.waitForFunction(() => { const b = document.getElementById('fr-okbtn'); return b && !b.disabled; }, null, { timeout: 15000 });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const dl2 = page.waitForEvent('download', { timeout: 20000 });
  await page.keyboard.press('Control+Enter');
  await dl2; await page.waitForSelector('#grov', { state: 'detached', timeout: 15000 });
  console.log('p4 reviewed:', await page.evaluate(() => S.items.get('p4').gr.reviewed));

  // ③ 차트 플랜에 오늘 혈액검사 → 안내 + [결과 나오면 보고로 보내기]
  await paste(chart('101834', '홍지우', '오늘 LH, FSH, E2, IGF-1 혈액검사 시행'));
  await page.waitForFunction(() => { const b = document.getElementById('fr-okbtn'); return b && !b.disabled; }, null, { timeout: 15000 });
  await page.screenshot({ path: OUT + '/4_bloodtip.png' });
  console.log('recommended chip:', await page.locator('#fr-xv .xvchip:has(small)').innerText());
  await page.click('#fr-xv .xvchip:has(small)');
  await page.click('[data-fr="close"]');
  await page.waitForSelector('#grov', { state: 'detached' });
  console.log('p1 blood (xv):', await page.evaluate(() => S.items.get('p1').xv));

  // ④ 한 번 눌러 혈액검사 해제/설정
  await page.click('[data-act="gr-blood"][data-id="p3"]');
  console.log('p3 after toggle off:', await page.evaluate(() => S.items.get('p3').gr.blood));
  await page.click('[data-act="gr-blood"][data-id="p3"]');
  console.log('p3 after toggle on:', await page.evaluate(() => S.items.get('p3').gr.blood));
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/5_tab_after.png', fullPage: true });

  // ⑤ 직원: 모두 인쇄 → 한 번 인쇄, 2명 인쇄 완료
  const pages = await page.evaluate(() => new Promise(ok => { const o = new MutationObserver(() => { const h = document.getElementById('grprint'); if (h) { o.disconnect(); setTimeout(() => ok({ wrappers: h.querySelectorAll('.grpj').length, pages: h.querySelectorAll('.rp').length }), 30); } }); o.observe(document.body, { childList: true }); document.querySelector('[data-act="gr-printall"]').click(); }));
  console.log('print job:', JSON.stringify(pages));
  await page.waitForTimeout(500);
  console.log('prints:', await page.evaluate(() => window.__prints), 'printed:', await page.evaluate(() => ['p2', 'p4'].map(i => !!S.items.get(i).gr.printedAt)));
  await page.screenshot({ path: OUT + '/6_printed.png', fullPage: true });

  // ⑥ 다른 탭(현황판)에서 붙여넣어도 열림
  await page.click('.tabs button[data-view="board"]');
  await paste(chart('102304', '안유주', ''));
  await page.waitForSelector('#grov', { timeout: 5000 });
  console.log('board paste opened:', await page.locator('.grbar b').first().innerText());
  console.log('blood info tip:', await page.locator('#fr-tip').innerText().catch(() => ''));
  await page.click('[data-fr="close"]');

  // ⑦ 자동 인쇄(직원 기기)
  await page.click('.tabs button[data-view="report"]');
  await page.evaluate(() => { const g = Object.assign({}, S.items.get('p3').gr); });
  await page.check('[data-act="gr-optauto"]');
  const before = await page.evaluate(() => window.__prints);
  await page.evaluate(() => { const v = S.items.get('p3'); v.gr = Object.assign({}, v.gr, { ready: true, reviewed: true, reviewedAt: Date.now(), printedAt: null, post: { summary: '결과 설명', labs: 'LH 0.1', xray: '', direction: '', exercise: '', nutrition: '', sleep: '' }, dob: '2017-01-20', sex: 'F', recsText: '2026-11-06  키 130.2  몸무게 28.1' }); put(v, true); renderAll(false); });
  await page.waitForTimeout(1200);
  console.log('autoprint fired:', (await page.evaluate(() => window.__prints)) - before);
  console.log('errors:', errs.filter(e => !/favicon|ERR_|Failed to load resource/.test(e)).slice(0, 5));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
