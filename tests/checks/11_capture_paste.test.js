// 원무과 앱(visit-notice): EMR 화면 캡처를 붙여넣어도 읽음 — 예전엔 「엑셀을 읽지 못했어요: PNG Image File is not a spreadsheet」
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const pad = n => (n < 10 ? '0' : '') + n, d = new Date(Date.now() + 864e5), TMR = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const AI_ROWS = [{ name: '이지선', phone: '010-7271-0392', date: TMR, time: '10:00', service: '초진' }, { name: '허연우', phone: '010-8920-0708', date: TMR, time: '11:20', chart: '102746' }];
const api = (log, aiFail) => q => {
  if (q.method === 'GET') return [];
  const a = q.body && q.body.action; log.push(a || (q.body && q.body.type));
  if (a === 'readbookingimage') return aiFail ? { status: 'error', code: 'nokey', message: 'AI 키가 없어요' } : { status: 'ok', rows: AI_ROWS, cancelled: 1 };
  if (a === 'listbookings' || a === 'listintakes') return { status: 'ok', items: [] };
  if (a === 'flowlist') return { status: 'ok', visits: [] };
  return undefined;
};
const storage = { jrd_api_url: API, jrd_auth_token: 'staff.' + (Date.now() + 1e9) + '.sig', jrd_site_url: 'https://example.test/' };
// 진짜 PNG(EMR 캡처 크기)를 클립보드에 넣고 붙여넣기 — text 를 주면 표 글자도 같이 들어 있는 클립보드
const paste = (p, sel, text) => p.evaluate(async ([sel, text]) => {
  const cv = document.createElement('canvas'); cv.width = 1100; cv.height = 380; const g = cv.getContext('2d'); g.fillStyle = '#BFD9F2'; g.fillRect(0, 0, 1100, 380); g.fillStyle = '#000'; g.font = '16px sans-serif'; g.fillText('이지선 010-7271-0392 2026-11-21 10:00', 20, 40);
  const png = await new Promise(r => cv.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([png], 'image.png', { type: 'image/png' })); if (text) dt.setData('text/plain', text);
  const el = document.querySelector(sel); el.focus(); if (text) el.value = text; /* 진짜 붙여넣기처럼 글자는 칸에 들어감 */ el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, [sel, text]);
const msg = (p, sel) => p.evaluate(s => document.querySelector(s).textContent, sel);

test('초진 찾기 칸: 캡처를 붙여넣으면 AI가 읽어 표로 바꾸고 초진 찾기까지', async () => {
  const log = [], o = await open(b, page('visit-notice.html'), { storage, api: api(log) });
  await paste(o.p, '#np_text'); await o.p.waitForTimeout(1500);
  const m = await msg(o.p, '#np_msg');
  assert.ok(log.includes('readbookingimage'), '서버 AI 읽기를 부르지 않음');
  assert.doesNotMatch(m, /엑셀을 읽지 못했어요|PNG/);
  assert.match(m, /캡처에서 2명을 읽었어요/); assert.match(m, /예약 환자 2명/); assert.match(m, /기록지 미작성: 이지선$/m);
  assert.match(await o.p.evaluate(() => document.getElementById('np_text').value), /허연우\t010-8920-0708\t102746/);
  assert.deepStrictEqual(o.errors, []); await o.ctx.close();
});

test('초진 찾기 칸: 표 글자와 그림이 같이 들어 있으면 글자를 씀 (예약일자 칸의 시간·승인완료도 읽음)', async () => {
  const log = [], o = await open(b, page('visit-notice.html'), { storage, api: api(log) });
  const tsv = ['선택\t예약타입\t예약상태\t차트번호\t예약상품\t예약ID\t예약일자\t플랫폼\t이름\t전화번호', '\t예약\t승인완료\t\t하재욱 원장\tLyx-6k0L\t' + TMR + ' 10:00:00\t네이버\t이지선\t010-7271-0392', '\t예약\t취소\t100691\t하재욱 원장\tQkN-fHjn\t' + TMR + ' 10:10:00\t네이버\t박세진\t010-7334-8186'].join('\n');
  await paste(o.p, '#np_text', tsv); await o.p.waitForTimeout(1200);
  assert.ok(!log.includes('readbookingimage'), '글자가 있는데 그림을 AI로 읽음');
  assert.match(await msg(o.p, '#np_msg'), /^예약 환자 1명/);
  const t = await o.p.evaluate(() => npParse(document.getElementById('np_text').value).map(r => r.name + '|' + r.time + '|' + r.arrived));
  assert.deepStrictEqual(t, ['이지선|10:00|false']);
  await o.ctx.close();
});

test('AI를 못 쓰면 표 복사 방법을 안내 (엑셀 오류 문구 대신)', async () => {
  const log = [], o = await open(b, page('visit-notice.html'), { storage, api: api(log, true) });
  await paste(o.p, '#np_text'); await o.p.waitForTimeout(1200);
  const m = await msg(o.p, '#np_msg');
  assert.match(m, /캡처\(사진\)를 읽지 못했어요 — AI 키가 없어요/); assert.match(m, /Ctrl\+C로 복사/); assert.doesNotMatch(m, /엑셀을 읽지 못했어요/);
  await o.ctx.close();
});

test('예약 환자 올리기 칸: 캡처도 읽어 올림 · 명부 칸은 캡처를 받지 않고 안내', async () => {
  const log = [], o = await open(b, page('visit-notice.html'), { storage, api: api(log) });
  await paste(o.p, '.tr_text'); await o.p.waitForTimeout(1500);
  const tr = await msg(o.p, '.tr_say');
  assert.match(tr, /캡처에서 2명을 읽었어요/); assert.match(tr, /예약 2명 올렸어요/); assert.doesNotMatch(tr, /시간 없는/);
  assert.ok(log.includes('todayresv'), '서버에 예약 명단을 올리지 않음');
  await paste(o.p, '.cd_text'); await o.p.waitForTimeout(300);
  assert.match(await msg(o.p, '.cd_say'), /캡처\(사진\)로는 올릴 수 없어요/);
  assert.deepStrictEqual(o.errors, []); await o.ctx.close();
});
