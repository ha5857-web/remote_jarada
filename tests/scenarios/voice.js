// 보호자 폰은 찍은 카드의 아이 한 명만: 같은 휴대폰으로 C001 → C003 을 찍어도 C003 화면에 C001 아이(이름·탭·채혈 알람)가 뜨지 않음
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FLOW = process.argv[2], OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = { 'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js', 'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js' };
const pad = n => (n < 10 ? '0' : '') + n, ymd = t => t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
const TODAY = ymd(new Date()), now = Date.now(), M = 60000;
const KIDS = {
  C001: { name: '한가람', step: 2, date: TODAY, since: now - 20 * M, vids: '172', first: true, draws: [{ off: 30, due: now + 60 * 1000, done: false }], protoName: '자극검사' },
  C003: { name: '이바다', step: 0, date: TODAY, since: now - 35 * M, vids: '45', first: true, draws: [] }
};
const CALLS = [];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true });
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('https://script.google.com/macros/s/')) {
      const b = JSON.parse(route.request().postData() || '{}'); CALLS.push(b.action + ':' + b.card);
      if (b.action === 'flowme') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', now: Date.now(), visit: KIDS[b.card] || null }) });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    }
    for (const k in LIBS) if (u.includes(k)) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('file:')) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  const errs = [];
  const open = async c => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); await p.goto('file://' + FLOW + '?c=' + c); await p.waitForTimeout(2500); return p; };
  // 음성 안내: 버튼이 보이고, 누르면 켜지고, 끄면 꺼짐 (브라우저 음성 합성은 시험 환경에 없어도 오류 없이)
  const pv = await open('C003');
  await pv.evaluate(() => { window.__said = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], cancel() {}, speak(u) { window.__said.push(u.text); } }, configurable: true }); pmRender(true, true); });
  if (!(await pv.locator('#pm-voice').count())) console.log('FAIL 음성 안내 듣기 버튼이 없음');
  await pv.click('#pm-voice'); await pv.waitForTimeout(300);
  const vs = await pv.evaluate(() => ({ on: PM.voice, said: window.__said })); if (!vs.on || !vs.said.length || /이바다/.test(vs.said.join(''))) console.log('FAIL 음성 안내 켜기/내용', JSON.stringify(vs));
  await pv.click('#pm-voice-off'); await pv.waitForTimeout(200); if (await pv.evaluate(() => PM.voice)) console.log('FAIL 음성 안내 끄기'); await pv.close();
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
