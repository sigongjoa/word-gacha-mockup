import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://sigongjoa.github.io/word-gacha-mockup/baseball-pvp.html', { waitUntil: 'networkidle' });
const seen = new Set();
for (let i=0; i<20 && seen.size < 3; i++) {
  await p.waitForSelector('.choice:not([disabled])', { timeout: 8000 });
  const ptype = await p.textContent('#ptype');
  const prompt = await p.textContent('#promptText');
  console.log(i, ptype.trim(), '|', prompt.slice(0, 50));
  seen.add(ptype.trim());
  await p.click('.choice:nth-child(1)');
  await p.waitForTimeout(2400);
}
console.log('live deployed — seen:', [...seen]);
await b.close();
