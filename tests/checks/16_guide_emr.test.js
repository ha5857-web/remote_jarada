// 진료 후 안내 초안 고치기 창: EMR 엑셀로 올린 차트(환아 메모의 「— 원본 메모 —」)를 위에 보여 줌 — 진료 다음 날 확인해도 그대로
// 예전엔 records[].chartNoteRaw 만 찾아서, 엑셀로 올린 아이는 AI 초안이 있는데도 「EMR 차트가 아직 없어요」가 떴음
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' };
const CHART = ['#주소: 키 성장 상담', 'O) Ht 140.3 Wt 33.0', '#SMR: T2 (testis 4cc)', '#CA/BA: 9Y11M / 12Y10M', '#PAH: 166.2', '#Plan: LH/FSH 자극검사 예약', 'P) 3개월 후 재방문'].join('\n');
const ADDED = '[진찰·영상 소견]\n#SMR: T2 (testis 4cc)\n#CA/BA: 9Y11M / 12Y10M\n\n[플랜]\nLH/FSH 자극검사 예약';
const kid = (id, extra) => Object.assign({ id, name: '김도윤', chartNo: '102369', sex: 'M', dob: '2016-12-20', notes: 'PAH(예측 성인키): 166.2cm\n— 원본 메모 —\n' + CHART,
  records: [{ id: 'r1', date: '2026-11-21', height: 140.3, weight: 33 }], pendingGuideSend: true,
  guideDraft: { date: '2026-11-21', kind: 'first', ai: true, count: 3, post: { summary: '오늘 진찰에서 고환 크기(4cc)…', labs: '', xray: '뼈나이 12세 10개월', direction: '', nextDate: '', exercise: '', nutrition: '', sleep: '' } } }, extra || {});

test('EMR 엑셀로 올린 아이: 다음 날 열어도 차트가 보이고, AI가 근거로 쓴 줄을 「새로 쓴 줄」로 보여 줌', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  await o.p.evaluate(([k1, k2]) => { patients.push(k1, k2); guideEdit(k1.id); }, [kid('g1', { guideDraft: Object.assign(kid('x').guideDraft, { added: ADDED }) }), kid('g2', { name: '이전초안', chartNo: '102370' })]);
  await o.p.waitForTimeout(300);
  const head = (await o.p.locator('#ge_emr').innerText()).replace(/\s+/g, ' ');
  assert.doesNotMatch(head, /아직 없어요/);
  assert.match(head, /EMR 차트 2026\.11\.21 · 새로 쓴 3줄/);
  await o.p.evaluate(() => document.querySelector('#ge_emr [data-emr="tog"]').click()); await o.p.waitForTimeout(150);
  const nw = (await o.p.locator('#ge_emr .emr-txt').innerText()).split('\n').map(s => s.trim()).filter(Boolean);
  assert.deepStrictEqual(nw, ['[진찰·영상 소견]', '#SMR: T2 (testis 4cc)', '#CA/BA: 9Y11M / 12Y10M', '[플랜]', 'LH/FSH 자극검사 예약']);
  await o.p.evaluate(() => document.querySelector('#ge_emr [data-emr="all"]').click()); await o.p.waitForTimeout(150);
  assert.strictEqual(await o.p.locator('#ge_emr .emr-l').count(), 7, '전체 차트 7줄');
  assert.strictEqual(await o.p.locator('#ge_emr .emr-l.nw').count(), 3, '전체 차트에서 새로 쓴 3줄(#Plan 포함)을 노랗게');
  // 근거 줄을 기억하지 않는 예전 초안: 전체 차트를 보여 줌
  await o.p.evaluate(() => { GE_EMR.open = false; GE_EMR.all = false; guideEdit('g2'); }); await o.p.waitForTimeout(300);
  assert.match((await o.p.locator('#ge_emr').innerText()).replace(/\s+/g, ' '), /EMR 차트 2026\.11\.21 · 전체 7줄/);
  // 차트가 정말 없는 아이만 「아직 없어요」
  await o.p.evaluate(() => { patients.push({ id: 'g3', name: '차트없음', notes: '', records: [], pendingGuideSend: true, guideDraft: { date: '2026-11-21', post: {} } }); guideEdit('g3'); }); await o.p.waitForTimeout(300);
  assert.match(await o.p.locator('#ge_emr').innerText(), /EMR 차트가 아직 없어요/);
  assert.deepStrictEqual(o.errors, []); await o.ctx.close();
});

test('초안을 새로 만들면 AI가 근거로 쓴 줄을 초안에 같이 저장', async () => {
  const o = await open(b, page('index.html'), { storage: Object.assign({}, storage, { jrd_api_url: '' }) });
  const r = await o.p.evaluate(async (CHART) => {
    const p = { id: 'g9', name: '새초안', chartNo: '102999', sex: 'M', dob: '2016-12-20', notes: '', records: [], firstVisit: { status: 'invited' } };
    const base = '#주소: 키 성장 상담\nO) Ht 140.3 Wt 33.0';
    return await fvGuideBuild(p, CHART, base);
  }, CHART);
  assert.ok(r && !r.skip, '초안을 만들지 못함');
  assert.match(r.added, /#SMR: T2/); assert.match(r.added, /LH\/FSH 자극검사 예약/);
  await o.ctx.close();
});
