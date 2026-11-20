// 📌 이 파일은 Apps Script 프로젝트 「자라다 케어」에 올린 ForeignIntake.gs 의 사본입니다(2026-11-20, 배포 버전 109). Code.gs 의 listintakes 가 listAllIntakes_ 를 부릅니다.
/* ============================================================
 * [외국어 초진기록지] 한국어 기록지 + 10개 외국어 기록지(응답_EN … 응답_ZT 탭)를
 * 원무과·원장 화면의 "새 초진 기록지" 목록에 한 번에 보여줍니다.  (2026-11-20)
 * ============================================================
 * - 'listintakes' 요청이 이 함수(listAllIntakes_)를 부릅니다. (Code.gs 의 listFirstVisitIntakes_ 는 그대로 둠)
 * - 외국어 기록지 행에는 lang·intl 표시와 함께, 화면이 읽기 쉽도록 끝에
 *   ⟦해외 EN | 이름: … | 전화: … | 이메일: … | 메신저: … | ID: …⟧ 한 칸을 덧붙입니다.
 * - 이미 접수한 행 표시(type='intakeDone', id='intk:'+응답 시각)는 한국어 기록지와 같습니다.
 */
var FOREIGN_INTAKE_TABS = {
  en: 287914477, zh: 1365733062, zt: 988841108, ja: 116531373, vi: 1758975616,
  th: 1481714266, id: 817484798, es: 769811866, ar: 1439195966, mn: 1103961280
};

function listAllIntakes_(sheet) {
  var out = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var ss = SpreadsheetApp.openById(INTAKE_SHEET_ID);
    // 이미 접수된 행 (Data 시트는 한 번만 읽음)
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var idCol = headers.indexOf('id'), typeCol = headers.indexOf('type');
    var done = {};
    for (var i = 1; i < values.length; i++) {
      if (values[i][typeCol] === 'intakeDone') done[String(values[i][idCol])] = true;
    }
    var tabs = [['ko', INTAKE_SHEET_GID]];
    Object.keys(FOREIGN_INTAKE_TABS).forEach(function (k) { tabs.push([k, FOREIGN_INTAKE_TABS[k]]); });
    var items = [], missing = [];
    tabs.forEach(function (t) {
      var lang = t[0], sh = ss.getSheetById(t[1]);
      if (!sh) { if (lang === 'ko') sh = ss.getSheets()[0]; else { missing.push(lang); return; } }
      var last = sh.getLastRow();
      if (last < 2) return;
      var start = Math.max(2, last - INTAKE_LIST_MAX_ROWS + 1);
      var width = sh.getLastColumn();
      var rows = sh.getRange(start, 1, last - start + 1, width).getDisplayValues();
      var stamps = sh.getRange(start, 1, last - start + 1, 1).getValues();
      var col = null;
      if (lang !== 'ko') col = foreignIntakeCols_(sh.getRange(1, 1, 1, width).getDisplayValues()[0]);
      for (var r = rows.length - 1; r >= 0; r--) {
        var key = String(rows[r][0] || '').trim();
        if (!key || done['intk:' + key.slice(0, 120)]) continue;
        var raw = rows[r].join('\t');
        if (raw.length > 7400) raw = raw.slice(0, 7400);
        var ts = (stamps[r][0] instanceof Date) ? stamps[r][0].getTime() : 0;
        var it = { key: key, raw: raw, ts: ts };
        if (lang !== 'ko') {
          var g = function (k) { return col[k] >= 0 ? String(rows[r][col[k]] || '').replace(/[|⟦⟧\t\r\n]+/g, ' ').trim() : ''; };
          var f = { name: g('name'), dob: g('dob'), phone: g('phone'), email: g('email'), apps: g('apps'), appId: g('appId') };
          it.lang = lang; it.intl = true; it.f = f;
          it.raw = raw + '\t⟦해외 ' + lang.toUpperCase() + ' | 이름: ' + f.name + ' | 전화: ' + f.phone + ' | 이메일: ' + f.email +
            ' | 메신저: ' + f.apps + ' | ID: ' + f.appId + '⟧';
        }
        items.push(it);
      }
    });
    items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });   // 최신 순 (모든 언어 섞어서)
    return out({ status: 'ok', items: items, missingTabs: missing,
      template: PropertiesService.getScriptProperties().getProperty('SOLAPI_FIRSTVISIT_TEMPLATE_ID') ? 'new' : 'default' });
  } catch (err) {
    return out({ status: 'error', message: '응답 시트를 읽지 못했습니다: ' + err.message });
  }
}

// 외국어 기록지 머리글에서 "1." 이름, "2." 생년월일, "19." 전화, "20." 이메일, "21." 메신저, "22." 메신저 ID 칸을 찾습니다.
function foreignIntakeCols_(head) {
  var find = function (n) {
    for (var c = 1; c < head.length; c++) { if (new RegExp('^\\s*' + n + '\\s*[.．]').test(String(head[c]))) return c; }
    return -1;
  };
  return { name: find(1), dob: find(2), phone: find(19), email: find(20), apps: find(21), appId: find(22) };
}

// 편집기에서 직접 실행해 확인용: 실행 로그에 언어별 건수가 나옵니다.
function testListAllIntakes() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var o = JSON.parse(listAllIntakes_(sheet).getContent());
  var by = {};
  (o.items || []).forEach(function (it) { var k = it.lang || 'ko'; by[k] = (by[k] || 0) + 1; });
  Logger.log('status=' + o.status + ' total=' + (o.items || []).length + ' byLang=' + JSON.stringify(by) + ' missing=' + JSON.stringify(o.missingTabs || []) + (o.message ? ' msg=' + o.message : ''));
  var f = (o.items || []).filter(function (it) { return it.intl; })[0];
  if (f) Logger.log('sample intl: ' + JSON.stringify({ key: f.key, lang: f.lang, f: f.f }));
}
