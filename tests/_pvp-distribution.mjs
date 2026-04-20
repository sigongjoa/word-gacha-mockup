import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://sigongjoa.github.io/word-gacha-mockup/baseball-pvp.html', { waitUntil: 'networkidle' });
const counts = { '직구': 0, '슬라이더': 0, '커브': 0, other: 0 };
const seq = [];
for (let i = 0; i < 25; i++) {
  try {
    await p.waitForSelector('.choice:not([disabled])', { timeout: 8000 });
  } catch { break; }
  const ptype = (await p.textContent('#ptype')).trim();
  seq.push(ptype);
  if (ptype.includes('직구')) counts['직구']++;
  else if (ptype.includes('슬라이더')) counts['슬라이더']++;
  else if (ptype.includes('커브')) counts['커브']++;
  else counts.other++;
  // click wrong on purpose sometimes to vary count state
  const idx = (i % 4) + 1;
  try { await p.click(`.choice:nth-child(${idx})`); } catch {}
  await p.waitForTimeout(2200);
}
console.log('seq:', seq);
console.log('counts:', counts);
await b.close();
