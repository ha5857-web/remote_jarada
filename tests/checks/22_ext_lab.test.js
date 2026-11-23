// 수탁검사(미량원소·PCR·알러지·소변) 항목만 추려내기
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' };
test('수탁검사 항목 추출', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  const r = await o.p.evaluate(() => {
    const rows = [
      ['[챠트번호] 100123 [수진자명] 홍길동'], ['검사일자', '2026-11-20'],
      ['', 'Calcium (칼슘)', '9.8', 'mg/dL', '8.8-10.8', ''],
      ['', '아연 Zinc', '62', 'ug/dL', '70-120', 'L'],
      ['', 'GH', '3.2', 'ng/mL', '0-10', ''],
      ['', 'Mycoplasma PCR', '음성', '', '', ''],
      ['', '소변 단백', '-', '', '', ''],
      ['[챠트번호] 100124 [수진자명] 김철수'], ['', 'MAST 알러지 집먼지진드기', 'class 2', '', '', '']
    ];
    const list = parseExtLabRows([rows]);
    return { n: list.length, g1: Object.keys(list[0].items), t: extLabChartText(list[0]), g2: Object.keys(list[1].items), d: list[0].examDate };
  });
  assert.strictEqual(r.n, 2);
  assert.deepStrictEqual(r.g1.sort(), ['PCR', '미량원소', '소변'].sort());
  assert.ok(/아연 Zinc: 62 ug\/dL \(기준 70-120\) \[L\]/.test(r.t), r.t);
  assert.ok(!/GH/.test(r.t));
  assert.deepStrictEqual(r.g2, ['알러지']);
  assert.strictEqual(r.d, '2026-11-20');
});
