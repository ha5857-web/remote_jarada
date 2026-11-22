// flow에서 원장이 확인한 성장 리포트 → 원장 앱 환자는 「AI 초안」 대기에서 빠지고 「성장리포트 발송」으로 표시
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const storage = { jrd_api_url: API, jrd_auth_token: 'doctor.' + (Date.now() + 1e9) + '.sig', jrd_auth_mode: 'token', jrd_doctor_unlocked: '1' };
test('flow 리포트 완성 → 초안 대기 해제 + 발송 표시', async () => {
  const o = await open(b, page('index.html'), { phone: true, storage });
  const r = await o.p.evaluate(() => {
    const t = todayStr();
    patients.push({ id: 'f1', name: '조하연', chartNo: '100129', sex: 'F', pendingGuideSend: true, guideDraft: { date: t, post: { summary: 'AI 초안' } } });
    const v = { id: 'v1', name: '조하연', chartNo: '100129', date: t, step: 3, gr: { ready: true, reviewed: true, reviewedAt: Date.now(), from: 'flow', post: { summary: '원장 확정 요약' } } };
    const ch = rvFlowSentSync([v]), p = patients.find(x => x.id === 'f1');
    return { ch, pend: p.pendingGuideSend, sent: !!p.guideDraft.sentAt, sum: p.guideDraft.post.summary, badge: guideBadgeHtml(p), again: rvFlowSentSync([v]) };
  });
  assert.strictEqual(r.ch, true); assert.strictEqual(r.pend, false); assert.strictEqual(r.sent, true);
  assert.strictEqual(r.sum, '원장 확정 요약'); assert.match(r.badge, /성장리포트 발송/); assert.strictEqual(r.again, false);
  await o.close && o.close();
});
