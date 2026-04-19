import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:8765/baseball-pvp.html');
// Collect 3 pitches (at least one of each type) by repeatedly answering
const seen = new Set();
for (let i=0; i<15 && seen.size < 3; i++) {
  await p.waitForSelector('.choice:not([disabled])', { timeout: 6000 });
  const ptype = await p.textContent('#ptype');
  seen.add(ptype.trim());
  console.log('pitch', i, ':', ptype.trim());
  await p.click('.choice:nth-child(1)');
  await p.waitForTimeout(2200);
}
console.log('seen categories:', [...seen]);
if (!seen.has('⚾ 직구 · 어휘') && !seen.has('⚾ 슬라이더 · 문법') && !seen.has('⚾ 커브 · 빈칸')) {
  console.log('FAIL: no category labels found');
  process.exit(1);
}
console.log('OK');
await b.close();
