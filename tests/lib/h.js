// 공용 도우미: 브라우저를 띄우고, 바깥 주소(CDN·서버)는 모두 가짜로 바꿔서 페이지를 엽니다.
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const NM = path.join(__dirname, '..', 'node_modules');
const LIBS = {
  'qrcode-generator@1.4.4/qrcode.js': path.join(NM, 'qrcode-generator', 'qrcode.js'),
  'three@0.128.0/build/three.min.js': path.join(NM, 'three', 'build', 'three.min.js')
};
const page = name => 'file://' + path.join(ROOT, name);
const API = 'https://script.google.com/macros/s/TEST/exec';

// api(req) → 돌려줄 값(객체). 없으면 GET은 [], POST는 {status:'ok'}
async function open(browser, url, opt) {
  opt = opt || {};
  const ctx = await browser.newContext(opt.phone ? Object.assign({}, devices['iPhone 13']) : { viewport: { width: 1300, height: 900 } });
  if (opt.storage) await ctx.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, opt.storage);
  const calls = [];
  await ctx.route('**/*', async r => {
    const req = r.request(), u = req.url();
    if (u.startsWith('file:')) return r.continue();
    for (const k in LIBS) if (u.includes(k)) return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(LIBS[k]) });
    if (u.startsWith('https://script.google.com/')) {
      let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch (e) {}
      calls.push({ method: req.method(), url: u, body });
      let out = opt.api ? await opt.api({ method: req.method(), url: u, body }) : undefined;
      if (out === undefined) out = req.method() === 'GET' ? [] : { status: 'ok' };
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify(out) });
    }
    calls.push({ method: req.method(), url: u, outside: true });
    return r.fulfill({ status: 204, body: '' });
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await p.goto(url);
  await p.waitForTimeout(opt.wait || 1200);
  return { ctx, p, errors, calls };
}
const doctorToken = () => 'doctor.' + (Date.now() + 1e9) + '.sig';
module.exports = { chromium, open, page, ROOT, API, doctorToken };
