// 키 입력 즉시 반응(지난 기록 대비·연 속도·백분위) + 원장 「확인 ✓ + 한마디」 → 보호자 앱에 표시
const test = require('node:test'), assert = require('node:assert');
const { chromium, open, page, API, doctorToken } = require('../lib/h');
let b; test.before(async () => { b = await chromium.launch(); }); test.after(async () => { await b.close(); });
const PID = 'abcdefghij0123456789';

test('보호자: 입력하면 바로 +cm·연 속도·또래 순서, 원장 확인 뒤 ✓와 한마디(언어별)', async () => {
  const rows = [{ id: 'm_old', pid: PID, type: 'measurement', date: '2026-08-01', height: '130.0', timestamp: '2026-08-01T01:00:00Z' }];
  const o = await open(b, page('자라다케어_환아용.html?pid=' + PID + '&api=' + encodeURIComponent(API) + '&dob=2016-05-10&sex=F'), {
    phone: true, storage: { jrd_lang: 'ko' },
    api: q => {
      if (q.method === 'GET') return rows;
      if (q.body && q.body.type === 'measurement' && !q.body.action) { rows.push(Object.assign({ timestamp: '2026-11-10T01:00:00Z' }, q.body)); return { status: 'ok' }; }
      return undefined;
    }
  });
  o.p.on('dialog', d => d.accept());
  await o.p.evaluate(() => { switchTab('measure'); document.getElementById('m_date').value = '2026-11-10'; document.getElementById('m_height').value = '131.8'; });
  await o.p.evaluate(() => submitMeasurement());
  await o.p.waitForTimeout(500);
  let txt = await o.p.evaluate(() => document.getElementById('mfbCard').innerText);
  assert.match(txt, /방금 입력/); assert.match(txt, /\+1\.8cm/); assert.match(txt, /101일 사이/);
  assert.match(txt, /약 6\.5cm/); assert.match(txt, /또래 100명 중 작은 쪽부터 \d+번째 \(지난번 \d+번째\)/); assert.match(txt, /원장님이 확인하면/);

  rows.push({ id: 'a1', pid: PID, type: 'answer', refId: rows[1].id, answer: '[[ack:good]]' });
  await o.p.evaluate(() => loadPastMeasurements()); await o.p.waitForTimeout(300);
  txt = await o.p.evaluate(() => document.getElementById('mfbCard').innerText);
  assert.match(txt, /✓ 원장 확인 · 잘 크고 있어요/);
  assert.match(await o.p.evaluate(() => document.getElementById('pastMeasureList').innerText), /✓ 원장 확인/);
  await o.p.evaluate(() => { localStorage.setItem('jrd_lang', 'en'); mfbRender(); });
  txt = await o.p.evaluate(() => document.getElementById('mfbCard').innerText);
  assert.match(txt, /Checked by the doctor · Growing well/); assert.match(txt, /101 days apart/);

  // 키가 줄면 놀라지 않게 측정 요령 안내
  rows.push({ id: 'm_new2', pid: PID, type: 'measurement', date: '2026-11-20', height: '131.5', timestamp: '2026-11-20T01:00:00Z' });
  await o.p.evaluate(() => { localStorage.setItem('jrd_lang', 'ko'); return loadPastMeasurements(); }); await o.p.waitForTimeout(300);
  txt = await o.p.evaluate(() => document.getElementById('mfbCard').innerText);
  assert.match(txt, /-0\.3cm/); assert.match(txt, /맨발로 벽에 붙어/); assert.ok(!/방금 입력/.test(txt));
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});

test('원장: 대기 목록에서 한마디 한 번 → 보호자에게 확인 전송 + 차트 반영 + 목록에서 빠짐', async () => {
  const pt = { id: 'pt1', name: '해외아이', sex: 'F', dob: '2016-05-10', accessCode: PID, careCategory: 'overseas', category: 'overseas', updatedAt: '2026-11-01T00:00:00.000Z',
    records: [{ id: 'r1', date: '2026-08-01', height: 130.0, callDone: false }] };
  const rows = [{ id: 'm1', pid: PID, type: 'measurement', date: '2026-11-10', height: '131.8', weight: '28.1', timestamp: '2026-11-10T01:00:00Z' }];
  const posts = [];
  const o = await open(b, page('index.html'), {
    storage: { jrd_api_url: API, jrd_auth_token: doctorToken(), jrd_auth_mode: 'token', jrd_doctor_unlocked: '1', jrd_remote_gh_patients_v1: JSON.stringify([pt]) },
    api: q => {
      if (q.method === 'GET') return /[?&]file=/.test(q.url) ? undefined : rows;
      if (q.body && q.body.type === 'answer') { posts.push(q.body); rows.push(q.body); return { status: 'ok' }; }
      return undefined;
    }
  });
  o.p.on('dialog', d => d.accept());
  const cat = await o.p.evaluate(() => getPatientCategory(getPatient('pt1')));
  await o.p.evaluate(() => renderPendingMeasurements()); await o.p.waitForTimeout(300);
  const list = await o.p.evaluate(() => document.getElementById('pendingMeasureList').innerText);
  if (cat === 'overseas') {
    assert.match(list, /지난 기록\(.*101일 전\)보다 \+1\.8cm · 연 6\.5cm 속도 · 백분위 \d+ \(지난번 \d+\)/);
    await o.p.evaluate(() => document.querySelector('#pendingMeasureList .mack-chip').click());   // 대시보드 칸이 접혀 있어도 누름
    await o.p.waitForTimeout(400);
    assert.match(await o.p.evaluate(() => document.getElementById('pendingMeasureList').innerText), /확인 대기 중인 키\/몸무게 기록이 없습니다/);
  } else {
    await o.p.evaluate(() => measAck('pt1', 'm1', '2026-11-10', '131.8', '28.1', 'good'));
  }
  assert.strictEqual(posts.length, 1);
  assert.deepStrictEqual({ pid: posts[0].pid, refId: posts[0].refId, answer: posts[0].answer }, { pid: PID, refId: 'm1', answer: '[[ack:good]]' });
  const st = await o.p.evaluate(() => { const p = getPatient('pt1'); return { recs: p.records.map(r => r.date + ':' + r.height + '/' + (r.weight || '')).sort(), applied: p.appliedInboxIds }; });
  assert.deepStrictEqual(st.recs, ['2026-08-01:130/', '2026-11-10:131.8/28.1']); assert.deepStrictEqual(st.applied, ['m1']);
  // 상세 제출함: 보낸 한마디가 보임 (두 번 보내지 않게 버튼 대신 표시)
  await o.p.evaluate(() => { currentPatientId = 'pt1'; return renderInbox(getPatient('pt1'), true); }); await o.p.waitForTimeout(300);
  const inbox = await o.p.evaluate(() => document.getElementById('inboxList').innerText);
  assert.match(inbox, /✓ 보호자에게 확인 보냄 · 잘 크고 있어요/);
  assert.deepStrictEqual(o.errors, []);
  await o.ctx.close();
});
