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
  // 영상 재생 중에는 화면이 다시 그려져도 영상이 끊기지 않고, 같은 영상이 두 번 나오지 않음
  const pv = await open('C003');
  const titles = await pv.evaluate(() => [...document.querySelectorAll('#kiosk .kvrow b')].map(x => x.textContent.replace(/\s/g, '')));
  if (new Set(titles).size !== titles.length) console.log('FAIL 같은 영상이 중복으로 나옴', JSON.stringify(titles));
  await pv.click('#kiosk .kvrow'); await pv.waitForTimeout(300);
  const mark = await pv.evaluate(() => { const e = document.querySelector('#kiosk .kvitem.on .kvplay > *'); if (e) e.dataset.m = '1'; return !!e; });
  if (!mark) console.log('FAIL 영상이 그 자리에서 열리지 않음');
  await pv.evaluate(() => { for (let i = 0; i < 5; i++) pmRender(false); pmRender(true); }); await pv.waitForTimeout(3500);
  const still = await pv.evaluate(() => !!document.querySelector('#kiosk .kvitem.on .kvplay > [data-m="1"]'));
  if (!still) console.log('FAIL 다시 그리기 때문에 영상이 끊김');
  const th = await pv.evaluate(() => getComputedStyle(document.querySelector('#kiosk .kvitem.on .kvth')).display);
  if (th !== 'none') console.log('FAIL 영상이 열렸는데 썸네일이 아래에 또 보임', th);
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
