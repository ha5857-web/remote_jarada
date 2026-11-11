// 서버(Security.gs)를 시험용 가짜 시트 위에서 그대로 돌립니다. Security.gs 는 저장소에 없으므로(Apps Script 에만 있음)
// SECURITY_GS=경로 로 알려 주거나 server/Security.gs 가 있을 때만 씁니다. 없으면 null → 그 시험은 건너뜁니다.
const fs = require('fs'), path = require('path');
function find() {
  const c = [process.env.SECURITY_GS, path.join(__dirname, '..', '..', 'server', 'Security.gs')].filter(Boolean);
  return c.find(p => fs.existsSync(p)) || null;
}
function load() {
  const file = find(); if (!file) return null;
  const props = { DOCTOR_APP_PASSWORD: 'doc-pw-1', STAFF_APP_PASSWORD: 'staff-pw-1', TOKEN_SECRET: 'sec' }, cache = {};
  const store = { chunks: [], saves: 0, gets: 0, clock: Date.parse('2026-11-11T00:00:00Z') };   // doctordata 조각 행
  const hooks = { ai: () => ({ code: 500, body: '' }) };
  const out = t => ({ t, setMimeType() { return this; }, getContent() { return this.t; } });
  const env = {
    Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 10), sleep() {}, base64EncodeWebSafe: x => String(x), computeHmacSha256Signature: (a, b) => String(a + '|' + b).replace(/[^A-Za-z0-9]/g, '_'), getUuid: () => 'u' + Math.random().toString(36).slice(2) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props), getKeys: () => Object.keys(props) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: out },
    getSheet_: () => ({ getDataRange: () => ({ getValues: () => [['id', 'pid', 'type', 'date', 'question']] }) }),
    legacyDoGet_: e => { store.gets++; const k = e.parameter.key; return out(JSON.stringify(store.chunks.filter(r => r.pid === k))); },
    legacyDoPost_: e => {
      const b = JSON.parse(e.postData.contents);
      if (b.action === 'savedoctordata') {
        store.saves++; store.clock += 1000; const ts = new Date(store.clock).toISOString(), parts = [];
        for (let i = 0; i < b.data.length; i += 40000) parts.push(b.data.slice(i, i + 40000));
        if (!parts.length) parts.push('');
        store.chunks = store.chunks.filter(r => r.pid !== b.key).concat(parts.map((q, i) => ({ id: 'c' + store.saves + '_' + i, pid: b.key, type: 'doctordata', refId: String(i), answer: String(parts.length), timestamp: ts, question: q })));
        return out(JSON.stringify({ status: 'ok', chunks: parts.length }));
      }
      return out(JSON.stringify({ status: 'ok', legacy: b.action || 'append' }));
    },
    flowMe_: () => out('{"status":"ok","visit":null}'),
    UrlFetchApp: { fetch: (url, opt) => { const r = hooks.ai(url, opt); return { getResponseCode: () => r.code, getContentText: () => r.body }; } }
  };
  const names = Object.keys(env);
  const G = new Function(...names, fs.readFileSync(file, 'utf8') + '\nreturn {doPost,doGet,signToken_:typeof signToken_==="function"?signToken_:null};')(...names.map(n => env[n]));
  const post = b => JSON.parse(G.doPost({ parameter: {}, postData: { contents: JSON.stringify(b) } }).getContent());
  const get = q => JSON.parse(G.doGet({ parameter: q }).getContent());
  const login = pw => post({ action: 'login', password: pw });
  const cloud = key => { const r = store.chunks.filter(x => x.pid === key).sort((a, b) => a.refId - b.refId); return r.length ? JSON.parse(r.map(x => x.question).join('')) : null; };
  const setCloud = (key, list) => env.legacyDoPost_({ postData: { contents: JSON.stringify({ action: 'savedoctordata', key, data: JSON.stringify(list) }) } });
  return { post, get, login, store, cloud, setCloud, props, cache, file, hooks };
}
module.exports = { load, find };
