// 모든 화면이 오류 없이 열리는지 (가장 기본)
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });

const PAGES = [
  ['의사 앱', 'index.html', {}],
  ['의사 앱(로그인 상태)', 'index.html', { storage: { jrd_api_url: API, jrd_auth_token: doctorToken() } }],
  ['현황판', 'flow.html', {}],
  ['현황판(휴대폰)', 'flow.html', { phone: true }],
  ['카드 QR 보호자 화면', 'flow.html?c=C003', { phone: true }],
  ['원무과 앱', 'visit-notice.html', {}],
  ['초진방', '자라다케어_환아용.html?pid=aaaaaaaaaaaaaaaaaaaa&api=' + encodeURIComponent(API) + '&first=1', { phone: true }]
];
for (const [name, file, opt] of PAGES) {
  test(name + ' — 오류 없이 열림', async () => {
    const o = await open(b, page(file), opt);
    assert.deepStrictEqual(o.errors, []);
    await o.ctx.close();
  });
}
