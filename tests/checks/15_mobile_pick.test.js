// 휴대폰(원장 앱 index.html): Ctrl+V·끌어다 놓기가 없으니 「📷 캡처 사진 올리기」·「📋 붙여넣기」 단추로 네이버 예약 캡처를 넣음
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const pad = n => (n < 10 ? '0' : '') + n, d = new Date(Date.now() + 864e5), TMR = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_site_url: 'https://example.test/' };
// 네이버 스마트플레이스 앱 예약 상세 카드 두 장이 이어진 긴 스크롤 캡처. 조각마다 AI가 읽은 결과를 흉내 냄:
// 첫 조각 끝에서 둘째 카드가 잘려 예약번호 없이 읽힘 → 다음 조각의 온전한 카드와 같은 사람이므로 버려야 함
const FULL1 = { name: '민현정', visitor: '김민주', sex: '여', phone: '010-3896-3041', bookingNo: '1413113249', date: TMR, time: '11:30', service: '하재욱 원장', status: '확정' };
const FULL2 = { name: '박선주', visitor: '백지원', sex: '여', phone: '010-3501-4239', bookingNo: '1414022149', date: TMR, time: '10:00', service: '하재욱 원장', status: '확정' };
const CUT2 = { name: '박선주', visitor: '백지원', sex: '여', phone: '010-3501-4239', bookingNo: '', date: '', time: '' };
const api = (log, saved) => q => {
  if (q.method === 'GET') return [];
  const a = q.body && q.body.action; log.push(a);
  if (a === 'readbookingimage') { const n = log.filter(x => x === 'readbookingimage').length; return { status: 'ok', rows: n === 1 ? [FULL1, CUT2] : n === 2 ? [FULL2] : [FULL2], cancelled: 0 }; }
  if (a === 'savebookings') { saved.push(...q.body.items); return { status: 'ok', added: q.body.items.length }; }
  if (a === 'listbookings' || a === 'listintakes') return { status: 'ok', items: [] };
  return undefined;
};
const tallPng = p => p.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 3900; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 1080, 3900); g.fillStyle = '#000'; g.font = '48px sans-serif';
  for (let y = 200; y < 3900; y += 160) g.fillText('예약 ' + y, 60, y);
  return cv.toDataURL('image/png').split(',')[1];
});

test('📷 캡처 사진 올리기: 긴 휴대폰 캡처를 겹쳐 잘라 읽고, 잘린 카드는 빼고 2건만 저장', async () => {
  const log = [], saved = [], dialogs = [];
  const o = await open(b, page('index.html'), { phone: true, storage, api: api(log, saved) });
  o.p.on('dialog', dl => { dialogs.push(dl.message()); dl.accept(); });
  assert.ok(await o.p.$('#np_img'), '캡처 사진 고르기 칸이 없음');
  assert.ok(await o.p.$('#np_paste'), '붙여넣기 단추가 없음');
  assert.strictEqual(await o.p.$eval('#np_img', e => e.accept + '|' + e.multiple), 'image/*|true');
  const b64 = await tallPng(o.p);
  await o.p.setInputFiles('#np_img', { name: 'Screenshot_naver.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await o.p.waitForFunction(() => /네이버 예약 \d+건을 저장/.test(document.getElementById('np_msg').textContent) || /❌/.test(document.getElementById('np_msg').textContent), null, { timeout: 15000 });
  const chunks = log.filter(x => x === 'readbookingimage').length;
  assert.strictEqual(chunks, 3, '긴 캡처(1080×3900)는 세 조각으로 읽어야 함: ' + chunks);
  assert.strictEqual(dialogs.length, 1); assert.match(dialogs[0], /네이버 예약 2건/);
  assert.deepStrictEqual(saved.map(r => r.visitor + '|' + r.bookingNo + '|' + r.time).sort(), ['김민주|1413113249|11:30', '백지원|1414022149|10:00']);
  assert.deepStrictEqual(o.errors, []); await o.ctx.close();
});

test('📋 붙여넣기 단추: 클립보드 캡처를 읽고, 쓸 수 없는 브라우저면 다른 방법을 안내', async () => {
  const log = [], saved = [];
  const o = await open(b, page('index.html'), { phone: true, storage, api: api(log, saved) });
  o.p.on('dialog', dl => dl.dismiss());
  await o.p.evaluate(() => { navigator.clipboard.read = async () => { throw new Error('NotAllowedError'); }; });
  await o.p.evaluate(() => document.getElementById('np_paste').click());
  await o.p.waitForTimeout(300);
  const m = await o.p.$eval('#np_msg', e => e.textContent);
  assert.match(m, /📷 캡처 사진 올리기/); assert.match(m, /길게 눌러/);
  // 클립보드에 캡처가 있으면 AI로 읽기 시작
  await o.p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1800; cv.getContext('2d').fillRect(0, 0, 10, 10);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    navigator.clipboard.read = async () => [{ types: ['image/png'], getType: async () => blob }];
  });
  await o.p.evaluate(() => document.getElementById('np_paste').click());
  await o.p.waitForTimeout(1500);
  assert.ok(log.includes('readbookingimage'), '클립보드 캡처를 AI로 읽지 않음');
  assert.deepStrictEqual(o.errors, []); await o.ctx.close();
});
