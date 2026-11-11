// 전체 시험 실행: ① checks/ (규칙 확인)  ② scenarios/ (실제 화면을 처음부터 끝까지 눌러 보는 시나리오)
// 쓰는 법:  cd tests && npm ci && npx playwright install chromium && npm test
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;

console.log('━━ ① 규칙 확인 (checks/) ━━');
const files = fs.readdirSync(path.join(__dirname, 'checks')).filter(f => f.endsWith('.test.js')).sort().map(f => path.join('checks', f));
const c = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec', ...files], { cwd: __dirname, stdio: 'inherit' });
if (c.status !== 0) failed++;

console.log('\n━━ ② 화면 시나리오 (scenarios/) ━━');
const ARGS = { flow: [path.join(ROOT, 'flow.html'), OUT], 'flow+index': [path.join(ROOT, 'flow.html'), path.join(ROOT, 'index.html'), OUT] };
const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios', 'list.json'), 'utf8'));
for (const s of list) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join('scenarios', s.file), ...ARGS[s.args || 'flow']], { cwd: __dirname, encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const errLines = out.split('\n').filter(l => /^\s*(page )?err(or)?s\b/i.test(l) && !/\[\s*\]\s*$/.test(l.trim()));
  const bad = r.status !== 0 || /^FAIL\b/m.test(out) || errLines.length > 0;
  console.log((bad ? '✗ ' : '✓ ') + s.name + '  (' + Math.round((Date.now() - t0) / 1000) + '초)');
  if (bad) { failed++; console.log(out.split('\n').slice(-25).join('\n')); }
}
console.log(failed ? '\n✗ 실패한 묶음 ' + failed + '개' : '\n✓ 모두 통과');
process.exit(failed ? 1 : 0);
