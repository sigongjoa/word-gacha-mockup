import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://sigongjoa.github.io/word-gacha-mockup/baseball-pvp.html', { waitUntil: 'networkidle' });
const hasHangul = s => /[\uac00-\ud7af]/.test(s);
const hasLatin  = s => /[a-zA-Z]/.test(s);
for (let i = 0; i < 15; i++) {
  try { await p.waitForSelector('.choice:not([disabled])', { timeout: 8000 }); } catch { break; }
  const ptype = (await p.textContent('#ptype')).trim();
  const opts = await p.$$eval('.choice', bs => bs.map(x => x.textContent.trim()));
  const allHan = opts.every(o => hasHangul(o) && !hasLatin(o.replace(/^\d+\.\s*/,'')));
  const allLat = opts.every(o => hasLatin(o.replace(/^\d+\.\s*/,'')) && !hasHangul(o));
  console.log(i, ptype, '→', allHan ? 'KO' : allLat ? 'EN' : 'MIX', JSON.stringify(opts));
  await p.click('.choice:nth-child(1)');
  await p.waitForTimeout(2200);
}
await b.close();
