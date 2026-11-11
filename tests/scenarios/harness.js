// flow.html 성장 리포트 최소 클릭 흐름 — 모의 서버로 실제 브라우저에서 확인

const fs = require('fs'), path = require('path');
const FLOW = process.argv[2];
const OUT = process.argv[3];
const NM = path.join(__dirname,'..','node_modules');
const LIBS = {
  'qrcode-generator@1.4.4/qrcode.js': NM + '/qrcode-generator/qrcode.js',
  'three@0.128.0/build/three.min.js': NM + '/three/build/three.min.js',
  'html2canvas/1.4.1/html2canvas.min.js': NM + '/html2canvas/dist/html2canvas.min.js',
  'jspdf/2.5.1/jspdf.umd.min.js': NM + '/jspdf/dist/jspdf.umd.min.js',
};
const d = new Date(), pad = n => (n < 10 ? '0' : '') + n;
const TODAY = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const now = Date.now(), M = 60000;
const base = () => ({ intake: { chief: '', purpose: '성장 평가', fatherH: '', motherH: '', history: '', signs: '', consent: false },
  measure: { height: '', weight: '' }, xray: { part: '왼손 정면 (골연령)', done: false, note: '' },
  lab: { items: ['원내검사'], drawn: false, results: {}, proto: 'single', t0: null, draws: [], ext: {}, at: {} },
  review: { boneAge: '', note: '', next: '' }, exit: { paid: false, guide: false }, report: { sent: false } });
const V = (o) => Object.assign({ sv: 2, card: '', appt: '', log: [], createdAt: now - 90 * M, updatedAt: now - 60 * M, date: TODAY, rev: true }, base(), o);
const DB = new Map();
[
  V({ id: 'p1', name: '홍지우', age: 7, sex: '여', chartNo: '101834', appt: '10:00', step: -1, dob: '2019-03-02' }),
  V({ id: 'p2', name: '노시온', age: 10, sex: '남', chartNo: '101700', appt: '10:10', step: 7, dob: '2016-05-11', log: [{ s: 0, t: now - 50 * M }, { s: 7, t: now - 5 * M }] }),
  V({ id: 'p3', name: '안유주', age: 9, sex: '여', chartNo: '102304', appt: '10:20', step: 6, dob: '2017-01-20', lab: Object.assign(base().lab, { drawn: true }), log: [{ s: 0, t: now - 40 * M }, { s: 5, t: now - 20 * M }, { s: 6, t: now - 10 * M }] }),
  V({ id: 'p4', name: '이규현', age: 13, sex: '남', chartNo: '101707', appt: '10:30', step: 7, dob: '2013-02-14', gr: { q: { blood: false, xray: true } }, xray: { part: '왼손', done: true, note: '' }, log: [{ s: 0, t: now - 30 * M }, { s: 4, t: now - 20 * M }, { s: 7, t: now - 2 * M }] }),
].forEach(v => DB.set(v.id, v));
function setPath(o, k, val) { const p = k.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (!x[p[i]] || typeof x[p[i]] !== 'object') x[p[i]] = {}; x = x[p[i]]; } if (val === null) delete x[p[p.length - 1]]; else x[p[p.length - 1]] = val; }
const calls = [];
function handle(body) {
  calls.push(body.action);
  switch (body.action) {
    case 'flowlist': return { status: 'ok', visits: [...DB.values()] };
    case 'flowsave': { let v = DB.get(body.id); if (!v) { v = { id: body.id }; DB.set(body.id, v); } Object.entries(body.patch).forEach(([k, val]) => setPath(v, k, val)); return { status: 'ok' }; }
    case 'flowprepare': return { status: 'ok', source: 'patient', identity: {} };
    case 'generatefirstvisitchart': return { via: 'jarada-codegs', status: 'ok', data: {
      summary: '오늘은 1년 동안의 키 성장을 확인했어요. 또래 중간 정도로 잘 자라고 있습니다.', labs: '', xray: '뼈나이는 실제 나이와 비슷해요.',
      direction: '지금처럼 생활하면서 6개월 뒤 다시 키를 재 보아요.', exercise: '줄넘기 하루 10분', nutrition: '우유 하루 2잔', sleep: '밤 10시 전에 잠들기' } };
    default: return { status: 'ok' };
  }
}
const chart = (no, name, extra) => `${no ? '등록번호 ' + no + '  ' : ''}${name ? name + ' ' : ''}
# CA/BA: (10.5)/(10.3)
# Image finding: 특이 소견 없음
# Plan: ${extra || '6개월 후 f/u, 생활습관 교정'}
등록일자\tAGE\tBA\tWT\tHT\tBMI
2025-11-05\t9.06\t\t30.1(45.2)\t134.0(48.1)\t16.8(44.0)
${TODAY}\t10.05\t10.03\t33.4(47.0)\t139.6(50.2)\t17.1(46.3)
`;

module.exports={FLOW,OUT,LIBS,handle};
