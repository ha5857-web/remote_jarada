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
  // ① 앞 아이 카드
  const p1 = await open('C001'); const t1 = await p1.locator('#kiosk').innerText();
  if (!/한가람/.test(t1)) console.log('FAIL C001 화면에 한가람이 없음');
  const tok1 = await p1.evaluate(() => JSON.parse(localStorage.getItem('jrd_pm_v1')).kids.C001.tok); await p1.close();
  // ② 같은 휴대폰으로 다음 아이 카드
  CALLS.length = 0;
  const p2 = await open('C003'); const t2 = await p2.locator('#kiosk').innerText(), h2 = await p2.locator('#kiosk').innerHTML();
  console.log('C003 화면 첫 줄:', t2.split('\n').slice(0, 3).join(' / '));
  if (!/이바다/.test(t2)) console.log('FAIL C003 화면에 이바다가 없음');
  if (/한가람|C001/.test(t2) || /data-pmtab|pm-tabs/.test(h2)) console.log('FAIL C003 화면에 앞 아이(C001)가 보임');
  if (CALLS.some(x => /C001/.test(x))) console.log('FAIL C003 화면이 C001 정보를 불러옴: ' + CALLS.join(','));
  if (!/v\/ko\/G\d\.mp4|기다리는 동안 보세요/.test(h2)) console.log('FAIL C003 대기 영상이 안 보임');
  await p2.screenshot({ path: OUT + '/onekid_c003.png', fullPage: false });
  // C001 채혈 알람 시간이 와도 C003 화면에서는 울리지 않음
  const alarmed = await p2.evaluate(() => [...PM.alerted]); if (alarmed.some(x => /C001/.test(x))) console.log('FAIL C003 화면에서 C001 채혈 알람이 울림');
  await p2.close();
  // ③ 앞 아이 카드를 다시 찍으면 그 아이만, 표(질문·별점용)는 이어짐
  const p3 = await open('C001'); const t3 = await p3.locator('#kiosk').innerText();
  if (!/한가람/.test(t3) || /이바다/.test(t3)) console.log('FAIL C001 다시 찍었을 때 화면이 이상함');
  const tok3 = await p3.evaluate(() => JSON.parse(localStorage.getItem('jrd_pm_v1')).kids.C001.tok);
  if (tok1 !== tok3) console.log('FAIL 다시 찍었더니 표가 바뀜');
  await p3.close();
  // ④ 잘못된 번호면 아무 아이도 안 보임
  const p4 = await open('XX'); const t4 = await p4.locator('#kiosk').innerText();
  if (/한가람|이바다/.test(t4)) console.log('FAIL 잘못된 카드 번호인데 다른 아이가 보임'); await p4.close();
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
